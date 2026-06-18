import { StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';


import { colors } from '../../theme/colors';
type PlayerSearchInputProps = {
  onChangeText: (query: string) => void;
  value: string;
};

export function PlayerSearchInput({ onChangeText, value }: PlayerSearchInputProps) {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons color={colors.mutedText} name="account-search-outline" size={20} />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder="Search name or username"
        placeholderTextColor={colors.mutedText}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    minHeight: 44,
    paddingVertical: 10,
  },
});
