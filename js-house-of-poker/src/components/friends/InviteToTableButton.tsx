import { ActionButton } from '../ActionButton';

type InviteToTableButtonProps = {
  fullWidth?: boolean;
  hasActiveTable: boolean;
  onPress: () => void;
};

export function InviteToTableButton({ fullWidth = true, hasActiveTable, onPress }: InviteToTableButtonProps) {
  return (
    <ActionButton
      compact
      fullWidth={fullWidth}
      icon={hasActiveTable ? 'cards-playing-outline' : 'table-plus'}
      label={hasActiveTable ? 'Table Invite' : 'Table Invite Placeholder'}
      onPress={onPress}
      tone={hasActiveTable ? 'success' : 'neutral'}
      variant={hasActiveTable ? 'primary' : 'secondary'}
    />
  );
}
