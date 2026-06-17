import type { StyleProp, ViewStyle } from 'react-native';

import { ActionButton } from '../ActionButton';

type InviteToChatButtonProps = {
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  fullWidth?: boolean;
  label?: string;
  loading?: boolean;
  onPress: () => void;
};

export function InviteToChatButton({
  containerStyle,
  disabled = false,
  fullWidth = true,
  label = 'Chat Invite',
  loading = false,
  onPress,
}: InviteToChatButtonProps) {
  return (
    <ActionButton
      compact
      containerStyle={containerStyle}
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
