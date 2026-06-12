'use client';

import { useState, useEffect } from 'react';

interface BridgeStatus {
  status: string;
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
}

interface ToolInfo {
  id: string;
  name: string;
  description: string;
  provider: string;
  authType: string;
}

export default function BridgeDashboard() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [registerResult, setRegisterResult] = useState('');

  const bridgeUrl = process.env.NEXT_PUBLIC_BRIDGE_URL || 'http://78.47.189.93:3000';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusRes, toolsRes] = await Promise.all([
          fetch(`${bridgeUrl}/health`),
          fetch(`${bridgeUrl}/tools`),
        ]);
        if (statusRes.ok) setStatus(await statusRes.json());
        if (toolsRes.ok) {
          const data = await toolsRes.json();
          setTools(data.tools || []);
        }
      } catch (err) {
        console.error('Failed to fetch bridge data:', err);
      }
      setLoading(false);
    };
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [bridgeUrl]);

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  };

  const handleRegisterTool = async () => {
    if (!apiKey) {
      setRegisterResult('⚠️ API key richiesta');
      return;
    }
    try {
      const res = await fetch(`${bridgeUrl}/tools/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-helix-api-key': apiKey },
        body: JSON.stringify({
          name: `test_tool_${Date.now()}`,
          description: 'Test tool from dashboard',
          provider: 'Dashboard',
          endpoint: 'https://httpbin.org/get',
          method: 'GET',
          authType: 'none',
          inputSchema: { type: 'object', properties: {} },
        }),
      });
      const data = await res.json();
      setRegisterResult(data.success ? '✅ Tool registrato!' : `❌ ${data.error}`);
      if (data.success) {
        const toolsRes = await fetch(`${bridgeUrl}/tools`);
        if (toolsRes.ok) {
          const td = await toolsRes.json();
          setTools(td.tools || []);
        }
      }
    } catch (err) {
      setRegisterResult(`❌ ${err}`);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="border-b border-[#1a1a1a] bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-xl">🧬</span>
            <span className="font-bold">Helix Bridge</span>
          </a>
          <span className="text-sm text-gray-500">Dashboard</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Bridge Dashboard</h1>
            <p className="text-gray-400 mt-1">API Translation Layer — Status & Management</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#111] border border-[#1a1a1a]">
            <span className={`w-2.5 h-2.5 rounded-full ${status?.status === 'ok' ? 'bg-green-400 status-dot' : 'bg-red-400'}`} />
            <span className="text-sm">{status?.status === 'ok' ? 'Operational' : loading ? 'Loading...' : 'Down'}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Tools Registrati', value: tools.length, icon: '🔧' },
            { label: 'Versione', value: status?.version || '—', icon: '📦' },
            { label: 'Uptime', value: status ? formatUptime(status.uptime) : '—', icon: '⏱️' },
            { label: 'Provider', value: [...new Set(tools.map(t => t.provider))].length, icon: '🔌' },
          ].map((stat) => (
            <div key={stat.label} className="p-6 rounded-xl bg-[#111] border border-[#1a1a1a]">
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tool Registry */}
        <div className="rounded-xl bg-[#111] border border-[#1a1a1a] overflow-hidden">
          <div className="p-6 border-b border-[#1a1a1a] flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tool Registry</h2>
            <span className="text-sm text-gray-500">{tools.length} tools</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-[#1a1a1a]">
                  <th className="px-6 py-3 font-medium">Nome</th>
                  <th className="px-6 py-3 font-medium">Provider</th>
                  <th className="px-6 py-3 font-medium">Descrizione</th>
                  <th className="px-6 py-3 font-medium">Auth</th>
                  <th className="px-6 py-3 font-medium">ID</th>
                </tr>
              </thead>
              <tbody>
                {tools.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      {loading ? 'Loading...' : 'Nessun tool registrato. Usa il form qui sotto per registrare il primo.'}
                    </td>
                  </tr>
                ) : (
                  tools.map((tool) => (
                    <tr key={tool.id} className="border-b border-[#1a1a1a] text-sm hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3 font-medium">{tool.name}</td>
                      <td className="px-6 py-3 text-gray-400">{tool.provider}</td>
                      <td className="px-6 py-3 text-gray-400 max-w-xs truncate">{tool.description}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          tool.authType === 'none' ? 'bg-gray-800 text-gray-400' :
                          tool.authType === 'api_key' ? 'bg-yellow-900/30 text-yellow-400' :
                          'bg-blue-900/30 text-blue-400'
                        }`}>
                          {tool.authType}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-600 font-mono text-xs">{tool.id.slice(-12)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Test */}
        <div className="rounded-xl bg-[#111] border border-[#1a1a1a] p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Test — Registra Tool</h2>
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              placeholder="API Key (hk_...)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1 min-w-[200px] px-4 py-2 bg-black border border-[#1a1a1a] rounded-lg text-sm focus:outline-none focus:border-green-500 transition-colors"
            />
            <button
              onClick={handleRegisterTool}
              className="px-6 py-2 bg-green-500 hover:bg-green-400 text-black font-semibold rounded-lg transition-colors text-sm"
            >
              Registra Tool
            </button>
          </div>
          {registerResult && (
            <p className={`mt-3 text-sm ${registerResult.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
              {registerResult}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
