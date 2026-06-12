import type { BridgeTool } from '@helix/shared';

// Tipi per OpenAPI parsing semplificato
interface OpenAPISpec {
  openapi?: string;
  info?: { title: string; version: string; description?: string };
  servers?: Array<{ url: string; description?: string }>;
  paths?: Record<string, Record<string, OpenAPIOperation>>;
}

interface OpenAPIOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    schema?: Record<string, unknown>;
    description?: string;
  }>;
  requestBody?: {
    description?: string;
    content?: Record<string, { schema?: Record<string, unknown> }>;
  };
  responses?: Record<string, {
    description: string;
    content?: Record<string, { schema?: Record<string, unknown> }>;
  }>;
  security?: Array<Record<string, string[]>>;
}

export interface TranslateResult {
  success: boolean;
  source: string;
  provider: string;
  tools: TranslatedTool[];
  warnings?: string[];
  error?: string;
}

interface TranslatedTool {
  name: string;
  description: string;
  method: string;
  path: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  authType: 'api_key' | 'oauth2' | 'none';
}

export function translateOpenAPI(spec: unknown, providerName?: string): TranslateResult {
  try {
    const api = spec as OpenAPISpec;
    const warnings: string[] = [];

    if (!api.paths) {
      return { success: false, source: 'openapi', provider: providerName || 'unknown', tools: [], error: 'No paths found in spec' };
    }

    const title = api.info?.title || providerName || 'Unknown API';
    const baseUrl = api.servers?.[0]?.url || '';

    const tools: TranslatedTool[] = [];
    for (const [path, methods] of Object.entries(api.paths)) {
      if (!methods) continue;
      for (const [method, operation] of Object.entries(methods)) {
        if (!operation) continue;
        if (['parameters', 'servers', 'summary', 'description'].includes(method)) continue;

        const toolName = operation.operationId ||
          `${method}_${path.replace(/[\/{}]/g, '_').replace(/__+/g, '_').replace(/^_|_$/g, '')}`;

        const description = operation.summary || operation.description || `${method.toUpperCase()} ${path}`;

        // Build input schema from parameters + requestBody
        const inputProperties: Record<string, unknown> = {};
        const required: string[] = [];

        if (operation.parameters) {
          for (const param of operation.parameters) {
            inputProperties[param.name] = {
              type: param.schema?.type || 'string',
              description: param.description || '',
            };
            if (param.required) {
              required.push(param.name);
            }
          }
        }

        if (operation.requestBody?.content?.['application/json']?.schema) {
          const bodySchema = operation.requestBody.content['application/json'].schema;
          if (bodySchema && typeof bodySchema === 'object' && 'properties' in bodySchema) {
            const props = bodySchema.properties as Record<string, unknown>;
            Object.assign(inputProperties, props);
            if (Array.isArray(bodySchema.required)) {
              required.push(...(bodySchema.required as string[]));
            }
          }
        }

        // Build output schema
        let outputProperties: Record<string, unknown> = {};
        const successResponse = operation.responses?.['200'] || operation.responses?.['201'];
        if (successResponse?.content?.['application/json']?.schema) {
          const schema = successResponse.content['application/json'].schema;
          if (schema && typeof schema === 'object' && 'properties' in schema) {
            outputProperties = schema.properties as Record<string, unknown> || {};
          }
        }

        // Detect auth type from security
        let authType: 'api_key' | 'oauth2' | 'none' = 'none';
        if (operation.security) {
          const secNames = operation.security.flatMap(s => Object.keys(s));
          if (secNames.some(s => s.toLowerCase().includes('oauth'))) authType = 'oauth2';
          else if (secNames.length > 0) authType = 'api_key';
        }

        tools.push({
          name: toolName,
          description,
          method: method.toUpperCase(),
          path: baseUrl + path,
          inputSchema: {
            type: 'object',
            properties: inputProperties,
            ...(required.length > 0 ? { required } : {}),
          },
          outputSchema: {
            type: 'object',
            properties: outputProperties,
          },
          authType,
        });
      }
    }

    if (tools.length === 0) {
      warnings.push('No endpoints could be translated from the spec');
    }

    return {
      success: true,
      source: 'openapi',
      provider: title,
      tools,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      success: false,
      source: 'openapi',
      provider: providerName || 'unknown',
      tools: [],
      error: error instanceof Error ? error.message : 'Failed to parse OpenAPI spec',
    };
  }
}
