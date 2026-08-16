import { Client, Account, TablesDB, ID, Query } from 'appwrite';

const env = import.meta.env;

export const client = new Client()
  .setEndpoint(env.VITE_APPWRITE_ENDPOINT)
  .setProject(env.VITE_APPWRITE_PROJECT_ID);

export const account = new Account(client);

const tablesDB = new TablesDB(client);
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
};

/** Thin row helpers. `table` is a key of TABLES. */
export const db = {
  list: (table, queries = []) =>
    tablesDB
      .listRows({ databaseId, tableId: TABLES[table], queries: [Query.limit(500), ...queries] })
      .then((r) => r.rows),
  get: (table, rowId) => tablesDB.getRow({ databaseId, tableId: TABLES[table], rowId }),
  // pass `rowId` to pin the row to a known id (employees reuse the auth user's $id)
  create: (table, data, rowId = ID.unique()) =>
    tablesDB.createRow({ databaseId, tableId: TABLES[table], rowId, data }),
  update: (table, rowId, data) =>
    tablesDB.updateRow({ databaseId, tableId: TABLES[table], rowId, data }),
  remove: (table, rowId) => tablesDB.deleteRow({ databaseId, tableId: TABLES[table], rowId }),
};

export { ID, Query };
