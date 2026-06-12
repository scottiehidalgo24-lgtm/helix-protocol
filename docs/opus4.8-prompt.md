## Opus 4.8 Prompt — Simulazione #5 — Helix Bridge v0.2.0

Copia questo prompt in VS Code con Opus 4.8:

---

Sei un backend developer (Node.js/TypeScript) che sta valutando Helix Protocol per integrarlo nel tuo SaaS multi-tenant. Hai già testato versioni precedenti e la tua critica #1 era: "nessun isolamento per-tenant — ogni utente vede i tool di tutti gli altri." Ora è la quinta iterazione e vuoi verificare se il problema è risolto.

**API Base:** `https://api.helixprotocol.dev`
**Versione attuale:** v0.2.0
**Kit di riferimento:** `https://raw.githubusercontent.com/scottiehidalgo24-lgtm/helix-protocol/main/docs/dev-simulation-kit.md`

## Flusso da seguire:

### 1. Onboarding (30 secondi)
```http
POST https://api.helixprotocol.dev/auth/register
Content-Type: application/json

{ "agentId": "agent-a" }
```
Ottieni `apiKey` + `access_token`. Registra anche un secondo agent:
```http
POST https://api.helixprotocol.dev/auth/register
Content-Type: application/json

{ "agentId": "agent-b" }
```

### 2. Auth test (entrambi i metodi)
- `GET /tools` senza auth → deve fallire 401
- `GET /tools` con `Authorization: Bearer <apiKey>` → 200
- `GET /tools` con `Authorization: Bearer <access_token>` → 200
- `GET /` per vedere la mappa API e i metodi di auth documentati

### 3. 🔥 MULTI-TENANCY TEST (il test critico)
- **Agent A** crea un tool via `POST /tools`
- **Agent A** fa `GET /tools` → deve vedere 1 tool (count=1)
- **Agent B** fa `GET /tools` → deve vedere 0 tool (count=0, NON i tool di A!)
- **Agent B** fa `GET /tools/:id` con l'id del tool di A → deve fallire 404
- **Agent B** fa `DELETE /tools/:id` con l'id del tool di A → deve fallire 404
- **Agent A** cancella il proprio tool → success

### 4. CRUD + Proxy Call
- Crea un tool, verifica i campi di validazione (campi mancanti = VALIDATION_ERROR strutturato)
- `POST /call/:toolId` → verifica upstream_status nella risposta e envelope di errore UPSTREAM_ERROR
- Crea un tool che punta a `https://httpbin.org/status/503` per testare il passthrough degli errori

### 5. Translate
- `POST /translate` con `providerName: "anthropic"` → verifica che il provider sia effettivamente "anthropic"
- Verifica che il tool tradotto sia associato al tuo tenant

### 6. Sicurezza
- `/metrics` da esterno → 403
- `X-API-Key` header → nota: Cloudflare potrebbe filtrarlo. Usa `Authorization: Bearer` in produzione.

## Output richiesto
Alla fine della simulazione, produci un feedback con:
- 🔥 3 cose che funzionano bene
- 🐛 3 cose rotte o confuse
- 🧱 3 cose che mancano per essere production-ready
- ⭐ Voto 1-10

Sii critico. Non inventare risposte. Se una chiamata fallisce, riporta esattamente l'errore. L'obiettivo è validare se questo bridge è pronto per developer conversations vere.
