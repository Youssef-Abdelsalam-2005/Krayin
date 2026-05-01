import gql from 'graphql-tag';

/**
 * Reusable shape for Notification rows in the inbox + full page.
 * Mirrors the fields exposed by NotificationEntity (twenty-server).
 */
export const NOTIFICATION_FRAGMENT = gql`
  fragment NotificationFragment on Notification {
    id
    type
    properties
    readAt
    archivedAt
    linkedObjectName
    linkedRecordId
    linkedRecordCachedName
    triggeredByWorkspaceMemberId
    reminderWindowDays
    createdAt
    updatedAt
  }
`;
