/**
 * Turns the Appwrite CSV exports in ../../appwrite_backup into one SQL file you
 * can paste into the D1 console.
 *
 *   node migrate/appwrite-to-d1.mjs
 *
 * Two things worth knowing about the mapping:
 *  - employees.id becomes the old `userId`, NOT the old row `$id`. Tasks, dumps
 *    and payments all reference userIds, so this keeps every link intact.
 *  - Appwrite held the passwords, and they are not exportable. Each employee gets
 *    a fresh random temporary password, hashed here with the same PBKDF2 scheme
 *    the worker uses; the plain text lands in migrate/credentials.txt for you to
 *    hand out. Nothing else can read them afterwards.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto as crypto } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKUP = join(HERE, '..', '..', 'appwrite_backup');

// ---------- tiny CSV reader (quoted fields, doubled quotes, embedded newlines) ----------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const header = rows.shift().map((h) => h.replace(/^﻿/, '').trim());
  return rows
    .filter((r) => r.some((v) => v !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const load = (prefix) => {
  const file = readdirSync(BACKUP).find((f) => f.startsWith(prefix) && f.endsWith('.csv'));
  if (!file) {
    console.warn(`  (no ${prefix}*.csv in appwrite_backup — skipping)`);
    return [];
  }
  return parseCsv(readFileSync(join(BACKUP, file), 'utf8'));
};

// ---------- SQL helpers ----------
// Appwrite writes the string "null" for empty cells; treat that as SQL NULL.
const isBlank = (v) => v === undefined || v === null || v === '' || v === 'null';
const str = (v) => (isBlank(v) ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const numeric = (v) => (isBlank(v) || Number.isNaN(Number(v)) ? '0' : String(Number(v)));

const insertRows = (table, columns, rows) => {
  if (!rows.length) return `-- ${table}: nothing to import\n`;
  const values = rows.map((cells) => `  (${cells.join(', ')})`).join(',\n');
  return `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES\n${values};\n`;
};

// ---------- password hashing: identical scheme to backend/src/lib/password.js ----------
const ITERATIONS = 100_000;
const b64 = (bytes) => Buffer.from(bytes).toString('base64');

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}

const tempPassword = () => Buffer.from(crypto.getRandomValues(new Uint8Array(9))).toString('base64url');

// ---------- build ----------
console.log('reading', BACKUP);

const employees = load('employees');
const roles = load('roles');
const brands = load('brands');
const tasks = load('tasks');
const dumps = load('dump');
const comments = load('comments');
const payments = load('payments');

const credentials = [];
const employeeRows = [];
for (const e of employees) {
  const id = isBlank(e.userId) ? e.$id : e.userId; // userId is what everything else points at
  const password = tempPassword();
  credentials.push({ name: e.name, email: e.email, role: e.role, password });
  employeeRows.push([
    str(id), str(e.name), str(String(e.email || '').trim().toLowerCase()),
    str(await hashPassword(password)),
    str(e.role === 'admin' ? 'admin' : 'employee'),
    str(e.subRole), str(e.status || 'available'), str(e.joinDate),
    '1', // temp password -> the app asks them to set their own on first sign-in
    str(e.$createdAt),
  ]);
}

const sql = [
  '-- Appwrite -> D1 migration.',
  `-- Generated ${new Date().toISOString()} from appwrite_backup/.`,
  '-- Paste into the Cloudflare dashboard: D1 > your database > Console.',
  '-- Safe to re-run: every insert is INSERT OR REPLACE, keyed on id.',
  '',
  '-- employees.id = the old Appwrite userId, so tasks/dumps/payments keep pointing at the right person.',
  insertRows('employees',
    ['id', 'name', 'email', 'passwordHash', 'role', 'subRole', 'status', 'joinDate',
      'mustChangePassword', 'createdAt'],
    employeeRows),
  '',
  insertRows('roles', ['id', 'name'],
    roles.map((r) => [str(r.$id), str(r.name)])),
  '',
  insertRows('brands', ['id', 'name', 'contactName', 'contactInfo', 'ratePerProject', 'notes'],
    brands.map((b) => [str(b.$id), str(b.name), str(b.contactName), str(b.contactInfo), numeric(b.ratePerProject), str(b.notes)])),
  '',
  insertRows('tasks',
    ['id', 'title', 'description', 'brandId', 'assignedTo', 'createdBy', 'status', 'priority',
      'deadline', 'submissionLink', 'remarks', 'completedAt', 'createdAt'],
    tasks.map((t) => [
      str(t.$id), str(t.title), str(t.description), str(t.brandId), str(t.assignedTo), str(t.createdBy),
      str(t.status || 'pending'), str(t.priority || 'medium'), str(t.deadline), str(t.submissionLink),
      str(t.remarks), str(t.completedAt), str(t.$createdAt),
    ])),
  '',
  '-- dumps are text-only now; any file rows in the export are dropped on purpose.',
  insertRows('dumps', ['id', 'content', 'createdBy', 'createdAt'],
    dumps
      .filter((d) => !isBlank(d.content) && (isBlank(d.type) || d.type === 'text'))
      .map((d) => [str(d.$id), str(d.content), str(d.createdBy), str(d.$createdAt)])),
  '',
  insertRows('comments', ['id', 'taskId', 'authorId', 'authorName', 'message', 'createdAt'],
    comments.map((c) => [str(c.$id), str(c.taskId), str(c.authorId), str(c.authorName), str(c.message), str(c.$createdAt)])),
  '',
  insertRows('payments', ['id', 'employeeId', 'month', 'base', 'bonus', 'deductions', 'status', 'paidOn'],
    payments.map((p) => [str(p.$id), str(p.employeeId), str(p.month), numeric(p.base), numeric(p.bonus),
      numeric(p.deductions), str(p.status || 'unpaid'), str(p.paidOn)])),
  '',
].join('\n');

writeFileSync(join(HERE, 'seed.sql'), sql);

const creds = [
  'Temporary passwords for the migrated logins.',
  'Hand these out, then delete this file — the hashes in seed.sql cannot be reversed.',
  '',
  ...credentials.map((c) => `${(c.email || '').padEnd(34)} ${(c.role || '').padEnd(9)} ${c.password}   (${c.name})`),
  '',
].join('\n');
writeFileSync(join(HERE, 'credentials.txt'), creds);

console.log(`\nwrote migrate/seed.sql`);
console.log(`wrote migrate/credentials.txt (${credentials.length} logins)\n`);
console.log(`employees ${employees.length} | roles ${roles.length} | brands ${brands.length} `
  + `| tasks ${tasks.length} | dumps ${dumps.length} | comments ${comments.length} | payments ${payments.length}`);
