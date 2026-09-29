// Thin D1 helpers. Every write goes through a column allowlist, so a client can
// never name its own columns (that is the SQL-injection surface here — values are
// always bound parameters).

export const newId = () => crypto.randomUUID();

export const all = async (db, sql, params = []) => {
  const { results } = await db.prepare(sql).bind(...params).all();
  return results ?? [];
};

export const one = (db, sql, params = []) => db.prepare(sql).bind(...params).first();

export const run = (db, sql, params = []) => db.prepare(sql).bind(...params).run();

/** Writable columns per table. `id`, `createdAt` and `passwordHash` are set by the server. */
export const COLUMNS = {
  employees: ['name', 'email', 'role', 'subRole', 'status', 'joinDate'],
  roles: ['name'],
  brands: ['name', 'contactName', 'contactInfo', 'ratePerProject', 'notes'],
  tasks: ['title', 'description', 'brandId', 'assignedTo', 'createdBy', 'status',
    'priority', 'deadline', 'submissionLink', 'remarks', 'completedAt'],
  comments: ['taskId', 'authorId', 'authorName', 'message'],
  payments: ['employeeId', 'month', 'base', 'bonus', 'deductions', 'status', 'paidOn'],
  dumps: ['content', 'createdBy'],
};

const pick = (table, data, extra = []) => {
  const allowed = [...(COLUMNS[table] || []), ...extra];
  return Object.entries(data || {}).filter(([k, v]) => allowed.includes(k) && v !== undefined);
};

/** INSERT ... RETURNING *, so callers get the stored row back in one round trip. */
export async function insert(db, table, data, { id = newId(), extra = [] } = {}) {
  const entries = pick(table, data, extra);
  const cols = ['id', ...entries.map(([k]) => k)];
  const values = [id, ...entries.map(([, v]) => v)];
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) RETURNING *`;
  return one(db, sql, values);
}

/** Partial update. Returns the updated row, or null when the id does not exist. */
export async function update(db, table, id, data, { extra = [] } = {}) {
  const entries = pick(table, data, extra);
  if (!entries.length) return one(db, `SELECT * FROM ${table} WHERE id = ?`, [id]);
  const sql = `UPDATE ${table} SET ${entries.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ? RETURNING *`;
  return one(db, sql, [...entries.map(([, v]) => v), id]);
}

export const remove = (db, table, id) => run(db, `DELETE FROM ${table} WHERE id = ?`, [id]);

/** 'a,b' or ['a','b'] -> ['a','b']; empty input -> []. */
export const csv = (value) => (Array.isArray(value) ? value : String(value ?? '').split(','))
  .map((v) => String(v).trim())
  .filter(Boolean);
