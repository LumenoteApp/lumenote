// Deploy dist/ to lumenote.nl over FTP.
//   npm run deploy            build, show plan, ask, back up the live site, upload
//   npm run deploy -- --dry   show what would change, touch nothing
//   npm run deploy -- --yes   no question (still backs up)
//   npm run deploy -- --clean also remove old files in assets/ that the new build no longer uses
// Settings live in .env.deploy (not in git). See .env.deploy.example.
import { Client } from 'basic-ftp';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const args = new Set(process.argv.slice(2));
const dry = args.has('--dry');

function loadEnv() {
  const file = process.env.DEPLOY_ENV ?? join(root, '.env.deploy');
  if (!existsSync(file)) fail('.env.deploy is missing. Copy .env.deploy.example to .env.deploy and fill it in.');
  const env = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  for (const k of ['FTP_HOST', 'FTP_USER', 'FTP_PASSWORD', 'FTP_DIR']) {
    if (!env[k]) fail(`${k} is empty in .env.deploy`);
  }
  return env;
}

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

function localFiles(dir, base = dir, out = new Map()) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) localFiles(full, base, out);
    else out.set(relative(base, full).replaceAll('\\', '/'), { full, size: statSync(full).size });
  }
  return out;
}

async function remoteFiles(ftp, dir, prefix = '', out = new Map()) {
  for (const f of await ftp.list(dir)) {
    if (f.name === '.' || f.name === '..') continue;
    const rel = prefix + f.name;
    if (f.isDirectory) await remoteFiles(ftp, `${dir}/${f.name}`, rel + '/', out);
    else out.set(rel, { size: f.size });
  }
  return out;
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

const env = loadEnv();
const remoteRoot = env.FTP_DIR.replace(/\/+$/, '');

if (!args.has('--skip-build')) {
  console.log('Building…');
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
}
const local = localFiles(dist);

const ftp = new Client(30000);
try {
  console.log(`\nConnecting to ${env.FTP_HOST} as ${env.FTP_USER}…`);
  const secure = (env.FTP_SECURE ?? 'true').toLowerCase() !== 'false';
  try {
    await ftp.access({ host: env.FTP_HOST, port: Number(env.FTP_PORT || 21), user: env.FTP_USER, password: env.FTP_PASSWORD, secure });
  } catch (e) {
    const hint = /certificate|altname|self.signed/i.test(e.message)
      ? ' The TLS certificate does not match this host. Use the server name from site.nl as FTP_HOST, or set FTP_SECURE=false.'
      : /530|login/i.test(e.message) ? ' Check FTP_USER and FTP_PASSWORD.' : '';
    fail(`Could not connect: ${e.message}.${hint}`);
  }

  try {
    await ftp.cd(remoteRoot);
  } catch {
    fail(`Folder "${remoteRoot}" does not exist on the server. Check FTP_DIR (the folder you open in FileZilla).`);
  }
  await ftp.cd('/');

  const remote = await remoteFiles(ftp, remoteRoot);

  // Hashed files in assets/ only change when their size changes; everything else is small, so always send it.
  const upload = [...local].filter(([rel, f]) => !rel.startsWith('assets/') || remote.get(rel)?.size !== f.size);
  const stale = [...remote.keys()].filter((rel) => rel.startsWith('assets/') && !local.has(rel));

  console.log(`\nTarget: ${env.FTP_HOST}:${remoteRoot}  (${remote.size} files there now)`);
  console.log(`Upload ${upload.length} file(s):`);
  for (const [rel, f] of upload) console.log(`  + ${rel}  ${kb(f.size)}`);
  if (stale.length) {
    console.log(`${args.has('--clean') ? 'Remove' : 'Old, kept (use --clean to remove)'} ${stale.length} file(s) in assets/:`);
    for (const rel of stale) console.log(`  - ${rel}`);
  }
  if (dry) {
    console.log('\nDry run: nothing changed.');
    process.exit(0);
  }

  if (!args.has('--yes')) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question('\nPut this live on lumenote.nl? (y/n) ')).trim().toLowerCase();
    rl.close();
    if (!['y', 'j', 'yes', 'ja'].includes(answer)) fail('Cancelled. Nothing changed.');
  }

  if (!args.has('--no-backup') && remote.size) {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const dest = join(root, 'backups', stamp);
    console.log(`\nBacking up the live site to backups/${stamp}…`);
    await ftp.downloadToDir(dest, remoteRoot);
  }

  console.log('\nUploading…');
  // index.html last, so visitors never get a page that points at files not uploaded yet.
  upload.sort(([a], [b]) => (a === 'index.html') - (b === 'index.html'));
  for (const [rel, f] of upload) {
    await ftp.ensureDir(dirname(`${remoteRoot}/${rel}`));
    await ftp.cd('/');
    await ftp.uploadFrom(f.full, `${remoteRoot}/${rel}`);
    console.log(`  ✓ ${rel}`);
  }
  if (args.has('--clean')) {
    for (const rel of stale) {
      await ftp.remove(`${remoteRoot}/${rel}`);
      console.log(`  ✓ removed ${rel}`);
    }
  }
  console.log('\nDone. Live at https://lumenote.nl (hard refresh with Ctrl+F5 if you still see the old version).');
} finally {
  ftp.close();
}
