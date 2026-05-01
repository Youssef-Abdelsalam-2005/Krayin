import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { In, IsNull, LessThan, Not, Repository } from 'typeorm';

import { NotificationEntity } from 'src/engine/core-modules/notification/notification.entity';
import {
  ArchiveNotificationsInput,
  ListNotificationsInput,
  MarkNotificationsAsReadInput,
  NOTIFICATIONS_LIST_HARD_LIMIT,
  NotificationCountsDTO,
} from 'src/engine/core-modules/notification/dtos/notification.dto';
import { NotificationType } from 'src/engine/core-modules/notification/types/notification-type.enum';

export type CreateNotificationInput = Pick<
  NotificationEntity,
  | 'workspaceId'
  | 'recipientWorkspaceMemberId'
  | 'type'
> &
  Partial<
    Pick<
      NotificationEntity,
      | 'properties'
      | 'linkedObjectName'
      | 'linkedRecordId'
      | 'linkedRecordCachedName'
      | 'triggeredByWorkspaceMemberId'
      | 'reminderWindowDays'
    >
  >;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
  ) {}

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  async list(
    workspaceId: string,
    recipientWorkspaceMemberId: string,
    input: ListNotificationsInput,
  ): Promise<NotificationEntity[]> {
    const limit = Math.max(
      1,
      Math.min(input.limit ?? 25, NOTIFICATIONS_LIST_HARD_LIMIT),
    );

    const where: Record<string, unknown> = {
      workspaceId,
      recipientWorkspaceMemberId,
    };

    if (input.archivedOnly) {
      where.archivedAt = Not(IsNull());
    } else {
      where.archivedAt = IsNull();
    }

    if (input.unreadOnly && !input.archivedOnly) {
      where.readAt = IsNull();
    }

    if (input.types && input.types.length > 0) {
      where.type = In(input.types);
    }

    if (input.before) {
      where.createdAt = LessThan(input.before);
    }

    return this.notificationRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getCounts(
    workspaceId: string,
    recipientWorkspaceMemberId: string,
  ): Promise<NotificationCountsDTO> {
    const [unread, total] = await Promise.all([
      this.notificationRepository.count({
        where: {
          workspaceId,
          recipientWorkspaceMemberId,
          readAt: IsNull(),
          archivedAt: IsNull(),
        },
      }),
      this.notificationRepository.count({
        where: {
          workspaceId,
          recipientWorkspaceMemberId,
          archivedAt: IsNull(),
        },
      }),
    ]);

    return { unread, total };
  }

  // ---------------------------------------------------------------------------
  // Mutations — recipient-side
  // ---------------------------------------------------------------------------

  async markAsRead(
    workspaceId: string,
    recipientWorkspaceMemberId: string,
    input: MarkNotificationsAsReadInput,
  ): Promise<number> {
    const where: Record<string, unknown> = {
      workspaceId,
      recipientWorkspaceMemberId,
      readAt: IsNull(),
    };

    if (input.ids && input.ids.length > 0) {
      where.id = In(input.ids);
    }

    const result = await this.notificationRepository.update(where, {
      readAt: new Date(),
    });

    return result.affected ?? 0;
  }

  async archive(
    workspaceId: string,
    recipientWorkspaceMemberId: string,
    input: ArchiveNotificationsInput,
  ): Promise<number> {
    if (input.ids.length === 0) return 0;

    const result = await this.notificationRepository.update(
      {
        workspaceId,
        recipientWorkspaceMemberId,
        id: In(input.ids),
      },
      { archivedAt: new Date() },
    );

    return result.affected ?? 0;
  }

  // ---------------------------------------------------------------------------
  // Mutations — server-side (used by event listeners + cron jobs).
  // ---------------------------------------------------------------------------

  async create(input: CreateNotificationInput): Promise<NotificationEntity> {
    return this.notificationRepository.save(
      this.notificationRepository.create(input),
    );
  }

  async createMany(
    inputs: CreateNotificationInput[],
  ): Promise<NotificationEntity[]> {
    if (inputs.length === 0) return [];

    return this.notificationRepository.save(
      inputs.map((i) => this.notificationRepository.create(i)),
    );
  }

  /**
   * Insert-or-skip used by the reminder cron.  The unique partial index
   * `IDX_NOTIFICATION_REMINDER_DEDUP_UNIQUE` does the heavy lifting; we just
   * swallow the conflict so the cron is idempotent.
   */
  async upsertReminder(
    input: CreateNotificationInput & {
      type: NotificationType.TASK_DUE_SOON | NotificationType.TASK_OVERDUE;
      reminderWindowDays: number;
      linkedRecordId: string;
    },
  ): Promise<NotificationEntity | null> {
    try {
      return await this.create(input);
    } catch (error) {
      // Postgres unique_violation == 23505
      if ((error as { code?: string }).code === '23505') {
        this.logger.debug(
          `Skipping duplicate reminder for task ${input.linkedRecordId} window=${input.reminderWindowDays}`,
        );

        return null;
      }
      throw error;
    }
  }
}
