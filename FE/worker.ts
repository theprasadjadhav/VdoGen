interface Env {
    ASSETS: { fetch: (req: Request) => Promise<Response> };
}

const HTML_HEADERS: Record<string, string> = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=0, s-maxage=3600",
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
};

async function serveAsset(env: Env, origin: string, filename: string): Promise<Response> {
    const res = await env.ASSETS.fetch(new Request(`${origin}/${filename}`));
    return new Response(res.body, { status: res.status, headers: HTML_HEADERS });
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const { pathname } = new URL(request.url);
        const origin = new URL(request.url).origin;

        if (request.method === "GET") {
            if (pathname === "/")        return serveAsset(env, origin, "landing.html");
            if (pathname === "/privacy") return serveAsset(env, origin, "privacy.html");
            if (pathname === "/terms")   return serveAsset(env, origin, "terms.html");
        }

        // Try static asset; 404 → serve React SPA
        const res = await env.ASSETS.fetch(request);
        if (res.status === 404) {
            return serveAsset(env, new URL(request.url).origin, "_spa.html");                                                                           }
        return res;
    },
};
