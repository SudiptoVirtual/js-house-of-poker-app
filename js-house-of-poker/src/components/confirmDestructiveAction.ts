import { Alert } from 'react-native';

type DestructiveConfirmationOptions = {
  confirmLabel: string;
  message: string;
  onConfirm: () => void;
  title: string;
};

function showDestructiveConfirmation({ confirmLabel, message, onConfirm, title }: DestructiveConfirmationOptions) {
  Alert.alert(title, message, [
    { style: 'cancel', text: 'Cancel' },
    { onPress: onConfirm, style: 'destructive', text: confirmLabel },
  ]);
}

export function confirmLeaveChatRoom(roomName: string, onConfirm: () => void) {
  showDestructiveConfirmation({
    confirmLabel: 'Leave room',
    message: `Are you sure you want to leave ${roomName}?`,
    onConfirm,
    title: 'Leave chat room?',
  });
}

export function confirmRemoveFriend(friendName: string, onConfirm: () => void) {
  showDestructiveConfirmation({
    confirmLabel: 'Remove friend',
    message: `Are you sure you want to remove ${friendName} from your friends?`,
    onConfirm,
    title: 'Remove friend?',
  });
}
