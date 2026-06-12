# Helix Developer Simulation Kit v0.2.0

## Obiettivo
Simulare l'esperienza di un developer esterno che scopre Helix Protocol per la prima volta.

## Novità v0.2.0
- **🎯 Multi-tenancy**: ogni tenant vede solo i propri tool. Isolamento completo per agentId.
- **🔑 Auth flessibile**: API key usabile sia come `X-API-Key` (su localhost) che come `Authorization: Bearer <apiKey>` (via Cloudflare).
- **📡 Upstream status**: `/call` fa passthrough trasparente dello status HTTP dell'upstream.
- **📦 Error model**: envelope strutturato su TUTTI gli errori, incluso UPSTREAM_ERROR (con details troncato a 200 char).

## API Base
```
https://api.helixprotocol.dev
```
Versione: **0.2.0**

## Onboarding (30 secondi)
Registrati con un solo endpoint pubblico:

```http
POST /auth/register
Content-Type: application/json

{ "agentId": "my-agent" }
```

Risposta (201): `{ success: true, apiKey, access_token, token_type: "Bearer", expires_in: 3600, agentId, scopes: ["read","write"] }`

**Autenticazione**: usa `Authorization: Bearer <apiKey>` o `Authorization: Bearer <access_token>` su tutti gli endpoint protetti.
(Nota: `X-API-Key` funziona su localhost ma viene filtrato da Cloudflare in produzione. Usa sempre `Authorization: Bearer`.)

---

## Checklist Simulazione

### 1. Scoperta
| Step | Endpoint | Atteso |
|------|----------|--------|
| Health check | `GET /health` | 200, `{ status:"ok", service:"bridge", version:"0.2.0" }` |
| Root info | `GET /` | 200, lista endpoint + multi_tenancy info |
| Senza auth | `GET /tools` | 401, `{ error: { code: "AUTH_MISSING", ... } }` |
| Registrazione | `POST /auth/register` | 201, apiKey + access_token |

### 2. Multi-tenancy 🎯
| Step | Azione | Atteso |
|------|--------|--------|
| Agent A crea tool | `POST /tools` con auth di A | 201, tool con ownerId |
| Agent A lista | `GET /tools` con auth di A | 200, vede solo i suoi tool |
| Agent B lista | `GET /tools` con auth di B | 200, count=0 (non vede i tool di A) |
| Agent B GET tool di A | `GET /tools/:id` con auth di B | 404, TOOL_NOT_FOUND |
| Agent B DELETE tool di A | `DELETE /tools/:id` con auth di B | 404, TOOL_NOT_FOUND |

### 3. CRUD Tool
| Step | Endpoint | Body | Atteso |
|------|----------|------|--------|
| Crea tool | `POST /tools` | `{ name, description, provider, endpoint, authType, inputSchema }` | 201 |
| Campi mancanti | `POST /tools` | `{ name:"solo" }` | 400, VALIDATION_ERROR strutturato |
| Lista | `GET /tools` | — | 200, `{ tools:[...], count:N, tenant }` |
| Dettaglio | `GET /tools/:id` | — | 200, `{ tool: {...} }` |
| Elimina | `DELETE /tools/:id` | — | 200, `{ success:true }` |

### 4. Proxy Call (passthrough status)
| Step | Endpoint | Body | Atteso |
|------|----------|------|--------|
| Call | `POST /call/:toolId` | `{ params: {...} }` | 200, `{ success, data, latencyMs, upstream_status }` |
| Upstream rotto | `POST /call/:toolId` (tool → httpbin/status/503) | `{ params: {} }` | 503, UPSTREAM_ERROR strutturato |
| Senza auth | `POST /call/:toolId` | — | 401 |

### 5. Translate
| Step | Endpoint | Body | Atteso |
|------|----------|------|--------|
| OpenAPI→tool | `POST /translate` | `{ spec: {...}, providerName: "anthropic" }` | 200, provider="anthropic", auto-registered per tuo tenant |

### 6. Sicurezza
| Step | Endpoint | Atteso |
|------|----------|--------|
| Tools senza auth | `GET /tools` | 401 |
| Call senza auth | `POST /call/:id` | 401 |
| Translate senza auth | `POST /translate` | 401 |
| Metrics da esterno | `GET /metrics` | 403 |
| Chiave invalida | `GET /tools` (header sbagliato) | 401, AUTH_INVALID |

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

{
  "agentId": "my-agent"
}

### 4. Tools senza auth (deve fallire)
GET https://api.helixprotocol.dev/tools

### 5. Tools con API Key (via Bearer)
GET https://api.helixprotocol.dev/tools
Authorization: Bearer {{apiKey}}

### 6. Tools con access_token
GET https://api.helixprotocol.dev/tools
Authorization: Bearer {{access_token}}

### 7. Crea tool
POST https://api.helixprotocol.dev/tools
Authorization: Bearer {{apiKey}}
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
Authorization: Bearer {{apiKey}}
Content-Type: application/json

{
  "name": "Incompleto"
}

### 9. Test multi-tenancy
# Registra un secondo agent
POST https://api.helixprotocol.dev/auth/register
Content-Type: application/json

{
  "agentId": "agent-B"
}

# Agent B NON vede i tool di Agent A
GET https://api.helixprotocol.dev/tools
Authorization: Bearer {{apiKey_b}}

# Agent B NON può accedere al tool di A
GET https://api.helixprotocol.dev/tools/{{tool_id_a}}
Authorization: Bearer {{apiKey_b}}

### 10. Translate OpenAPI
POST https://api.helixprotocol.dev/translate
Authorization: Bearer {{apiKey}}
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

### 11. Elimina tool
DELETE https://api.helixprotocol.dev/tools/{{tool_id}}
Authorization: Bearer {{apiKey}}
```

---

## Modello errori (v0.2.0)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": "Missing or invalid: description, provider, endpoint",
    "validation_errors": [
      { "path": "description", "message": "...", "code": "invalid_type" }
    ],
    "request_id": "req_..."
  }
}
```

Codici errore: `AUTH_MISSING`, `AUTH_INVALID`, `VALIDATION_ERROR`, `TOOL_NOT_FOUND`, `UPSTREAM_ERROR`, `METRICS_INTERNAL`, `AUTH_UNSUPPORTED_GRANT`, `AUTH_MISSING_PARAMS`

---

## Output atteso
Alla fine della simulazione, produci un feedback con:
1. **3 cose che funzionano bene**
2. **3 cose rotte o confuse**
3. **3 cose che mancano per essere production-ready**
4. **Voto 1-10** sulla developer experience
