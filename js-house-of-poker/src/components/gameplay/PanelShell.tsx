import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  eyebrow?: string;
  title: string;
};

export function PanelShell({ children, contentStyle, eyebrow, title }: Props) {
  return (
    <LinearGradient
      colors={['rgba(10, 7, 20, 0.98)', 'rgba(5, 4, 12, 0.99)']}
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
    color: '#8BD7B7',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  header: {
    borderBottomColor: 'rgba(180, 84, 255, 0.16)',
    borderBottomWidth: 1,
    gap: 4,
    paddingBottom: 8,
  },
  shell: {
    borderColor: 'rgba(180, 84, 255, 0.28)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: {
    color: '#B35CFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
