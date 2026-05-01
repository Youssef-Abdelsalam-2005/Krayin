import { registerEnumType } from '@nestjs/graphql';

export enum NotificationType {
  RECORD_CREATED = 'RECORD_CREATED',
  RECORD_UPDATED = 'RECORD_UPDATED',
  RECORD_DELETED = 'RECORD_DELETED',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_DUE_SOON = 'TASK_DUE_SOON',
  TASK_OVERDUE = 'TASK_OVERDUE',
}

registerEnumType(NotificationType, {
  name: 'NotificationType',
  description:
    'Type of notification — drives icon, copy and grouping in the UI.',
});
