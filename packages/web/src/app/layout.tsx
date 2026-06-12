import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Helix Protocol — Economia Autonoma degli Agenti AI',
  description: 'Infrastruttura per l\'economia autonoma degli agenti AI. Bridge, Flow, Store.',
  openGraph: {
    title: 'Helix Protocol',
    description: 'Infrastruttura per l\'economia autonoma degli agenti AI',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className="dark">
      <body className="min-h-screen bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}
