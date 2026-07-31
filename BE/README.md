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
DATABASE_URL=

# AI
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-5
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-pro
MAX_TOKENS=6000
AI_PROVIDER=deepseek              # "anthropic" or "deepseek"

# Google Cloud (path to service account JSON)
GOOGLE_APPLICATION_CREDENTIALS=

# App
PORT=8081

# Redis
REDIS_URL=localhost
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=

# Auth / CORS
JWT_SECRET=
AUTHORIZED_PARTY=http://localhost:5173
CORS_ORIGIN=http://localhost:5173

# Google OAuth
GOOGLE_AUTH_CLIENT_ID=
GOOGLE_AUTH_CLIENT_SECRET=
GOOGLE_AUTH_REDIRECT_URL=http://localhost:8081/v1/auth/google/callback
GCS_BUCKET_NAME=

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

#k8s
K8S_NAMESPACE=
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
| POST | `/auth/signin` | Login with email/password |
| POST | `/auth/signup` | Register with email/password |
| POST | `/auth/google` | Google OAuth login |
| GET | `/auth/signout` | Logout (clears cookie) |
| GET | `/auth/me` | Get current user (fresh DB fetch) |
| GET | `/auth/identities` | List linked auth providers for user |
| POST | `/auth/change-password` | Change password (email users only) |

### Video — `/video`
| Method | Path | Description |
|---|---|---|
| POST | `/video/create` | Generate video from prompt |
| GET | `/video/status?id=` | Poll video status (Redis → DB fallback) |
| GET | `/video/:id/manifest?type=preview\|edit` | Get HLS manifest with signed segment URLs |
| GET | `/video/download?videoId=` | Stream video as MP4 via ffmpeg |

### Content — `/content`
| Method | Path | Description |
|---|---|---|
| GET | `/content/history` | List all conversations for user |
| GET | `/content/conversation/:conversationId` | Get paginated videos in a conversation |
| DELETE | `/content/conversation/:conversationId` | Delete conversation + GCS files |

### Project — `/project`
| Method | Path | Description |
|---|---|---|
| GET | `/project` | List all editor projects |
| POST | `/project` | Create new project |
| GET | `/project/:projectId` | Get project with videos |
| PATCH | `/project` | Update project timeline data |
| DELETE | `/project/:projectId` | Delete project |
| POST | `/project/add-video` | Assign video to project(s) |
| POST | `/project/render?projectId=` | Start project video render |
| GET | `/project/render/status?jobId=` | Poll render job status |

### Payment — `/payment`
| Method | Path | Description |
|---|---|---|
| POST | `/payment/webhook` | Razorpay webhook handler (no auth) |
| POST | `/payment/pay` | Create Razorpay order |
| POST | `/payment/status?payment_id=` | Get payment status + updated user data |

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
