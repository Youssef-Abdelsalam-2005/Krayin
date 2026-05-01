import gql from 'graphql-tag';

import { NOTIFICATION_FRAGMENT } from '@/notifications/graphql/fragments/notificationFragment';

/**
 * Inbox feed.  `input` is optional — when omitted the server returns the
 * last 25 non-archived notifications.  Polled at 30s interval via the
 * `useNotificationsInbox` hook (see frontend wiring docs).
 */
export const GET_NOTIFICATIONS = gql`
  query GetNotifications($input: ListNotificationsInput) {
    notifications(input: $input) {
      ...NotificationFragment
    }
  }
  ${NOTIFICATION_FRAGMENT}
`;

/**
 * Cheap aggregate used to drive the bell badge.  Polled separately from
 * the feed so the badge updates even when the dropdown is closed.
 */
export const GET_NOTIFICATION_COUNTS = gql`
  query GetNotificationCounts {
    notificationCounts {
      unread
      total
    }
  }
`;
