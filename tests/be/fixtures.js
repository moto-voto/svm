/**
 * Shared fixtures and helpers for backend unit tests.
 */
import { TARGET } from '../../src/common.js';

/**
 * Encode a URL the way Seasonvar does in playlist payloads.
 * @param {string} url
 */
export function encodeEpisodeFile(url) {
    const base64 = Buffer.from(url, 'utf8').toString('base64');
    // Leading `#<digit>` is stripped by the decoder.
    return `#1${base64}`;
}

export const searchHtml = `
<html><body>
  <div class="pgs-search-wrap">
    <a class="pst" href="/serial-1-test.html"><img src="//cdn.svstat.net/oblojka/1.jpg"></a>
    <div class="pgs-search-info">
      <a href="/serial-1-test.html">  Test   Show  </a>
      <p>  A   description  </p>
    </div>
  </div>
  <div class="pgs-search-wrap">
    <a class="pst" href="https://other.example/x.html"><img src="https://img.example/x.jpg"></a>
    <div class="pgs-search-info">
      <a href="https://other.example/x.html">Second</a>
      <p></p>
    </div>
  </div>
</body></html>`;

export const defaultListHtml = `
<html><body>
  <div class="news">
    <a data-id="43004" href="/serial-43004-nePara-3-season.html">
      <div class="news_w">
        <div class="news_n">Series Title</div>
        <div class="season">(3 сезон)</div>
      </div>
      <span class="news_s">1-8 серия</span>
    </a>
  </div>
  <div class="news">
    <a data-id="43005" href="https://seasonvar.ru/serial-43005-other.html">
      <div class="news_w">
        <div class="news_n">Another</div>
      </div>
    </a>
  </div>
</body></html>`;

export const seriesDetailsHtml = `
<html>
<head>
  <link rel="canonical" href="https://seasonvar.ru/serial-43004-test.html">
  <meta property="og:image" content="//cdn.svstat.net/oblojka/43004.jpg">
  <meta name="description" content="A test description">
</head>
<body>
  <div class="pgs-sinfo" data-id-season="43004-season" data-id-serial="43004">
    <h1 class="pgs-sinfo-title">Test Series (не)Пара</h1>
    <div class="pgs-sinfo_list">Страна: <span>США</span></div>
    <div class="pgs-sinfo_list">Жанр: <span>комедия, мелодрамы</span></div>
    <div class="pgs-sinfo_list">Вышел: 2024</div>
    <div class="pgs-sinfo_list">Оригинал: <span>Mismatched</span></div>
    <div class="pgs-sinfo_list rating">IMDB: <span>6.00</span></div>
    <div class="pgs-sinfo_list rating">КиноПоиск: <span>7.24</span></div>
  </div>
  <div class="pgs-seaslist">
    <a href="/s1.html">Сезон 1</a>
    <a href="/s2.html">Сезон 2</a>
  </div>
</body>
</html>`;

/** Series page with two seasons and no translations. */
export const seriesSimpleHtml = `
<html><body>
  <div class="pgs-seaslist">
    <div class="tabs-result">
      <a href="/s1.html">>>>Сезон 1 01.01.2024 8 серий</a>
      <a href="/s2.html">Сезон 2 05.05.2023 10 серий</a>
    </div>
  </div>
</body></html>`;

/**
 * Series page with seasons plus two translations and matching playlist JSON.
 * @returns {{ html: string, routes: Record<string, unknown[]> }}
 */
export function seriesWithTranslations() {
    const mk = (url) => ({ title: 'Episode 1<br/>Pilot', file: encodeEpisodeFile(url) });
    const pl0 = [mk('https://example.com/e1.mp4')];
    const pl1 = [mk('https://example.com/f1.mp4')];

    const html = `
<html><body>
  <div class="pgs-sinfo" data-id-season="43004-season" data-id-serial="43004"></div>
  <div class="pgs-seaslist">
    <div class="tabs-result">
      <a href="/s1.html">>>>Сезон 1 01.01.2024 8 серий</a>
    </div>
  </div>
  <script>var pl = {'0':'/plist/0.json','1':'/plist/1.json'};</script>
  <ul>
    <li data-click="translate" data-translate="0">Дубляж</li>
    <li data-click="translate" data-translate="1">Субтитры</li>
  </ul>
</body></html>`;

    return {
        html,
        routes: {
            [`${TARGET}/plist/0.json`]: pl0,
            [`${TARGET}/plist/1.json`]: pl1,
        },
    };
}

/** Playlist page using the `pl[id] = "..."` assignment form and no <li> list. */
export function playlistAssignmentOnly() {
    const pl = [{ title: 'Only<br>One', file: encodeEpisodeFile('https://example.com/only.mp4') }];
    const html = `
<html><body>
  <script>pl['0'] = '/plist/only.json';</script>
</body></html>`;
    return { html, routes: { [`${TARGET}/plist/only.json`]: pl } };
}

/** Playlist page whose payload contains an undecodable/non-http entry to be filtered. */
export function playlistWithInvalidEntry() {
    const pl = [
        { title: 'Good', file: encodeEpisodeFile('https://example.com/good.mp4') },
        { title: 'Bad', file: encodeEpisodeFile('ftp://example.com/bad.mp4') },
    ];
    const html = `
<html><body>
  <script>var pl = {'0':'/plist/mixed.json'};</script>
  <ul><li data-click="translate" data-translate="0">Default</li></ul>
</body></html>`;
    return { html, routes: { [`${TARGET}/plist/mixed.json`]: pl } };
}