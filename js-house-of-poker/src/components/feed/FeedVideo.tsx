import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';

import type { FeedVideoMedia } from '../../types/feed';

import { colors } from '../../theme/colors';
type FeedVideoProps = {
  isActive: boolean;
  media: FeedVideoMedia;
  targetWidth?: number;
  onOpenFullScreen?: () => void;
  onRequestActive?: () => void;
};

function mediaAspectRatio(media: FeedVideoMedia) {
  return media.width && media.height && media.width > 0 && media.height > 0
    ? media.width / media.height
    : 16 / 9;
}

const DEFAULT_FEED_VIDEO_WIDTH = 360;
const MAX_FEED_VIDEO_HEIGHT = 720;
const MIN_FEED_VIDEO_HEIGHT = 180;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function FeedVideo({ isActive, media, onOpenFullScreen, onRequestActive, targetWidth }: FeedVideoProps) {
  const [measuredWidth, setMeasuredWidth] = useState(targetWidth ?? DEFAULT_FEED_VIDEO_WIDTH);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const playbackUrl = media.playableUrl || media.url;
  const isReady = media.processingStatus == null || media.processingStatus === 'ready';
  const player = useVideoPlayer(isReady ? playbackUrl : '', (nextPlayer) => {
    nextPlayer.loop = true;
    nextPlayer.muted = true;
  });
  const isPlaying = isActive && !isManuallyPaused;
  const thumbnailUrl = typeof media.thumbnailUrl === 'string' ? media.thumbnailUrl.trim() : '';
  const estimatedMediaWidth = Math.max(targetWidth ?? measuredWidth, 280);
  const mediaHeight = clamp(estimatedMediaWidth / mediaAspectRatio(media), MIN_FEED_VIDEO_HEIGHT, MAX_FEED_VIDEO_HEIGHT);

  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  useEffect(() => {
    if (isPlaying) player.play();
    else player.pause();
  }, [isPlaying, player]);

  useEffect(() => {
    if (!isActive) {
      setIsManuallyPaused(false);
      setIsMuted(true);
    }
  }, [isActive]);

  function togglePlayback() {
    if (!isReady) return;
    if (!isActive) {
      setIsManuallyPaused(false);
      onRequestActive?.();
      return;
    }
    setIsManuallyPaused(isPlaying);
  }

  return (
    <View onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)} style={[styles.shell, { height: mediaHeight }]}>
      {thumbnailUrl ? (
        <Image accessibilityLabel={`${media.altText} video thumbnail`} resizeMode="cover" source={{ uri: thumbnailUrl }} style={StyleSheet.absoluteFillObject} />
      ) : (
        <View accessibilityLabel={`${media.altText} video placeholder`} accessibilityRole="image" style={[StyleSheet.absoluteFillObject, styles.placeholder]}>
          <MaterialCommunityIcons color={colors.secondary} name="video-outline" size={42} />
        </View>
      )}
      {isActive && isReady ? <VideoView accessibilityLabel={media.altText} accessibilityRole="image" contentFit="contain" nativeControls={false} player={player} style={StyleSheet.absoluteFillObject} /> : null}
      {!isReady ? (
        <View accessibilityLabel="Video is processing" accessibilityRole="text" style={styles.processingOverlay}>
          <MaterialCommunityIcons color={colors.gold} name={media.processingStatus === 'failed' ? 'alert-circle-outline' : 'progress-clock'} size={30} />
          <Text style={styles.processingText}>{media.processingStatus === 'failed' ? 'Video unavailable' : 'Processing video'}</Text>
        </View>
      ) : null}
      <View style={styles.controls}>
        <Pressable accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'} accessibilityRole="button" disabled={!isReady} onPress={togglePlayback} style={[styles.controlButton, !isReady && styles.disabledControlButton]}>
          <MaterialCommunityIcons color={colors.white} name={isReady ? (isPlaying ? 'pause' : 'play') : 'progress-clock'} size={24} />
        </Pressable>
        <Pressable accessibilityLabel={isMuted ? 'Enable video sound' : 'Mute video'} accessibilityRole="button" disabled={!isReady} onPress={() => setIsMuted((current) => !current)} style={[styles.controlButton, !isReady && styles.disabledControlButton]}>
          <MaterialCommunityIcons color={colors.white} name={isMuted ? 'volume-off' : 'volume-high'} size={20} />
        </Pressable>
        {onOpenFullScreen ? (
          <Pressable accessibilityHint="Opens a full-screen video player" accessibilityLabel="Open video full screen" accessibilityRole="button" disabled={!isReady} onPress={onOpenFullScreen} style={[styles.controlButton, !isReady && styles.disabledControlButton]}>
            <MaterialCommunityIcons color={colors.white} name="arrow-expand" size={20} />
          </Pressable>
        ) : null}
        {media.durationMs != null ? <Text style={styles.duration}>{Math.floor(media.durationMs / 60000)}:{String(Math.floor(media.durationMs / 1000) % 60).padStart(2, '0')}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controlButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(6,3,20,0.78)',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  controls: {
    alignItems: 'center',
    bottom: 10,
    flexDirection: 'row',
    gap: 8,
    left: 10,
    position: 'absolute',
    right: 10,
  },
  disabledControlButton: {
    opacity: 0.55,
  },
  duration: {
    backgroundColor: 'rgba(6,3,20,0.78)',
    borderRadius: 999,
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 'auto',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  processingOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(6,3,20,0.72)',
    gap: 8,
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  processingText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  placeholder: {
    alignItems: 'center',
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  shell: {
    backgroundColor: colors.background,
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
  },
});
