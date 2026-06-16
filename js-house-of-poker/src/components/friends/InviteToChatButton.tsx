import { ActionButton } from '../ActionButton';

type InviteToChatButtonProps = {
  disabled?: boolean;
  fullWidth?: boolean;
  label?: string;
  loading?: boolean;
  onPress: () => void;
};

export function InviteToChatButton({ disabled = false, fullWidth = true, label = 'Chat Invite', loading = false, onPress }: InviteToChatButtonProps) {
  return (
    <ActionButton
      compact
      disabled={disabled}
      fullWidth={fullWidth}
      icon="chat-plus-outline"
      label={label}
      loading={loading}
      onPress={onPress}
      tone="primary"
      variant="secondary"
    />
  );
}
