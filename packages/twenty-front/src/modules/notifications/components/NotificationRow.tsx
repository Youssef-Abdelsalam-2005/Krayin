import { styled } from '@linaria/react';
import { useNavigate } from 'react-router-dom';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { getBasePathToShowPage } from '@/object-metadata/utils/getBasePathToShowPage';
import { useNotificationActions } from '@/notifications/hooks/useNotificationActions';
import { type Notification } from '@/notifications/types/Notification';
import { getNotificationDisplay } from '@/notifications/utils/getNotificationDisplay';

const ROW_PADDING_X = 12;
const ROW_PADDING_Y = 10;
const ICON_SIZE = 16;

const StyledRow = styled.button<{ unread: boolean }>`
  align-items: flex-start;
  background: ${({ unread }) =>
    unread ? themeCssVariables.color.blue10 : 'transparent'};
  border: none;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  cursor: pointer;
  display: flex;
  font-family: inherit;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${ROW_PADDING_Y}px ${ROW_PADDING_X}px;
  text-align: left;
  width: 100%;

  &:hover {
    background: ${themeCssVariables.background.tertiary};
  }
`;

const StyledIconColumn = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  height: ${ICON_SIZE}px;
  justify-content: center;
  margin-top: 2px;
  width: ${ICON_SIZE}px;
`;

const StyledTextColumn = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const StyledTitle = styled.span<{ unread: boolean }>`
  color: ${({ unread }) =>
    unread ? themeCssVariables.font.color.primary : themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${({ unread }) => (unread ? 500 : 400)};
  /* Truncate to 2 lines so a long subject can't blow up the row. */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const StyledSubtitle = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledTimestamp = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.xs};
  margin-left: ${themeCssVariables.spacing[2]};
`;

const StyledUnreadDot = styled.div`
  background: ${themeCssVariables.color.blue};
  border-radius: 999px;
  flex-shrink: 0;
  height: 8px;
  margin-left: ${themeCssVariables.spacing[2]};
  margin-top: 6px;
  width: 8px;
`;

/**
 * Compact relative time — "now" / "2m" / "3h" / "5d".  Avoids pulling in
 * a heavy formatting lib for what is fundamentally a one-shot display.
 */
const formatRelative = (iso: string): string => {
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));

  if (diffSec < 45) return 'now';
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h`;

  return `${Math.round(diffSec / 86400)}d`;
};

type NotificationRowProps = {
  notification: Notification;
  /** Called after click navigation so the parent can close its dropdown. */
  onNavigate?: () => void;
};

export const NotificationRow = ({
  notification,
  onNavigate,
}: NotificationRowProps) => {
  const navigate = useNavigate();
  const { markAsRead } = useNotificationActions();
  const display = getNotificationDisplay(notification);
  const unread = notification.readAt === null;

  const handleClick = async () => {
    // Optimistically mark read on click — fire-and-forget so the navigation
    // isn't gated on the network round-trip.
    if (unread) void markAsRead(notification.id);

    if (notification.linkedObjectName && notification.linkedRecordId) {
      const path =
        getBasePathToShowPage({
          objectNameSingular: notification.linkedObjectName,
        }) + notification.linkedRecordId;

      navigate(path);
    }

    onNavigate?.();
  };

  return (
    <StyledRow unread={unread} onClick={handleClick}>
      <StyledIconColumn>
        <display.Icon size={ICON_SIZE} />
      </StyledIconColumn>
      <StyledTextColumn>
        <StyledTitle unread={unread}>{display.title}</StyledTitle>
        {display.subtitle && <StyledSubtitle>{display.subtitle}</StyledSubtitle>}
      </StyledTextColumn>
      <StyledTimestamp>{formatRelative(notification.createdAt)}</StyledTimestamp>
      {unread && <StyledUnreadDot />}
    </StyledRow>
  );
};
