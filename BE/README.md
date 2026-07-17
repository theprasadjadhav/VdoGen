# VdoGen — Backend

Express 5 API server with BullMQ worker and Kubernetes Job status watcher. Handles authentication, video job orchestration, payments, and GCS video storage.

## Architecture

Three separate processes, each deployed as its own Kubernetes pod:

| Process | Entry Point | Role |
|---|---|---|
| `master` | `src/master/index.ts` | HTTP API server |
| `worker` | `src/workers/worker.ts` | BullMQ job processor — launches K8s Manim jobs |
| `status` | `src/workers/status-check-worker.ts` | K8s informer — watches job completion and updates DB/Redis |

## Tech Stack

- **Runtime**: Bun
- **Framework**: Express 5
- **Database**: PostgreSQL + Prisma ORM
- **Queue**: BullMQ + Redis (ioredis)
- **K8s**: `@kubernetes/client-node`
- **Storage**: Google Cloud Storage
- **Auth**: JWT (HttpOnly cookies) + bcrypt + Google OAuth
- **AI**: Anthropic Claude API
- **Payments**: Razorpay
- **Logging**: Pino

## Project Structure

```
BE/
├── src/
│   ├── master/
│   │   ├── index.ts              # Express app entry point
│   │   ├── routes/
│   │   │   ├── authRouter.ts     # /auth — login, signup, google OAuth
│   │   │   ├── videoRouter.ts    # /video — create, stream, status
│   │   │   ├── contentRouter.ts  # /content — conversations
│   │   │   ├── projectRouter.ts  # /project — editor projects
│   │   │   └── paymentRoute.ts   # /payment — Razorpay orders & webhooks
│   │   ├── middlewares.ts        # Auth middleware (JWT cookie validation)
│   │   ├── rateLimiters.ts       # Per-route rate limiting
│   │   └── functions.ts          # Shared helpers
│   ├── workers/
│   │   ├── worker.ts             # BullMQ worker — spawns K8s Jobs
│   │   └── status-check-worker.ts# K8s informer — job completion handler
│   ├── types/
│   │   └── index.ts              # Shared TypeScript types & enums
│   └── util/
│       ├── config.ts             # All client initializations + env validation
│       ├── gcp.ts                # GCS helpers
│       └── zodSchemas.ts         # Request validation schemas
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── Dockerfile.master
├── Dockerfile.worker
└── Dockerfile.status
```

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Environment variables

Create a `.env` file:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/vdogen

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-min-32-chars

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id

# Google Cloud Storage
GCS_BUCKET_NAME=your-bucket-name

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Razorpay
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=your-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# App
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Kubernetes
K8S_NAMESPACE=script-runner
```

### 3. Database setup

```bash
bunx prisma migrate deploy
bunx prisma generate
```

### 4. Run

```bash
# API server
bun run src/master/index.ts

# Worker (separate terminal)
bun run src/workers/worker.ts

# Status watcher (separate terminal)
bun run src/workers/status-check-worker.ts
```

## API Routes

### Auth — `/auth`
| Method | Path | Description |
|---|---|---|
| POST | `/auth/signup` | Register with email/password |
| POST | `/auth/signin` | Login with email/password |
| POST | `/auth/google` | Google OAuth login |
| POST | `/auth/signout` | Logout (clears cookie) |
| GET | `/auth/me` | Get current user |

### Video — `/video`
| Method | Path | Description |
|---|---|---|
| POST | `/video/create` | Generate video from prompt |
| GET | `/video/status/:id` | Poll video status |
| GET | `/video/stream/:id` | Get HLS stream URL |

### Payment — `/payment`
| Method | Path | Description |
|---|---|---|
| POST | `/payment/pay` | Create Razorpay order |
| POST | `/payment/verify` | Verify payment & activate plan |
| POST | `/payment/webhook` | Razorpay webhook handler |
| GET | `/payment/status` | Get subscription status |

## Docker

```bash
# Build API server
docker build -f Dockerfile.master -t vdogen-master .

# Build worker
docker build -f Dockerfile.worker -t vdogen-worker .

# Build status watcher
docker build -f Dockerfile.status -t vdogen-status .
```

## Video Job Flow

1. `POST /video/create` → validates prompt → adds job to BullMQ
2. **Worker** dequeues job → generates Manim Python script via Claude → creates K8s Job
3. **K8s Job** (Manim pod) runs the script → uploads HLS segments to GCS
4. **Status worker** watches K8s Jobs via informer → on completion updates DB + Redis
5. Client polls `GET /video/status/:id` → gets COMPLETE/FAILED status from Redis

## Retry Logic

Failed K8s Jobs are automatically retried up to 3 times:
- Retry count tracked via job label `retry`
- Redis `SET NX` lock (`retry-lock:{videoId}:{retry}`) prevents duplicate retries on re-watch
- After 3 failures, video status set to `FAILED`
