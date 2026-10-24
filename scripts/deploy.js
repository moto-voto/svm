import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Recreate __dirname and __filename in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= Configuration =================
const REMOTE_HOST = "root@motor-heat.duckdns.org";
const SSH_KEY = path.join(process.env.HOME || process.env.USERPROFILE || '', ".ssh", "id_ed25519");
const REMOTE_WEB_DIR = "/var/www/svm/";
const REMOTE_APP_DIR = "/opt/svm/";
// =================================================

// Define paths relative to project root (one level up from 'scripts')
const PROJECT_ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

console.log(`==> Starting deployment to ${REMOTE_HOST} (IPv4)...`);

// Helper function to run shell commands cleanly
/**
 * @param {string} command
 * @param {readonly string[]} args
 */
function runCommand(command, args) {
    const result = spawnSync(command, args, { stdio: 'inherit' });
    if (result.error) {
        console.error(`[ERROR] Failed to execute ${command}:`, result.error.message);
        process.exit(1);
    }
    if (result.status !== 0) {
        console.error(`[ERROR] Command failed with exit code ${result.status}`);
        process.exit(result.status);
    }
}

// 0. Delete old public files on the server
console.log("==> Deleting old public files on the server...");
runCommand('ssh', [
    '-4', // Force IPv4
    '-i', SSH_KEY,
    REMOTE_HOST,
    `rm -r ${REMOTE_WEB_DIR}*`
]);


// 1. Copy public static files
console.log("==> Copying public files...");
runCommand('scp', [
    '-4', // Force IPv4
    '-i', SSH_KEY,
    '-r',
    path.join(DIST_DIR, 'public', '*'),
    `${REMOTE_HOST}:${REMOTE_WEB_DIR}`
]);

// 2. Copy svm.js
console.log("==> Copying svm.js...");
runCommand('scp', [
    '-4', // Force IPv4
    '-i', SSH_KEY,
    path.join(DIST_DIR, 'svm.js'),
    `${REMOTE_HOST}:${REMOTE_APP_DIR}svm.js`
]);

// 3. Fix ownership and restart the runit service
console.log("==> Fixing permissions and restarting svm service...");
runCommand('ssh', [
    '-4', // Force IPv4
    '-i', SSH_KEY,
    REMOTE_HOST,
    `chown -R root:svm ${REMOTE_WEB_DIR} && chmod -R 755 ${REMOTE_WEB_DIR} && chown -R svm:svm ${REMOTE_APP_DIR} && sv restart svm && sv restart nginx`
]);

console.log("==> Deployment completed successfully!");
