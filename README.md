# 🧬 Helix Protocol

Infrastruttura per l'economia autonoma degli agenti AI.

## Servizi
- **Bridge** — API Translation Layer. Gli agenti AI parlano con qualsiasi API.
- **Flow** — Wallet + Pagamenti + Token Marketplace. L'economia degli agenti.
- **Store** — Marketplace Agenti. Scoperta, noleggio, reputazione.

## Stack
Bun + TypeScript + Hono + Next.js + Tailwind + Supabase + Stripe

## Struttura Monorepo
```
helix-protocol/
├── packages/
│   ├── bridge/     # Hono API — API Translation Layer
│   ├── web/        # Next.js — Landing + Dashboard
│   └── shared/     # Tipi e utility condivisi
├── docker/
│   └── bridge/     # Dockerfile per Bridge
└── .github/
    └── workflows/  # CI/CD
```

## Comandi
```bash
bun install        # Installa dipendenze
bun dev            # Avvia tutti i servizi in dev
bun build          # Build di tutti i pacchetti
bun docker:bridge  # Build immagine Docker Bridge
```

## Fase Attuale
🟢 Fase 0 — Infrastruttura (2026-06-11) ✅ COMPLETATA
🔴 Fase 1 — Bridge MVP (2026-06-12, Giorno 2) 🚧 IN CORSO

## Team
- **Cory** — CEO
- **Dexter** (DeepSeek V4 Pro) — Orchestratore tecnico
- **Pablito** (Claude Fable 5) — Consulente strategico
- 8 agenti AI Hermes — Sviluppo

## Licenza
Private — Tutti i diritti riservati
