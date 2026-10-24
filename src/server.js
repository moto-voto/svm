import express from 'express';
import { join } from 'path';
import { log } from './common.js';
import { apiSearch } from './api/api-search.js';
import { apiPlaylist } from './api/api-playlist.js';
import { apiSeries } from './api/api-series.js';
import { apiSeriesList } from './api/api-series-list.js';
import { apiSeriesDetails } from './api/api-series-details.js';

const __dirname = import.meta.dirname;

const app = express();

// ---- API ----

app.get('/api/search', async (req, res) => {
    const query = String(req.query.q || '');
    try {
        const searchResult = await apiSearch(query);
        res.json(searchResult);
    } catch (err) {
        res.json({ error: 'Failed to fetch search results.' + (err instanceof Error ? err.message : String(err)) });
    }
});

app.get('/api/series-list', async (req, res) => {
    try {
        const seriesList = await apiSeriesList();
        res.json(seriesList);
    } catch (err) {
        res.json({ error: 'Failed to fetch series list.' + (err instanceof Error ? err.message : String(err)) });
    }
});

app.get('/api/playlist', async (req, res) => {
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

app.get('/api/series', async (req, res) => {
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

app.get('/api/series-details', async (req, res) => {
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

// ---- SolidJS SPA (built by `npm run build:ui` into dist/public) ----

const UI_DIST = join(__dirname, '..', 'dist', 'public');
app.use(express.static(UI_DIST));

// SPA fallback: unknown paths render the app so the client router can handle them.
app.use((_req, res) => {
    res.sendFile(join(UI_DIST, 'index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    log('log', `✅ Server running at http://localhost:${PORT}`);
});

