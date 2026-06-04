import { ActionButton } from '../ActionButton';

type InviteToChatButtonProps = {
  disabled?: boolean;
  fullWidth?: boolean;
  onPress: () => void;
};

export function InviteToChatButton({ disabled = false, fullWidth = true, onPress }: InviteToChatButtonProps) {
  return (
    <ActionButton
      compact
      disabled={disabled}
      fullWidth={fullWidth}
      icon="chat-plus-outline"
      label="Chat Invite"
      onPress={onPress}
      tone="primary"
      variant="secondary"
    />
  );
}
