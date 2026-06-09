import { ActionButton } from '../ActionButton';

type SendFriendRequestButtonProps = {
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
};

export function SendFriendRequestButton({ disabled = false, loading = false, onPress }: SendFriendRequestButtonProps) {
  return (
    <ActionButton
      compact
      disabled={disabled}
      fullWidth
      icon="account-plus-outline"
      label="Send Friend Request"
      loading={loading}
      onPress={onPress}
      tone="accent"
    />
  );
}
