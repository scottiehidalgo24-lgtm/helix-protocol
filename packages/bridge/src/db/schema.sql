-- Helix Protocol — Schema Database Supabase
-- Fase 1: Bridge MVP

-- Estensione per UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- BRIDGE — API Translation Layer
-- ============================================

-- Provider di servizi esterni
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  website VARCHAR(500),
  auth_type VARCHAR(50) NOT NULL DEFAULT 'api_key',
  auth_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tools registrati nel Bridge
CREATE TABLE tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  endpoint VARCHAR(1000) NOT NULL,
  method VARCHAR(10) NOT NULL DEFAULT 'POST',
  input_schema JSONB NOT NULL DEFAULT '{}',
  output_schema JSONB DEFAULT '{}',
  headers JSONB DEFAULT '{}',
  pricing_type VARCHAR(20) DEFAULT 'free',
  pricing_cost DECIMAL(10,6) DEFAULT 0,
  pricing_currency VARCHAR(3) DEFAULT 'EUR',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- API Keys per provider
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  agent_id UUID, -- chi possiede questa key
  key_hash VARCHAR(255) NOT NULL, -- hash della API key (mai in chiaro)
  encrypted_value TEXT, -- valore criptato (opzionale, per proxy)
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- FLOW — Wallet + Pagamenti
-- ============================================

-- Agenti registrati (user dell'ecosistema)
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'ai_agent',
  owner_id VARCHAR(255), -- riferimento esterno (es. Hermes agent ID)
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wallet degli agenti
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE UNIQUE,
  balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transazioni Flow
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'payment', 'refund')),
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  reference_type VARCHAR(50), -- 'bridge_call', 'store_purchase', 'stripe_topup'
  reference_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- LOGGING & METRICS
-- ============================================

-- Log chiamate Bridge
CREATE TABLE bridge_call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool_id UUID REFERENCES tools(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  request_params JSONB,
  response_data JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  latency_ms INTEGER,
  error_message TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Metriche aggregate (per dashboard)
CREATE TABLE metrics_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  total_calls INTEGER DEFAULT 0,
  successful_calls INTEGER DEFAULT 0,
  failed_calls INTEGER DEFAULT 0,
  total_latency_ms BIGINT DEFAULT 0,
  unique_agents INTEGER DEFAULT 0,
  revenue DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date)
);

-- ============================================
-- INDICI
-- ============================================

CREATE INDEX idx_tools_provider ON tools(provider_id);
CREATE INDEX idx_tools_active ON tools(is_active);
CREATE INDEX idx_api_keys_agent ON api_keys(agent_id);
CREATE INDEX idx_wallets_agent ON wallets(agent_id);
CREATE INDEX idx_transactions_wallet ON transactions(wallet_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX idx_bridge_logs_tool ON bridge_call_logs(tool_id);
CREATE INDEX idx_bridge_logs_created ON bridge_call_logs(created_at DESC);
CREATE INDEX idx_metrics_daily_date ON metrics_daily(date DESC);

-- ============================================
-- RLS (Row Level Security)
-- ============================================

-- Abilita RLS su tutte le tabelle
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_daily ENABLE ROW LEVEL SECURITY;

-- Policies base (saranno raffinate in produzione)
-- Per ora: le API keys e i dati sensibili sono accessibili solo via service_role
CREATE POLICY "Service role full access" ON api_keys FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON wallets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON bridge_call_logs FOR ALL USING (true) WITH CHECK (true);

-- Tabelle pubbliche (read per anon)
CREATE POLICY "Public read" ON providers FOR SELECT USING (true);
CREATE POLICY "Public read" ON tools FOR SELECT USING (true);
CREATE POLICY "Public read" ON metrics_daily FOR SELECT USING (true);

-- ============================================
-- FUNZIONI
-- ============================================

-- Aggiorna automaticamente updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tools_updated_at
  BEFORE UPDATE ON tools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
