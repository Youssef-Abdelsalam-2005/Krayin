import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';

import { NotificationType } from 'src/engine/core-modules/notification/types/notification-type.enum';

@ObjectType('NotificationCounts')
export class NotificationCountsDTO {
  @Field(() => Int)
  unread: number;

  @Field(() => Int)
  total: number;
}

/** Server-side cap so a malicious client can't drain the table in one query. */
export const NOTIFICATIONS_LIST_HARD_LIMIT = 100;

@InputType()
export class ListNotificationsInput {
  /**
   * When true, only unread (readAt IS NULL) and not-archived rows are returned.
   * Drives the default "Unread" tab in the UI.  Defaults to false (returns all
   * non-archived).
   */
  @Field(() => Boolean, { nullable: true })
  unreadOnly?: boolean;

  /** When true, return archived rows.  Mutually exclusive with `unreadOnly`. */
  @Field(() => Boolean, { nullable: true })
  archivedOnly?: boolean;

  @Field(() => [NotificationType], { nullable: true })
  types?: NotificationType[];

  /** Cursor: only return notifications strictly older than this createdAt. */
  @Field(() => Date, { nullable: true })
  before?: Date;

  /** 1..NOTIFICATIONS_LIST_HARD_LIMIT, default 25. */
  @Field(() => Int, { nullable: true })
  limit?: number;
}

@InputType()
export class MarkNotificationsAsReadInput {
  /** When omitted, every unread notification for the user is marked read. */
  @Field(() => [String], { nullable: true })
  ids?: string[];
}

@InputType()
export class ArchiveNotificationsInput {
  @Field(() => [String])
  ids: string[];
}
