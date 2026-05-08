import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

const appLogo = require('../../assets/images/app-logo.jpg');

type BrandPanelProps = {
  title: string;
  subtitle?: string;
};

export function BrandPanel({ subtitle, title }: BrandPanelProps) {
  return (
    <View style={styles.card}>
      <View style={styles.logoFrame}>
        <Image source={appLogo} style={styles.logo} resizeMode="cover" />
      </View>
      <View style={styles.copyBlock}>
        <Text style={styles.kicker}>J&apos;s House of Poker</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  copyBlock: {
    alignItems: 'center',
    gap: 8,
  },
  kicker: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  logo: {
    borderRadius: 28,
    height: '100%',
    width: '100%',
  },
  logoFrame: {
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 30,
    borderWidth: 1,
    height: 156,
    overflow: 'hidden',
    width: 156,
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
});
