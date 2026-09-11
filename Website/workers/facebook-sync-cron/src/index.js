export default {
    async scheduled(event, env) {
        const syncUrl = env.SYNC_URL || 'https://etaxhcm.com/api/sync/facebook';
        const secret = env.WEBHOOK_SYNC_SECRET;

        if (!secret) {
            console.warn('[facebook-sync-cron] WEBHOOK_SYNC_SECRET is not configured');
            return;
        }

        const url = `${syncUrl}?secret=${encodeURIComponent(secret)}`;
        const response = await fetch(url, { method: 'GET' });

        const body = await response.text();
        console.log('[facebook-sync-cron] status:', response.status, body);

        if (!response.ok) {
            throw new Error(`Facebook sync failed (${response.status}): ${body}`);
        }
    }
};
