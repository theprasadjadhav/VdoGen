# VdoGen — Frontend

React 19 SPA for the AI-powered Manim video generation platform. Deployed on Cloudflare Workers via Wrangler.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4 + shadcn/ui (Radix UI)
- **Routing**: React Router v7
- **Forms**: React Hook Form + Zod
- **HTTP**: Axios
- **Video**: HLS.js + hls-video-player
- **Editor**: react-rnd + @dnd-kit (drag-and-drop timeline)
- **Charts**: Recharts
- **Deployment**: Cloudflare Workers (Wrangler)

## Project Structure

```
FE/
├── src/
│   ├── app/
│   │   └── dashboard/
│   │       ├── auth-page.tsx       # Login / Signup
│   │       ├── chat-page.tsx       # Prompt input + video generation
│   │       ├── home-page.tsx       # Dashboard home
│   │       └── project-page.tsx    # Video editor / timeline
│   ├── components/
│   │   ├── editor.tsx              # Main video editor
│   │   ├── timeline-editor.tsx     # Drag-and-drop timeline
│   │   ├── hls-video-player.tsx    # HLS encrypted video player
│   │   ├── plan-dialog.tsx         # Subscription / payment dialog
│   │   ├── payment-status-dialog.tsx
│   │   ├── login-form.tsx
│   │   ├── signup-form.tsx
│   │   └── ...                     # shadcn/ui components
│   ├── hooks/
│   │   ├── use-Auth.tsx            # Auth state — calls /auth/me on mount
│   │   ├── use-content.ts          # Conversation/video state
│   │   ├── use-history.tsx         # Video history
│   │   └── use-mobile.tsx          # Responsive breakpoint hook
│   ├── lib/
│   │   ├── axios.ts                # Axios instance with base URL + credentials
│   │   ├── types.ts                # Shared TypeScript types
│   │   └── schema.ts               # Zod validation schemas
│   └── app.tsx                     # Root component + routes
├── public/
├── index.html
├── vite.config.ts
└── wrangler.json                   # Cloudflare deployment config
```

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Environment variables

Create `.env.development` and `.env.production`:

```env
VITE_API_URL=http://localhost:3000
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_RAZORPAY_KEY_ID=rzp_live_...
```

### 3. Run

```bash
# Development
bun run dev

# Build
bun run build

# Preview build
bun run preview
```

## Deployment

Deployed to Cloudflare Workers via Wrangler:

```bash
bunx wrangler deploy
```

Config is in `wrangler.json`. Set production env vars in the Cloudflare dashboard or via `wrangler secret`.

## Key Flows

### Authentication
- `use-Auth.tsx` calls `GET /auth/me` on mount for fresh user data
- JWT stored in HttpOnly cookie — Axios sends it automatically with `withCredentials: true`
- Google OAuth via `@react-oauth/google`

### Video Generation
1. User enters prompt on chat page
2. `POST /video/create` → video enters `PROCESSING` state
3. Frontend polls `GET /video/status/:id` until `COMPLETE` or `FAILED`
4. On complete → fetches HLS stream URL → plays in `hls-video-player`

### Payments
- Razorpay order created via `POST /payment/pay`
- Razorpay checkout opens in browser
- On success → `POST /payment/verify` → user state refreshed with new `primeExpiry`
