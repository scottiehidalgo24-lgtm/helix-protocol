import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://juijwfxmcfalkkyallov.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
  }
  return supabase;
}

export interface CallLog {
  tool_id?: string;
  agent_id?: string;
  request_params?: Record<string, unknown>;
  response_data?: Record<string, unknown>;
  status: 'pending' | 'success' | 'error';
  latency_ms: number;
  error_message?: string;
  ip_address?: string;
}

export async function logCall(log: CallLog): Promise<void> {
  try {
    const db = getDb();
    await db.from('bridge_call_logs').insert({
      tool_id: log.tool_id,
      agent_id: log.agent_id,
      request_params: log.request_params,
      response_data: log.response_data,
      status: log.status,
      latency_ms: log.latency_ms,
      error_message: log.error_message,
      ip_address: log.ip_address,
    });
  } catch (err) {
    console.error('[Logger] Failed to log call:', err);
  }
}
