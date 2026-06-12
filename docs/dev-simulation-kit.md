# Helix Developer Simulation Kit

## Obiettivo
Simulare l'esperienza di un developer esterno che scopre Helix Protocol per la prima volta, usando VS Code + Claude Opus 4.8 come "co-pilot".

## Contesto per la simulazione
Sei uno sviluppatore backend (Node.js/TypeScript) che ha sentito parlare di Helix Protocol e vuole capire se integrarlo nel tuo SaaS. Hai trovato `api.helixprotocol.dev` e vuoi esplorarlo.

---

## Configurazione

### API Base
```
https://api.helixprotocol.dev
```

### Chiave API
```
Tua API key (creala con POST /auth/api-key)
```

### Workflow completo
1. Registrati (ottieni API key)
2. Consulta la lista tool disponibili
3. Crea un tool personalizzato
4. Chiama un tool
5. Traduci un tool tra provider
6. Controlla i metric

---

## Checklist Simulazione

### 1. Scoperta e autenticazione
| Step | Comando | Atteso |
|------|---------|--------|
| Health check | `GET /health` | 200, `{ "service": "helix-bridge", "version": "0.1.0" }` |
| Richiesta senza auth | `GET /tools` | 401 Unauthorized |
| Creazione API key | `POST /auth/api-key` | 200, apiKey |
| Richiesta con auth | `GET /tools` (Header: `X-API-Key`) | 200, array tools |

### 2. Gestione tool
| Step | Comando | Atteso |
|------|---------|--------|
| Lista tool | `GET /tools` | 200, array |
| Crea tool | `POST /tools` con body JSON | 201, tool creato |
| Get tool by ID | `GET /tools/:id` | 200, tool |
| Tool senza auth | `GET /tools/:id` (senza header) | 401 |
| Elimina tool | `DELETE /tools/:id` | 200 |

### 3. Chiamata e traduzione
| Step | Comando | Atteso |
|------|---------|--------|
| Call tool | `POST /call/:toolId` con params | 200, risposta tradotta |
| Call senza auth | `POST /call/:toolId` (senza header) | 401 |
| Translate tool | `POST /translate` con body | 200, tool tradotto |

### 4. Metriche e sicurezza
| Step | Comando | Atteso |
|------|---------|--------|
| Metrics da esterno | `GET /metrics` | 403 Forbidden |
| Metrics da localhost | `curl localhost:3000/metrics` | 200 (solo sulla VPS) |

---

## Cose da annotare come "developer"
Durante la simulazione, prendi nota di:
- Cosa non è chiaro subito
- Cosa ti aspettavi e non hai trovato
- Quale documentazione manca
- Errori poco chiari o messaggi confusi
- Cosa ti farebbe dire "lo uso" vs "lo abbandono"

---

## Esempio di sessione VS Code
Apri un file `helix-test.http` e usa l'estensione REST Client:

```http
### Health Check
GET https://api.helixprotocol.dev/health

### Tools senza auth (deve fallire)
GET https://api.helixprotocol.dev/tools

### Registrazione - crea API key
POST https://api.helixprotocol.dev/auth/api-key
Content-Type: application/json

{}

### Tools con auth
GET https://api.helixprotocol.dev/tools
X-API-Key: {{api_key}}

### Crea tool
POST https://api.helixprotocol.dev/tools
X-API-Key: {{api_key}}
Content-Type: application/json

{
  "name": "Test Tool",
  "description": "Tool creato durante la simulazione",
  "method": "GET",
  "path": "/test"
}
```

---

## Output atteso
Alla fine della simulazione, produci un feedback con:
1. **Cosa ha funzionato bene** (3 punti)
2. **Cosa è rotto o confuso** (3 punti)
3. **Cosa manca per essere production-ready** (3 punti)
4. **Voto 1-10** sulla developer experience complessiva
