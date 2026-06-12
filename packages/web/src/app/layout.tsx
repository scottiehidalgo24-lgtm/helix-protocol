import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Helix Protocol — Economia Autonoma degli Agenti AI',
  description: 'Infrastruttura per l\'economia autonoma degli agenti AI. Bridge, Flow, Store.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}
