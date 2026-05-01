import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { WorkspaceActivationStatus } from 'twenty-shared/workspace';
import { Repository } from 'typeorm';

import { SentryCronMonitor } from 'src/engine/core-modules/cron/sentry-cron-monitor.decorator';
import { ExceptionHandlerService } from 'src/engine/core-modules/exception-handler/exception-handler.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { TASK_REMINDER_CRON_PATTERN } from 'src/engine/core-modules/notification/constants/task-reminder.constants';
import {
  ProcessTaskRemindersForWorkspaceJob,
  type ProcessTaskRemindersForWorkspaceJobData,
} from 'src/engine/core-modules/notification/jobs/process-task-reminders-for-workspace.job';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

/**
 * Hourly cron — fans out into one ProcessTaskRemindersForWorkspaceJob per
 * active workspace.  Mirrors the TrashCleanupCronJob → TrashCleanupJob
 * relationship.
 */
@Injectable()
@Processor(MessageQueue.cronQueue)
export class TaskReminderCronJob {
  private readonly logger = new Logger(TaskReminderCronJob.name);

  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectMessageQueue(MessageQueue.workspaceQueue)
    private readonly workspaceQueueService: MessageQueueService,
    private readonly exceptionHandlerService: ExceptionHandlerService,
  ) {}

  @Process(TaskReminderCronJob.name)
  @SentryCronMonitor(TaskReminderCronJob.name, TASK_REMINDER_CRON_PATTERN)
  async handle(): Promise<void> {
    const workspaces = await this.workspaceRepository.find({
      where: { activationStatus: WorkspaceActivationStatus.ACTIVE },
      select: ['id'],
      order: { id: 'ASC' },
    });

    if (workspaces.length === 0) {
      this.logger.log('No active workspaces; skipping task reminders.');

      return;
    }

    // Capture the cron firing time so every per-workspace job uses the same
    // reference instant (avoids edge cases when fanout takes >1 minute).
    const referenceUtcIso = new Date().toISOString();

    for (const workspace of workspaces) {
      try {
        await this.workspaceQueueService.add<ProcessTaskRemindersForWorkspaceJobData>(
          ProcessTaskRemindersForWorkspaceJob.name,
          { workspaceId: workspace.id, referenceUtcIso },
        );
      } catch (error) {
        this.exceptionHandlerService.captureExceptions([error], {
          workspace: { id: workspace.id },
        });
      }
    }

    this.logger.log(
      `Enqueued task reminder jobs for ${workspaces.length} workspace(s).`,
    );
  }
}
