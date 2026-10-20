import express from 'express';
import { join } from 'path';
import { log } from './common.js';
import { apiSearch } from './api/api-search.js';
import { apiPlaylist } from './api/api-playlist.js';
import { apiSeries } from './api/api-series.js';

const __dirname = import.meta.dirname;


const app = express();
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

app.get('/', async (req, res) => {
    const query = String(req.query.q || '');
    try {
        const results = await apiSearch(query);
        res.render('index', { results, query: query, error: null });
    } catch (err) {
        const error = 'Failed to fetch search results.' + (err instanceof Error ? err.message : String(err));
        res.render('index', { results: [], query: query, error });
    }
});

app.get('/series', async (req, res) => {
    const seriesUrl = String(req.query.url || '');
    const title = req.query.title;

    if (!seriesUrl) {
        return res.redirect('/');
    }

    try {
        const series = await apiSeries(seriesUrl);
        res.render('player', series);
    } catch (err) {
        res.render('player', { error:err });
    }
});

app.get('/api/search', async (req, res) => {
    const query = String(req.query.q || '');
    try {
        const searchResult = await apiSearch(query);
        res.json(searchResult);
    } catch (err) {
        res.json({ error: 'Failed to fetch search results.' + (err instanceof Error ? err.message : String(err)) });
    }
});


app.get('/api/playlist', async (req, res) => {
    const seriesUrl = String(req.query.url || '');

    if (!seriesUrl) {
        res.json({ error: 'Series URL is required' });
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
        res.json({ error: 'Series URL is required' });
    }

    try {
        const series = await apiSeries(seriesUrl);
        res.json(series);
    } catch (err) {
        res.json({ error: 'Failed to fetch series:' + (err instanceof Error ? err.message : String(err)) });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    log('log', `✅ Server running at http://localhost:${PORT}`);
});