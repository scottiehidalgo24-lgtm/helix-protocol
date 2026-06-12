import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { BridgeTool, BridgeCallResponse } from '@helix/shared';
import { translateOpenAPI } from './translate';
import { proxyCall } from './proxy';
import {
  authenticate,
  registerApiKey,
  generateApiKey,
  generateOAuthCredentials,
  registerOAuthToken,
} from './auth';
import { logCall } from './db';

const app = new Hono();

// CORS per dashboard frontend
app.use('*', cors());

// ============================================
// MIDDLEWARE: Autenticazione Bridge
// ============================================
app.use('/tools/register', async (c, next) => {
  const authHeader = c.req.header('authorization') || c.req.header('x-helix-api-key');
  const result = authenticate(authHeader);
  if (!result.authenticated) {
    return c.json({ error: result.error }, 401);
  }
  c.set('agentId', result.agentId);
  c.set('authType', result.authType);
  await next();
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'bridge',
    version: '0.1.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// TOOL REGISTRY
// ============================================
// In-memory tool registry (MVP — sarà in Supabase)
const toolRegistry: Map<string, BridgeTool> = new Map();

const registerSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1),
  provider: z.string().min(1),
  endpoint: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  authType: z.enum(['api_key', 'oauth2', 'none']),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()).optional(),
  pricing: z.object({
    type: z.enum(['free', 'per_call', 'subscription']),
    cost: z.number().optional(),
    currency: z.string().optional(),
  }).optional(),
});

// Registra un nuovo tool
app.post('/tools/register', zValidator('json', registerSchema), async (c) => {
  const body = c.req.valid('json');
  const id = `tool_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const tool: BridgeTool = { id, ...body };
  toolRegistry.set(id, tool);

  console.log(`[Bridge] Tool registered: ${tool.name} (${id}) by agent ${c.get('agentId')}`);

  return c.json({ success: true, tool }, 201);
});

// Lista tutti i tool
app.get('/tools', (c) => {
  const tools = Array.from(toolRegistry.values()).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    provider: t.provider,
    authType: t.authType,
    pricing: t.pricing,
  }));
  return c.json({ tools, count: tools.length });
});

// Dettaglio singolo tool
app.get('/tools/:id', (c) => {
  const id = c.req.param('id');
  const tool = toolRegistry.get(id);
  if (!tool) return c.json({ error: 'Tool not found' }, 404);
  return c.json({ tool });
});

// Cancella un tool
app.delete('/tools/:id', async (c, next) => {
  const authHeader = c.req.header('authorization') || c.req.header('x-helix-api-key');
  const result = authenticate(authHeader);
  if (!result.authenticated) {
    return c.json({ error: result.error }, 401);
  }
  await next();
}, (c) => {
  const id = c.req.param('id');
  const existed = toolRegistry.delete(id);
  if (!existed) return c.json({ error: 'Tool not found' }, 404);
  return c.json({ success: true });
});

// ============================================
// ENDPOINT CALL (PROXY)
// ============================================
const callSchema = z.object({
  params: z.record(z.unknown()).default({}),
  auth: z.object({
    apiKey: z.string().optional(),
    oauthToken: z.string().optional(),
  }).optional(),
});

app.post('/call/:toolId', zValidator('json', callSchema), async (c) => {
  const toolId = c.req.param('toolId');
  const body = c.req.valid('json');
  const tool = toolRegistry.get(toolId);

  if (!tool) {
    return c.json({
      success: false,
      error: 'Tool not found',
      latencyMs: 0,
      timestamp: new Date().toISOString(),
    } as BridgeCallResponse, 404);
  }

  const agentId = c.get('agentId') || 'anonymous';
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';

  const result = await proxyCall(tool, body.params, body.auth);

  // Log asincrono
  logCall({
    tool_id: toolId,
    agent_id: agentId,
    request_params: body.params,
    response_data: result.data as Record<string, unknown> | undefined,
    status: result.success ? 'success' : 'error',
    latency_ms: result.latencyMs,
    error_message: result.error,
    ip_address: ip,
  }).catch(err => console.error('[Bridge] Log error:', err));

  return c.json(result);
});

// ============================================
// OPENAPI TRANSLATION
// ============================================
const translateSchema = z.object({
  spec: z.unknown(),
  providerName: z.string().optional(),
});

app.post('/translate', zValidator('json', translateSchema), async (c) => {
  const { spec, providerName } = c.req.valid('json');
  const result = translateOpenAPI(spec, providerName);

  if (result.success && result.tools.length > 0) {
    // Auto-registra i tool tradotti
    const registeredTools: BridgeTool[] = [];
    for (const t of result.tools) {
      const id = `tool_translated_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const tool: BridgeTool = {
        id,
        name: t.name,
        description: t.description,
        provider: result.provider,
        endpoint: t.path,
        authType: t.authType,
        inputSchema: t.inputSchema,
        outputSchema: t.outputSchema,
      };
      toolRegistry.set(id, tool);
      registeredTools.push(tool);
    }
    return c.json({
      ...result,
      registered: registeredTools.map(t => ({ id: t.id, name: t.name })),
    });
  }

  return c.json(result);
});

// ============================================
// AUTH MANAGEMENT
// ============================================

// Genera API key (richiede autenticazione admin)
app.post('/auth/api-key', async (c) => {
  const authHeader = c.req.header('authorization');
  const result = authenticate(authHeader);
  if (!result.authenticated) {
    return c.json({ error: result.error }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const agentId = body.agentId || result.agentId;
  const scopes = body.scopes || ['*'];

  const apiKey = generateApiKey();
  registerApiKey(apiKey, agentId, scopes);

  return c.json({
    success: true,
    apiKey,
    agentId,
    scopes,
    message: 'Store this key securely. It will not be shown again.',
  }, 201);
});

// Client credentials OAuth2
app.post('/auth/oauth2/register', async (c) => {
  const authHeader = c.req.header('authorization');
  const result = authenticate(authHeader);
  if (!result.authenticated) {
    return c.json({ error: result.error }, 401);
  }

  const { clientId, clientSecret } = generateOAuthCredentials();

  return c.json({
    success: true,
    clientId,
    clientSecret,
    message: 'Store these credentials securely.',
  }, 201);
});

// OAuth2 token exchange
app.post('/auth/oauth2/token', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { client_id, client_secret, grant_type } = body as Record<string, string>;

  if (grant_type !== 'client_credentials') {
    return c.json({ error: 'Unsupported grant type' }, 400);
  }

  // In MVP: validazione base. In produzione: controllo reale client credentials
  if (!client_id || !client_secret) {
    return c.json({ error: 'Missing client_id or client_secret' }, 400);
  }

  const token = `helix_at_${Array.from({ length: 48 }, () =>
    'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
  ).join('')}`;

  registerOAuthToken(token, client_id, 3600);

  return c.json({
    access_token: token,
    token_type: 'Bearer',
    expires_in: 3600,
  });
});

// ============================================
// METRICS
// ============================================
app.get('/metrics', (c) => {
  return c.json({
    tools: toolRegistry.size,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

export default app;

// Start server
const port = parseInt(process.env.PORT || '3000');
console.log(`🧬 Helix Bridge v0.1.0 running on port ${port}`);
