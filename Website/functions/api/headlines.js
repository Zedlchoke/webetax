const MAX_PER_FEED = 5;
const MAX_ITEMS = 24;
const EXCERPT_LENGTH = 160;

const NAMED_ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    aacute: 'á', agrave: 'à', acirc: 'â', atilde: 'ã', abreve: 'ă',
    Aacute: 'Á', Agrave: 'À', Acirc: 'Â', Atilde: 'Ã', Abreve: 'Ă',
    eacute: 'é', egrave: 'è', ecirc: 'ê',
    Eacute: 'É', Egrave: 'È', Ecirc: 'Ê',
    iacute: 'í', igrave: 'ì',
    Iacute: 'Í', Igrave: 'Ì',
    oacute: 'ó', ograve: 'ò', ocirc: 'ô', otilde: 'õ', ohorn: 'ơ',
    Oacute: 'Ó', Ograve: 'Ò', Ocirc: 'Ô', Otilde: 'Õ', Ohorn: 'Ơ',
    uacute: 'ú', ugrave: 'ù', uhorn: 'ư',
    Uacute: 'Ú', Ugrave: 'Ù', Uhorn: 'Ư',
    yacute: 'ý', ygrave: 'ỳ',
    Yacute: 'Ý', Ygrave: 'Ỳ',
    dstrok: 'đ', Dstrok: 'Đ',
    hellip: '…', ndash: '–', mdash: '—',
    lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”'
};

function decodeEntities(value) {
    let text = String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

    for (let pass = 0; pass < 2; pass += 1) {
        text = text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
            if (body[0] === '#') {
                const code = body[1] === 'x' || body[1] === 'X'
                    ? parseInt(body.slice(2), 16)
                    : parseInt(body.slice(1), 10);
                return Number.isFinite(code) ? String.fromCodePoint(code) : match;
            }
            return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body)
                ? NAMED_ENTITIES[body]
                : match;
        });
    }

    return text;
}

function stripTags(value) {
    return decodeEntities(value)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tagValue(block, tagName) {
    const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'));
    return match ? stripTags(match[1]) : '';
}

function extractImage(block) {
    const candidates = [
        /<media:content\b[^>]*url=["']([^"']+)["']/i,
        /<media:thumbnail\b[^>]*url=["']([^"']+)["']/i,
        /<enclosure\b[^>]*url=["']([^"']+)["'][^>]*>/i,
        /<img\b[^>]*src=["']([^"']+)["']/i
    ];

    for (const pattern of candidates) {
        const match = block.match(pattern);
        if (!match) continue;
        const imageUrl = decodeEntities(match[1]).trim();
        if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
    }

    return '';
}

function normalizeRssDate(value) {
    return String(value || '').replace(/([A-Za-z]{3})\s+(\d{2})(?=\s+\d{2}:)/, (match, month, year) => {
        const numericYear = Number(year);
        return `${month} ${numericYear < 100 ? 2000 + numericYear : numericYear}`;
    });
}

function parseRss(xml, feed) {
    const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
    return blocks.slice(0, MAX_PER_FEED).map((block) => {
        const linkTag = block.match(/<link>([\s\S]*?)<\/link>/i);
        const atomLink = block.match(/<link[^>]+href=["']([^"']+)["']/i);
        const url = stripTags(linkTag ? linkTag[1] : (atomLink ? atomLink[1] : ''));
        const title = tagValue(block, 'title');
        const excerpt = tagValue(block, 'description').slice(0, EXCERPT_LENGTH);
        const date = normalizeRssDate(tagValue(block, 'pubDate') || tagValue(block, 'published') || tagValue(block, 'updated'));
        const image = extractImage(block);

        if (!title || !url) return null;

        return {
            title,
            url,
            excerpt,
            date,
            image,
            source: feed.source,
            lang: feed.lang
        };
    }).filter(Boolean);
}

async function loadFeeds(requestUrl) {
    const sourceUrl = new URL('/data/news-sources.json', requestUrl);
    const response = await fetch(sourceUrl);
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.feeds) ? data.feeds : [];
}

async function fetchFeed(feed) {
    const response = await fetch(feed.url, {
        headers: {
            Accept: 'application/rss+xml, application/xml, text/xml, */*',
            'User-Agent': 'ETAXHCM-NewsBot/1.0 (+https://etaxhcm.com)'
        },
        signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
        throw new Error(`${feed.id} returned ${response.status}`);
    }

    const xml = await response.text();
    return parseRss(xml, feed);
}

async function fetchNewsData(apiKey) {
    const endpoint = new URL('https://newsdata.io/api/1/news');
    endpoint.searchParams.set('apikey', apiKey);
    endpoint.searchParams.set('language', 'vi,en,zh');
    endpoint.searchParams.set('category', 'business');

    const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
        throw new Error(`newsdata returned ${response.status}`);
    }

    const payload = await response.json();
    const results = Array.isArray(payload.results) ? payload.results : [];

    return results.slice(0, 10).map((item) => {
        const lang = ['vi', 'en', 'zh'].includes(item.language) ? item.language : 'en';
        const title = stripTags(item.title || '');
        const url = item.link || item.url || '';
        if (!title || !url) return null;

        return {
            title,
            url,
            excerpt: stripTags(item.description || '').slice(0, EXCERPT_LENGTH),
            date: item.pubDate || item.published_at || '',
            image: item.image_url || '',
            source: item.source_name || item.source_id || 'News',
            lang
        };
    }).filter(Boolean);
}

function sortItems(items) {
    return items
        .sort((a, b) => {
            const aTime = Date.parse(a.date) || 0;
            const bTime = Date.parse(b.date) || 0;
            return bTime - aTime;
        })
        .slice(0, MAX_ITEMS);
}

export async function onRequestGet(context) {
    try {
        const feeds = await loadFeeds(context.request.url);
        const settled = await Promise.allSettled(feeds.map((feed) => fetchFeed(feed)));
        const items = [];
        const errors = [];

        settled.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                items.push(...result.value);
                return;
            }
            errors.push(feeds[index]?.id || 'feed');
        });

        if (context.env.NEWSDATA_API_KEY) {
            try {
                items.push(...await fetchNewsData(context.env.NEWSDATA_API_KEY));
            } catch (error) {
                console.warn('[api/headlines] newsdata:', error);
                errors.push('newsdata');
            }
        }

        const seen = new Set();
        const unique = items.filter((item) => {
            if (seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
        });

        return new Response(JSON.stringify({ items: sortItems(unique) }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'public, max-age=600, must-revalidate'
            }
        });
    } catch (error) {
        console.error('[api/headlines] error:', error);
        return new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'public, max-age=60'
            }
        });
    }
}
