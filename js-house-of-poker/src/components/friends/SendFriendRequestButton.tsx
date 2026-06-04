import { ActionButton } from '../ActionButton';

type SendFriendRequestButtonProps = {
  onPress: () => void;
};

export function SendFriendRequestButton({ onPress }: SendFriendRequestButtonProps) {
  return (
    <ActionButton
      compact
      fullWidth
      icon="account-plus-outline"
      label="Send Friend Request"
      onPress={onPress}
      tone="accent"
    />
  );
}
