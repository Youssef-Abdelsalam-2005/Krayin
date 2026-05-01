import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { NotificationRow } from '@/notifications/components/NotificationRow';
import { NOTIFICATION_BELL_DROPDOWN_ID } from '@/notifications/constants/NotificationDropdownIds';
import { useNotificationActions } from '@/notifications/hooks/useNotificationActions';
import { useNotifications } from '@/notifications/hooks/useNotifications';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';

/**
 * Width is intentionally larger than the standard "ExtraLarge" (320 px)
 * because each row needs to fit a leading icon, two lines of text and a
 * trailing timestamp without cramping.
 */
const PANEL_WIDTH_PX = 380;
/** Maximum visible height before the list internally scrolls. */
const PANEL_MAX_LIST_HEIGHT_PX = 480;

type Tab = 'unread' | 'all';

const StyledHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledTabs = styled.div`
  display: flex;
  flex: 1 1 auto;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledTabButton = styled.button<{ active: boolean }>`
  background: ${({ active }) =>
    active ? themeCssVariables.background.tertiary : 'transparent'};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${({ active }) =>
    active
      ? themeCssVariables.font.color.primary
      : themeCssVariables.font.color.secondary};
  cursor: pointer;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: 500;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledHeaderAction = styled.button`
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};

  &:hover {
    color: ${themeCssVariables.font.color.primary};
  }

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
`;

const StyledList = styled.div`
  max-height: ${PANEL_MAX_LIST_HEIGHT_PX}px;
  overflow-y: auto;
`;

const StyledEmptyState = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[6]} ${themeCssVariables.spacing[3]};
  text-align: center;
`;

const StyledFooter = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  justify-content: center;
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledFooterLink = styled(Link)`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  text-decoration: none;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
  }
`;

/**
 * Popover content rendered when the bell is clicked.  Shows the most recent
 * notifications scoped to the active tab (unread by default), with controls
 * to mark all as read and a footer link to the full inbox page.
 *
 * The polling that backs `useNotifications` (30 s) means re-opening the panel
 * always shows fresh data even though state is internally local — refetches
 * also fire after every action via the `useNotificationActions` `refetchQueries`.
 */
export const NotificationDropdownPanel = () => {
  const [tab, setTab] = useState<Tab>('unread');
  const { closeDropdown } = useCloseDropdown();
  const { markAllAsRead } = useNotificationActions();

  const { notifications, loading } = useNotifications(
    tab === 'unread' ? { unreadOnly: true, limit: 25 } : { limit: 25 },
  );

  const handleClose = () => closeDropdown(NOTIFICATION_BELL_DROPDOWN_ID);

  return (
    <DropdownContent widthInPixels={PANEL_WIDTH_PX}>
      <StyledHeader>
        <StyledTabs>
          <StyledTabButton
            active={tab === 'unread'}
            onClick={() => setTab('unread')}
          >
            {t`Unread`}
          </StyledTabButton>
          <StyledTabButton
            active={tab === 'all'}
            onClick={() => setTab('all')}
          >
            {t`All`}
          </StyledTabButton>
        </StyledTabs>
        <StyledHeaderAction
          onClick={() => void markAllAsRead()}
          disabled={notifications.every((n) => n.readAt !== null)}
        >
          {t`Mark all as read`}
        </StyledHeaderAction>
      </StyledHeader>
      <StyledList>
        {notifications.length === 0 ? (
          <StyledEmptyState>
            {loading
              ? t`Loading…`
              : tab === 'unread'
                ? t`You're all caught up.`
                : t`No notifications yet.`}
          </StyledEmptyState>
        ) : (
          notifications.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onNavigate={handleClose}
            />
          ))
        )}
      </StyledList>
      <StyledFooter>
        <StyledFooterLink to="/notifications" onClick={handleClose}>
          {t`View all notifications`}
        </StyledFooterLink>
      </StyledFooter>
    </DropdownContent>
  );
};
