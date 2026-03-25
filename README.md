# Sniderbytes

A multi-tenant "single pane of glass" dashboard for Grafana-backed cluster metrics.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Go 1.22 + Gin |
| Database | PostgreSQL 16 |
| Deploy | Docker Compose (local) / Kubernetes (production) |

## Repo Structure

```
sniderbytes/
├── api/          Go backend
├── ui/           React frontend
├── deploy/       Kubernetes manifests
├── docker-compose.yml
└── README.md
```

---

## Running Locally

### Prerequisites

- Docker + Docker Compose v2
- (Optional) Go 1.22+ and Node 20+ for running without Docker

### Quick start with Docker Compose

```bash
docker compose up --build
```

- UI: http://localhost
- API: http://localhost:8080
- Postgres: localhost:5432

### Demo credentials (seeded on first boot)

| User | Password | Role | Access |
|------|----------|------|--------|
| admin | admin | admin | All clusters |
| alice | alice123 | viewer | cluster-alpha (Acme Corp / production) |
| bob | bob123 | viewer | cluster-beta (Globex Inc / staging) |

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
# For local dev without Docker, point proxy to localhost:8080
# Edit vite.config.ts: target: 'http://localhost:8080'
npm run dev
```

---

## Environment Variables

### API

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_URL` | `postgres://sniderbytes:sniderbytes@localhost:5432/sniderbytes?sslmode=disable` | PostgreSQL connection string |
| `JWT_SECRET` | `dev-secret-change-in-production` | HMAC secret for JWT signing |
| `PORT` | `8080` | HTTP server port |
| `ENV` | `development` | Set to `production` to enable Gin release mode |

### UI

The UI is built as a static SPA. In development, Vite proxies `/api` to the API service.
In production (Docker/K8s), Nginx proxies `/api` to the `api` service.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/clusters` | JWT | List accessible clusters |
| GET | `/api/clusters/:id/metrics` | JWT | Get cluster metrics |
| GET | `/api/clusters/:id/alerts` | JWT | Get cluster alerts |
| GET | `/healthz` | No | Health check |

---

## Grafana Integration

Each cluster has `grafana_url` and `grafana_token` fields in the database.

If a cluster's `grafana_url` is empty (as in the demo seed data), the API returns **mock data** with a `"mock": true` flag. The UI displays a "demo data" badge when mock data is shown.

To connect a real Grafana instance, update the cluster row:
```sql
UPDATE clusters SET grafana_url = 'http://your-grafana:3000', grafana_token = 'your-service-account-token' WHERE id = 1;
```

---

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster with nginx ingress controller
- `kubectl` configured

### 1. Create the namespace and secrets

```bash
kubectl apply -f deploy/namespace.yaml

# Postgres secret
kubectl create secret generic postgres-secret -n sniderbytes \
  --from-literal=POSTGRES_DB=sniderbytes \
  --from-literal=POSTGRES_USER=sniderbytes \
  --from-literal=POSTGRES_PASSWORD=<your-db-password>

# API secret
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
docker build -t ghcr.io/<your-org>/sniderbytes-api:latest ./api
docker build -t ghcr.io/<your-org>/sniderbytes-ui:latest ./ui
docker push ghcr.io/<your-org>/sniderbytes-api:latest
docker push ghcr.io/<your-org>/sniderbytes-ui:latest
```

Update image references in `deploy/api/deployment.yaml` and `deploy/ui/deployment.yaml`.

---

## Authorization Model

- **Admin** users see all customers, environments, and clusters.
- **Viewer** users see only clusters granted via `user_cluster_access`.
- Authorization is enforced server-side on every request — not frontend-only.
