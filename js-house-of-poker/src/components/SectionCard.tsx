import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';


import { colors } from '../theme/colors';
type SectionCardProps = PropsWithChildren<{
  headerRight?: ReactNode;
  title: string;
}>;

export function SectionCard({ title, headerRight, children }: SectionCardProps) {
  return (
    <View style={styles.card}>
      {headerRight ? (
        <View style={styles.header}>
          <Text style={[styles.title, styles.headerTitle]}>{title}</Text>
          <View style={styles.headerRight}>{headerRight}</View>
        </View>
      ) : (
        <Text style={styles.title}>{title}</Text>
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // backgroundColor: colors.surface,
    // borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    // padding: 18,
  },
  content: {
    gap: 10,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headerRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
});
