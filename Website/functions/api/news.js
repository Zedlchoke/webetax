import { getNewsData } from '../lib/news-store.js';

export async function onRequestGet(context) {
    try {
        const data = await getNewsData(context.env, context.request.url);

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'public, max-age=60, must-revalidate'
            }
        });
    } catch (error) {
        console.error('[api/news] error:', error);
        return new Response(JSON.stringify({ error: 'Failed to load news' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
    }
}
