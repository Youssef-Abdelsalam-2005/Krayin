import { Command, CommandRunner } from 'nest-commander';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { TASK_REMINDER_CRON_PATTERN } from 'src/engine/core-modules/notification/constants/task-reminder.constants';
import { TaskReminderCronJob } from 'src/engine/core-modules/notification/crons/task-reminder.cron.job';

/**
 * `cron:task-reminder` — registers the hourly task-due-date reminder cron.
 * Wired into `cron-register-all.command.ts` so a single `cron:register:all`
 * picks it up alongside the existing crons.
 */
@Command({
  name: 'cron:task-reminder',
  description:
    'Hourly sweep: enqueue task due-date reminders for assignees ' +
    'whose local time is 08:00.',
})
export class TaskReminderCronCommand extends CommandRunner {
  constructor(
    @InjectMessageQueue(MessageQueue.cronQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {
    super();
  }

  async run(): Promise<void> {
    await this.messageQueueService.addCron<undefined>({
      jobName: TaskReminderCronJob.name,
      data: undefined,
      options: {
        repeat: { pattern: TASK_REMINDER_CRON_PATTERN },
      },
    });
  }
}
