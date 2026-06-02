import { colors } from '../../theme/colors';
import type { ChatRoomPlayerStatus } from '../../types/chatRooms';

export function formatChatTimestamp(isoDate: string) {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

export function getPlayerStatusColor(status: ChatRoomPlayerStatus) {
  switch (status) {
    case 'available':
      return colors.success;
    case 'inTable':
      return colors.secondary;
    case 'away':
    default:
      return colors.gold;
  }
}

export function getPlayerStatusLabel(status: ChatRoomPlayerStatus) {
  switch (status) {
    case 'available':
      return 'Available';
    case 'inTable':
      return 'At table';
    case 'away':
    default:
      return 'Away';
  }
}
