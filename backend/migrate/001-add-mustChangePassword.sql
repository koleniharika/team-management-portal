-- Only needed if you created the employees table BEFORE this column existed.
-- A table made from the current schema.sql already has it, and re-running this
-- errors with "duplicate column name" — that error is safe to ignore.
ALTER TABLE employees ADD COLUMN mustChangePassword INTEGER NOT NULL DEFAULT 1;
