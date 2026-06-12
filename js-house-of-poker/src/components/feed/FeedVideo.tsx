import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';

import { colors } from '../../theme/colors';
import type { FeedVideoMedia } from '../../types/feed';

type FeedVideoProps = {
  isActive: boolean;
  media: FeedVideoMedia;
  onRequestActive?: () => void;
};

function mediaAspectRatio(media: FeedVideoMedia) {
  return media.width && media.height && media.width > 0 && media.height > 0
    ? media.width / media.height
    : 16 / 9;
}

export function FeedVideo({ isActive, media, onRequestActive }: FeedVideoProps) {
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const player = useVideoPlayer(media.url, (nextPlayer) => {
    nextPlayer.loop = true;
    nextPlayer.muted = true;
  });
  const isPlaying = isActive && !isManuallyPaused;

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
    if (!isActive) {
      setIsManuallyPaused(false);
      onRequestActive?.();
      return;
    }
    setIsManuallyPaused(isPlaying);
  }

  return (
    <View style={[styles.shell, { aspectRatio: mediaAspectRatio(media) }]}>
      <Image accessibilityLabel={`${media.altText} video thumbnail`} resizeMode="cover" source={{ uri: media.thumbnailUrl }} style={StyleSheet.absoluteFillObject} />
      {isActive ? <VideoView accessibilityLabel={media.altText} accessibilityRole="image" contentFit="contain" nativeControls={false} player={player} style={StyleSheet.absoluteFillObject} /> : null}
      <View style={styles.controls}>
        <Pressable accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'} accessibilityRole="button" onPress={togglePlayback} style={styles.controlButton}>
          <MaterialCommunityIcons color={colors.white} name={isPlaying ? 'pause' : 'play'} size={24} />
        </Pressable>
        <Pressable accessibilityLabel={isMuted ? 'Enable video sound' : 'Mute video'} accessibilityRole="button" onPress={() => setIsMuted((current) => !current)} style={styles.controlButton}>
          <MaterialCommunityIcons color={colors.white} name={isMuted ? 'volume-off' : 'volume-high'} size={20} />
        </Pressable>
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
  shell: {
    backgroundColor: colors.background,
    borderRadius: 16,
    maxHeight: 480,
    minHeight: 180,
    overflow: 'hidden',
    width: '100%',
  },
});
