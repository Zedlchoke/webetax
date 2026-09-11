import { fetchRecentFacebookPosts } from './facebook.js';
import { mergeFacebookPosts } from './news-store.js';

const DEFAULT_SITE_URL = 'https://etaxhcm.com/';

export async function syncFacebookFromGraph(env, requestUrl = DEFAULT_SITE_URL) {
    const pageId = env.FB_PAGE_ID;
    const accessToken = env.FB_PAGE_ACCESS_TOKEN;

    if (!pageId || !accessToken) {
        return {
            ok: false,
            error: 'FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN must be configured'
        };
    }

    const graphPosts = await fetchRecentFacebookPosts(pageId, accessToken, 25);
    const data = await mergeFacebookPosts(env, requestUrl, graphPosts);

    return {
        ok: true,
        imported: graphPosts.length,
        totalPosts: data.posts.length
    };
}
