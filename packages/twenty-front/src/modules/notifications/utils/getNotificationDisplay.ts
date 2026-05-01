import {
  IconBell,
  IconClock,
  IconEdit,
  IconPlus,
  IconTrash,
  IconUserPlus,
  type IconComponent,
} from 'twenty-ui/display';

import {
  type Notification,
  NotificationType,
} from '@/notifications/types/Notification';

/**
 * Pretty-print rules for each notification type.  `subject` is taken from
 * `linkedRecordCachedName` (the denormalised display name captured at write
 * time); everything else here is purely presentational.
 *
 * Kept in one place so the dropdown and the full page render notifications
 * identically and we only have one switch statement to update when adding a
 * new notification type.
 */

export type NotificationDisplay = {
  Icon: IconComponent;
  /** Single-line summary, e.g. "Updated stage on Acme Corp". */
  title: string;
  /** Optional second line, e.g. "Negotiation → Closed Won". */
  subtitle?: string;
};

const objectLabel = (objectName: string | null): string => {
  if (!objectName) return 'record';
  // person -> person, opportunity -> opportunity. Keep singular, lowercase.
  return objectName;
};

const subjectLabel = (n: Notification): string =>
  n.linkedRecordCachedName ?? `${objectLabel(n.linkedObjectName)}`;

const formatChangedFields = (fields?: string[]): string | undefined => {
  if (!fields || fields.length === 0) return undefined;
  if (fields.length === 1) return `${fields[0]} changed`;
  if (fields.length === 2) return `${fields[0]} and ${fields[1]} changed`;

  return `${fields[0]}, ${fields[1]} and ${fields.length - 2} more changed`;
};

export const getNotificationDisplay = (
  notification: Notification,
): NotificationDisplay => {
  const subject = subjectLabel(notification);
  const obj = objectLabel(notification.linkedObjectName);

  switch (notification.type) {
    case NotificationType.RECORD_CREATED:
      return {
        Icon: IconPlus,
        title: `New ${obj}: ${subject}`,
      };

    case NotificationType.RECORD_UPDATED:
      return {
        Icon: IconEdit,
        title: `${subject} was updated`,
        subtitle: formatChangedFields(notification.properties?.changedFields),
      };

    case NotificationType.RECORD_DELETED:
      return {
        Icon: IconTrash,
        title: `${subject} was deleted`,
      };

    case NotificationType.TASK_ASSIGNED:
      return {
        Icon: IconUserPlus,
        title: `Task assigned: ${subject}`,
      };

    case NotificationType.TASK_DUE_SOON: {
      const days = notification.properties?.daysRemaining;

      return {
        Icon: IconClock,
        title: `Reminder: "${subject}" is due ${
          days === 1 ? 'tomorrow' : `in ${days ?? '?'} days`
        }`,
      };
    }

    case NotificationType.TASK_OVERDUE: {
      const days = notification.properties?.daysOverdue;

      return {
        Icon: IconBell,
        title: `Overdue: "${subject}" was due ${
          days === 1 ? 'yesterday' : `${days ?? ''} days ago`
        }`,
      };
    }

    default:
      return { Icon: IconBell, title: subject };
  }
};
