import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { IconBell } from 'twenty-ui/display';
import { LightIconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { NotificationDropdownPanel } from '@/notifications/components/NotificationDropdownPanel';
import { NOTIFICATION_BELL_DROPDOWN_ID } from '@/notifications/constants/NotificationDropdownIds';
import { useNotificationCounts } from '@/notifications/hooks/useNotifications';

/**
 * Visual constants for the unread badge.  Kept out of the styled component
 * so they can be tweaked alongside other dimensional constants if Twenty's
 * design system absorbs a dedicated badge primitive in the future.
 */
const BADGE_DIAMETER_PX = 16;
/** Show "9+" once we exceed this — keeps the badge readable. */
const BADGE_MAX_DISPLAY = 9;

const StyledBellWrapper = styled.div`
  position: relative;
`;

const StyledBadge = styled.span<{ visible: boolean }>`
  align-items: center;
  background: ${themeCssVariables.color.red};
  border-radius: 999px;
  color: #fff;
  display: ${({ visible }) => (visible ? 'flex' : 'none')};
  font-size: 10px;
  font-weight: 600;
  height: ${BADGE_DIAMETER_PX}px;
  justify-content: center;
  /* Pull the badge into the top-right corner of the bell. */
  pointer-events: none;
  position: absolute;
  right: -4px;
  top: -4px;
  min-width: ${BADGE_DIAMETER_PX}px;
  padding: 0 4px;
`;

/**
 * Always-visible entry point to the notification inbox.  Lives in
 * NavigationDrawerHeader next to the search icon.  Click → opens the
 * dropdown panel; the unread badge is driven by the (separately polled)
 * `notificationCounts` aggregate so it updates even when the panel is closed.
 */
export const NotificationBell = () => {
  const { counts } = useNotificationCounts();

  const display =
    counts.unread > BADGE_MAX_DISPLAY ? `${BADGE_MAX_DISPLAY}+` : `${counts.unread}`;

  return (
    <Dropdown
      dropdownId={NOTIFICATION_BELL_DROPDOWN_ID}
      dropdownPlacement="bottom-start"
      dropdownOffset={{ y: 8 }}
      clickableComponent={
        <StyledBellWrapper>
          <LightIconButton
            Icon={IconBell}
            accent="secondary"
            size="small"
            aria-label={t`Notifications`}
          />
          <StyledBadge visible={counts.unread > 0}>{display}</StyledBadge>
        </StyledBellWrapper>
      }
      dropdownComponents={<NotificationDropdownPanel />}
    />
  );
};
