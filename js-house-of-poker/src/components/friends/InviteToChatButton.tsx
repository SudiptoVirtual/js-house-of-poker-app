import { ActionButton } from '../ActionButton';

type InviteToChatButtonProps = {
  disabled?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
  onPress: () => void;
};

export function InviteToChatButton({ disabled = false, fullWidth = true, loading = false, onPress }: InviteToChatButtonProps) {
  return (
    <ActionButton
      compact
      disabled={disabled}
      fullWidth={fullWidth}
      icon="chat-plus-outline"
      label="Chat Invite"
      loading={loading}
      onPress={onPress}
      tone="primary"
      variant="secondary"
    />
  );
}
