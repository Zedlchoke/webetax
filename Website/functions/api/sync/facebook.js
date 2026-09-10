import { syncFacebookFromGraph } from '../../lib/sync-facebook.js';

function isAuthorized(request, env) {
    const secret = env.WEBHOOK_SYNC_SECRET;
    if (!secret) {
        return false;
    }

    const url = new URL(request.url);
    const querySecret = url.searchParams.get('secret');
    const headerSecret = request.headers.get('x-sync-secret');

    return querySecret === secret || headerSecret === secret;
}

export async function onRequestPost({ request, env }) {
    if (!isAuthorized(request, env)) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const result = await syncFacebookFromGraph(env, request.url);

        if (!result.ok) {
            return Response.json({ error: result.error }, { status: 500 });
        }

        return Response.json(result);
    } catch (error) {
        console.error('[api/sync/facebook] error:', error);
        return Response.json({ error: error.message || 'Sync failed' }, { status: 500 });
    }
}

export async function onRequestGet({ request, env }) {
    return onRequestPost({ request, env });
}
