import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../../theme/colors';

type Props = {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  eyebrow?: string;
  title: string;
};

export function PanelShell({ children, contentStyle, eyebrow, title }: Props) {
  return (
    <LinearGradient
      colors={[colors.surface, colors.background]}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.shell}
    >
      <View style={styles.header}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 10,
  },
  eyebrow: {
    color: colors.action,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  header: {
    borderBottomColor: colors.surfaces.actionTint,
    borderBottomWidth: 1,
    gap: 4,
    paddingBottom: 8,
  },
  shell: {
    borderColor: colors.glowCyan,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
