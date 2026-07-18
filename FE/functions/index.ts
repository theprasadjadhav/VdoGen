interface Env {
    ASSETS: { fetch: (req: Request) => Promise<Response> };
}

// Serve the static landing page at "/" instead of the React SPA shell.
// All other routes fall through to assets -> SPA fallback (index.html).
export const onRequestGet = async (context: {
    request: Request;
    env: Env;
}) => {
    const { origin } = new URL(context.request.url);
    const assetResponse = await context.env.ASSETS.fetch(
        new Request(`${origin}/landing.html`)
    );

    return new Response(assetResponse.body, {
        status: assetResponse.status,
        headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=0, s-maxage=3600",
            "x-frame-options": "DENY",
            "x-content-type-options": "nosniff",
        },
    });
};
