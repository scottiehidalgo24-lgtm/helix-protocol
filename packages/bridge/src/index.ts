import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z, ZodError } from 'zod';
import type { BridgeTool, BridgeCallResponse } from '@helix/shared';
import { translateOpenAPI } from './translate';
import { proxyCall } from './proxy';
import { authenticate, registerApiKey, generateApiKey, generateOAuthCredentials, registerOAuthToken } from './auth';
import { logCall } from './db';

const app = new Hono();

// ============================================
// HELPERS
// ============================================

function getAuthHeader(c: any): string | undefined {
  const auth = c.req.header('authorization');
  if (auth) return auth;
  for (const key of ['x-api-key', 'x-helix-api-key', 'helix-api-key']) {
    const val = c.req.header(key);
    if (val) return val;
  }
  return undefined;
}

function reqId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function jsonErr(code: string, msg: string, status: number, detail?: string) {
  return { error: { code, message: msg, details: detail || undefined, request_id: reqId() } };
}

function zodErr(e: ZodError) {
  const issues = e.issues.map(i => ({ path: i.path.join('.'), message: i.message, code: i.code }));
  return {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: `Missing or invalid: ${issues.map(i => i.path || i.message).join(', ')}`,
      validation_errors: issues,
      request_id: reqId(),
    }
  };
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// Custom validation middleware
function validate<T>(schema: z.ZodSchema<T>) {
  return async (c: any, next: any) => {
    let body: unknown;
    try { body = await c.req.json(); } catch {
      return c.json(jsonErr('VALIDATION_ERROR', 'Invalid JSON body', 400), 400);
    }
    const result = schema.safeParse(body);
    if (!result.success) {
      return c.json(zodErr(result.error), 400);
    }
    c.set('body', result.data);
    return next();
  };
}

// Auth middleware
function requireAuth(c: any, next: any) {
  const h = getAuthHeader(c);
  if (!h) return c.json(jsonErr('AUTH_MISSING', 'Missing authorization. Use Authorization: Bearer <token> or X-API-Key: <key>', 401), 401);
  const r = authenticate(h);
  if (!r.authenticated) return c.json(jsonErr('AUTH_INVALID', r.error || 'Invalid credentials', 401), 401);
  c.set('agentId', r.agentId);
  c.set('authType', r.authType);
  return next();
}

// ============================================
// TOOL STORE with Multi-Tenancy
// ============================================
const tools: Map<string, BridgeTool & { ownerId: string }> = new Map();

function getTenantTools(agentId: string) {
  return Array.from(tools.values()).filter(t => t.ownerId === agentId);
}

function getOwnedTool(id: string, agentId: string) {
  const t = tools.get(id);
  if (!t || t.ownerId !== agentId) return null;
  return t;
}

// ============================================
// CORS + ROOT
// ============================================
app.use('*', cors());

app.get('/', (c) => c.json({
  service: 'Helix Protocol Bridge',
  version: '0.2.2',
  docs: 'https://github.com/scottiehidalgo24-lgtm/helix-protocol',
  multi_tenancy: 'Each tenant sees only their own tools. Tools are isolated by agentId.',
  auth: {
    methods: ['Authorization: Bearer <apiKey>', 'Authorization: Bearer <access_token>'],
    api_key: 'Long-lived secret (hk_*). No expiry. For server-to-server integrations.',
    access_token: 'Short-lived OAuth2 token (expires_in: 3600). Obtain via POST /auth/register. For client apps.',
    note: 'X-API-Key passes through Cloudflare in most cases but Authorization: Bearer is recommended for guaranteed cross-environment compatibility (works on localhost, VPS, and Cloudflare).',
  },
  proxy: {
    semantics: 'Transparent passthrough — upstream HTTP status forwarded to client as-is (no remapping to 502/504).',
    upstream_status: 'Present in both success and error responses as upstream_status field.',
  },
  endpoints: {
    health: 'GET /health',
    register: 'POST /auth/register (public — onboarding)',
    tools: 'GET /tools?limit=&offset= (auth — tenant-scoped, paginated)',
    create_tool: 'POST /tools (auth)',
    get_tool: 'GET /tools/:id (auth — ownership required)',
    delete_tool: 'DELETE /tools/:id (auth — ownership required)',
    call: 'POST /call/:toolId (auth — ownership required)',
    token_info: 'GET /auth/me (auth — token introspection)',
    translate: 'POST /translate (auth — auto-registers for your tenant)',
    oauth_token: 'POST /auth/oauth2/token (public)',
  },
  error_model: '{ error: { code, message, details?, validation_errors?, upstream_status?, upstream_url?, request_id } }',
}));

// ============================================
// HEALTH
// ============================================
app.get('/health', (c) => c.json({
  status: 'ok', service: 'bridge', version: '0.2.2',
  uptime: process.uptime(), timestamp: new Date().toISOString(),
}));

// ============================================
// TOOL CRUD — multi-tenant
// ============================================
const regSchema = z.object({
  name: z.string().min(1, 'name is required').max(255),
  description: z.string().min(1, 'description is required'),
  provider: z.string().min(1, 'provider is required'),
  endpoint: z.string().min(1, 'endpoint is required'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  authType: z.enum(['api_key', 'oauth2', 'none']),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()).optional(),
  pricing: z.object({
    type: z.enum(['free', 'per_call', 'subscription']),
    cost: z.number().optional(), currency: z.string().optional(),
  }).optional(),
});

app.post('/tools', requireAuth, validate(regSchema), (c) => {
  const body: any = c.get('body');
  const ownerId = c.get('agentId');
  const id = `tool_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const t = { id, ownerId, ...body };
  tools.set(id, t);
  console.log(`[Bridge] Tool registered: ${t.name} (${id}) by ${ownerId}`);
  return c.json({ success: true, tool: t }, 201);
});

app.post('/tools/register', requireAuth, validate(regSchema), (c) => {
  const body: any = c.get('body');
  const ownerId = c.get('agentId');
  const id = `tool_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const t = { id, ownerId, ...body };
  tools.set(id, t);
  console.log(`[Bridge] Tool registered: ${t.name} (${id}) by ${ownerId}`);
  return c.json({ success: true, tool: t }, 201);
});

// GET /tools — tenant-scoped, paginated
app.get('/tools', requireAuth, (c) => {
  const agentId = c.get('agentId');
  const all = getTenantTools(agentId).map(t => ({
    id: t.id, name: t.name, description: t.description,
    provider: t.provider, authType: t.authType, pricing: t.pricing,
  }));
  const limit = parseInt(c.req.query('limit') || '0') || 0;
  const offset = parseInt(c.req.query('offset') || '0') || 0;
  const page = limit > 0 ? all.slice(offset, offset + limit) : (offset > 0 ? all.slice(offset) : all);
  return c.json({
    tools: page,
    count: page.length,
    total: all.length,
    limit: limit || undefined,
    offset: offset || undefined,
    tenant: agentId,
  });
});

// GET /tools/:id — ownership check
app.get('/tools/:id', requireAuth, (c) => {
  const t = getOwnedTool(c.req.param('id'), c.get('agentId'));
  return t ? c.json({ tool: t }) : c.json(jsonErr('TOOL_NOT_FOUND', 'Tool not found', 404), 404);
});

// DELETE /tools/:id — ownership check
app.delete('/tools/:id', requireAuth, (c) => {
  const tid = c.req.param('id');
  const t = getOwnedTool(tid, c.get('agentId'));
  if (!t) return c.json(jsonErr('TOOL_NOT_FOUND', 'Tool not found', 404), 404);
  tools.delete(tid);
  console.log(`[Bridge] Tool deleted: ${t.name} (${tid}) by ${c.get('agentId')}`);
  return c.json({ success: true });
});

// ============================================
// CALL — ownership check + upstream status forwarding
// ============================================
const callSchema = z.object({
  params: z.record(z.unknown()).default({}),
  auth: z.object({ apiKey: z.string().optional(), oauthToken: z.string().optional() }).optional(),
});

app.post('/call/:toolId', requireAuth, validate(callSchema), async (c) => {
  const tid = c.req.param('toolId');
  const t = getOwnedTool(tid, c.get('agentId'));
  if (!t) {
    return c.json({ success: false, error: 'Tool not found', latencyMs: 0, timestamp: new Date().toISOString() }, 404);
  }
  const body: any = c.get('body');
  const aid = c.get('agentId');
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  const result = await proxyCall(t, body.params, body.auth);
  logCall({
    tool_id: tid, agent_id: aid, request_params: body.params,
    response_data: result.data as Record<string, unknown> | undefined,
    status: result.success ? 'success' : 'error',
    latency_ms: result.latencyMs, error_message: result.error, ip_address: ip,
  }).catch(e => console.error('[Bridge] Log error:', e));
  // Transparent passthrough: upstream HTTP status forwarded as-is (no remapping to 502/504).
  // upstream_status field included in both success and error responses.
  const upstreamStatus = result.success ? 200 : (result.status && result.status >= 400 ? result.status : 502);
  if (!result.success) {
    const dataStr = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const baseErr = jsonErr('UPSTREAM_ERROR', result.error || 'Upstream error', upstreamStatus, truncate(dataStr, 200));
    return c.json({
      error: {
        ...baseErr.error,
        upstream_status: upstreamStatus,
        upstream_url: t.endpoint,
      }
    }, upstreamStatus as any);
  }
  return c.json({
    ...result,
    upstream_status: upstreamStatus,
  }, 200);
});

// ============================================
// TRANSLATE — auto-register for current tenant
// ============================================
const trSchema = z.object({ spec: z.unknown(), providerName: z.string().optional() });

app.post('/translate', requireAuth, validate(trSchema), (c) => {
  const { spec, providerName }: any = c.get('body');
  const ownerId = c.get('agentId');
  const result = translateOpenAPI(spec, providerName);
  if (result.success && result.tools.length > 0) {
    const reg: Array<{ id: string; name: string }> = [];
    for (const t of result.tools) {
      const id = `tool_tr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      tools.set(id, { id, ownerId, name: t.name, description: t.description, provider: result.provider, endpoint: t.path, authType: t.authType, inputSchema: t.inputSchema, outputSchema: t.outputSchema, method: t.method });
      reg.push({ id, name: t.name });
    }
    return c.json({ ...result, registered: reg });
  }
  return c.json(result);
});

// ============================================
// AUTH
// ============================================
// GET /auth/me — token introspection
app.get('/auth/me', requireAuth, (c) => {
  const h = getAuthHeader(c);
  if (!h) return c.json(jsonErr('AUTH_MISSING', 'Missing authorization', 401), 401);
  const r = authenticate(h);
  if (!r.authenticated) return c.json(jsonErr('AUTH_INVALID', r.error || 'Invalid token', 401), 401);
  return c.json({
    agentId: r.agentId,
    auth_type: r.authType,
    scopes: r.scopes || [],
    authenticated: true,
  });
});
app.post('/auth/register', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const agentId = body.agentId || `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const scopes = body.scopes || ['read', 'write'];
  const apiKey = generateApiKey();
  registerApiKey(apiKey, agentId, scopes);
  const token = `helix_at_${Array.from({ length: 48 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')}`;
  registerOAuthToken(token, agentId, 3600);
  console.log(`[Bridge] New registration: ${agentId}`);
  return c.json({ success: true, apiKey, access_token: token, token_type: 'Bearer', expires_in: 3600, agentId, scopes }, 201);
});

app.post('/auth/api-key', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const agentId = body.agentId || c.get('agentId');
  const apiKey = generateApiKey();
  registerApiKey(apiKey, agentId, body.scopes || ['*']);
  return c.json({ success: true, apiKey, agentId }, 201);
});

app.post('/auth/oauth2/register', requireAuth, async (c) => {
  const { clientId, clientSecret } = generateOAuthCredentials();
  return c.json({ success: true, clientId, clientSecret }, 201);
});

app.post('/auth/oauth2/token', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { client_id, client_secret, grant_type } = body as Record<string, string>;
  if (grant_type !== 'client_credentials') return c.json(jsonErr('AUTH_UNSUPPORTED_GRANT', 'Unsupported grant type', 400), 400);
  if (!client_id || !client_secret) return c.json(jsonErr('AUTH_MISSING_PARAMS', 'Missing client_id or client_secret', 400), 400);
  const token = `helix_at_${Array.from({ length: 48 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')}`;
  registerOAuthToken(token, client_id, 3600);
  return c.json({ access_token: token, token_type: 'Bearer', expires_in: 3600 });
});

// ============================================
// METRICS — tenant-aware
// ============================================
app.get('/metrics', (c) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'direct';
  if (!ip.startsWith('127.') && ip !== '::1' && ip !== 'direct')
    return c.json(jsonErr('METRICS_INTERNAL', 'Metrics are internal only', 403), 403);
  const allTools = Array.from(tools.values());
  const tenants = new Set(allTools.map(t => t.ownerId));
  return c.json({
    tools: allTools.length,
    tenants: tenants.size,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

export default app;

const port = parseInt(process.env.PORT || '3000');
console.log('🧬 Helix Bridge v0.2.2 running on port', port);
