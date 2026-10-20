import express from 'express';
import { load } from 'cheerio';
import { join } from 'path';
const __dirname = import.meta.dirname;

const app = express();
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

const TARGET = 'https://seasonvar.ru';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3',
    'Host': 'seasonvar.ru',
    'Referer': 'https://seasonvar.ru/'
};

// --- ROUTE 1: MAIN PAGE (SEARCH) ---
app.get('/', async (req, res) => {
    const query = req.query.q;
    let results = [];
    let error = null;

    if (query) {
        try {
            const searchUrl = `${TARGET}/search?q=${encodeURIComponent(query)}`;
            console.log(`\n🔍 [SEARCH DEBUG] Fetching URL: ${searchUrl}`);
            
            const response = await fetch(searchUrl, { headers: HEADERS });
            const htmlContent = await response.text();
            const $ = load(htmlContent);

            // Seasonvar search results are wrapped in .pgs-search-wrap
            $('.pgs-search-wrap').each((i, el) => {
                const infoBlock = $(el).find('.pgs-search-info');
                const titleLink = infoBlock.find('a').first();
                
                let title = titleLink.text().trim().replace(/\s+/g, ' ');
                let link = titleLink.attr('href');

                // Extract Image
                let imageSrc = $(el).find('a.pst img').attr('src');
                if (imageSrc && imageSrc.startsWith('//')) {
                    imageSrc = 'https:' + imageSrc;
                }

                // Extract Description
                let description = infoBlock.find('p').text().trim().replace(/\s+/g, ' ');

                if (title && link && title.length > 1) {
                    results.push({
                        title,
                        fullLink: link.startsWith('http') ? link : `${TARGET}/${link.replace(/^\//, '')}`,
                        image: imageSrc || null,
                        description: description || null
                    });
                }
            });

            console.log(`✅ [SEARCH DEBUG] Found ${results.length} unique results.`);

        } catch (err) {
            console.error('❌ [SEARCH DEBUG] Error:', err.message);
            error = 'Failed to fetch search results.';
        }
    }
    res.render('index', { results, query: query || '', error });
});

// --- ROUTE 2: SERIAL PAGE (EPISODE LIST) ---
app.get('/serial', async (req, res) => {
    const serialUrl = req.query.url;
    const title = req.query.title;
    let episodes = [];
    let error = null;

    if (!serialUrl) return res.redirect('/');

    try {
        console.log(`\n🔍 [SERIAL DEBUG] Fetching: ${serialUrl}`);
        const response = await fetch(serialUrl, { headers: HEADERS });
        const htmlContent = await response.text();

        // Extract the `pl` variable containing the playlist path
        const plMatch = htmlContent.match(/var\s+pl\s*=\s*\{[^}]*['"]0['"]\s*:\s*['"]([^'"]+)['"]/);
        
        if (plMatch && plMatch[1]) {
            const playlistPath = plMatch[1];
            const playlistUrl = playlistPath.startsWith('http') ? playlistPath : `https://seasonvar.ru${playlistPath}`;
            
            console.log(`✅ [SERIAL DEBUG] Found playlist URL: ${playlistUrl}`);
            
            const playlistRes = await fetch(playlistUrl, { headers: HEADERS });
            const playlistData = await playlistRes.json();

            if (Array.isArray(playlistData)) {
                console.log(`📺 [SERIAL DEBUG] Found ${playlistData.length} episodes.`);
                episodes = playlistData.map((ep, index) => {
                    const decodedFile = decodeSeasonvarLink(ep.file);
                    return {
                        title: ep.title.replace(/<br\s*\/?>/gi, ' - ').replace(/\s+/g, ' ').trim(),
                        file: decodedFile
                    };
                }).filter(ep => ep.file && ep.file.startsWith('http'));
            }
        } else {
             console.log('❌ [SERIAL DEBUG] Could not find `var pl` in the HTML.');
             error = 'Could not find the playlist URL.';
        }
    } catch (err) {
        console.error('❌ [SERIAL DEBUG] Error:', err.message);
        error = 'Failed to connect to the video server.';
    }

    res.render('serial', { title: title || 'Serial', episodes, error });
});

// --- DECODER ---
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
    console.log(`✅ Server running at http://localhost:${PORT}`);
});