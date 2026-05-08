export const gameplayLayoutConfig = {
  breakpoints: {
    heroHandLg: 1240,
    heroHandMd: 900,
    heroZoneCompact: 980,
  },
  spacing: {
    availableMainWidthOffset: 18,
    landscapeHorizontalPadding: 24,
    landscapeGapTotal: 14,
    portraitFocusWidthOffset: 14,
    portraitFocusBottomOffset: 116,
    landscapeFocusBottomOffset: 30,
  },
  table: {
    aspectRatio: 1.72,
    aspectRatioLandscape: 2.16,
    minWidth: 340,
    maxWidthPortrait: 840,
    maxWidthLandscape: 1520,
    focusMaxWidth: 980,
    minHeight: 250,
    focusMinHeight: 260,
    heightRatio: 0.5,
  },
  panel: {
    minWidth: 220,
    maxWidth: 320,
    widthRatio: 0.24,
  },
} as const;
