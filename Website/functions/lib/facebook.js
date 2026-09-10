export const FACEBOOK_PAGE_URL = 'https://www.facebook.com/ETAXHCMVN/';

export async function verifyFacebookSignature(appSecret, signatureHeader, rawBody) {
    if (!appSecret || !signatureHeader || !signatureHeader.startsWith('sha256=')) {
        return false;
    }

    const expectedHex = signatureHeader.slice('sha256='.length);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(appSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const actualHex = [...new Uint8Array(signed)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');

    return actualHex === expectedHex;
}

export function mapFacebookPostToNews(post) {
    const message = (post.message || '').trim();
    const firstLine = message.split('\n').find((line) => line.trim()) || '';
    const title = firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : (firstLine || 'ETAX HCM');
    const date = post.created_time ? post.created_time.split('T')[0] : new Date().toISOString().split('T')[0];
    const slug = `fb-${String(post.id).replace(/[^a-zA-Z0-9-]/g, '-')}`;

    return {
        slug,
        date,
        source: 'facebook',
        facebookId: post.id,
        facebookUrl: post.permalink_url || FACEBOOK_PAGE_URL,
        image: post.full_picture || '',
        title: { vi: title, en: title, zh: title },
        excerpt: {
            vi: message.slice(0, 220),
            en: message.slice(0, 220),
            zh: message.slice(0, 220)
        },
        body: { vi: message, en: message, zh: message }
    };
}

export async function fetchFacebookPost(postId, accessToken) {
    const fields = 'id,message,created_time,full_picture,permalink_url,status_type';
    const url = `https://graph.facebook.com/v21.0/${postId}?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`;
    const response = await fetch(url);

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Facebook Graph API error (${response.status}): ${error}`);
    }

    return response.json();
}

export async function fetchRecentFacebookPosts(pageId, accessToken, limit = 20) {
    const fields = 'id,message,created_time,full_picture,permalink_url,status_type';
    const url = `https://graph.facebook.com/v21.0/${pageId}/posts?fields=${fields}&limit=${limit}&access_token=${encodeURIComponent(accessToken)}`;
    const response = await fetch(url);

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Facebook Graph API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return Array.isArray(data.data) ? data.data : [];
}
