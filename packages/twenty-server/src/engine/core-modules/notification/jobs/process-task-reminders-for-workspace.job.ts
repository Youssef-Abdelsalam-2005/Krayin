import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';
import { In, IsNull, Not } from 'typeorm';

import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import {
  TASK_DONE_STATUSES,
  TASK_REMINDER_LOCAL_HOUR,
  TASK_REMINDER_WINDOWS_DAYS,
} from 'src/engine/core-modules/notification/constants/task-reminder.constants';
import { NotificationService } from 'src/engine/core-modules/notification/services/notification.service';
import { NotificationType } from 'src/engine/core-modules/notification/types/notification-type.enum';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { TaskWorkspaceEntity } from 'src/modules/task/standard-objects/task.workspace-entity';
import { WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';

export type ProcessTaskRemindersForWorkspaceJobData = {
  workspaceId: string;
  /** ISO timestamp of when the parent cron fired. */
  referenceUtcIso: string;
};

/**
 * Per-workspace task reminder processor.  Selects every assignee whose local
 * time is currently 08:00, walks their open tasks and upserts a reminder
 * notification for each one whose dueAt sits in the 3/2/1-day window (or
 * just became overdue).
 *
 * Idempotency comes from the partial unique index
 * `IDX_NOTIFICATION_REMINDER_DEDUP_UNIQUE` — see notification.entity.ts.
 */
@Injectable()
@Processor(MessageQueue.workspaceQueue)
export class ProcessTaskRemindersForWorkspaceJob {
  private readonly logger = new Logger(ProcessTaskRemindersForWorkspaceJob.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  @Process(ProcessTaskRemindersForWorkspaceJob.name)
  async handle(data: ProcessTaskRemindersForWorkspaceJobData): Promise<void> {
    const { workspaceId, referenceUtcIso } = data;
    const referenceUtc = new Date(referenceUtcIso);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const memberRepo = await this.globalWorkspaceOrmManager.getRepository(
          workspaceId,
          WorkspaceMemberWorkspaceEntity,
          { shouldBypassPermissionChecks: true },
        );

        const allMembers = await memberRepo.find({
          select: ['id', 'timeZone'],
        });

        // Members for whom local time is 08:00 right now.
        const dueMembers = allMembers.filter((m) => {
          const tz = m.timeZone || 'UTC';
          const localHour = this.getLocalHour(referenceUtc, tz);

          return localHour === TASK_REMINDER_LOCAL_HOUR;
        });

        if (dueMembers.length === 0) return;

        this.logger.debug(
          `[reminders] ws=${workspaceId} eligibleMembers=${dueMembers.length}`,
        );

        const taskRepo = await this.globalWorkspaceOrmManager.getRepository(
          workspaceId,
          TaskWorkspaceEntity,
          { shouldBypassPermissionChecks: true },
        );

        // Pull every open task assigned to one of those members.  We further
        // filter in memory because the day-diff is timezone-dependent and
        // SQL between-clauses would force one-tz-per-query.
        const tasks = await taskRepo.find({
          where: {
            assigneeId: In(dueMembers.map((m) => m.id)),
            dueAt: Not(IsNull()),
          },
          select: ['id', 'title', 'dueAt', 'status', 'assigneeId'],
        });

        let inserted = 0;

        for (const member of dueMembers) {
          const tz = member.timeZone || 'UTC';
          const memberTasks = tasks.filter(
            (t) => t.assigneeId === member.id && !this.isDone(t.status),
          );

          for (const task of memberTasks) {
            const window = this.classifyDueDate(task.dueAt!, referenceUtc, tz);

            if (!isDefined(window)) continue;

            const created = await this.notificationService.upsertReminder({
              workspaceId,
              recipientWorkspaceMemberId: member.id,
              triggeredByWorkspaceMemberId: null,
              type:
                window.kind === 'overdue'
                  ? NotificationType.TASK_OVERDUE
                  : NotificationType.TASK_DUE_SOON,
              linkedObjectName: 'task',
              linkedRecordId: task.id,
              linkedRecordCachedName: task.title ?? null,
              reminderWindowDays: window.days,
              properties: {
                dueAt: task.dueAt!.toISOString(),
                ...(window.kind === 'overdue'
                  ? { daysOverdue: window.days }
                  : { daysRemaining: window.days }),
              },
            });

            if (created) inserted++;
          }
        }

        if (inserted > 0) {
          this.logger.log(
            `[reminders] ws=${workspaceId} insertedNotifications=${inserted}`,
          );
        }
      },
      buildSystemAuthContext(workspaceId),
    );
  }

  // ---------------------------------------------------------------------------
  // Timezone-aware date helpers (no external lib — Intl handles it)
  // ---------------------------------------------------------------------------

  private getLocalHour(instant: Date, timeZone: string): number {
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).format(instant);

    // Intl can return "24" for midnight in some locales; normalise.
    const n = parseInt(hour, 10);

    return n === 24 ? 0 : n;
  }

  /**
   * Returns null if the task isn't in any reminder window.
   * Otherwise: { kind: 'soon', days: 3|2|1 } or { kind: 'overdue', days: N≥1 }.
   */
  private classifyDueDate(
    dueAt: Date,
    referenceUtc: Date,
    timeZone: string,
  ): { kind: 'soon'; days: number } | { kind: 'overdue'; days: number } | null {
    const today = this.toLocalYmd(referenceUtc, timeZone);
    const due = this.toLocalYmd(dueAt, timeZone);
    const diffDays = this.diffYmdInDays(due, today);

    if (diffDays > 0 && (TASK_REMINDER_WINDOWS_DAYS as readonly number[]).includes(diffDays)) {
      return { kind: 'soon', days: diffDays };
    }

    if (diffDays < 0) {
      return { kind: 'overdue', days: Math.abs(diffDays) };
    }

    return null;
  }

  /** "YYYY-MM-DD" in the given timezone (so day-bucketing is tz-correct). */
  private toLocalYmd(instant: Date, timeZone: string): string {
    // 'en-CA' yields YYYY-MM-DD format reliably across locales/runtimes.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant);
  }

  /** `due - today` in calendar days; positive = future, negative = past. */
  private diffYmdInDays(dueYmd: string, todayYmd: string): number {
    const due = new Date(`${dueYmd}T00:00:00Z`).getTime();
    const today = new Date(`${todayYmd}T00:00:00Z`).getTime();

    return Math.round((due - today) / (1000 * 60 * 60 * 24));
  }

  private isDone(status: string | null): boolean {
    if (!status) return false;

    return TASK_DONE_STATUSES.has(status);
  }
}
