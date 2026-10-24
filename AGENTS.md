# AGENTS.md

Guidelines for AI coding agents working in this repository.

## JSDoc type imports

Use `@import` directives instead of inline `import('module').Type` in JSDoc:

```js
/** @import { JSXElement } from 'solid-js' */

/**
 * @param {{
 *   topRight?: JSXElement,
 *   children?: JSXElement,
 * }} props
 */
```

The directive goes in a standalone JSDoc block right after the `import`
statements. Use it for local types too:

```js
/** @import { SeriesDetails } from '../../parser/series-details.js' */

/** @returns {Promise<SeriesDetails>} */
```

**Exception:** types declared in the same file via `@typedef` resolve as
locals — reference them by bare name and skip the `@import` (a self-import
causes TS2440: "Import declaration conflicts with local declaration"):

```js
/** @returns {SeasonProgress | null} */ // SeasonProgress is a local @typedef
```