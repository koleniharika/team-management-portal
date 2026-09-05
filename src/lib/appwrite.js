import { Client, Account, TablesDB, Storage, ID, Query } from 'appwrite';

const env = import.meta.env;

export const client = new Client()
  .setEndpoint(env.VITE_APPWRITE_ENDPOINT)
  .setProject(env.VITE_APPWRITE_PROJECT_ID);

export const account = new Account(client);

const tablesDB = new TablesDB(client);
const storage = new Storage(client);
const databaseId = env.VITE_APPWRITE_DATABASE_ID;

// ponytail: falls back to the table's plain name — Appwrite table ids usually match,
// so an unfilled .env line still works instead of erroring at runtime.
export const TABLES = {
  employees: env.VITE_APPWRITE_EMPLOYEES_TABLE_ID || 'employees',
  roles: env.VITE_APPWRITE_ROLES_TABLE_ID || 'roles',
  brands: env.VITE_APPWRITE_BRANDS_TABLE_ID || 'brands',
  tasks: env.VITE_APPWRITE_TASKS_TABLE_ID || 'tasks',
  comments: env.VITE_APPWRITE_COMMENTS_TABLE_ID || 'comments',
  payments: env.VITE_APPWRITE_PAYMENTS_TABLE_ID || 'payments',
  invoices: env.VITE_APPWRITE_INVOICES_TABLE_ID || 'invoices',
  dumps: env.VITE_APPWRITE_DUMPS_TABLE_ID || 'dumps',
};

export const DUMPS_BUCKET = env.VITE_APPWRITE_DUMPS_BUCKET_ID || 'dumps';

/**
 * Appwrite answers a wrong/missing table id with "not authorized" rather than 404 —
 * the permission check runs first — so every failure names the table and its id.
 */
const tagged = (table, promise) =>
  promise.catch((e) => {
    throw new Error(`${table} (${TABLES[table]}): ${e.message}`);
  });

/** Thin row helpers. `table` is a key of TABLES. */
export const db = {
  list: (table, queries = []) =>
    tagged(table, tablesDB
      .listRows({ databaseId, tableId: TABLES[table], queries: [Query.limit(500), ...queries] })
      .then((r) => r.rows)),
  get: (table, rowId) => tagged(table, tablesDB.getRow({ databaseId, tableId: TABLES[table], rowId })),
  // pass `rowId` to pin the row to a known id (employees reuse the auth user's $id)
  create: (table, data, rowId = ID.unique()) =>
    tagged(table, tablesDB.createRow({ databaseId, tableId: TABLES[table], rowId, data })),
  update: (table, rowId, data) =>
    tagged(table, tablesDB.updateRow({ databaseId, tableId: TABLES[table], rowId, data })),
  remove: (table, rowId) => tagged(table, tablesDB.deleteRow({ databaseId, tableId: TABLES[table], rowId })),
};

/**
 * Files in the dumps bucket. Reads go through getFileView, not getFilePreview:
 * preview runs image transformations, which Appwrite Cloud gates behind a paid plan.
 */
export const files = {
  upload: (file) => storage
    .createFile({ bucketId: DUMPS_BUCKET, fileId: ID.unique(), file })
    .catch((e) => { throw new Error(`dumps bucket (${DUMPS_BUCKET}): ${e.message}`); }),
  url: (fileId) => storage.getFileView(DUMPS_BUCKET, fileId),
  downloadUrl: (fileId) => storage.getFileDownload(DUMPS_BUCKET, fileId),
  remove: (fileId) => storage.deleteFile({ bucketId: DUMPS_BUCKET, fileId }),
};

export { ID, Query };

/**
 * Deletes a task and the comments pointing at it. Comments go first: there is no
 * relationship to cascade, so a half-failed delete should leave the task (and a way
 * to retry) rather than orphaned comment rows.
 */
export const deleteTaskWithComments = async (taskId) => {
  const comments = await db.list('comments', [Query.equal('taskId', taskId)]);
  await Promise.all(comments.map((c) => db.remove('comments', c.$id)));
  await db.remove('tasks', taskId);
};

/** Confirm + delete, shared by the card, the detail view and the review page. */
export const confirmDeleteTask = async (task) => {
  // ponytail: native confirm, same as the brands delete — swap for a Modal if design asks
  if (!window.confirm("Delete this task? This can't be undone.")) return false;
  await deleteTaskWithComments(task.$id);
  return true;
};
