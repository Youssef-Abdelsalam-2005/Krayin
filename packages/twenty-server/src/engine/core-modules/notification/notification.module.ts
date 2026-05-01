import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TaskReminderCronCommand } from 'src/engine/core-modules/notification/commands/task-reminder.cron.command';
import { TaskReminderCronJob } from 'src/engine/core-modules/notification/crons/task-reminder.cron.job';
import { ProcessTaskRemindersForWorkspaceJob } from 'src/engine/core-modules/notification/jobs/process-task-reminders-for-workspace.job';
import { NotificationEntity } from 'src/engine/core-modules/notification/notification.entity';
import { NotificationResolver } from 'src/engine/core-modules/notification/notification.resolver';
import { NotificationService } from 'src/engine/core-modules/notification/services/notification.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { TwentyORMModule } from 'src/engine/twenty-orm/twenty-orm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationEntity, WorkspaceEntity]),
    TwentyORMModule,
  ],
  providers: [
    NotificationService,
    NotificationResolver,
    // Cron providers — kept inside this module so a single import in
    // core-engine.module.ts wires up everything, mirroring TrashCleanupModule.
    TaskReminderCronJob,
    TaskReminderCronCommand,
    ProcessTaskRemindersForWorkspaceJob,
  ],
  exports: [
    NotificationService,
    TaskReminderCronCommand,
    TypeOrmModule,
  ],
})
export class NotificationModule {}
