import { useQuery } from '@apollo/client/react';

import {
  GET_NOTIFICATIONS,
  GET_NOTIFICATION_COUNTS,
} from '@/notifications/graphql/queries/getNotifications';
import {
  type ListNotificationsInput,
  type Notification,
  type NotificationCounts,
} from '@/notifications/types/Notification';

/** Polled every 30s — matches Linear/Slack-style ambient inbox refresh. */
export const NOTIFICATIONS_POLL_INTERVAL_MS = 30_000;

type GetNotificationsData = {
  notifications: Notification[];
};

type GetNotificationCountsData = {
  notificationCounts: NotificationCounts;
};

/**
 * Inbox feed.  Caller decides whether to scope by `unreadOnly` / `archivedOnly`
 * via the input — the dropdown uses `unreadOnly: true` by default and the
 * `/notifications` page shows everything.
 */
export const useNotifications = (input?: ListNotificationsInput) => {
  const { data, loading, refetch, fetchMore } =
    useQuery<GetNotificationsData>(GET_NOTIFICATIONS, {
      variables: { input: input ?? null },
      pollInterval: NOTIFICATIONS_POLL_INTERVAL_MS,
      // refetch on tab focus is handled by Apollo's `nextFetchPolicy: cache-and-network`
      fetchPolicy: 'cache-and-network',
      notifyOnNetworkStatusChange: true,
    });

  return {
    notifications: data?.notifications ?? [],
    loading,
    refetch,
    fetchMore,
  };
};

/**
 * Lightweight aggregate query — drives the bell badge.  Polled separately
 * from the feed so the badge stays current even when the dropdown is closed.
 */
export const useNotificationCounts = () => {
  const { data, loading, refetch } = useQuery<GetNotificationCountsData>(
    GET_NOTIFICATION_COUNTS,
    {
      pollInterval: NOTIFICATIONS_POLL_INTERVAL_MS,
      fetchPolicy: 'cache-and-network',
    },
  );

  return {
    counts: data?.notificationCounts ?? { unread: 0, total: 0 },
    loading,
    refetch,
  };
};
