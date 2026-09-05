# Studio ERP

Internal tool for a freelance content team: tasks, brands, payroll, invoices and analytics.
React + Vite + Appwrite. Two access levels — **admin** and **employee**. No public sign-up:
`/` is the sign-in page, and everything behind it is role-gated.

```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # date / salary-cycle self-check
npm run lint
npm run build
```

## Environment

All keys are `VITE_`-prefixed and read in [src/lib/appwrite.js](src/lib/appwrite.js).

| Key | What |
| --- | --- |
| `VITE_APPWRITE_ENDPOINT` | e.g. `https://fra.cloud.appwrite.io/v1` |
| `VITE_APPWRITE_PROJECT_ID` | Appwrite project id |
| `VITE_APPWRITE_DATABASE_ID` | database holding the tables below |
| `VITE_APPWRITE_EMPLOYEES_TABLE_ID` | employees |
| `VITE_APPWRITE_ROLES_TABLE_ID` | roles |
| `VITE_APPWRITE_BRANDS_TABLE_ID` | brands |
| `VITE_APPWRITE_TASKS_TABLE_ID` | tasks |
| `VITE_APPWRITE_COMMENTS_TABLE_ID` | comments |
| `VITE_APPWRITE_PAYMENTS_TABLE_ID` | payments |
| `VITE_APPWRITE_INVOICES_TABLE_ID` | invoices (analytics only — invoicing is local now) |
| `VITE_APPWRITE_DUMPS_TABLE_ID` | dumps |
| `VITE_APPWRITE_DUMPS_BUCKET_ID` | storage bucket for dump files |

An empty table-id line falls back to the plain table name (`employees`, `tasks`, …), so it only
needs filling if your ids differ from the names.

### Table expectations

Columns are the ones in `appwrite-setup.md`. Two notes that matter at runtime:

- **Date columns are Appwrite `datetime`** (`deadline`, `completedAt`, `joinDate`, `paidOn`,
  `periodFrom`, `periodTo`). A picked day is written as UTC midnight —
  `2026-08-20T00:00:00.000Z` via `toDateTime()` in [src/lib/util.js](src/lib/util.js) — and read
  back with `.slice(0, 10)`. No timezone conversion happens in either direction, so the day you
  pick is the day that comes back; `new Date(d).toISOString()` would shift it for anyone east or
  west of GMT. `paidOn` is set to `null` (never `''`) when a payment is marked unpaid, so the
  column must be **not required**. `payments.month` stays a plain `YYYY-MM` **string**.
- **`invoices.taskIds` must be a string array** (an array-of-strings column), not a single string.
  The invoices table is now only read by Analytics; the invoicing page never touches it.
- **`dumps`**: `type` (enum `text|image|pdf`), `content`, `fileId`, `fileName`, `createdBy`.
  Files live in the dumps bucket. Image tiles load through `getFileView` — if they come back 401,
  give the bucket **read access to Any**: a browser can't attach the session to an `<img>` request
  when third-party cookies are blocked.

Also add the Appwrite indexes the queries rely on: `employees.userId`, `tasks.assignedTo`,
`tasks.status`, `comments.taskId`, `payments.employeeId`, `payments.month`, `invoices.brandId`.

Permissions: give logged-in users read access to all tables, and create/update rights on
`tasks`, `comments`, `brands`, `payments`, `invoices`. Row-level restrictions beyond that are not
enforced client-side — the UI hides admin routes, it does not replace table permissions.

## First admin

Chicken-and-egg: the "Add employee" form needs an admin. Bootstrap once by hand —
in the Appwrite console create a user under **Auth**, then add an `employees` row with that
user's id as `userId`, `role: admin`, and a `joinDate`. Sign in and add everyone else from
**Team → Add employee**.

## Adding employees

Fully client-side, no backend. **Team → Add employee** calls `account.create()` with the entered
email and temporary password, then writes the `employees` row using the new user's `$id` as the
row id — login and profile row share one identifier. `account.create()` starts no session, so the
admin filling in the form stays signed in as themselves.

Two consequences of doing this from the browser: the project's **Auth → Security → Sign-up must
stay enabled** (there is no sign-up UI, but the endpoint is what the form uses), and anyone who
knows the project id can hit that endpoint directly. The `employees` row is what grants access
here, so a stray account without one lands on "No employee record" and can do nothing.

## Layout

```
src/
  lib/        appwrite client + row helpers, date/money utils, useAsync
  context/    AuthContext (session + role), ThemeContext (dark/light)
  components/ ui.jsx (button, card, badge, input, modal, stat), Layout, TaskCard, TaskForm
  pages/      Login, AdminDashboard, EmployeeDashboard, CompletedTasks, TaskDetail, Team,
              ReportCard, Brands, Salary, Payslip, Invoices (local), Dump, Analytics
```

Routes: `/` sign-in · `/me` employee desk · `/tasks/:id` detail + comments · `/dump` idea board
(any signed-in user) · `/admin`, `/completed-tasks`, `/team`, `/team/:userId`, `/brands`,
`/salary`, `/salary/:userId/:month`, `/invoices`, `/analytics` (admin only).

## Invoicing (local only)

`/invoices` never talks to Appwrite. Invoices are typed by hand, kept in `localStorage`
(`erp.invoices.v1`) and downloaded as a PDF built in the browser with jsPDF — imported on click
so it stays out of the initial bundle. Every field is optional: blank in, blank out, and totals
stay empty until a line resolves to a number ([src/lib/invoices.js](src/lib/invoices.js),
covered by `npm run check`). The PDF prints amounts as `INR` — jsPDF's built-in fonts can't
encode `₹`.

Deleting a task also deletes its comments (`deleteTaskWithComments` in
[src/lib/appwrite.js](src/lib/appwrite.js)) — there is no relationship to cascade, so the rows are
removed by query. Admins can delete any task; everyone else only what they created.

## Theming

Every colour is a CSS variable in [src/index.css](src/index.css); `.dark` on `<html>` swaps the
palette, and the choice is saved to `localStorage`. Components never hard-code a colour, so new
pages get both themes for free. The payslip prints via `window.print()` — anything marked
`.no-print` is dropped. Invoices download as a PDF instead.

## Salary module

Layout and cycle maths are ported from `salaryModule.html`: fixed payday-of-month anchor,
clamped to short months (31st → 28 Feb → back to 31 Mar), overdue / due-today / upcoming
status, and the stats + history-table layout. `npm run check` runs those assertions.
Net pay = base + bonus − deductions.
