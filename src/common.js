export const TARGET = 'https://seasonvar.ru';
export const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3',
    'Host': 'seasonvar.ru',
    'Referer': 'https://seasonvar.ru/'
};


/**
 * 
 * @param {'log' | 'warn' | 'error'} level 
 * @param {string} message 
 */
export function log(level, message) {
    const timestamp = new Date().toISOString();
    console[level](`[${timestamp}] ${level.toUpperCase()}: ${message}`);
}
