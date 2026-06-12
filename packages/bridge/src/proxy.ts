import type { BridgeCallResponse, BridgeTool } from '@helix/shared';

export async function proxyCall(
  tool: BridgeTool,
  params: Record<string, unknown>,
  auth?: { apiKey?: string; oauthToken?: string }
): Promise<BridgeCallResponse> {
  const startTime = Date.now();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Helix-Bridge/0.1.0',
      'Accept': 'application/json',
    };

    if (auth?.apiKey) {
      headers['Authorization'] = `Bearer ${auth.apiKey}`;
    } else if (auth?.oauthToken) {
      headers['Authorization'] = `Bearer ${auth.oauthToken}`;
    }

    let url = tool.endpoint;
    const bodyParams: Record<string, unknown> = { ...params };

    const pathParamMatches = url.match(/\{(\w+)\}/g);
    if (pathParamMatches) {
      for (const match of pathParamMatches) {
        const paramName = match.slice(1, -1);
        if (params[paramName] !== undefined) {
          url = url.replace(match, String(params[paramName]));
          delete bodyParams[paramName];
        }
      }
    }

    const method = (tool.method || 'POST').toUpperCase();
    let fetchOptions: RequestInit = { method, headers };

    if (method === 'GET' || method === 'DELETE') {
      const queryEntries = Object.entries(bodyParams)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '');
      if (queryEntries.length > 0) {
        const queryString = queryEntries
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&');
        url += `?${queryString}`;
      }
    } else {
      if (Object.keys(bodyParams).length > 0) {
        fetchOptions.body = JSON.stringify(bodyParams);
      }
    }

    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get('content-type') || '';

    let responseData: unknown;
    if (contentType.includes('json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        error: `Upstream API error: ${response.status} ${response.statusText}`,
        data: responseData,
        latencyMs,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      data: responseData,
      latencyMs,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown proxy error',
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}
