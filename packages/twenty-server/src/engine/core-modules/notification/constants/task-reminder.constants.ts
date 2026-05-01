/**
 * Hourly cron — at minute 0 of every hour we sweep all workspaces and check
 * which assignees are *currently* at 08:00 local time, then enqueue the
 * per-workspace reminder job for them.
 *
 * Hourly granularity is the cheapest correct way to honour each user's
 * personal timezone without per-user cron registrations.
 */
export const TASK_REMINDER_CRON_PATTERN = '0 * * * *';

/** Local hour at which a reminder should fire for a given workspace member. */
export const TASK_REMINDER_LOCAL_HOUR = 8;

/**
 * Days-before-due that produce a TASK_DUE_SOON reminder.  Past 0 the task
 * becomes overdue and gets a single TASK_OVERDUE the morning after the due
 * date passed.
 */
export const TASK_REMINDER_WINDOWS_DAYS = [3, 2, 1] as const;

/**
 * Task statuses that mean "done" and should suppress reminders.  Twenty's
 * task.status is a free-form text column; the standard option set has
 * `TODO`, `IN_PROGRESS`, `DONE`.  Keep this lowercase-insensitive in code.
 */
export const TASK_DONE_STATUSES = new Set(['DONE', 'done', 'Done']);
