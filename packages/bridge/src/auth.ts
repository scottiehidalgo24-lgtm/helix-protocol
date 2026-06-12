import { z } from 'zod';

const API_KEY_HEADER = 'x-helix-api-key';
const BEARER_PREFIX = 'Bearer ';

// In-memory API key store (MVP — sarà in DB)
const apiKeys = new Map<string, { agentId: string; scopes: string[] }>();

// In-memory OAuth2 token store (MVP)
const oauthTokens = new Map<string, { agentId: string; expiresAt: number; scopes: string[] }>();

export function registerApiKey(apiKey: string, agentId: string, scopes: string[] = ['*']): void {
  apiKeys.set(apiKey, { agentId, scopes });
}

export function registerOAuthToken(token: string, agentId: string, ttlSeconds: number = 3600, scopes: string[] = ['*']): void {
  oauthTokens.set(token, { agentId, expiresAt: Date.now() + ttlSeconds * 1000, scopes });
}

export interface AuthResult {
  authenticated: boolean;
  agentId?: string;
  authType?: 'api_key' | 'oauth2';
  error?: string;
}

export function authenticate(header: string | null): AuthResult {
  if (!header) {
    return { authenticated: false, error: 'Missing authorization header' };
  }

  // API Key: x-helix-api-key header
  if (header.startsWith('hk_')) {
    const keyData = apiKeys.get(header);
    if (!keyData) {
      return { authenticated: false, error: 'Invalid API key' };
    }
    return { authenticated: true, agentId: keyData.agentId, authType: 'api_key' };
  }

  // OAuth2 Bearer token
  if (header.startsWith(BEARER_PREFIX)) {
    const token = header.slice(BEARER_PREFIX.length);
    const tokenData = oauthTokens.get(token);
    if (!tokenData) {
      return { authenticated: false, error: 'Invalid OAuth token' };
    }
    if (tokenData.expiresAt < Date.now()) {
      oauthTokens.delete(token);
      return { authenticated: false, error: 'OAuth token expired' };
    }
    return { authenticated: true, agentId: tokenData.agentId, authType: 'oauth2' };
  }

  return { authenticated: false, error: 'Unsupported authorization method' };
}

// Generate API keys (MVP — in produzione useremo crypto.randomUUID)
export function generateApiKey(): string {
  const prefix = 'hk_';
  const random = Array.from({ length: 32 }, () =>
    'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
  ).join('');
  return prefix + random;
}

// Generate OAuth2 client credentials
export function generateOAuthCredentials(): { clientId: string; clientSecret: string } {
  const clientId = 'helix_' + Array.from({ length: 24 }, () =>
    'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
  ).join('');
  const clientSecret = Array.from({ length: 48 }, () =>
    'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
  ).join('');
  return { clientId, clientSecret };
}

// Bootstrap: genera una root key al primo avvio
const BOOTSTRAP_KEY = "hk_" + Array.from({length: 32}, () => 
  "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]
).join("");

registerApiKey(BOOTSTRAP_KEY, "root", ["*"]);

console.log("🔑 Helix Bridge Bootstrap API Key:", BOOTSTRAP_KEY);
console.log("   ⚠️  SAVE THIS KEY — it will not be shown again.");
console.log("   Use: curl -H 'x-helix-api-key: " + BOOTSTRAP_KEY + "' http://localhost:3000/...");
