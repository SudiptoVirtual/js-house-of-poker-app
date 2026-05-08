import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

type Props = {
  bottomRightNode?: React.ReactNode;
  errorMessage?: string | null;
  footerNode?: React.ReactNode;
  heroSection: React.ReactNode;
  insets: { bottom: number; left: number; right: number; top: number };
  isLandscape: boolean;
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
  tableNode,
  topBar,
}: Props) {
  const { height, width } = useWindowDimensions();
  const footerHeight = isLandscape ? 38 : 50;
  const topInset = Math.max(2, insets.top ? 0 : 4);
  const sideGap = clamp(width * 0.008, 8, 16);
  const topBarHeight = isLandscape
    ? clamp(height * 0.074, 58, 78)
    : clamp(height * 0.16, 94, 144);
  const actionHeight = isLandscape
    ? clamp(height * 0.112, 88, 118)
    : clamp(height * 0.19, 126, 174);
  const actionBottom = footerHeight + Math.max(4, insets.bottom ? 0 : 4);

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.tableStage,
          {
            bottom: isLandscape
              ? actionBottom + actionHeight + 4
              : actionBottom + actionHeight * 0.62,
            left: sideGap + insets.left,
            right: sideGap + insets.right,
            top: isLandscape ? topInset + topBarHeight + 4 : topBarHeight * 0.84,
          },
        ]}
      >
        {tableNode}
      </View>

      <View
        style={[
          styles.topBarStage,
          {
            height: topBarHeight,
            left: sideGap,
            right: sideGap,
            top: topInset,
          },
        ]}
      >
        {topBar}
      </View>

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

      {bottomRightNode && isLandscape && width >= 900 ? (
        <View
          style={[
            styles.bottomRightStage,
            {
              bottom: actionBottom + 10,
              right: sideGap + insets.right,
              width: clamp(width * 0.19, 190, 280),
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
              top: topInset + topBarHeight + 6,
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
