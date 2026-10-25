import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Recreate __dirname and __filename in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= Configuration =================
const REMOTE_HOST = "root@motor-heat.duckdns.org";
const SSH_KEY = path.join(process.env.HOME || process.env.USERPROFILE || '', ".ssh", "id_ed25519");
// Remote paths are owned by scripts/install.remote.sh (WEB=/var/www/svm, APP=/opt/svm).
// =================================================

// Define paths relative to project root (one level up from 'scripts')
const PROJECT_ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const NODE_MODULES_DIR = path.join(PROJECT_ROOT, 'node_modules');

// npm is npm.cmd on Windows
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

console.log(`==> Starting deployment to ${REMOTE_HOST} (IPv4)...`);

// Helper function to run shell commands cleanly
/**
 * @param {string} command
 * @param {readonly string[]} args
 */
function runCommand(command, args) {
    const fullCommand = [command, ...args].join(' ');
    const result = spawnSync(fullCommand, { stdio: 'inherit', shell: process.platform === 'win32'  });
    if (result.error) {
        console.error(`[ERROR] Failed to execute ${command}:`, result.error.message);
        process.exit(1);
    }
    if (result.status !== 0) {
        console.error(`[ERROR] Command failed with exit code ${result.status}`);
        process.exit(result.status);
    }
}

/**
 * Recursively delete a local folder (no error if it doesn't exist).
 * @param {string} dir
 */
function removeLocalDir(dir) {
    if (!fs.existsSync(dir)) {
        console.log(`==> ${path.relative(PROJECT_ROOT, dir)} not found, skipping...`);
        return;
    }
    console.log(`==> Deleting local ${path.relative(PROJECT_ROOT, dir)}...`);
    fs.rmSync(dir, { recursive: true, force: true });
}

// ================= Predeploy (local) =================

// 0. Clean local build artifacts and dependencies
removeLocalDir(DIST_DIR);
removeLocalDir(NODE_MODULES_DIR);

// 1. Install npm packages from scratch
console.log("==> Installing npm packages...");
runCommand(NPM, ['install', '--no-audit', '--no-fund']);

// 2. Type check
console.log("==> Running type check (tsc)...");
runCommand(NPM, ['run', 'check']);

// 3. Run tests
console.log("==> Running tests...");
runCommand(NPM, ['test']);

// 4. Build frontend and backend
console.log("==> Building frontend...");
runCommand(NPM, ['run', 'build:fe']);
console.log("==> Building backend...");
runCommand(NPM, ['run', 'build:be']);

// ===================================================
// Everything above must succeed before touching the host.
// ===================================================

// 4b. Verify build artifacts exist before deploying
const PUBLIC_DIR = path.join(DIST_DIR, 'public');
const SVM_JS = path.join(DIST_DIR, 'svm.js');
if (!fs.existsSync(SVM_JS)) {
    console.error(`[ERROR] Build artifact missing: ${SVM_JS}`);
    process.exit(1);
}
if (!fs.existsSync(PUBLIC_DIR)) {
    console.error(`[ERROR] Build artifact missing: ${PUBLIC_DIR}`);
    process.exit(1);
}
console.log("==> Build artifacts verified.");

// ================= Deploy (single SSH connection) =================
const REMOTE_STAGE = '/tmp/svm-deploy';
const INSTALL_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'install.remote.sh');

// 5. Pack artifacts + remote install script into a tarball (in memory).
//    -C uses absolute paths so the archive layout is: svm.js, public/, install.remote.sh
console.log("==> Packing build artifacts...");
const tar = spawnSync('tar', [
    '-C', DIST_DIR, '-czf', '-', 'svm.js', 'public',
    '-C', path.join(PROJECT_ROOT, 'scripts'), path.basename(INSTALL_SCRIPT),
], { stdio: ['inherit', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 });
if (tar.error) {
    console.error('[ERROR] Failed to run tar:', tar.error.message);
    process.exit(1);
}
if (tar.status !== 0) {
    console.error(`[ERROR] tar failed with exit code ${tar.status}`);
    process.exit(tar.status);
}

// 6. Stream everything over ONE ssh connection: extract on the server, then
//    let install.remote.sh do the swap, permissions and service restarts.
const remoteCommand = [
    'set -e',
    `rm -rf ${REMOTE_STAGE}`,
    `mkdir -p ${REMOTE_STAGE}`,
    `tar -xzf - -C ${REMOTE_STAGE}`,
    // Normalize the script in case it was packed with CRLF endings
    `sed -i 's/\\r$//' ${REMOTE_STAGE}/install.remote.sh`,
    `bash ${REMOTE_STAGE}/install.remote.sh`,
].join('\n');

console.log(`==> Deploying to ${REMOTE_HOST} (IPv4) in a single connection...`);
const ssh = spawnSync('ssh', [
    '-4', // Force IPv4
    // '-i', SSH_KEY,
    REMOTE_HOST,
    remoteCommand,
], { stdio: ['pipe', 'inherit', 'inherit'], input: tar.stdout });
if (ssh.error) {
    console.error('[ERROR] Failed to run ssh:', ssh.error.message);
    process.exit(1);
}
if (ssh.status !== 0) {
    console.error(`[ERROR] ssh failed with exit code ${ssh.status}`);
    process.exit(ssh.status);
}

console.log("==> Deployment completed successfully!");