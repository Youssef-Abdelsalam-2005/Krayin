import gql from 'graphql-tag';

/**
 * Mark notifications read.  When `input.ids` is omitted, every unread
 * notification belonging to the current user is marked read in one round-trip
 * — used by the "Mark all as read" button in the dropdown header.
 *
 * Returns the number of rows affected so the UI can decrement the badge
 * without a refetch.
 */
export const MARK_NOTIFICATIONS_AS_READ = gql`
  mutation MarkNotificationsAsRead($input: MarkNotificationsAsReadInput) {
    markNotificationsAsRead(input: $input)
  }
`;

/**
 * Soft-archive (dismisses from the inbox).  Recipient-only — the resolver
 * scopes by the authenticated workspace member.
 */
export const ARCHIVE_NOTIFICATIONS = gql`
  mutation ArchiveNotifications($input: ArchiveNotificationsInput!) {
    archiveNotifications(input: $input)
  }
`;
