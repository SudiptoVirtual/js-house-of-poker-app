import type React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';


import { colors } from '../../theme/colors';
type TableActionButtonProps = {
  disabled?: boolean;
  iconName: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  loading?: boolean;
  onPress: () => void;
};

function TableActionButton({ disabled = false, iconName, label, loading = false, onPress }: TableActionButtonProps) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.button, disabled ? styles.disabled : null, pressed ? styles.pressed : null]}>
      {loading ? (
        <ActivityIndicator color={colors.gold} size="small" />
      ) : (
        <MaterialCommunityIcons color={colors.gold} name={iconName} size={17} />
      )}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

type TableButtonProps = Omit<TableActionButtonProps, 'iconName' | 'label'>;

export function JoinTableButton(props: TableButtonProps) {
  return <TableActionButton {...props} iconName="login-variant" label="Join Table" />;
}

export function InviteToTableButton(props: TableButtonProps) {
  return <TableActionButton {...props} iconName="account-plus-outline" label="Invite to Table" />;
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.goldTint,
    borderColor: 'rgba(255,201,94,0.32)',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.74,
  },
});
