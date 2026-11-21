// Self-check for the date maths. Run: `npm run check`
import assert from 'node:assert/strict';
import { daysBetween, isOverdue, today, addDays, toDateTime, fmtDate, canDeleteTask } from './util.js';

assert.equal(daysBetween('2026-03-01', '2026-03-29'), 28, 'daysBetween across DST');
assert.equal(daysBetween('2026-05-10', '2026-05-10'), 0, 'same day');

assert.equal(isOverdue({ deadline: addDays(today(), -1), status: 'pending' }), true);
assert.equal(isOverdue({ deadline: addDays(today(), -1), status: 'done' }), false, 'done is never overdue');
assert.equal(isOverdue({ deadline: today(), status: 'pending' }), false, 'due today is not late yet');
assert.equal(isOverdue({ status: 'pending' }), false, 'no deadline, no overdue');

// datetime columns: what we write must read back as the same calendar day, everywhere
assert.equal(toDateTime('2026-08-20'), '2026-08-20T00:00:00.000Z');
assert.equal(toDateTime('2026-08-20T00:00:00.000Z'), '2026-08-20T00:00:00.000Z', 'idempotent on stored values');
assert.equal(toDateTime(''), null, 'blank clears a nullable datetime');
assert.equal(toDateTime(null), null);
const stored = toDateTime('2026-08-20');
assert.equal(stored.slice(0, 10), '2026-08-20', 'round-trips regardless of TZ');
assert.equal(daysBetween('2026-08-18', stored), 2, 'date maths accepts a stored datetime');
assert.equal(fmtDate(stored), fmtDate('2026-08-20'), 'formats the day it was picked');
assert.equal(isOverdue({ deadline: toDateTime(addDays(today(), -1)), status: 'pending' }), true);

// who may delete a task
const admin = { id: 'a1', role: 'admin' };
const worker = { id: 'e1', role: 'employee' };
const mine = { createdBy: 'e1' };
const theirs = { createdBy: 'e2' };
assert.equal(canDeleteTask(theirs, admin), true, 'admins delete anything');
assert.equal(canDeleteTask(mine, worker), true, 'employees delete what they created');
assert.equal(canDeleteTask(theirs, worker), false, "employees cannot delete other people's tasks");
assert.equal(canDeleteTask(theirs, null), false, 'no signed-in employee, no delete');
assert.equal(canDeleteTask(null, admin), false, 'no task, no delete');
assert.equal(canDeleteTask({}, worker), false, 'a task with no creator is not yours');

console.log('util self-check ok');
