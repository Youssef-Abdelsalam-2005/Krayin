import { useMutation } from '@apollo/client/react';
import { useCallback } from 'react';

import {
  ARCHIVE_NOTIFICATIONS,
  MARK_NOTIFICATIONS_AS_READ,
} from '@/notifications/graphql/mutations/notificationMutations';
import {
  GET_NOTIFICATIONS,
  GET_NOTIFICATION_COUNTS,
} from '@/notifications/graphql/queries/getNotifications';

/**
 * Bundles the three mutations the inbox UI calls — mark single read, mark all
 * read, archive — and refetches the feed + counts after each so the badge and
 * row state update without an additional poll cycle.
 */
export const useNotificationActions = () => {
  const refetchQueries = [
    { query: GET_NOTIFICATIONS },
    { query: GET_NOTIFICATION_COUNTS },
  ];

  const [markReadMutation] = useMutation<{
    markNotificationsAsRead: number;
  }>(MARK_NOTIFICATIONS_AS_READ, {
    refetchQueries,
    awaitRefetchQueries: false,
  });

  const [archiveMutation] = useMutation<{
    archiveNotifications: number;
  }>(ARCHIVE_NOTIFICATIONS, {
    refetchQueries,
    awaitRefetchQueries: false,
  });

  const markAsRead = useCallback(
    async (id: string) => {
      await markReadMutation({ variables: { input: { ids: [id] } } });
    },
    [markReadMutation],
  );

  const markAllAsRead = useCallback(async () => {
    await markReadMutation({ variables: { input: null } });
  }, [markReadMutation]);

  const archive = useCallback(
    async (id: string) => {
      await archiveMutation({ variables: { input: { ids: [id] } } });
    },
    [archiveMutation],
  );

  return { markAsRead, markAllAsRead, archive };
};
