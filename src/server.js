import express from 'express';
import { join } from 'path';
import { parseSearchResults } from './parser/search.js';
import { HEADERS, log, TARGET } from './common.js';
import { parsePlaylist } from './parser/playlists.js';
import { parseDefaultList } from './parser/defaultList.js';
const __dirname = import.meta.dirname;

/** @import {SerialDescription} from './parser/search.js' */

const app = express();
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

// --- ROUTE 1: MAIN PAGE (SEARCH) ---
app.get('/', async (req, res) => {
    /** @type {string | undefined} **/
    const query = String(req.query.q || '');

    /**
     * @type {SerialDescription[]}
     */
    let results = [];
    let error = null;

    if (query) {
        try {
            const searchUrl = `${TARGET}/search?q=${encodeURIComponent(query)}`;
            log('log', `\n🔍 [SEARCH DEBUG] Fetching URL: ${searchUrl}`);
            
            const response = await fetch(searchUrl, { headers: HEADERS });
            const htmlContent = await response.text();
            results = parseSearchResults(htmlContent, TARGET);
            log('log', `✅ [SEARCH DEBUG] Found ${results.length} unique results.`);

        } catch (err) {
            log('warn', '⚠️ [SEARCH DEBUG] Warning:' + (err instanceof Error ? err.message : String(err)));
            log('error', '❌ [SEARCH DEBUG] Error:' + (err instanceof Error ? err.message : String(err)));
            error = 'Failed to fetch search results.';
        }
    } else {
            const response = await fetch(TARGET, { headers: HEADERS });
            const htmlContent = await response.text();
            results = parseDefaultList(htmlContent, TARGET);
    }

    res.render('index', { results, query: query || '', error });
});

// --- ROUTE 2: SERIAL PAGE (EPISODE LIST) ---
app.get('/serial', async (req, res) => {
    const serialUrl = String(req.query.url || '');
    const title = req.query.title;
    /**
     * @type {{ title: any; file: string | null; }[]}
     */

    if (!serialUrl) return res.redirect('/');

    try {
        log('log', `\n🔍 [SERIAL DEBUG] Fetching: ${serialUrl}`);
        const response = await fetch(serialUrl, { headers: HEADERS });
        const htmlContent = await response.text();
        const episodes = await parsePlaylist(htmlContent);
        res.render('serial', { title: title || 'Serial', episodes, error: null });
    } catch (err) {
        log('error', '❌ [SERIAL DEBUG] Error:' + (err instanceof Error ? err.message : String(err)));
        res.render('serial', { title: title || 'Serial', episodes: [], err});
    }
});

// --- DECODER ---
/**
 * @param {string} encodedStr
 * @returns {string | null}
 */
function decodeSeasonvarLink(encodedStr) {
    try {
        let clean = encodedStr.replace(/^#\d/, '');
        clean = clean.replace(/\/\/b2xvbG8=/g, '').replace(/b2xvbG8=/g, '').replace(/b2xvbG8/g, '');
        while (clean.length % 4 !== 0) clean += '=';
        let decoded = Buffer.from(clean, 'base64').toString('utf8');
        decoded = decoded.replace(/ololo/g, '').replace(/[^\x20-\x7E]/g, '');
        if (decoded.startsWith('//')) decoded = 'https:' + decoded;
        return decoded.trim();
    } catch (err) {
        return null;
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    log('log', `✅ Server running at http://localhost:${PORT}`);
});