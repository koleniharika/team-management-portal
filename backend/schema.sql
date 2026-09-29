CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  subRole TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  joinDate TEXT,
  mustChangePassword INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contactName TEXT,
  contactInfo TEXT,
  ratePerProject REAL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  brandId TEXT,
  assignedTo TEXT NOT NULL,
  createdBy TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  deadline TEXT,
  submissionLink TEXT,
  remarks TEXT,
  completedAt TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  taskId TEXT NOT NULL,
  authorId TEXT NOT NULL,
  authorName TEXT NOT NULL,
  message TEXT NOT NULL,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  employeeId TEXT NOT NULL,
  month TEXT NOT NULL,
  base REAL DEFAULT 0,
  bonus REAL DEFAULT 0,
  deductions REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid',
  paidOn TEXT
);

CREATE TABLE IF NOT EXISTS dumps (
  id TEXT PRIMARY KEY,
  content TEXT,
  createdBy TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_assignedTo ON tasks (assignedTo);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_brandId ON tasks (brandId);
CREATE INDEX IF NOT EXISTS idx_comments_taskId ON comments (taskId);
CREATE INDEX IF NOT EXISTS idx_payments_employeeId ON payments (employeeId);
CREATE INDEX IF NOT EXISTS idx_payments_month ON payments (month);
CREATE INDEX IF NOT EXISTS idx_dumps_createdAt ON dumps (createdAt);
