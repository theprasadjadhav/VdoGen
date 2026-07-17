# VdoGen — AI-Powered Manim Video Generator

An AI-powered platform that converts natural language prompts into mathematical animation videos using [Manim](https://www.manim.community/). Users describe what they want, the AI generates a Python/Manim script, and the platform renders it into an HLS-encrypted video.

## Architecture Overview

```
User Prompt
    │
    ▼
FE (React + Vite)  ──────►  BE Master (Express API)
                                    │
                          ┌─────────┴──────────┐
                          ▼                    ▼
                     BullMQ Queue          Prisma/PostgreSQL
                          │
                          ▼
                     BE Worker
                   (Dequeues job)
                          │
                          ▼
                  K8s Job (Manim Pod)
                  Renders Python script
                          │
                          ▼
                   GCS (HLS + AES-128)
                          │
                          ▼
                   Status Worker
                 (K8s Informer → DB/Redis)
```

## Repository Structure

```
video-generator/
├── BE/                  # Backend — Express API, workers, K8s jobs
├── FE/                  # Frontend — React SPA (deployed on Cloudflare)
└── README.md
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Express 5, TypeScript, Bun |
| Database | PostgreSQL via Prisma ORM |
| Queue | BullMQ + Redis |
| Video Render | Manim (Python) on Kubernetes Jobs |
| Storage | Google Cloud Storage (HLS + AES-128 encryption) |
| Auth | JWT (HttpOnly cookies), Google OAuth, Email/Password |
| Payments | Razorpay |
| AI | Anthropic Claude API |
| Deployment | Kubernetes (BE), Cloudflare Workers (FE) |

## Quick Start

### Prerequisites
- Bun >= 1.2
- Docker
- Kubernetes cluster with `script-runner` namespace
- PostgreSQL database
- Redis instance
- Google Cloud Storage bucket

### Run locally

```bash
# Backend
cd BE
bun install
bun run src/master/index.ts

# Frontend
cd FE
bun install
bun run dev
```

See [BE/README.md](./BE/README.md) and [FE/README.md](./FE/README.md) for full setup.

## Features

- Natural language to Manim animation via Claude AI
- HLS video streaming with AES-128 encryption
- Video editor with timeline and project management
- Google OAuth + Email/Password authentication
- Razorpay subscription payments (1 month / 3 months / 1 year)
- Automatic retry (up to 3 attempts) for failed render jobs
- Rate limiting per route

## Deployment

The backend runs as 3 separate Kubernetes deployments:
- `master` — Express API server (`Dockerfile.master`)
- `worker` — BullMQ job processor (`Dockerfile.worker`)
- `status` — K8s Job informer / status updater (`Dockerfile.status`)

The frontend is deployed to Cloudflare Workers via Wrangler.
