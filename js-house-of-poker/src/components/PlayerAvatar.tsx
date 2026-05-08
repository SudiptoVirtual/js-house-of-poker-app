import { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  getAvatarPalette,
  getPlayerInitials,
  getPlayerStatusBadge,
  getPlayerStatusBadgeImage,
  getPlayerStatusName,
} from '../utils/pokerTable';
import type { PokerPlayerStatus } from '../types/poker';

type PlayerAvatarProps = {
  connected?: boolean;
  name: string;
  seed: string;
  size?: 'lg' | 'md' | 'sm';
  status?: PokerPlayerStatus;
};

const SIZE_MAP = {
  lg: {
    badgeFontSize: 8,
    badgeImage: 26,
    badgePaddingHorizontal: 3,
    badgePaddingVertical: 3,
    badgeTop: 3,
    dot: 14,
    fontSize: 18,
    inner: 62,
    outer: 72,
  },
  md: {
    badgeFontSize: 7,
    badgeImage: 22,
    badgePaddingHorizontal: 3,
    badgePaddingVertical: 3,
    badgeTop: 2,
    dot: 12,
    fontSize: 15,
    inner: 46,
    outer: 54,
  },
  sm: {
    badgeFontSize: 6,
    badgeImage: 18,
    badgePaddingHorizontal: 2,
    badgePaddingVertical: 2,
    badgeTop: 1,
    dot: 10,
    fontSize: 12,
    inner: 34,
    outer: 40,
  },
} as const;

export const PlayerAvatar = memo(function PlayerAvatar({
  connected = true,
  name,
  seed,
  size = 'md',
  status,
}: PlayerAvatarProps) {
  const palette = getAvatarPalette(seed);
  const config = SIZE_MAP[size];
  const statusBadge = status ? getPlayerStatusBadge(status) : null;
  const statusBadgeImage = status ? getPlayerStatusBadgeImage(status) : null;
  const statusBadgeName = status ? statusBadge?.name ?? getPlayerStatusName(status) : undefined;

  return (
    <View
      style={[
        styles.shell,
        {
          borderColor: palette.ring,
          height: config.outer,
          width: config.outer,
        },
      ]}
    >
      <LinearGradient
        colors={[palette.fill, '#0B171A']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[
          styles.inner,
          {
            height: config.inner,
            width: config.inner,
          },
        ]}
      >
        <View style={styles.sheen} />
        <Text style={[styles.label, { color: palette.text, fontSize: config.fontSize }]}>
          {getPlayerInitials(name)}
        </Text>
      </LinearGradient>
      {statusBadge || statusBadgeImage ? (
        <View
          style={[
            styles.statusBubble,
            {
              backgroundColor: statusBadge?.backgroundColor ?? 'transparent',
              borderColor: statusBadge?.borderColor ?? 'transparent',
              paddingHorizontal: config.badgePaddingHorizontal,
              paddingVertical: config.badgePaddingVertical,
              top: config.badgeTop,
            },
          ]}
        >
          {statusBadgeImage ? (
            <Image
              accessibilityLabel={statusBadgeName}
              resizeMode="contain"
              source={statusBadgeImage}
              style={{ height: config.badgeImage, width: config.badgeImage }}
            />
          ) : statusBadge ? (
            <Text
              numberOfLines={1}
              style={[
                styles.statusBubbleText,
                { color: statusBadge.color, fontSize: config.badgeFontSize },
              ]}
            >
              {statusBadge.label}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.presence,
          {
            backgroundColor: connected ? '#67F3BB' : '#737A88',
            borderColor: '#071316',
            height: config.dot,
            width: config.dot,
          },
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  inner: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  presence: {
    borderRadius: 999,
    borderWidth: 2,
    bottom: 0,
    position: 'absolute',
    right: 0,
  },
  sheen: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    height: '60%',
    left: '10%',
    position: 'absolute',
    top: '6%',
    width: '60%',
  },
  shell: {
    alignItems: 'center',
    backgroundColor: 'rgba(5,12,15,0.72)',
    borderRadius: 999,
    borderWidth: 2,
    justifyContent: 'center',
    position: 'relative',
  },
  statusBubble: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    position: 'absolute',
    right: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    zIndex: 2,
  },
  statusBubbleText: {
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
