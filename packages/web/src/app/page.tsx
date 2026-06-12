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

export default function Home() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const bridgeUrl = process.env.NEXT_PUBLIC_BRIDGE_URL || 'http://78.47.189.93:3000';
        const [statusRes, toolsRes] = await Promise.all([
          fetch(`${bridgeUrl}/health`),
          fetch(`${bridgeUrl}/tools`),
        ]);
        if (statusRes.ok) setStatus(await statusRes.json());
        if (toolsRes.ok) {
          const data = await toolsRes.json();
          setTools(data.tools || []);
        }
      } catch {
        // Bridge non raggiungibile dal client — normale in dev
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const services = [
    {
      name: 'Bridge',
      desc: 'API Translation Layer — connetti qualsiasi API agli agenti AI',
      status: status?.status === 'ok' ? 'online' : 'checking',
      href: '/dashboard/bridge',
    },
    {
      name: 'Flow',
      desc: 'Wallet + Pagamenti + Token Marketplace per l\'economia degli agenti',
      status: 'coming',
      href: '#',
    },
    {
      name: 'Store',
      desc: 'Marketplace Agenti — scoperta, noleggio, reputazione',
      status: 'coming',
      href: '#',
    },
  ];

  return (
    <main>
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-md border-b border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧬</span>
            <span className="font-bold text-lg">Helix Protocol</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <a href="/dashboard/bridge" className="hover:text-white transition-colors">Dashboard</a>
            <a href="#services" className="hover:text-white transition-colors">Servizi</a>
            <a href="#docs" className="hover:text-white transition-colors">API Docs</a>
            <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#111] border border-[#1a1a1a]">
              <span className={`w-2 h-2 rounded-full ${status?.status === 'ok' ? 'bg-green-400 status-dot' : 'bg-gray-600'}`} />
              <span className="text-xs">{status?.status === 'ok' ? 'Bridge Online' : 'Checking...'}</span>
            </span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center px-8 pt-20">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-to-b from-green-500/5 to-transparent rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#111] border border-[#1a1a1a] text-sm text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-400 status-dot" />
            Bridge MVP — Fase 1 in corso
          </div>
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight leading-tight">
            L&apos;infrastruttura per
            <br />
            <span className="gradient-text">l&apos;economia autonoma</span>
            <br />
            degli agenti AI
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Helix Protocol connette agenti AI, servizi API e pagamenti in un unico ecosistema.
            Inizia con Bridge — il layer di traduzione universale.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <a
              href="/dashboard/bridge"
              className="px-6 py-3 bg-green-500 hover:bg-green-400 text-black font-semibold rounded-lg transition-colors"
            >
              Vai alla Dashboard
            </a>
            <a
              href="#services"
              className="px-6 py-3 border border-[#1a1a1a] hover:border-gray-600 rounded-lg transition-colors"
            >
              Scopri i Servizi
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 max-w-xl mx-auto pt-12">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{tools.length || '—'}</div>
              <div className="text-sm text-gray-500">Tool Registrati</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{status ? '1' : '—'}</div>
              <div className="text-sm text-gray-500">Servizi Attivi</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">8</div>
              <div className="text-sm text-gray-500">Agenti AI</div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-24 px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">Servizi Helix</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {services.map((svc) => (
              <a
                key={svc.name}
                href={svc.href}
                className="card-hover block p-8 rounded-xl bg-[#111] border border-[#1a1a1a] cursor-pointer"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold">{svc.name}</h3>
                  <span className={`w-2 h-2 rounded-full ${
                    svc.status === 'online' ? 'bg-green-400 status-dot' :
                    svc.status === 'checking' ? 'bg-yellow-400' : 'bg-gray-600'
                  }`} />
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">{svc.desc}</p>
                <div className="mt-4 text-xs">
                  {svc.status === 'online' && <span className="text-green-400">● Online</span>}
                  {svc.status === 'checking' && <span className="text-yellow-400">● Connecting</span>}
                  {svc.status === 'coming' && <span className="text-gray-500">○ Coming soon</span>}
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="docs" className="py-12 px-8 border-t border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span>🧬</span>
            <span>Helix Protocol © 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <span>Bridge API v{status?.version || '0.1.0'}</span>
            <span>·</span>
            <a href="https://api.helixprotocol.dev/health" className="hover:text-white transition-colors">API Health</a>
            <span>·</span>
            <span>Fase 1 — Bridge MVP</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
