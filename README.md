# Sniderbytes

A multi-tenant operations dashboard that aggregates Grafana-backed cluster metrics, alerts, and configurable PromQL panels into a single interface. Supports multiple customers, environments, and clusters with role-based access control and optional Keycloak SSO.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Go 1.23 + Gin |
| Database | PostgreSQL 16 |
| Deploy | Docker Compose (local) / Kubernetes (production) |

## Repo Structure

```
sniderbytes/
├── api/              Go backend
│   ├── config/       Environment variable loading
│   ├── db/           Migrations and demo seed data
│   ├── grafana/      Grafana/Prometheus client
│   ├── handlers/     HTTP handlers
│   ├── middleware/   JWT auth + role enforcement
│   ├── models/       Shared data types
│   └── router/       Route registration
├── ui/               React frontend
│   └── src/
│       ├── api/      Axios client
│       ├── auth/     Auth context
│       ├── components/
│       ├── pages/
│       ├── routes/   Protected/admin route guards
│       └── types/
├── deploy/           Kubernetes manifests
│   ├── api/
│   ├── ui/
│   ├── postgres/
│   └── ingress.yaml
├── docker-compose.yml
└── README.md
```

---

## Running Locally

### Prerequisites

- Docker + Docker Compose v2
- (Optional) Go 1.23+ and Node 20+ for running without Docker

### Quick start with Docker Compose

```bash
docker compose up --build
```

- UI: http://localhost
- API: http://localhost:8080
- Postgres: localhost:5432

The API runs schema migrations and seeds demo data automatically on first boot. Demo user credentials are defined in `api/db/seed.go`.

### Running without Docker

**Postgres** (requires a running Postgres instance):

```bash
createdb sniderbytes
export DB_URL="postgres://$(whoami)@localhost:5432/sniderbytes?sslmode=disable"
```

**API:**

```bash
cd api
go run .
```

**UI:**

```bash
cd ui
npm install
# For local dev pointing to localhost:8080 instead of Docker
# Edit vite.config.ts: target: 'http://localhost:8080'
npm run dev
```

---

## Environment Variables

### API

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_URL` | `postgres://sniderbytes:sniderbytes@localhost:5432/sniderbytes?sslmode=disable` | PostgreSQL connection string |
| `JWT_SECRET` | `dev-secret-change-in-production` | HMAC secret for local JWT signing |
| `PORT` | `8080` | HTTP server port |
| `ENV` | `development` | Set to `production` to enable Gin release mode |
| `KEYCLOAK_JWKS_URL` | _(empty)_ | JWKS endpoint for Keycloak token validation; enables SSO when set |

### UI

The UI is a static SPA. In development, Vite proxies `/api` to the API. In production (Docker/K8s), Nginx proxies `/api` to the `api` service — no runtime env vars needed.

---

## API Endpoints

### Public

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Username/password login; returns a signed JWT |
| GET | `/healthz` | Health check |

### Authenticated (any role)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/me` | Current user info |
| GET | `/api/clusters` | List accessible clusters |
| GET | `/api/clusters/:id/metrics` | Cluster metrics (optional `?namespace=` filter) |
| GET | `/api/clusters/:id/alerts` | Cluster alerts |
| GET | `/api/clusters/:id/namespaces` | Kubernetes namespaces available in Prometheus |
| GET | `/api/clusters/:id/panels` | Metric panels configured for the cluster's environment |
| PUT | `/api/clusters/:id/panels/:panelId` | Update a panel's name, PromQL expression, or unit |
| POST | `/api/clusters/:id/test-query` | Run a PromQL expression against the cluster's Grafana |

### Admin only

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List all users |
| GET | `/api/admin/clusters` | List all clusters with full Grafana config |
| POST | `/api/admin/clusters` | Create a cluster |
| PUT | `/api/admin/clusters/:id` | Update a cluster |
| DELETE | `/api/admin/clusters/:id` | Delete a cluster |
| GET | `/api/admin/environments` | List all environments |
| POST | `/api/admin/organizations` | Create a customer + environment (atomic) with default panels |
| GET | `/api/admin/environments/:id/panels` | List panels for an environment |
| POST | `/api/admin/environments/:id/panels` | Add a panel to an environment |
| POST | `/api/admin/environments/:id/test-query` | Test a PromQL expression via environment's cluster |
| PUT | `/api/admin/panels/:id` | Update a panel |
| DELETE | `/api/admin/panels/:id` | Delete a panel |

---

## Authorization Model

### Roles

- **Admin** — full access to all customers, environments, clusters, panels, and users
- **Viewer** — access only to clusters explicitly granted in `user_cluster_access`

Authorization is enforced server-side on every request.

### Authentication methods

**Local (HMAC JWT):** Username and password are validated against bcrypt hashes stored in the database. A JWT signed with `JWT_SECRET` is issued with a 24-hour expiry.

**Keycloak SSO:** When `KEYCLOAK_JWKS_URL` is set, the API accepts tokens issued by Keycloak. Group membership in the Keycloak realm is mapped to sniderbytes roles:
- Grafana admin group → `admin` role
- Grafana viewer group → `viewer` role
- Customer-scoped groups → `viewer` role with automatic cluster access grants for the matching customer

If a token cannot be validated with the local HMAC secret, the middleware falls back to JWKS validation transparently.

---

## Data Model

```
customers
  └── environments
        ├── panels        (PromQL metric definitions, shared across clusters in the environment)
        └── clusters
              └── user_cluster_access   (grants viewer access per user)
```

- **Customer** — top-level tenant (e.g., an organization or client)
- **Environment** — a logical grouping within a customer (e.g., `production`, `staging`)
- **Cluster** — a Kubernetes cluster with Grafana credentials attached
- **Panel** — a named PromQL expression displayed as a metric card; scoped to an environment
- **user_cluster_access** — many-to-many join granting a viewer access to a specific cluster

---

## Panels and Metrics

### Default panels

When an environment is created (or on every startup for existing environments), five default panels are seeded automatically if they don't already exist:

| Name | Unit |
|------|------|
| CPU Usage | % |
| Memory Usage | % |
| Pod Count | |
| Request Rate | req/s |
| Error Rate | % |

All expressions use the `$namespace` variable (see below). Defaults are seeded as real database rows, so they appear in Organization Management and are editable like any custom panel.

### Namespace filtering

The Overview page fetches available Kubernetes namespaces from Prometheus and shows a dropdown selector. Selecting a namespace scopes all metric queries to that namespace. Panel PromQL expressions use `$namespace` as a placeholder, which is substituted at query time (`.*` for "All namespaces").

### Editing panels

Any user with access to a cluster can edit panel expressions, names, and units directly from the Overview page using the inline edit card. A "Run" button tests the current expression against the live Grafana instance before saving.

---

## Grafana Integration

Each cluster stores:

| Field | Description |
|-------|-------------|
| `grafana_url` | Base URL of the Grafana instance |
| `grafana_auth_type` | `token` or `keycloak` |
| `grafana_token` | Service account token (token auth) or client secret (keycloak auth) |
| `grafana_client_id` | Client ID (keycloak auth only) |
| `grafana_token_url` | Token endpoint URL (keycloak auth only) |

**Token auth:** Sends `Authorization: Bearer <token>` on every Grafana request.

**Keycloak auth:** Exchanges client credentials for an access token (cached until near-expiry) and sends it as a bearer token.

**Mock fallback:** If `grafana_url` is empty or Grafana is unreachable, the API returns randomly generated demo data and sets `"mock": true` in the response. The UI displays a "demo data" badge on affected metric cards.

To connect a real Grafana instance via the UI, go to **Organization Management**, select the relevant org, and edit the cluster's Grafana settings.

---

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster with an nginx ingress controller
- `kubectl` configured against the target cluster

### 1. Create namespace and secrets

```bash
kubectl apply -f deploy/namespace.yaml

# Postgres credentials
kubectl create secret generic postgres-secret -n sniderbytes \
  --from-literal=POSTGRES_DB=sniderbytes \
  --from-literal=POSTGRES_USER=sniderbytes \
  --from-literal=POSTGRES_PASSWORD=<your-db-password>

# API credentials
kubectl create secret generic api-secret -n sniderbytes \
  --from-literal=DB_URL="postgres://sniderbytes:<your-db-password>@postgres.sniderbytes.svc.cluster.local:5432/sniderbytes?sslmode=disable" \
  --from-literal=JWT_SECRET=<your-jwt-secret>
```

### 2. Apply manifests

```bash
kubectl apply -f deploy/postgres/
kubectl apply -f deploy/api/
kubectl apply -f deploy/ui/
kubectl apply -f deploy/ingress.yaml
```

### 3. Update the ingress hostname

Edit `deploy/ingress.yaml` and replace `sniderbytes.example.com` with your actual hostname.

### 4. Build and push images

```bash
# Build for linux/amd64 (required if building on Apple Silicon)
docker buildx build --platform linux/amd64 -t ghcr.io/<your-org>/api:latest --push ./api
docker buildx build --platform linux/amd64 -t ghcr.io/<your-org>/ui:latest --push ./ui
```

Update the image references in `deploy/api/deployment.yaml` and `deploy/ui/deployment.yaml`.

---

## Frontend Pages

| Route | Page | Access |
|-------|------|--------|
| `/login` | Login | Public |
| `/clusters/:id/overview` | Metrics overview with namespace selector and editable panels | All users |
| `/clusters/:id/alerts` | Alert list from Grafana alertmanager | All users |
| `/users` | User list | Admin |
| `/admin/organizations` | Organization, environment, cluster, and panel management | Admin |

The sidebar lists clusters grouped by customer and environment. Admins see all clusters; viewers see only granted clusters.
