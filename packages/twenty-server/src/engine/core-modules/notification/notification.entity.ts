import { Field, ObjectType } from '@nestjs/graphql';

import { IDField } from '@ptc-org/nestjs-query-graphql';
import { GraphQLJSONObject } from 'graphql-type-json';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { NotificationType } from 'src/engine/core-modules/notification/types/notification-type.enum';
import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

/**
 * Notification — in-app inbox row scoped to a single workspace member.
 *
 * Lives in the shared `core` schema (not in per-workspace schemas) because:
 *  - notifications are inherently per-user data, not user-customizable CRM
 *    objects, so they don't need workspace metadata machinery;
 *  - keeping them in `core` avoids touching the standard-object registration
 *    files (which would conflict on every upstream merge).
 *
 * Linked records are referenced via a *polymorphic pair* — `linkedObjectName`
 * (e.g. `'opportunity'`) + `linkedRecordId` — rather than per-object FKs,
 * because the target rows live in the workspace schema and FKs across schemas
 * would break workspace deletion.  `linkedRecordCachedName` is denormalised at
 * write time so the inbox can render a label even after the source row is
 * soft-deleted.
 */
@Index('IDX_NOTIFICATION_WORKSPACE_RECIPIENT_CREATED', [
  'workspaceId',
  'recipientWorkspaceMemberId',
  'createdAt',
])
@Index('IDX_NOTIFICATION_WORKSPACE_RECIPIENT_READ', [
  'workspaceId',
  'recipientWorkspaceMemberId',
  'readAt',
])
@Index('IDX_NOTIFICATION_LINKED_RECORD', [
  'workspaceId',
  'linkedObjectName',
  'linkedRecordId',
])
// Dedup key for the reminder cron — see task-reminder.cron.job.ts
@Index('IDX_NOTIFICATION_REMINDER_DEDUP_UNIQUE', [
  'workspaceId',
  'recipientWorkspaceMemberId',
  'type',
  'linkedRecordId',
  'reminderWindowDays',
], {
  unique: true,
  where:
    '"type" IN (\'TASK_DUE_SOON\', \'TASK_OVERDUE\') AND "linkedRecordId" IS NOT NULL',
})
@Entity({ name: 'notification', schema: 'core' })
@ObjectType('Notification')
export class NotificationEntity extends WorkspaceRelatedEntity {
  @IDField(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** workspaceMember.id of the user who should see this notification. */
  @Field(() => String)
  @Column({ type: 'uuid' })
  recipientWorkspaceMemberId: string;

  @Field(() => NotificationType)
  @Column({ type: 'varchar', length: 64 })
  type: NotificationType;

  /**
   * Free-form payload — shape depends on `type`.  Examples:
   *  - RECORD_UPDATED: { changedFields: ['stage', 'amount'], before: {...}, after: {...} }
   *  - TASK_DUE_SOON: { dueAt: ISO, daysRemaining: 2 }
   *  - TASK_OVERDUE: { dueAt: ISO, daysOverdue: 1 }
   */
  @Field(() => GraphQLJSONObject, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  properties: Record<string, unknown> | null;

  /** When the recipient marked it read.  null => unread. */
  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  /** When the recipient archived/dismissed it.  null => still in inbox. */
  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

  /**
   * The standard-object singular name of the linked record (e.g. `'opportunity'`,
   * `'task'`, `'person'`).  Used in conjunction with `linkedRecordId` to
   * navigate to the record from the UI.
   */
  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 128, nullable: true })
  linkedObjectName: string | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  linkedRecordId: string | null;

  /** Denormalised display name of the linked record at notification-write time. */
  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  linkedRecordCachedName: string | null;

  /**
   * workspaceMember.id of whoever caused this notification (e.g. the user who
   * updated the opportunity).  null when the trigger is a system event such
   * as a reminder cron.
   */
  @Field(() => String, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  triggeredByWorkspaceMemberId: string | null;

  /**
   * Reminder window in days (3, 2, 1, or 0 for overdue).  Only set for
   * TASK_DUE_SOON / TASK_OVERDUE rows; participates in the dedup unique index.
   */
  @Field(() => Number, { nullable: true })
  @Column({ type: 'integer', nullable: true })
  reminderWindowDays: number | null;

  @Field(() => Date)
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field(() => Date)
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
