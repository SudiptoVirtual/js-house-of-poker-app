import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

export function EmptyOnlineFriendsState() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>No friends online right now</Text>
      <Text style={styles.body}>Search players to find offline friends, pending requests, or new players.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  container: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 18,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
});
