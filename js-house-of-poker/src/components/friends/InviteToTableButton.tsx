import { ActionButton } from '../ActionButton';

type InviteToTableButtonProps = {
  disabled?: boolean;
  fullWidth?: boolean;
  hasActiveTable: boolean;
  loading?: boolean;
  onPress: () => void;
};

export function InviteToTableButton({ disabled = false, fullWidth = true, hasActiveTable, loading = false, onPress }: InviteToTableButtonProps) {
  return (
    <ActionButton
      compact
      disabled={disabled}
      fullWidth={fullWidth}
      icon={hasActiveTable ? 'cards-playing-outline' : 'table-plus'}
      label={hasActiveTable ? 'Table Invite' : 'Table Invite Placeholder'}
      loading={loading}
      onPress={onPress}
      tone={hasActiveTable ? 'success' : 'neutral'}
      variant={hasActiveTable ? 'primary' : 'secondary'}
    />
  );
}
