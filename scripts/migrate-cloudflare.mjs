import { readFile } from 'node:fs/promises';

const [destination, filename] = process.argv.slice(2);
if (!destination || !filename || !process.env.MIGRATION_TOKEN) {
  console.error('Usage: MIGRATION_TOKEN=<secret> node scripts/migrate-cloudflare.mjs https://your-domain data/session.json');
  process.exit(1);
}
const url = new URL('/api/migration/import', destination);
if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('HTTPS is required');
const body = await readFile(filename, 'utf8');
JSON.parse(body);
const response = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.MIGRATION_TOKEN}, body});
console.log(await response.text());
if (!response.ok) process.exitCode = 1;
