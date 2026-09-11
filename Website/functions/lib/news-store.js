import { FACEBOOK_PAGE_URL, fetchFacebookPost, mapFacebookPostToNews } from './facebook.js';

const MAX_POSTS = 50;

export async function getNewsData(env, requestUrl) {
    let posts = [];
    let facebookUrl = FACEBOOK_PAGE_URL;

    const stored = env.NEWS_KV ? await env.NEWS_KV.get('news', 'json') : null;
    if (stored && Array.isArray(stored.posts)) {
        posts = [...stored.posts];
        facebookUrl = stored.facebookUrl || facebookUrl;
    }

    try {
        const staticUrl = new URL('/data/news.json', requestUrl);
        const response = await fetch(staticUrl);
        if (response.ok) {
            const staticData = await response.json();
            facebookUrl = staticData.facebookUrl || facebookUrl;

            for (const post of staticData.posts || []) {
                const exists = posts.some((item) => (
                    item.slug === post.slug
                    || (item.facebookId && post.facebookId && item.facebookId === post.facebookId)
                ));

                if (!exists) {
                    posts.push(post);
                }
            }
        }
    } catch (error) {
        console.warn('[news-store] Static fallback failed:', error);
    }

    return normalizeNewsData({ facebookUrl, posts });
}

export async function saveNewsData(env, data) {
    if (!env.NEWS_KV) {
        throw new Error('NEWS_KV binding is not configured');
    }

    await env.NEWS_KV.put('news', JSON.stringify(normalizeNewsData(data)));
}

export async function upsertFacebookPost(env, requestUrl, postId) {
    const accessToken = env.FB_PAGE_ACCESS_TOKEN;
    if (!accessToken) {
        throw new Error('FB_PAGE_ACCESS_TOKEN is not configured');
    }

    const graphPost = await fetchFacebookPost(postId, accessToken);
    if (!graphPost.message && !graphPost.full_picture) {
        return null;
    }

    const newsPost = mapFacebookPostToNews(graphPost);
    const data = await getNewsData(env, requestUrl);
    const posts = Array.isArray(data.posts) ? [...data.posts] : [];
    const existingIndex = posts.findIndex(
        (post) => post.facebookId === graphPost.id || post.slug === newsPost.slug
    );

    if (existingIndex >= 0) {
        posts[existingIndex] = newsPost;
    } else {
        posts.unshift(newsPost);
    }

    data.posts = sortAndTrimPosts(posts);
    await saveNewsData(env, data);
    return newsPost;
}

export async function mergeFacebookPosts(env, requestUrl, graphPosts) {
    const data = await getNewsData(env, requestUrl);
    const posts = Array.isArray(data.posts) ? [...data.posts] : [];

    for (const graphPost of graphPosts) {
        if (!graphPost.message && !graphPost.full_picture) {
            continue;
        }

        const newsPost = mapFacebookPostToNews(graphPost);
        const existingIndex = posts.findIndex(
            (post) => post.facebookId === graphPost.id || post.slug === newsPost.slug
        );

        if (existingIndex >= 0) {
            posts[existingIndex] = newsPost;
        } else {
            posts.push(newsPost);
        }
    }

    data.posts = sortAndTrimPosts(posts);
    await saveNewsData(env, data);
    return data;
}

function normalizeNewsData(data) {
    const posts = Array.isArray(data?.posts) ? data.posts : [];

    return {
        facebookUrl: data?.facebookUrl || FACEBOOK_PAGE_URL,
        posts: sortAndTrimPosts(posts)
    };
}

function sortAndTrimPosts(posts) {
    return posts
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, MAX_POSTS);
}
