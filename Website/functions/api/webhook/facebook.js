import { verifyFacebookSignature } from '../../lib/facebook.js';
import { upsertFacebookPost } from '../../lib/news-store.js';

export async function onRequestGet({ request, env }) {
    const params = new URL(request.url).searchParams;
    const mode = params.get('hub.mode');
    const token = params.get('hub.verify_token');
    const challenge = params.get('hub.challenge');

    if (mode === 'subscribe' && token && token === env.FB_VERIFY_TOKEN && challenge) {
        return new Response(challenge, { status: 200 });
    }

    return new Response('Forbidden', { status: 403 });
}

export async function onRequestPost({ request, env }) {
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    if (!await verifyFacebookSignature(env.FB_APP_SECRET, signature, rawBody)) {
        return new Response('Invalid signature', { status: 401 });
    }

    let payload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return new Response('Invalid JSON', { status: 400 });
    }

    if (payload.object !== 'page') {
        return Response.json({ ok: true, ignored: true });
    }

    const processed = [];

    for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
            if (change.field !== 'feed') {
                continue;
            }

            const value = change.value || {};
            if (value.verb !== 'add' || !value.post_id) {
                continue;
            }

            try {
                const post = await upsertFacebookPost(env, request.url, value.post_id);
                if (post) {
                    processed.push(post.slug);
                }
            } catch (error) {
                console.error('[webhook/facebook] upsert failed:', value.post_id, error);
            }
        }
    }

    return Response.json({ ok: true, processed });
}
