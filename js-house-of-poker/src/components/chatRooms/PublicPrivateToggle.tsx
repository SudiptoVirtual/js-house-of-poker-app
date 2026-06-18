import { Pressable, StyleSheet, Text, View } from 'react-native';


import { colors } from '../../theme/colors';
type PublicPrivateToggleProps = {
  isPrivate: boolean;
  onTogglePrivacy: (isPrivate: boolean) => void;
};

export function PublicPrivateToggle({ isPrivate, onTogglePrivacy }: PublicPrivateToggleProps) {
  return (
    <View style={styles.privacyRow}>
      <PrivacyToggle label="Public" selected={!isPrivate} onPress={() => onTogglePrivacy(false)} />
      <PrivacyToggle label="Private" selected={isPrivate} onPress={() => onTogglePrivacy(true)} />
    </View>
  );
}

function PrivacyToggle({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.privacyToggle, selected ? styles.privacyToggleSelected : null, pressed ? styles.pressed : null]}
    >
      <Text style={[styles.privacyText, selected ? styles.privacyTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.78,
  },
  privacyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  privacyText: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: '900',
  },
  privacyTextSelected: {
    color: colors.background,
  },
  privacyToggle: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  privacyToggleSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
});
