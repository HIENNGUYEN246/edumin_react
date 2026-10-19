const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[BUILD] Installing frontend dependencies...');
execSync('npm --prefix frontend install', { stdio: 'inherit' });

console.log('[BUILD] Building Vite production frontend...');
execSync('npm --prefix frontend run build', { stdio: 'inherit' });

console.log('[BUILD] Syncing frontend/dist to root dist for Vercel...');
const src = path.resolve('frontend/dist');
const dest = path.resolve('dist');

if (fs.existsSync(src)) {
  fs.cpSync(src, dest, { recursive: true });
  console.log('[BUILD] Successfully prepared dist for Vercel deployment.');
} else {
  console.error('[BUILD] Error: frontend/dist was not found!');
  process.exit(1);
}
