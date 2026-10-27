import { Parser } from 'htmlparser2';
/** @import { SerialDescription } from '../parser/search.js'; */

const MAX_FILTER_RESULTS = 1000;

/**
 * Check if class attribute contains the given class name.
 * @param {string | string[] | undefined} className
 * @param {string} name
 * @returns {boolean}
 */
function hasClass(className, name) {
    if (!className) return false;
    if (Array.isArray(className)) {
        return className.some((c) => String(c).split(/\s+/).includes(name));
    }
    return String(className).split(/\s+/).includes(name);
}

/**
 * Decode a few common HTML entities.
 * @param {string} text
 * @returns {string}
 */
function decodeEntities(text) {
    if (!text) return '';
    return text
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&apos;/gi, "'");
}

/**
 * Parse seasonvar filter results (alphabetical list format) using streaming SAX parser.
 * Looks for .letter[data-tabt] elements and takes their next sibling element as container
 * holding <a> tags with data-id.
 * 
 * @param {string} htmlContent - The HTML content of filtered results page
 * @param {string} targetUrl - The base URL for constructing full links
 * @param {number} [limit] - Maximum number of items to parse
 * @returns {SerialDescription[]}
 */
export function parseFilterResults(htmlContent, targetUrl, limit = MAX_FILTER_RESULTS) {
    /** @type {SerialDescription[]} */
    const results = [];
    if (!htmlContent) return results;

    /** @type {Array<{tag: string, isLetterTabt?: boolean}>} */
    let tagStack = [];
    let inHiddenContainer = false;
    /** @type {string[]} */
    let hiddenStack = [];
    let inAnchor = false;
    /** @type {string | undefined} */
    let currentAnchorId;
    /** @type {string} */
    let currentAnchorHref = '';
    /** @type {string[]} */
    let currentAnchorTextParts = [];
    let depthAnchor = 0;
    // After closing a letter div with data-tabt, next sibling element becomes hidden container
    let expectHiddenContainerNextSibling = false;

    const parser = new Parser(
        {
            onopentag(name, attribs = {}) {
                if (results.length >= limit) {
                    parser.pause();
                    return;
                }

                const tagName = String(name).toLowerCase();

                // Check if this is a letter div with data-tabt at document level (not inside hidden)
                if (!inHiddenContainer && tagName === 'div' && hasClass(attribs.class, 'letter') && attribs['data-tabt'] !== undefined) {
                    tagStack.push({ tag: tagName, isLetterTabt: true });
                    return;
                }

                // If expecting hidden container as next sibling of a just-closed letter div
                if (!inHiddenContainer && expectHiddenContainerNextSibling) {
                    inHiddenContainer = true;
                    hiddenStack = [tagName];
                    expectHiddenContainerNextSibling = false;
                    tagStack.push({ tag: tagName });
                    if (tagName === 'a') {
                        inAnchor = true;
                        depthAnchor = 1;
                        currentAnchorId = attribs['data-id'];
                        currentAnchorHref = attribs.href || '';
                        currentAnchorTextParts = [];
                    }
                    return;
                }

                if (inHiddenContainer) {
                    hiddenStack.push(tagName);
                    tagStack.push({ tag: tagName });
                    if (tagName === 'a' && !inAnchor) {
                        inAnchor = true;
                        depthAnchor = 1;
                        currentAnchorId = attribs['data-id'];
                        currentAnchorHref = attribs.href || '';
                        currentAnchorTextParts = [];
                        return;
                    } else if (inAnchor) {
                        depthAnchor++;
                        return;
                    }
                    return;
                }

                tagStack.push({ tag: tagName });
            },
            ontext(text) {
                if (results.length >= limit) {
                    parser.pause();
                    return;
                }
                if (inAnchor && text) {
                    currentAnchorTextParts.push(text);
                }
            },
            onclosetag(name) {
                if (results.length >= limit) {
                    parser.pause();
                    return;
                }

                const tagName = String(name).toLowerCase();

                // Check if we're closing a letter div with data-tabt
                if (!inHiddenContainer && tagStack.length > 0) {
                    const top = tagStack[tagStack.length - 1];
                    if (top && top.tag === tagName && top.isLetterTabt) {
                        tagStack.pop();
                        expectHiddenContainerNextSibling = true;
                        return;
                    }
                }

                if (inAnchor && tagName === 'a') {
                    depthAnchor--;
                    if (depthAnchor <= 0) {
                        if (currentAnchorId) {
                            const rawText = currentAnchorTextParts.join('');
                            const title = decodeEntities(rawText).trim().replace(/\s+/g, ' ');
                            const link = currentAnchorHref;
                            let fullLink;
                            try {
                                fullLink = link.startsWith('http') ? link : new URL(link, targetUrl).href;
                            } catch {
                                fullLink = link;
                            }
                            const imageUrl = `https://cdn.svstat.net/oblojka/${currentAnchorId}.jpg`;
                            results.push({
                                id: String(currentAnchorId),
                                title,
                                fullLink,
                                image: imageUrl,
                                description: null,
                            });
                            if (results.length >= limit) {
                                parser.pause();
                            }
                        }
                        inAnchor = false;
                        depthAnchor = 0;
                        currentAnchorId = undefined;
                        currentAnchorHref = '';
                        currentAnchorTextParts = [];
                    }
                    // Pop from stack if it's there
                    if (tagStack.length > 0 && tagStack[tagStack.length - 1]?.tag === tagName) {
                        tagStack.pop();
                    }
                    if (inHiddenContainer && hiddenStack.length > 0 && hiddenStack[hiddenStack.length - 1] === tagName) {
                        // Don't pop hiddenStack here if it's just anchor inside - anchor is handled separately
                    }
                    return;
                }

                if (inHiddenContainer) {
                    if (hiddenStack.length > 0 && hiddenStack[hiddenStack.length - 1] === tagName) {
                        hiddenStack.pop();
                    }
                    if (tagStack.length > 0 && tagStack[tagStack.length - 1]?.tag === tagName) {
                        tagStack.pop();
                    }
                    if (hiddenStack.length === 0) {
                        // Closed the hidden container
                        inHiddenContainer = false;
                        expectHiddenContainerNextSibling = false;
                    }
                    return;
                }

                if (tagStack.length > 0 && tagStack[tagStack.length - 1]?.tag === tagName) {
                    tagStack.pop();
                }
            },
            onend() {
                // done
            },
        },
        { decodeEntities: false }
    );

    parser.write(htmlContent);
    parser.end();

    return results;
}
