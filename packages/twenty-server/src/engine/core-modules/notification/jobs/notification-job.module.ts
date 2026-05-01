import { Module } from '@nestjs/common';

import { CreateNotificationsFromRecordEventJob } from 'src/engine/core-modules/notification/jobs/create-notifications-from-record-event.job';
import { NotificationModule } from 'src/engine/core-modules/notification/notification.module';
import { TwentyORMModule } from 'src/engine/twenty-orm/twenty-orm.module';

/**
 * Worker-side wrapper for notification queue processors.  Imported by
 * JobsModule so the @Processor classes get instantiated in the worker
 * process.  Mirrors TimelineJobModule.
 */
@Module({
  imports: [NotificationModule, TwentyORMModule],
  providers: [CreateNotificationsFromRecordEventJob],
  exports: [CreateNotificationsFromRecordEventJob],
})
export class NotificationJobModule {}
