// Runs a SQL test file against the live project through the Management API.
// Usage: node supabase/tests/run-sql.mjs <file.sql> [--migration <file.sql>]
// The line `-- @@MIGRATION@@` in the test is replaced by the migration text, so
// the test applies it and rolls back in one transaction. The token is read
// from the Credentials folder at run time and never printed or stored here.
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const file = args[0];
const mi = args.indexOf('--migration');
let sql = readFileSync(file, 'utf8');
// Applies the migration inside the test's transaction: at the marker, or right after the first `begin;`.
if (mi !== -1) {
  const mig = readFileSync(args[mi + 1], 'utf8');
  sql = sql.includes('-- @@MIGRATION@@') ? sql.replace('-- @@MIGRATION@@', () => mig) : sql.replace('begin;', () => 'begin;\n' + mig);
}

// Reads KEY=value pairs from a .env file.
const env = (p) =>
  Object.fromEntries(
    readFileSync(p, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
const token = env('D:/AIO Freelance/Credentials/perchable/.env').SUPABASE_ACCESS_TOKEN;
const ref = new URL(env('.env').EXPO_PUBLIC_SUPABASE_URL).hostname.split('.')[0];

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
const body = await res.json();
if (!res.ok) {
  console.log('HTTP', res.status, JSON.stringify(body));
  process.exitCode = 1;
}
// Prints each result row as pipe-separated values.
const rows = res.ok ? (Array.isArray(body) ? body : [body]) : [];
for (const row of rows) {
  const v = Object.values(row)[0];
  const list = typeof v === 'string' ? JSON.parse(v) : v;
  if (Array.isArray(list)) list.forEach((r) => console.log(Object.values(r).map((x) => (typeof x === 'object' ? JSON.stringify(x) : x)).join(' | ')));
  else console.log(JSON.stringify(row));
}
