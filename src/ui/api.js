/**
 * Fetch series from the backend search API.
 * @param {string} query
 * @returns {Promise<import('../parser/search.js').SerialDescription[]>}
 */
export async function searchSeries(query) {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
        throw new Error(data?.error || 'Unexpected response from server');
    }
    return data;
}
