import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { BridgeTool, BridgeCallRequest, BridgeCallResponse } from '@helix/shared';

const app = new Hono();

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'bridge', version: '0.0.1' });
});

// Tool registry (in-memory, sarà in DB in produzione)
const toolRegistry: Map<string, BridgeTool> = new Map();

// Register a new tool
const registerSchema = z.object({
  name: z.string(),
  description: z.string(),
  provider: z.string(),
  endpoint: z.string(),
  authType: z.enum(['api_key', 'oauth2', 'none']),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()),
  pricing: z.object({
    type: z.enum(['free', 'per_call', 'subscription']),
    cost: z.number().optional(),
    currency: z.string().optional(),
  }).optional(),
});

app.post('/tools/register', zValidator('json', registerSchema), async (c) => {
  const body = c.req.valid('json');
  const id = `tool_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const tool: BridgeTool = { id, ...body };
  toolRegistry.set(id, tool);
  return c.json({ success: true, tool }, 201);
});

// List all registered tools
app.get('/tools', (c) => {
  const tools = Array.from(toolRegistry.values());
  return c.json({ tools, count: tools.length });
});

// Get single tool
app.get('/tools/:id', (c) => {
  const id = c.req.param('id');
  const tool = toolRegistry.get(id);
  if (!tool) return c.json({ error: 'Tool not found' }, 404);
  return c.json({ tool });
});

// Call endpoint: proxy a tool call
const callSchema = z.object({
  toolId: z.string(),
  params: z.record(z.unknown()),
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
    return c.json({ success: false, error: 'Tool not found' } as BridgeCallResponse, 404);
  }

  const startTime = Date.now();

  try {
    // In MVP: simuliamo la chiamata esterna
    // In produzione: fetch reale con traduzione dei parametri
    const response = {
      success: true,
      data: {
        toolId,
        toolName: tool.name,
        params: body.params,
        result: `Mock response for ${tool.name}`,
      },
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    } as BridgeCallResponse;

    return c.json(response);
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    } as BridgeCallResponse, 500);
  }
});

// Translate endpoint: OpenAPI spec → Bridge tool definitions
app.post('/translate', async (c) => {
  const body = await c.req.json();
  // In MVP: analisi base dell'OpenAPI spec
  // In produzione: parsing completo con AI
  return c.json({
    success: true,
    source: 'openapi',
    endpoints: [],
    message: 'OpenAPI translation endpoint ready (MVP stub)',
  });
});

export default app;

// Start server if running directly
const port = parseInt(process.env.PORT || '3000');
console.log(`🧬 Helix Bridge running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
