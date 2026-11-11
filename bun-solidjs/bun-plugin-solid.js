/**
 * Bun plugin for SolidJS - uses Babel with babel-preset-solid
 * This is the same compiler that vite-plugin-solid uses internally.
 *
 * Generic plugin - no project-specific paths or assumptions.
 * Handles: .jsx, .tsx, .css, static assets
 */

const babel = require("@babel/core");
const solid = require("babel-preset-solid");
const ts = require("@babel/preset-typescript");

/**
 * @param {Object} [options]
 * @param {"dom"|"ssr"} [options.generate="dom"] - "dom" for client, "ssr" for server
 * @param {boolean} [options.hydratable=true] - enable hydration markers
 * @param {boolean} [options.dev=false] - dev mode (source maps, HMR refresh)
 * @param {function(string): void} [options.onModule] - callback for each resolved module
 * @param {Object} [options.babelOptions] - extra Babel options
 */
function solidPlugin(options = {}) {
  const {
    generate = "dom",
    hydratable = true,
    dev = false,
    onModule = null,
    babelOptions = {},
  } = options;

  const solidOptions = { generate, hydratable, dev };

  return {
    name: "bun-plugin-solid",
    setup(build) {
      // Track all resolved JS/TS modules
      build.onResolve({ filter: /\.[jt]sx?$/ }, (args) => {
        if (onModule) onModule(args.path);
        return undefined;
      });

      // Transform .jsx/.tsx with Babel + babel-preset-solid
      build.onLoad({ filter: /\.[jt]sx$/ }, async (args) => {
        const { readFile } = await import("node:fs/promises");
        const code = await readFile(args.path, "utf8");

        try {
          const result = await babel.transformAsync(code, {
            filename: args.path,
            presets: [[solid, solidOptions], [ts]],
            configFile: false,
            babelrc: false,
            sourceMaps: dev,
            sourceFileName: args.path,
            ...babelOptions,
          });

          if (!result?.code) {
            throw new Error("Babel transform returned empty code");
          }

          return {
            contents: result.code,
            loader: "js",
            sourceMap: result.map || undefined,
          };
        } catch (error) {
          return { errors: [{ text: String(error) }] };
        }
      });

      // CSS: pass through with css loader (Bun emits as separate file)
      build.onLoad({ filter: /\.css$/ }, async (args) => {
        const { readFile } = await import("node:fs/promises");
        const code = await readFile(args.path, "utf8");
        return { contents: code, loader: "css" };
      });

      // Static assets: inline as data URLs
      build.onLoad({ filter: /\.(svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot)$/ }, async (args) => {
        const { readFile } = await import("node:fs/promises");
        const data = await readFile(args.path);
        const base64 = data.toString("base64");
        const ext = args.path.split(".").pop().toLowerCase();
        const mime = {
          svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
          gif: "image/gif", webp: "image/webp", ico: "image/x-icon",
          woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", eot: "application/vnd.ms-fontobject",
        }[ext] || "application/octet-stream";
        return {
          contents: `export default "data:${mime};base64,${base64}";`,
          loader: "js",
        };
      });
    },
  };
}

module.exports = solidPlugin;
module.exports.default = solidPlugin;