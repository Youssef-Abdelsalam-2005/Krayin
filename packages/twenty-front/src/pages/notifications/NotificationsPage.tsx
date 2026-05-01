import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { NotificationRow } from '@/notifications/components/NotificationRow';
import { useNotificationActions } from '@/notifications/hooks/useNotificationActions';
import { useNotifications } from '@/notifications/hooks/useNotifications';
import { type ListNotificationsInput } from '@/notifications/types/Notification';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';

type Filter = 'all' | 'unread' | 'archived';

const filterToInput = (filter: Filter): ListNotificationsInput => {
  if (filter === 'unread') return { unreadOnly: true, limit: 100 };
  if (filter === 'archived') return { archivedOnly: true, limit: 100 };

  return { limit: 100 };
};

const StyledHeader = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: 0 ${themeCssVariables.spacing[8]} ${themeCssVariables.spacing[2]};
`;

const StyledFilterButton = styled.button<{ active: boolean }>`
  background: ${({ active }) =>
    active ? themeCssVariables.background.tertiary : 'transparent'};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${({ active }) =>
    active
      ? themeCssVariables.font.color.primary
      : themeCssVariables.font.color.secondary};
  cursor: pointer;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[3]};
`;

const StyledSpacer = styled.div`
  flex: 1 1 auto;
`;

const StyledMarkAllButton = styled.button`
  background: transparent;
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[3]};

  &:hover:not(:disabled) {
    color: ${themeCssVariables.font.color.primary};
  }

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
`;

const StyledList = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.light};
  margin: 0 ${themeCssVariables.spacing[8]};
`;

const StyledEmptyState = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.md};
  margin: 0 ${themeCssVariables.spacing[8]};
  padding: ${themeCssVariables.spacing[10]} 0;
  text-align: center;
`;

/**
 * Full-page inbox.  Mirrors the dropdown panel (same row component, same
 * data hook) but adds an "Archived" filter and a wider layout for catching
 * up after a few days away.  Linked from the dropdown footer and from any
 * deep-link to `/notifications`.
 */
export const NotificationsPage = () => {
  const { t } = useLingui();
  const [filter, setFilter] = useState<Filter>('all');
  const { notifications, loading } = useNotifications(filterToInput(filter));
  const { markAllAsRead } = useNotificationActions();

  const hasUnread = notifications.some((n) => n.readAt === null);

  return (
    <SubMenuTopBarContainer
      title={t`Notifications`}
      links={[{ children: <Trans>Notifications</Trans> }]}
    >
      <StyledHeader>
        <StyledFilterButton
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          {t`All`}
        </StyledFilterButton>
        <StyledFilterButton
          active={filter === 'unread'}
          onClick={() => setFilter('unread')}
        >
          {t`Unread`}
        </StyledFilterButton>
        <StyledFilterButton
          active={filter === 'archived'}
          onClick={() => setFilter('archived')}
        >
          {t`Archived`}
        </StyledFilterButton>
        <StyledSpacer />
        <StyledMarkAllButton
          disabled={!hasUnread}
          onClick={() => void markAllAsRead()}
        >
          {t`Mark all as read`}
        </StyledMarkAllButton>
      </StyledHeader>
      {notifications.length === 0 ? (
        <StyledEmptyState>
          {loading
            ? t`Loading…`
            : filter === 'unread'
              ? t`You're all caught up.`
              : filter === 'archived'
                ? t`Nothing in the archive.`
                : t`No notifications yet.`}
        </StyledEmptyState>
      ) : (
        <StyledList>
          {notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} />
          ))}
        </StyledList>
      )}
    </SubMenuTopBarContainer>
  );
};
