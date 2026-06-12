export interface BridgeTool {
  id: string;
  name: string;
  description: string;
  provider: string;
  endpoint: string;
  method?: string;
  authType: 'api_key' | 'oauth2' | 'none';
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  pricing?: {
    type: 'free' | 'per_call' | 'subscription';
    cost?: number;
    currency?: string;
  };
}

export interface BridgeCallRequest {
  toolId: string;
  params: Record<string, unknown>;
  auth?: {
    apiKey?: string;
    oauthToken?: string;
  };
}

export interface BridgeCallResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  latencyMs: number;
  timestamp: string;
}

export interface FlowWallet {
  id: string;
  agentId: string;
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlowTransaction {
  id: string;
  walletId: string;
  type: 'deposit' | 'withdrawal' | 'payment' | 'refund';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  metadata?: Record<string, unknown>;
  createdAt: string;
}
