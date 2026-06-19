import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';

import { colors } from '../../theme/colors';

type MediaVideoProps = {
  accessibilityLabel?: string;
  durationMs?: number | null;
  thumbnailUrl?: string | null;
  url: string;
};

export function formatVideoDuration(durationMs?: number | null) {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs < 0) return null;
  const totalSeconds = Math.floor(durationMs / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export function MediaVideo({ accessibilityLabel = 'Video attachment', durationMs, thumbnailUrl, url }: MediaVideoProps) {
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);
  const normalizedThumbnailUrl = typeof thumbnailUrl === 'string' ? thumbnailUrl.trim() : '';
  const formattedDuration = formatVideoDuration(durationMs);
  const player = useVideoPlayer(url, (nextPlayer) => {
    nextPlayer.loop = false;
    nextPlayer.muted = false;
  });

  useEffect(() => {
    if (isPlayerVisible) return;
    player.pause();
  }, [isPlayerVisible, player]);

  function closePlayer() {
    player.pause();
    setIsPlayerVisible(false);
  }

  return (
    <>
      <Pressable accessibilityHint="Opens a full-screen video player" accessibilityLabel={accessibilityLabel} accessibilityRole="button" onPress={() => setIsPlayerVisible(true)} style={styles.previewButton}>
        {normalizedThumbnailUrl ? (
          <Image resizeMode="cover" source={{ uri: normalizedThumbnailUrl }} style={StyleSheet.absoluteFillObject} />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.placeholder]}>
            <MaterialCommunityIcons color={colors.secondary} name="video-outline" size={38} />
          </View>
        )}
        <View style={styles.scrim} />
        <View style={styles.playBadge}>
          <MaterialCommunityIcons color={colors.white} name="play" size={28} />
        </View>
        {formattedDuration ? <Text style={styles.duration}>{formattedDuration}</Text> : null}
      </Pressable>
      <Modal animationType="fade" onRequestClose={closePlayer} transparent visible={isPlayerVisible}>
        <View style={styles.modalBackdrop}>
          <VideoView accessibilityLabel={`${accessibilityLabel} player`} contentFit="contain" nativeControls player={player} style={styles.player} />
          <Pressable accessibilityLabel="Close full-screen video player" accessibilityRole="button" onPress={closePlayer} style={styles.closeButton}>
            <MaterialCommunityIcons color={colors.white} name="close" size={24} />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  closeButton: { alignItems: 'center', backgroundColor: 'rgba(6,3,20,0.78)', borderRadius: 999, height: 44, justifyContent: 'center', position: 'absolute', right: 18, top: 54, width: 44 },
  duration: { backgroundColor: 'rgba(6,3,20,0.78)', borderRadius: 999, bottom: 10, color: colors.white, fontSize: 12, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 6, position: 'absolute', right: 10 },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.94)', flex: 1, justifyContent: 'center' },
  placeholder: { alignItems: 'center', backgroundColor: colors.background, justifyContent: 'center' },
  playBadge: { alignItems: 'center', backgroundColor: 'rgba(6,3,20,0.78)', borderColor: 'rgba(255,255,255,0.72)', borderRadius: 999, borderWidth: 1, height: 58, justifyContent: 'center', width: 58 },
  player: { height: '100%', width: '100%' },
  previewButton: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.border, borderRadius: 12, borderWidth: 1, height: 180, justifyContent: 'center', overflow: 'hidden', width: '100%' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,3,20,0.24)' },
});
