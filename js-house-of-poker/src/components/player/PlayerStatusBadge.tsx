import { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { PLAYER_STATUS_ASSETS, type PlayerStatusTier } from '../../constants/playerStatus';

type PlayerStatusBadgeProps = {
  compact?: boolean;
  showLabel?: boolean;
  size?: number;
  statusTier?: PlayerStatusTier;
};

export const PlayerStatusBadge = memo(function PlayerStatusBadge({
  compact = false,
  showLabel = true,
  size,
  statusTier,
}: PlayerStatusBadgeProps) {
  const statusAsset = statusTier ? PLAYER_STATUS_ASSETS[statusTier] : null;
  const fixedIconSize = size ?? null;

  if (!statusAsset?.image) {
    return null;
  }

  return (
    <View
      style={[
        styles.badge,
        compact ? styles.badgeCompact : null,
        size
          ? {
              backgroundColor: 'transparent',
              borderRadius: size / 2,
              borderWidth: 0,
              height: size,
              maxWidth: size,
              overflow: 'hidden',
              paddingHorizontal: 0,
              paddingVertical: 0,
              width: size,
            }
          : null,
      ]}
    >
      <Image
        accessibilityLabel={statusAsset.label}
        resizeMode="contain"
        source={statusAsset.image}
        style={[
          compact ? styles.imageCompact : styles.image,
          fixedIconSize
            ? { borderRadius: fixedIconSize / 2, height: fixedIconSize, width: fixedIconSize }
            : null,
        ]}
      />
      {showLabel ? (
        <Text numberOfLines={1} style={[styles.label, compact ? styles.labelCompact : null]}>
          {statusAsset.label}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(8, 8, 14, 0.84)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    maxWidth: 132,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeCompact: {
    gap: 3,
    maxWidth: 86,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  image: {
    height: 22,
    width: 22,
  },
  imageCompact: {
    height: 18,
    width: 18,
  },
  label: {
    color: '#FFF6FB',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  labelCompact: {
    fontSize: 8,
    letterSpacing: 0.25,
  },
});
