import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import type { PlayerError, VideoPlayerStatus } from 'expo-video';

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
const VIDEO_START_TIMEOUT_MS = 12000;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function FeedVideo({ isActive, media, onOpenFullScreen, onRequestActive, targetWidth }: FeedVideoProps) {
  const [measuredWidth, setMeasuredWidth] = useState(targetWidth ?? DEFAULT_FEED_VIDEO_WIDTH);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [playerStatus, setPlayerStatus] = useState<VideoPlayerStatus>('idle');
  const [playerError, setPlayerError] = useState<PlayerError | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const playbackUrl = media.playableUrl || media.url;
  const isReady = media.processingStatus == null || media.processingStatus === 'ready';
  const player = useVideoPlayer(isReady ? playbackUrl : '', (nextPlayer) => {
    nextPlayer.loop = true;
    nextPlayer.muted = true;
  });
  const isPlaying = isActive && !isManuallyPaused;
  const hasPlaybackError = playerStatus === 'error' || hasTimedOut;
  const showLoadingOverlay = isActive && isReady && !hasPlaybackError && (playerStatus === 'idle' || playerStatus === 'loading');
  const thumbnailUrl = typeof media.thumbnailUrl === 'string' ? media.thumbnailUrl.trim() : '';
  const estimatedMediaWidth = Math.max(targetWidth ?? measuredWidth, 280);
  const mediaHeight = clamp(estimatedMediaWidth / mediaAspectRatio(media), MIN_FEED_VIDEO_HEIGHT, MAX_FEED_VIDEO_HEIGHT);

  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  useEffect(() => {
    if (isPlaying && !hasPlaybackError) player.play();
    else player.pause();
  }, [hasPlaybackError, isPlaying, player]);

  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ error, status }) => {
      setPlayerStatus(status);
      setPlayerError(error ?? null);
      if (status === 'readyToPlay' || status === 'error') setHasTimedOut(false);
    });

    setPlayerStatus(player.status);
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    setPlayerError(null);
    setHasTimedOut(false);
    setPlayerStatus(player.status);
  }, [playbackUrl, player]);

  useEffect(() => {
    if (!showLoadingOverlay) return undefined;
    const timeout = setTimeout(() => setHasTimedOut(true), VIDEO_START_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [showLoadingOverlay, playbackUrl]);

  useEffect(() => {
    if (!isActive) {
      setIsManuallyPaused(false);
      setIsMuted(true);
    }
  }, [isActive]);

  function retryPlayback() {
    if (!isReady) return;
    setPlayerError(null);
    setHasTimedOut(false);
    setPlayerStatus('loading');
    player.replace(playbackUrl);
    if (!isActive) onRequestActive?.();
    player.play();
  }

  function togglePlayback() {
    if (!isReady || hasPlaybackError) return;
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
      {showLoadingOverlay ? (
        <View accessibilityLabel="Video is loading" accessibilityRole="text" style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.processingText}>{playerStatus === 'loading' ? 'Buffering video' : 'Starting video'}</Text>
        </View>
      ) : null}
      {hasPlaybackError ? (
        <View accessibilityLabel="Video playback failed" accessibilityRole="alert" style={styles.errorOverlay}>
          <MaterialCommunityIcons color={colors.gold} name="alert-circle-outline" size={32} />
          <Text style={styles.processingText}>{hasTimedOut ? 'Video took too long to start' : 'Could not play video'}</Text>
          {playerError?.message ? <Text numberOfLines={2} style={styles.errorDetail}>{playerError.message}</Text> : null}
          <View style={styles.errorActions}>
            <Pressable accessibilityLabel="Retry video playback" accessibilityRole="button" onPress={retryPlayback} style={styles.retryButton}>
              <MaterialCommunityIcons color={colors.background} name="reload" size={18} />
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
            {onOpenFullScreen ? (
              <Pressable accessibilityHint="Opens a full-screen video player" accessibilityLabel="Open video full screen" accessibilityRole="button" onPress={onOpenFullScreen} style={styles.fallbackButton}>
                <MaterialCommunityIcons color={colors.white} name="arrow-expand" size={18} />
                <Text style={styles.fallbackButtonText}>Open full screen</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
      {!isReady ? (
        <View accessibilityLabel="Video is processing" accessibilityRole="text" style={styles.processingOverlay}>
          <MaterialCommunityIcons color={colors.gold} name={media.processingStatus === 'failed' ? 'alert-circle-outline' : 'progress-clock'} size={30} />
          <Text style={styles.processingText}>{media.processingStatus === 'failed' ? 'Video unavailable' : 'Processing video'}</Text>
        </View>
      ) : null}
      <View style={styles.controls}>
        <Pressable accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'} accessibilityRole="button" disabled={!isReady || hasPlaybackError} onPress={togglePlayback} style={[styles.controlButton, (!isReady || hasPlaybackError) && styles.disabledControlButton]}>
          <MaterialCommunityIcons color={colors.white} name={isReady ? (isPlaying ? 'pause' : 'play') : 'progress-clock'} size={24} />
        </Pressable>
        <Pressable accessibilityLabel={isMuted ? 'Enable video sound' : 'Mute video'} accessibilityRole="button" disabled={!isReady || hasPlaybackError} onPress={() => setIsMuted((current) => !current)} style={[styles.controlButton, (!isReady || hasPlaybackError) && styles.disabledControlButton]}>
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
  errorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 4 },
  errorDetail: { color: colors.secondary, fontSize: 12, fontWeight: '700', maxWidth: '82%', textAlign: 'center' },
  errorOverlay: { alignItems: 'center', backgroundColor: 'rgba(6,3,20,0.78)', gap: 8, ...StyleSheet.absoluteFillObject, justifyContent: 'center', padding: 18 },
  fallbackButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.34)', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 9 },
  fallbackButtonText: { color: colors.white, fontSize: 12, fontWeight: '900' },
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
  loadingOverlay: { alignItems: 'center', backgroundColor: 'rgba(6,3,20,0.58)', gap: 10, ...StyleSheet.absoluteFillObject, justifyContent: 'center' },
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
  retryButton: { alignItems: 'center', backgroundColor: colors.gold, borderRadius: 999, flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  retryButtonText: { color: colors.background, fontSize: 12, fontWeight: '900' },
  shell: {
    backgroundColor: colors.background,
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
  },
});
