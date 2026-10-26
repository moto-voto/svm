import express from 'express';
import { join } from 'path';
import { log } from './common.js';
import { apiSearch } from './api/api-search.js';
import { apiPlaylist } from './api/api-playlist.js';
import { apiSeries } from './api/api-series.js';
import { apiSeriesList } from './api/api-series-list.js';
import { apiSeriesDetails } from './api/api-series-details.js';
import { apiSeriesFilter } from './api/api-series-filter.js';

const __dirname = import.meta.dirname;

/**
 * Runtime mount point for the whole app (API + static UI). Must match the
 * `BASE_PATH` the frontend was built with (`vite.config.fe.js`), unless a
 * reverse proxy strips the prefix before forwarding (then keep this at "/").
 *
 * Examples:
 *   BASE_PATH=/svm node dist/svm.js   # app served at http://host/svm/
 *   node dist/svm.js                  # app served at http://host/
 */
const rawBase = process.env.BASE_PATH || '/';
const BASE_PATH = `/${String(rawBase).replace(/^\/+|\/+$/g, '')}`.replace(/^\/$/, '') || '';

const app = express();
const router = express.Router();

// ---- API ----

router.get('/api/search', async (req, res) => {
    const query = String(req.query.q || '');
    try {
        const searchResult = await apiSearch(query);
        res.json(searchResult);
    } catch (err) {
        res.json({ error: 'Failed to fetch search results.' + (err instanceof Error ? err.message : String(err)) });
    }
});

router.get('/api/series-list', async (req, res) => {
    try {
        const seriesList = await apiSeriesList();
        res.json(seriesList);
    } catch (err) {
        res.json({ error: 'Failed to fetch series list.' + (err instanceof Error ? err.message : String(err)) });
    }
});

router.get('/api/playlist', async (req, res) => {
    const seriesUrl = String(req.query.url || '');

    if (!seriesUrl) {
        return res.json({ error: 'Series URL is required' });
    }

    try {
        const playlists = await apiPlaylist(seriesUrl);
        res.json(playlists);
    } catch (err) {
        res.json({ error: 'Failed to fetch playlist:' + (err instanceof Error ? err.message : String(err)) });
    }
});

router.get('/api/series', async (req, res) => {
    const seriesUrl = String(req.query.url || '');

    if (!seriesUrl) {
        return res.json({ error: 'Series URL is required' });
    }

    try {
        const series = await apiSeries(seriesUrl);
        res.json(series);
    } catch (err) {
        res.json({ error: 'Failed to fetch series:' + (err instanceof Error ? err.message : String(err)) });
    }
});

router.get('/api/series-details', async (req, res) => {
    const url = String(req.query.url || '');

    if (!url) {
        return res.json({ error: 'Series URL is required' });
    }

    try {
        const series = await apiSeriesDetails(url);
        res.json(series);
    } catch (err) {
        res.json({ error: 'Failed to fetch series info:' + (err instanceof Error ? err.message : String(err)) });
    }
});

router.get('/api/series-filter', async (req, res) => {
    try {
        /** @param {any} val @returns {string | undefined} */
        const normalize = (val) => typeof(val) === 'undefined' ? undefined : Array.isArray(val) ? val.join(',') : String(val);
        const params = {
            filter_quotG: normalize(req.query.filter_quotG),
            filter_quotC: normalize(req.query.filter_quotC),
            filter_sortTo: normalize(req.query.filter_sortTo),
            filter_engName: normalize(req.query.filter_engName),
            filter_only: normalize(req.query.filter_only),
            filter_raiT: normalize(req.query.filter_raiT),
            filter_hd: normalize(req.query.filter_hd),
            filter_fhd: normalize(req.query.filter_fhd),
            filter_sub: normalize(req.query.filter_sub),
            filter_block: normalize(req.query.filter_block),
            filter_history: normalize(req.query.filter_history),
            filter_mark: normalize(req.query.filter_mark),
            filter_nw: normalize(req.query.filter_nw),
            filter_exp: normalize(req.query.filter_exp)
        };
        const results = await apiSeriesFilter(params);
        res.json(results);
    } catch (err) {
        res.json({ error: 'Failed to fetch filtered series:' + (err instanceof Error ? err.message : String(err)) });
    }
});

// ---- SolidJS SPA (built by `npm run build:fe` into dist/public) ----

const UI_DIST = join(__dirname, '..', 'dist', 'public');
router.use(express.static(UI_DIST));

// SPA fallback: unknown paths render the app so the client router can handle them.
router.use((_req, res) => {
    res.sendFile(join(UI_DIST, 'index.html'));
});

// Mount everything under the configured prefix ("/" when unset).
// The trailing-slash redirect keeps relative asset URLs (`./assets/...`)
// resolving against the app root. nginx should do the same when it serves
// the static files directly.
if (BASE_PATH) {
    app.get(BASE_PATH, (req, res, next) => {
        // Non-strict routing also matches the trailing-slash form; only the
        // bare prefix (no slash) needs the redirect.
        if (req.path === BASE_PATH) return res.redirect(301, `${BASE_PATH}/`);
        next();
    });
}
app.use(BASE_PATH || '/', router);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    log('log', `✅ Server running at http://localhost:${PORT}${BASE_PATH || ''}/`);
});