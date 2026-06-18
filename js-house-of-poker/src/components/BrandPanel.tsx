import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { colors } from "../theme/colors";
const appLogo = require("../../assets/images/app-logo.jpg");

type BrandPanelProps = {
  title: string;
  subtitle?: string;
};

export function BrandPanel({ subtitle, title }: BrandPanelProps) {
  return (
    <LinearGradient
      colors={colors.gradients.feltOval}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.tableRingOuter} />
      <View style={styles.tableRingInner} />
      <View style={[styles.chip, styles.chipGold]}>
        <View style={styles.chipInset} />
      </View>
      <View style={[styles.chip, styles.chipCyan]}>
        <View style={styles.chipInset} />
      </View>
      <View style={styles.cardFan}>
        <View style={[styles.playingCard, styles.playingCardBack]}>
          <Text style={styles.cardRank}>J</Text>
          <Text style={styles.cardSuit}>♠</Text>
        </View>
        <View style={[styles.playingCard, styles.playingCardFront]}>
          <Text style={[styles.cardRank, styles.cardRankRed]}>A</Text>
          <Text style={[styles.cardSuit, styles.cardSuitRed]}>♥</Text>
        </View>
      </View>

      <View style={styles.logoFrame}>
        <Image source={appLogo} style={styles.logo} resizeMode="cover" />
      </View>
      <View style={styles.copyBlock}>
        <Text style={styles.kicker}>J's House of Poker</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: colors.radii.xl + 4,
    borderWidth: 1,
    gap: colors.spacing[16],
    overflow: "hidden",
    paddingHorizontal: colors.spacing[20],
    paddingVertical: colors.spacing[24],
    position: "relative",
    ...colors.shadows.lg,
  },
  cardFan: {
    height: 94,
    position: "absolute",
    right: 20,
    top: 16,
    width: 100,
  },
  cardRank: {
    color: colors.roles.cardBlackSuit,
    fontSize: 17,
    fontWeight: "900",
  },
  cardRankRed: {
    color: colors.roles.cardHeart,
  },
  cardSuit: {
    color: colors.roles.cardBlackSuit,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 22,
  },
  cardSuitRed: {
    color: colors.roles.cardHeart,
  },
  chip: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.72)",
    borderRadius: colors.radii.pill,
    borderWidth: 4,
    height: 52,
    justifyContent: "center",
    position: "absolute",
    width: 52,
  },
  chipCyan: {
    backgroundColor: colors.secondary,
    bottom: 22,
    right: 30,
  },
  chipGold: {
    backgroundColor: colors.gold,
    left: 24,
    top: 24,
  },
  chipInset: {
    borderColor: "rgba(6,3,20,0.34)",
    borderRadius: colors.radii.pill,
    borderWidth: 2,
    height: 26,
    width: 26,
  },
  copyBlock: {
    alignItems: "center",
    gap: colors.spacing[8],
    maxWidth: 320,
  },
  kicker: {
    ...colors.typography.chipLabel,
    color: colors.gold,
  },
  logo: {
    borderRadius: 28,
    height: "100%",
    width: "100%",
  },
  logoFrame: {
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 30,
    borderWidth: 1,
    height: 148,
    overflow: "hidden",
    width: 148,
    ...colors.shadows.md,
  },
  playingCard: {
    backgroundColor: colors.cardFace,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    borderWidth: 1,
    height: 76,
    padding: 8,
    position: "absolute",
    width: 54,
  },
  playingCardBack: {
    right: 36,
    transform: [{ rotate: "-14deg" }],
  },
  playingCardFront: {
    right: 4,
    top: 8,
    transform: [{ rotate: "10deg" }],
  },
  subtitle: {
    ...colors.typography.body,
    color: colors.textSoft,
    textAlign: "center",
  },
  tableRingInner: {
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 180,
    borderWidth: 1,
    height: 172,
    position: "absolute",
    top: 34,
    width: 320,
  },
  tableRingOuter: {
    borderColor: "rgba(255,201,94,0.20)",
    borderRadius: 220,
    borderWidth: 2,
    height: 220,
    position: "absolute",
    top: 10,
    width: 420,
  },
  title: {
    ...colors.typography.title,
    color: colors.text,
    textAlign: "center",
  },
});
