import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const palette = {
  ink: '#05030B',
  casinoMidnight: '#060314',
  casinoPurple: '#151035',
  casinoPurpleMuted: '#1F1648',
  neonViolet: '#8B5CFF',
  neonCyan: '#36E7FF',
  neonPink: '#FF4FD8',
  felt: '#0B5A56',
  feltDark: '#062A33',
  feltDeep: '#061812',
  gold: '#FFC95E',
  goldSoft: '#F4D99E',
  action: '#36E7FF',
  actionDeep: '#0A3F5C',
  muted: '#7F75A8',
  glowCyan: 'rgba(54,231,255,0.28)',
  glowGold: 'rgba(255,201,94,0.32)',
  glowDanger: 'rgba(255,95,137,0.26)',
  success: '#4DF3C7',
  danger: '#FF5F89',
  cardFace: '#F7F5FF',
  cardBorder: '#CBBEF9',
  cardRed: '#D6231B',
  cardHeart: '#D24563',
  cardDiamond: '#E26D4B',
  cardBlack: '#091018',
  text: '#F6F2FF',
  textInverse: '#21140A',
  textOnGold: '#21140A',
  textSoft: '#E8F8F1',
  textMuted: '#AFA3D6',
  border: '#403070',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const gradients = {
  casinoNight: [palette.ink, '#090314', palette.ink] as const,
  feltTable: [palette.felt, palette.feltDark, palette.feltDeep] as const,
  feltOval: ['#0F7770', palette.felt, palette.feltDark, palette.feltDeep] as const,
  tableRim: ['#3A2812', '#9D6A24', '#2A180B'] as const,
  actionPrimary: [palette.actionDeep, palette.action] as const,
  actionSecondary: ['#1B1432', palette.neonViolet] as const,
  actionDestructive: ['#3A0B18', palette.danger] as const,
  actionGold: ['#4A2E07', palette.gold] as const,
  modalOverlay: ['rgba(3,7,18,0.72)', 'rgba(3,7,18,0.88)'] as const,
} as const;

export const surfaces = {
  elevatedCard: '#151035',
  glassPanel: 'rgba(255,255,255,0.06)',
  navigationBar: 'rgba(6,3,20,0.94)',
  inputField: '#1F1648',
  destructivePanel: 'rgba(255,91,110,0.12)',
  modalBackdrop: 'rgba(3,7,18,0.72)',
  goldTint: 'rgba(255,201,94,0.10)',
  successTint: 'rgba(77,243,199,0.14)',
  cyanTint: 'rgba(54,231,255,0.12)',
  feltTint: 'rgba(11,90,86,0.28)',
  actionTint: 'rgba(54,231,255,0.14)',
  mutedTint: 'rgba(127,117,168,0.14)',
  glowPanel: 'rgba(54,231,255,0.08)',
} as const;

export const spacing = {
  2: 2,
  4: 4,
  8: 8,
  10: 10,
  12: 12,
  14: 14,
  16: 16,
  18: 18,
  20: 20,
  24: 24,
  32: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  button: 18,
  card: 22,
  xl: 24,
  pill: 999,
} as const;

export const borders = {
  hairline: 1,
  default: { borderColor: palette.border, borderWidth: 1 } satisfies ViewStyle,
  cyan: { borderColor: palette.neonCyan, borderWidth: 1 } satisfies ViewStyle,
  gold: { borderColor: palette.gold, borderWidth: 1 } satisfies ViewStyle,
  danger: { borderColor: palette.danger, borderWidth: 1 } satisfies ViewStyle,
  mutedCyan: { borderColor: 'rgba(54,231,255,0.18)', borderWidth: 1 } satisfies ViewStyle,
  mutedViolet: { borderColor: 'rgba(138,113,255,0.42)', borderWidth: 1 } satisfies ViewStyle,
} as const;

export const componentSpacing = {
  button: { gap: spacing[8], paddingHorizontal: spacing[18], paddingVertical: spacing[14] },
  buttonCompact: { gap: spacing[8], paddingHorizontal: spacing[14], paddingVertical: 11 },
  card: { gap: spacing[12], padding: spacing[18] },
  banner: { gap: spacing[12], margin: spacing[12], padding: spacing[14] },
} as const;

export const typography = {
  display: { fontSize: 34, fontWeight: '900', lineHeight: 40 } satisfies TextStyle,
  title: { fontSize: 24, fontWeight: '900', lineHeight: 30 } satisfies TextStyle,
  sectionTitle: { fontSize: 18, fontWeight: '800', lineHeight: 24 } satisfies TextStyle,
  body: { fontSize: 15, fontWeight: '500', lineHeight: 22 } satisfies TextStyle,
  caption: { fontSize: 12, fontWeight: '600', lineHeight: 17 } satisfies TextStyle,
  chipLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 0.4, lineHeight: 15, textTransform: 'uppercase' } satisfies TextStyle,
} as const;

const iosElevation = {
  sm: { shadowColor: palette.black, shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.16, shadowRadius: 8 },
  md: { shadowColor: palette.black, shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.22, shadowRadius: 16 },
  lg: { shadowColor: palette.black, shadowOffset: { height: 14, width: 0 }, shadowOpacity: 0.28, shadowRadius: 28 },
} as const;

const androidElevation = {
  sm: { elevation: 2 },
  md: { elevation: 5 },
  lg: { elevation: 9 },
} as const;

export const shadows = {
  sm: Platform.select<ViewStyle>({ android: androidElevation.sm, ios: iosElevation.sm, default: iosElevation.sm }),
  md: Platform.select<ViewStyle>({ android: androidElevation.md, ios: iosElevation.md, default: iosElevation.md }),
  lg: Platform.select<ViewStyle>({ android: androidElevation.lg, ios: iosElevation.lg, default: iosElevation.lg }),
  ios: iosElevation,
  android: androidElevation,
} as const;

export const theme = {
  borders,
  componentSpacing,
  gradients,
  palette,
  radii,
  shadows,
  spacing,
  surfaces,
  typography,
} as const;
