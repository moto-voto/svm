/**
 * @typedef {Object} SolidPluginOptions
 * @property {"dom"|"ssr"} [generate="dom"] - Output mode: "dom" for client-side, "ssr" for server-side rendering
 * @property {boolean} [hydratable=true] - Enable hydration markers for SSR hydration
 * @property {boolean} [dev=false] - Dev mode: enables source maps and HMR refresh registration
 * @property {function(string): void} [onModule] - Callback invoked for each resolved module path
 * @property {Object} [babelOptions] - Additional Babel transform options passed to @babel/core
 */

/**
 * @typedef {Object} BuildOptions
 * @property {boolean} [minify=true] - Minify output with Bun's minifier
 * @property {boolean} [splitting=true] - Enable code splitting for shared chunks
 * @property {"browser"|"bun"|"node"} [target="browser"] - Build target environment
 * @property {string[]} [conditions] - Custom export conditions (e.g. ["browser", "production"])
 * @property {Object<string, string>} [define] - Global constant definitions (e.g. {"process.env.NODE_ENV": '"production"'})
 * @property {string} [naming="[name]-[hash].[ext]"] - Output filename pattern
 * @property {string[]} [external] - Packages to exclude from bundle
 */

/**
 * @typedef {Object} ServerOptions
 * @property {number} [port=5173] - Dev server port
 * @property {string|null} [apiProxy="http://localhost:3000"] - Proxy /api/* requests to this URL. Set to null to disable.
 */

/**
 * @typedef {Object} BunSolidConfig
 * @property {string} entry - Path to HTML entry file (e.g. "index.html" or "src/ui/index.html"). The script entry point is read from `<script type="module" src="...">` inside this file.
 * @property {string} outDir - Output directory. Cleaned before each build.
 * @property {string} [publicDir] - Directory with static assets (favicons, etc.) copied to outDir root. Omit if not needed.
 * @property {SolidPluginOptions} [solid] - Options passed to the Solid plugin
 * @property {ServerOptions} [server] - Dev server options (used by dev.js only)
 * @property {BuildOptions} [build] - Options passed to Bun.build()
 */

/**
 * @type {BunSolidConfig}
 */
export default {};