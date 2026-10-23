/**
 * Dev orchestrator for `npm run dev:ui`.
 *
 * Starts the Express backend (which owns the `/api/*` routes) and the Vite dev
 * server (which owns the UI + HMR) side by side. Vite proxies `/api` to the
 * backend (see src/ui/vite.config.js), so the UI can talk to the API without a
 * build step. When either process exits, the other is shut down.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
let shuttingDown = false;

/**
 * @param {string} name
 * @param {string[]} args
 */
function start(name, args) {
    const child = spawn(process.execPath, args, {
        cwd: root,
        stdio: 'inherit',
        env: process.env,
    });

    child.on('exit', (code, signal) => {
        if (shuttingDown) return;
        console.error(`\n[dev:ui] ${name} exited (${code ?? signal ?? 'unknown'}). Stopping the other process...`);
        shutdown(typeof code === 'number' ? code : 1);
    });

    children.push(child);
}

/**
 * @param {number} code
 */
function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;

    for (const child of children) {
        if (!child.killed) {
            child.kill('SIGTERM');
        }
    }

    // Give children a moment to exit cleanly, then force-quit.
    setTimeout(() => process.exit(code), 300).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

// Backend first so the proxy target is up when Vite starts handling requests.
start('backend', ['src/server.js']);
start('vite', [join('node_modules', 'vite', 'bin', 'vite.js'), '--config', 'src/ui/vite.config.js']);