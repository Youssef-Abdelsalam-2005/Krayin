/**
 * Mirror of the GraphQL `Notification` type and `NotificationType` enum
 * exposed by NotificationResolver on the server.  We define them here by
 * hand instead of relying on `~/generated-metadata/graphql` so the UI can
 * compile before the next codegen run.
 *
 * Once `nx run twenty-front:graphql:generate` is run, switch the imports
 * to the codegen output and delete this file.
 */

export enum NotificationType {
  RECORD_CREATED = 'RECORD_CREATED',
  RECORD_UPDATED = 'RECORD_UPDATED',
  RECORD_DELETED = 'RECORD_DELETED',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_DUE_SOON = 'TASK_DUE_SOON',
  TASK_OVERDUE = 'TASK_OVERDUE',
}

export type NotificationProperties = {
  /** Allow-listed fields that changed (RECORD_UPDATED). */
  changedFields?: string[];
  /** Per-field { before, after } pairs (RECORD_UPDATED). */
  diff?: Record<string, { before: unknown; after: unknown }> | null;
  /** Snapshot of the record before the change (UPDATED / DELETED). */
  before?: Record<string, unknown> | null;
  /** Snapshot of the record after the change (CREATED / UPDATED). */
  after?: Record<string, unknown> | null;
  /** TASK_DUE_SOON / TASK_OVERDUE. */
  dueAt?: string;
  daysRemaining?: number;
  daysOverdue?: number;
};

export type Notification = {
  id: string;
  type: NotificationType;
  properties: NotificationProperties | null;
  readAt: string | null;
  archivedAt: string | null;
  linkedObjectName: string | null;
  linkedRecordId: string | null;
  linkedRecordCachedName: string | null;
  triggeredByWorkspaceMemberId: string | null;
  reminderWindowDays: number | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationCounts = {
  unread: number;
  total: number;
};

export type ListNotificationsInput = {
  unreadOnly?: boolean;
  archivedOnly?: boolean;
  types?: NotificationType[];
  before?: string;
  limit?: number;
};

export type MarkNotificationsAsReadInput = {
  ids?: string[];
};

export type ArchiveNotificationsInput = {
  ids: string[];
};
