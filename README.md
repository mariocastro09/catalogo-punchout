# 🛒 Punchout B2B Catalog

Multi-tenant B2B Punchout Catalog SaaS integrating with corporate eProcurement systems (SAP Ariba, Coupa, etc.).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  eProcurement System (SAP Ariba / Coupa)                │
│  sends cXML / OCI PunchOut request                      │
└────────────────────┬────────────────────────────────────┘
                     │  cXML / OCI
                     ▼
┌────────────────────────────────┐
│  FastAPI Middleware  :8001     │  ← Python: parses cXML, JWT auth,
│  (Protocol Translation Layer)  │    tenant isolation, routes to Medusa
└────────────────────┬───────────┘
                     │  REST / JSON
                     ▼
┌────────────────────────────────┐
│  MedusaJS Backend   :9000/:7001│  ← Node.js: catalog, pricing,
│  (Commerce Engine)             │    B2B customer groups, cart
└────────────────────┬───────────┘
                     │
                     ▼
┌────────────────────────────────┐
│  Next.js Storefront :8002      │  ← React: B2B SSO session, catalog UI
└────────────────────────────────┘
```

## Services

| Service | Port | Description |
|---|---|---|
| `db` | 5432 | PostgreSQL 15 — shared database |
| `redis` | 6379 | Redis — Medusa queue & cache |
| `medusa` | 9000 / 7001 | MedusaJS commerce engine + admin |
| `fastapi` | 8001 | Python cXML/OCI middleware |
| `storefront` | 8002 | Next.js B2B catalog storefront |

## Quick Start (Local Development)

### 1. Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose v2
- [Git](https://git-scm.com/)

### 2. Clone & configure
```bash
git clone https://github.com/mariocastro09/catalogo-punchout.git
cd catalogo-punchout

# Copy and fill in your secrets
cp .env.example .env
```

### 3. Start all services
```bash
docker compose up --build
```

### 4. Seed the database (first run only)
```bash
# Wait for medusa to finish migrating, then run:
docker compose exec medusa bun run seed
```

### 5. Access
| URL | What |
|---|---|
| http://localhost:9000/app | Medusa Admin |
| http://localhost:8002 | Storefront |
| http://localhost:8001/docs | FastAPI Swagger UI |

## Environment Variables

Copy `.env.example` → `.env` and fill in the required values. See comments in the file for each variable.

> ⚠️ Never commit your `.env` file. It is listed in `.gitignore`.

## Tech Stack

- **Commerce Engine:** [MedusaJS v2](https://medusajs.com) (Node.js / TypeScript)
- **Protocol Middleware:** Python 3.12 / [FastAPI](https://fastapi.tiangolo.com)
- **Storefront:** [Next.js 14](https://nextjs.org) (TypeScript)
- **Database:** PostgreSQL 15
- **Cache / Queue:** Redis
- **Container Orchestration:** Docker Compose (local) / [Coolify](https://coolify.io) (production)
