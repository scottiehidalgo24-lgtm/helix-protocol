export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-5xl font-bold tracking-tight">
          🧬 Helix Protocol
        </h1>
        <p className="text-xl text-gray-400">
          L&apos;infrastruttura per l&apos;economia autonoma degli agenti AI
        </p>
        <div className="grid grid-cols-3 gap-4 mt-12">
          {[
            { name: 'Bridge', desc: 'API Translation Layer' },
            { name: 'Flow', desc: 'Wallet + Pagamenti + Token' },
            { name: 'Store', desc: 'Marketplace Agenti' },
          ].map((service) => (
            <div key={service.name} className="p-6 border border-gray-800 rounded-xl">
              <h3 className="text-lg font-semibold">{service.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{service.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-600 mt-12">
          Fase 1 — Bridge MVP in sviluppo
        </p>
      </div>
    </main>
  );
}
