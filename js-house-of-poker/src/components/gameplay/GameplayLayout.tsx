import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export const bottomRightStageSizing = {
  heightRatio: 0.0350,
  maxHeight: 60,
  maxWidth: 180,
  minHeight: 45,
  minWidth: 80,
  widthRatio: 0.15,
} as const;

type Props = {
  bottomRightNode?: React.ReactNode;
  errorMessage?: string | null;
  footerNode?: React.ReactNode;
  heroSection?: React.ReactNode;
  insets: { bottom: number; left: number; right: number; top: number };
  isLandscape: boolean;
  isTopBarExpanded?: boolean;
  tableNode: React.ReactNode;
  topBar: React.ReactNode;
};

export function GameplayLayout({
  bottomRightNode,
  errorMessage,
  footerNode,
  heroSection,
  insets,
  isLandscape,
  isTopBarExpanded = true,
  tableNode,
  topBar,
}: Props) {
  const { height, width } = useWindowDimensions();
  const hasHeroSection = Boolean(heroSection);
  const footerHeight = isLandscape ? 30 : 42;
  const topInset = Math.max(2, insets.top ? 0 : 4);
  const sideGap = clamp(width * 0.008, 8, 16);
  const topBarHeight = isLandscape
    ? clamp(height * 0.052, 42, 56)
    : clamp(height * 0.12, 72, 108);
  const collapsedTopBarHeight = clamp(height * 0.052, 42, 56);
  const activeTopBarHeight = isTopBarExpanded ? topBarHeight : collapsedTopBarHeight;
  const tableTopOffset = isTopBarExpanded
    ? isLandscape
      ? topInset + topBarHeight + 2
      : topBarHeight * 0.78
    : topInset + collapsedTopBarHeight + 4;
  const actionHeight = hasHeroSection
    ? isLandscape
      ? clamp(height * 0.09, 68, 94)
      : clamp(height * 0.15, 104, 146)
    : 0;
  const actionBottom = footerHeight + Math.max(4, insets.bottom ? 0 : 4);
  const bottomRightHeight = clamp(
    height * bottomRightStageSizing.heightRatio,
    bottomRightStageSizing.minHeight,
    bottomRightStageSizing.maxHeight,
  );
  const bottomRightWidth = clamp(
    width * bottomRightStageSizing.widthRatio,
    bottomRightStageSizing.minWidth,
    bottomRightStageSizing.maxWidth,
  );

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.tableStage,
          {
            bottom: isLandscape
              ? actionBottom + actionHeight + (hasHeroSection ? 2 : 0)
              : actionBottom + (hasHeroSection ? actionHeight * 0.58 : 0),
            left: sideGap + insets.left,
            right: sideGap + insets.right,
            top: tableTopOffset,
          },
        ]}
      >
        {tableNode}
      </View>

      <View
        style={[
          styles.topBarStage,
          {
            alignItems: isTopBarExpanded ? 'stretch' : 'flex-start',
            height: activeTopBarHeight,
            left: sideGap,
            right: sideGap,
            top: topInset,
          },
        ]}
      >
        {topBar}
      </View>

      {hasHeroSection ? (
        <View
          style={[
            styles.heroStage,
            {
              bottom: actionBottom,
              height: actionHeight,
              left: sideGap + insets.left,
              right: sideGap + insets.right,
            },
          ]}
        >
          {heroSection}
        </View>
      ) : null}

      {bottomRightNode && isLandscape && width >= 900 ? (
        <View
          style={[
            styles.bottomRightStage,
            {
              bottom: actionBottom + 80,
              right: sideGap + insets.right,
              width: bottomRightWidth,
              height: bottomRightHeight,
            },
          ]}
        >
          {bottomRightNode}
        </View>
      ) : null}

      {footerNode ? (
        <View
          style={[
            styles.footerRail,
            {
              bottom: Math.max(0, insets.bottom ? -2 : 0),
              height: footerHeight,
              left: sideGap,
              right: sideGap,
            },
          ]}
        >
          {footerNode}
        </View>
      ) : null}

      {errorMessage ? (
        <View
          style={[
          styles.errorBanner,
          {
              left: sideGap + insets.left,
              right: sideGap + insets.right,
              top: topInset + activeTopBarHeight + 6,
            },
          ]}
        >
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomRightStage: {
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 46,
  },
  errorBanner: {
    backgroundColor: 'rgba(96,30,49,0.94)',
    borderColor: 'rgba(239,134,164,0.28)',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
    zIndex: 60,
  },
  errorText: {
    color: '#FFEAF4',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  footerRail: {
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 50,
  },
  heroStage: {
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 45,
  },
  screen: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  tableStage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 10,
  },
  topBarStage: {
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 55,
  },
});
