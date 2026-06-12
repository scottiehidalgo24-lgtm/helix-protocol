import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Reference — Helix Bridge',
  description: 'Documentazione API Helix Bridge v0.1.0',
};

export default function ApiDocs() {
  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="border-b border-[#1a1a1a] bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 hover:opacity-80">
            <span className="text-xl">🧬</span>
            <span className="font-bold">Helix Bridge</span>
          </a>
          <span className="text-sm text-gray-500">API Reference v0.1.0</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-12 space-y-12">
        <div>
          <h1 className="text-4xl font-bold mb-4">API Reference</h1>
          <p className="text-gray-400 text-lg">Helix Bridge — API Translation Layer. Connetti qualsiasi API agli agenti AI.</p>
          <div className="flex items-center gap-4 mt-4">
            <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-sm border border-green-500/20">
              ● Live — v0.1.0
            </span>
            <span className="text-sm text-gray-500">Base URL: https://api.helixprotocol.dev</span>
          </div>
        </div>

        {/* Auth */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">🔐 Autenticazione</h2>
          <p className="text-gray-400">Helix Bridge supporta due metodi di autenticazione:</p>
          
          <div className="space-y-6">
            <div className="p-6 rounded-xl bg-[#111] border border-[#1a1a1a]">
              <h3 className="text-lg font-semibold mb-2">API Key</h3>
              <p className="text-gray-400 text-sm mb-3">Passa la chiave nell&apos;header <code className="px-2 py-0.5 bg-black rounded text-green-400">x-helix-api-key</code></p>
              <pre className="bg-black p-4 rounded-lg text-sm overflow-x-auto">
{`curl -X POST https://api.helixprotocol.dev/tools/register \\
  -H "x-helix-api-key: hk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "my_tool", ...}'`}
              </pre>
            </div>

            <div className="p-6 rounded-xl bg-[#111] border border-[#1a1a1a]">
              <h3 className="text-lg font-semibold mb-2">OAuth2 Client Credentials</h3>
              <p className="text-gray-400 text-sm mb-3">Scambia client credentials per un access token Bearer</p>
              <pre className="bg-black p-4 rounded-lg text-sm overflow-x-auto">
{`# 1. Ottieni token
curl -X POST https://api.helixprotocol.dev/auth/oauth2/token \\
  -H "Content-Type: application/json" \\
  -d '{"client_id":"helix_...","client_secret":"...","grant_type":"client_credentials"}'

# 2. Usa il token
curl https://api.helixprotocol.dev/tools \\
  -H "Authorization: Bearer helix_at_..."`}
              </pre>
            </div>
          </div>
        </section>

        {/* Endpoints */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold">📡 Endpoints</h2>

          {[
            {
              method: 'GET', path: '/health',
              desc: 'Health check del servizio Bridge',
              example: `curl https://api.helixprotocol.dev/health`,
              response: `{"status":"ok","service":"bridge","version":"0.1.0","uptime":123.45}`,
            },
            {
              method: 'POST', path: '/translate',
              desc: 'Traduce una specifica OpenAPI 3.0 in tool definitions. I tool vengono auto-registrati.',
              example: `curl -X POST https://api.helixprotocol.dev/translate \\
  -H "Content-Type: application/json" \\
  -d '{"providerName":"MyAPI","spec":{"openapi":"3.0.0",...}}'`,
              response: `{"success":true,"source":"openapi","provider":"MyAPI","tools":[...]}`,
            },
            {
              method: 'GET', path: '/tools',
              desc: 'Lista tutti i tool registrati nel Bridge',
              example: `curl https://api.helixprotocol.dev/tools`,
              response: `{"tools":[...],"count":5}`,
            },
            {
              method: 'GET', path: '/tools/:id',
              desc: 'Dettaglio di un singolo tool',
              example: `curl https://api.helixprotocol.dev/tools/tool_xxx`,
              response: `{"tool":{"id":"tool_xxx","name":"github_user",...}}`,
            },
            {
              method: 'POST', path: '/tools/register',
              desc: 'Registra un nuovo tool (richiede autenticazione)',
              example: `curl -X POST https://api.helixprotocol.dev/tools/register \\
  -H "x-helix-api-key: hk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"name":"my_api","endpoint":"https://..."}'`,
              response: `{"success":true,"tool":{...}}`,
            },
            {
              method: 'POST', path: '/call/:toolId',
              desc: 'Chiama un tool registrato tramite proxy. Sostituisce automaticamente path params e query params.',
              example: `curl -X POST https://api.helixprotocol.dev/call/tool_xxx \\
  -H "Content-Type: application/json" \\
  -d '{"params":{"username":"octocat"}}'`,
              response: `{"success":true,"data":{...},"latencyMs":168}`,
            },
            {
              method: 'POST', path: '/auth/api-key',
              desc: 'Genera una nuova API key (richiede autenticazione)',
              example: `curl -X POST https://api.helixprotocol.dev/auth/api-key \\
  -H "x-helix-api-key: hk_bootstrap_key"`,
              response: `{"success":true,"apiKey":"hk_..."}`,
            },
            {
              method: 'POST', path: '/auth/oauth2/token',
              desc: 'OAuth2 token exchange (client credentials)',
              example: `curl -X POST https://api.helixprotocol.dev/auth/oauth2/token \\
  -H "Content-Type: application/json" \\
  -d '{"client_id":"...","client_secret":"...","grant_type":"client_credentials"}'`,
              response: `{"access_token":"helix_at_...","token_type":"Bearer","expires_in":3600}`,
            },
            {
              method: 'GET', path: '/metrics',
              desc: 'Metriche del servizio Bridge',
              example: `curl https://api.helixprotocol.dev/metrics`,
              response: `{"tools":12,"uptime":3600,"memory":{...}}`,
            },
          ].map((ep) => (
            <div key={ep.path} className="p-6 rounded-xl bg-[#111] border border-[#1a1a1a]">
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  ep.method === 'GET' ? 'bg-green-900/30 text-green-400' :
                  ep.method === 'POST' ? 'bg-blue-900/30 text-blue-400' :
                  'bg-gray-800 text-gray-400'
                }`}>{ep.method}</span>
                <code className="text-lg font-mono">{ep.path}</code>
              </div>
              <p className="text-gray-400 text-sm mb-4">{ep.desc}</p>
              <pre className="bg-black p-4 rounded-lg text-sm overflow-x-auto text-gray-300 mb-3">
                {ep.example}
              </pre>
              <p className="text-xs text-gray-500 font-semibold mb-1">Response:</p>
              <pre className="bg-black p-3 rounded-lg text-xs overflow-x-auto text-green-400 font-mono">
                {ep.response}
              </pre>
            </div>
          ))}
        </section>

        {/* Quickstart */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">🚀 Quickstart</h2>
          <div className="p-6 rounded-xl bg-[#111] border border-[#1a1a1a] space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. Registra un tool da un OpenAPI spec</h3>
              <pre className="bg-black p-4 rounded-lg text-sm overflow-x-auto">{`curl -X POST https://api.helixprotocol.dev/translate \\
  -H "Content-Type: application/json" \\
  -d @my-api-spec.json`}</pre>
            </div>
            <div>
              <h3 className="font-semibold mb-2">2. Lista i tool disponibili</h3>
              <pre className="bg-black p-4 rounded-lg text-sm overflow-x-auto">{`curl https://api.helixprotocol.dev/tools`}</pre>
            </div>
            <div>
              <h3 className="font-semibold mb-2">3. Chiama un tool</h3>
              <pre className="bg-black p-4 rounded-lg text-sm overflow-x-auto">{`curl -X POST https://api.helixprotocol.dev/call/TOOL_ID \\
  -H "Content-Type: application/json" \\
  -d '{"params":{"param1":"value1"}}'`}</pre>
            </div>
          </div>
        </section>

        <footer className="py-8 border-t border-[#1a1a1a] text-center text-sm text-gray-500">
          <p>🧬 Helix Protocol — Bridge v0.1.0 · Fase 1 MVP</p>
        </footer>
      </div>
    </main>
  );
}
