# Helix Developer Simulation Kit v0.1.2

## Obiettivo
Simulare l'esperienza di un developer esterno che scopre Helix Protocol per la prima volta.

## API Base
```
https://api.helixprotocol.dev
```
Versione: **0.1.2**

## Onboarding (30 secondi)
Registrati con un solo endpoint pubblico — ottieni API key + OAuth token:

```http
POST /auth/register
Content-Type: application/json

{}
```

Risposta: `{ apiKey, access_token, token_type: "Bearer", expires_in: 3600, agentId, scopes: ["read","write"] }`

Autenticazione: usa `X-API-Key: <apiKey>` oppure `Authorization: Bearer <access_token>` su tutti gli endpoint protetti.

---

## Checklist Simulazione

### 1. Scoperta
| Step | Endpoint | Atteso |
|------|----------|--------|
| Health check | `GET /health` | 200, `{ status:"ok", service:"bridge", version:"0.1.2" }` |
| Root info | `GET /` | 200, lista endpoint + auth info |
| Senza auth | `GET /tools` | 401, `{ error: { code: "AUTH_MISSING", ... } }` |
| Registrazione | `POST /auth/register` | 201, apiKey + access_token |

### 2. Auth (doppio metodo)
| Step | Header | Atteso |
|------|--------|--------|
| API Key | `X-API-Key: <apiKey>` | 200 |
| Bearer token | `Authorization: Bearer <token>` | 200 |

### 3. CRUD Tool
| Step | Endpoint | Body | Atteso |
|------|----------|------|--------|
| Crea tool | `POST /tools` | `{ name, description, provider, endpoint, authType, inputSchema }` | 201, tool creato |
| Campi mancanti | `POST /tools` | `{ name:"solo" }` | 400, `{ error: { code:"VALIDATION_ERROR", validation_errors: [...] } }` |
| Lista | `GET /tools` | — | 200, `{ tools:[...], count:N }` |
| Dettaglio | `GET /tools/:id` | — | 200, `{ tool: {...} }` |
| Elimina | `DELETE /tools/:id` | — | 200, `{ success:true }` |

### 4. Proxy Call (gateway reale)
| Step | Endpoint | Body | Atteso |
|------|----------|------|--------|
| Call | `POST /call/:toolId` | `{ params: {...} }` | 200, `{ success, data, latencyMs }` |
| Upstream rotto | `POST /call/:toolId` (tool → httpstat.us/503) | `{ params: {} }` | 502, errore strutturato |
| Senza auth | `POST /call/:toolId` | — | 401 |

### 5. Translate
| Step | Endpoint | Body | Atteso |
|------|----------|------|--------|
| OpenAPI→tool | `POST /translate` | `{ spec: {...}, providerName: "anthropic" }` | 200, tool tradotti + auto-registrati |

### 6. Sicurezza
| Step | Endpoint | Atteso |
|------|----------|--------|
| Tools senza auth | `GET /tools` | 401 |
| Call senza auth | `POST /call/:id` | 401 |
| Translate senza auth | `POST /translate` | 401 |
| Metrics da esterno | `GET /metrics` | 403 |
| Chiave invalida | `GET /tools` (header sbagliato) | 401, `AUTH_INVALID` |
| OAuth2 token | `POST /auth/oauth2/token` (senza parametri) | 400, errore strutturato |

---

## Esempio sessione `.http` (VS Code REST Client)

```http
### 1. Health Check
GET https://api.helixprotocol.dev/health

### 2. Root Info
GET https://api.helixprotocol.dev/

### 3. Registrazione
POST https://api.helixprotocol.dev/auth/register
Content-Type: application/json

{}

### 4. Tools senza auth (deve fallire)
GET https://api.helixprotocol.dev/tools

### 5. Tools con API Key
GET https://api.helixprotocol.dev/tools
X-API-Key: {{api_key}}

### 6. Tools con Bearer token
GET https://api.helixprotocol.dev/tools
Authorization: Bearer {{access_token}}

### 7. Crea tool
POST https://api.helixprotocol.dev/tools
X-API-Key: {{api_key}}
Content-Type: application/json

{
  "name": "Echo Test",
  "description": "Tool di test per la simulazione",
  "provider": "test",
  "endpoint": "https://dummyjson.com/test",
  "authType": "none",
  "inputSchema": {}
}

### 8. Crea tool con campi mancanti (errore strutturato)
POST https://api.helixprotocol.dev/tools
X-API-Key: {{api_key}}
Content-Type: application/json

{
  "name": "Incompleto"
}

### 9. Get tool by ID
GET https://api.helixprotocol.dev/tools/{{tool_id}}
X-API-Key: {{api_key}}

### 10. Chiama tool
POST https://api.helixprotocol.dev/call/{{tool_id}}
X-API-Key: {{api_key}}
Content-Type: application/json

{
  "params": {}
}

### 11. Translate OpenAPI
POST https://api.helixprotocol.dev/translate
X-API-Key: {{api_key}}
Content-Type: application/json

{
  "spec": {
    "openapi": "3.0.0",
    "info": { "title": "Weather API", "version": "1.0" },
    "paths": {
      "/weather": {
        "get": {
          "operationId": "getWeather",
          "summary": "Get current weather",
          "parameters": [
            { "name": "city", "in": "query", "required": true, "schema": { "type": "string" } }
          ]
        }
      }
    }
  },
  "providerName": "anthropic"
}

### 12. Elimina tool
DELETE https://api.helixprotocol.dev/tools/{{tool_id}}
X-API-Key: {{api_key}}
```

---

## Modello errori (v0.1.2)
Tutti gli errori seguono questo formato strutturato:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": "Missing or invalid: description, provider, endpoint",
    "validation_errors": [
      { "path": "description", "message": "Invalid input: expected string, received undefined", "code": "invalid_type" }
    ],
    "request_id": "req_..."
  }
}
```

Codici errore standard:
- `AUTH_MISSING` — nessun header di auth
- `AUTH_INVALID` — credenziali non valide
- `VALIDATION_ERROR` — body non valido (con `validation_errors[]`)
- `TOOL_NOT_FOUND` — tool ID inesistente
- `METRICS_INTERNAL` — metrics accessibili solo da localhost
- `AUTH_UNSUPPORTED_GRANT` — grant type OAuth2 non supportato

---

## Output atteso dal developer
Alla fine della simulazione, produci un feedback con:
1. **Cosa ha funzionato bene** (3 punti)
2. **Cosa è rotto o confuso** (3 punti)
3. **Cosa manca per essere production-ready** (3 punti)
4. **Voto 1-10** sulla developer experience complessiva
