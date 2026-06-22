import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';

import type { FeedImageMedia, FeedMedia, FeedVideoMedia } from '../../types/feed';
import { ZoomableMediaViewer } from '../media/ZoomableMediaViewer';
import { FeedVideo } from './FeedVideo';

import { colors } from '../../theme/colors';
type FeedMediaGalleryProps = {
  isActive?: boolean;
  media: FeedMedia[];
  onRequestVideoActive?: () => void;
};

type ImageState = 'loading' | 'ready' | 'error';

function mediaAspectRatio(media: FeedImageMedia) {
  return media.width && media.height && media.width > 0 && media.height > 0 ? media.width / media.height : 4 / 3;
}

function FeedImage({ collage = false, media, onPress }: { collage?: boolean; media: FeedImageMedia; onPress: () => void }) {
  const [imageState, setImageState] = useState<ImageState>('loading');

  return (
    <Pressable accessibilityHint="Opens a full-screen preview" accessibilityLabel={`Preview ${media.altText}`} accessibilityRole="imagebutton" onPress={onPress} style={collage ? styles.collageTile : [styles.imageShell, { aspectRatio: mediaAspectRatio(media) }]}>
      {imageState !== 'error' ? <Image accessibilityLabel={media.altText} onError={() => setImageState('error')} onLoad={() => setImageState('ready')} resizeMode={collage ? 'cover' : 'contain'} source={{ uri: media.url }} style={StyleSheet.absoluteFillObject} /> : null}
      {imageState === 'loading' ? <ActivityIndicator color={colors.secondary} size={collage ? 'small' : 'large'} /> : null}
      {imageState === 'error' ? <View style={styles.stateStack}><MaterialCommunityIcons color={colors.mutedText} name="image-off-outline" size={30} /><Text style={styles.stateText}>Image unavailable</Text></View> : null}
    </Pressable>
  );
}

function FeedVideoPreviewModal({ media, onClose, visible }: { media?: FeedVideoMedia; onClose: () => void; visible: boolean }) {
  const player = useVideoPlayer(media?.url ?? '', (nextPlayer) => {
    nextPlayer.loop = false;
    nextPlayer.muted = false;
  });

  useEffect(() => {
    if (!visible) {
      player.pause();
    }
  }, [player, visible]);

  function closePlayer() {
    player.pause();
    onClose();
  }

  return (
    <Modal animationType="fade" onRequestClose={closePlayer} transparent visible={visible}>
      <View style={styles.videoModalBackdrop}>
        {media ? <VideoView accessibilityLabel={`Full-screen video preview: ${media.altText}`} contentFit="contain" nativeControls player={player} style={styles.videoModalPlayer} /> : null}
        <Pressable accessibilityLabel="Close full-screen video player" accessibilityRole="button" onPress={closePlayer} style={styles.videoModalCloseButton}>
          <MaterialCommunityIcons color={colors.white} name="close" size={24} />
        </Pressable>
      </View>
    </Modal>
  );
}

export function FeedMediaGallery({ isActive = false, media, onRequestVideoActive }: FeedMediaGalleryProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewVideoIndex, setPreviewVideoIndex] = useState<number | null>(null);
  if (media.length === 0) return null;
  const images = media.filter((item): item is FeedImageMedia => item.type === 'image');
  const videos = media.filter((item) => item.type === 'video');
  const previewVideo = previewVideoIndex !== null ? videos[previewVideoIndex] : undefined;
  const move = (delta: number) => setPreviewIndex((index) => index === null ? null : (index + delta + images.length) % images.length);
  const tile = (image: FeedImageMedia, index: number) => <FeedImage collage key={`${image.url}-${index}`} media={image} onPress={() => setPreviewIndex(index)} />;
  const renderCollage = () => {
    if (images.length === 2 || images.length === 4) {
      return <View style={[styles.collage, images.length === 4 && styles.wrap]}>{images.map(tile)}</View>;
    }

    return <View style={styles.collage}><View style={styles.lead}>{tile(images[0], 0)}</View><View style={styles.column}>{images.slice(1).map((image, index) => tile(image, index + 1))}</View></View>;
  };
  return <View accessibilityLabel={`${media.length} media attachment${media.length === 1 ? '' : 's'}`} style={styles.gallery}>
    {images.length === 1 ? <FeedImage media={images[0]} onPress={() => setPreviewIndex(0)} /> : null}
    {images.length > 1 ? renderCollage() : null}
    {videos.map((item, index) => <FeedVideo isActive={isActive && previewVideoIndex === null} key={`${item.url}-${index}`} media={item} onOpenFullScreen={() => setPreviewVideoIndex(index)} onRequestActive={onRequestVideoActive} />)}
    <ZoomableMediaViewer accessibilityLabel={previewIndex !== null ? `Full-screen preview: ${images[previewIndex].altText}` : 'Full-screen image preview'} onClose={() => setPreviewIndex(null)} uri={previewIndex !== null ? images[previewIndex].url : undefined} visible={previewIndex !== null}>
      {images.length > 1 ? <><Pressable accessibilityLabel="Previous image" accessibilityRole="button" onPress={() => move(-1)} style={[styles.nav, styles.previous]}><MaterialCommunityIcons color={colors.white} name="chevron-left" size={36} /></Pressable><Pressable accessibilityLabel="Next image" accessibilityRole="button" onPress={() => move(1)} style={[styles.nav, styles.next]}><MaterialCommunityIcons color={colors.white} name="chevron-right" size={36} /></Pressable></> : null}
    </ZoomableMediaViewer>
    <FeedVideoPreviewModal media={previewVideo} onClose={() => setPreviewVideoIndex(null)} visible={previewVideoIndex !== null} />
  </View>;
}

const styles = StyleSheet.create({
  collage: { flexDirection: 'row', flexWrap: 'nowrap', gap: colors.spacing[4], height: 240 },
  collageTile: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center', minWidth: '48%', overflow: 'hidden' },
  column: { flex: 1, gap: 4 },
  gallery: {
    backgroundColor: 'rgba(5,3,11,0.42)',
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: colors.radii.lg,
    borderWidth: 1,
    gap: colors.spacing[12],
    padding: colors.spacing[12],
  },
  lead: { flex: 1.35 },
  nav: { alignItems: 'center', backgroundColor: 'rgba(21,16,53,0.72)', borderRadius: 999, height: 52, justifyContent: 'center', marginTop: -26, position: 'absolute', top: '50%', width: 52 },
  next: { right: 14 }, previous: { left: 14 },
  wrap: { flexWrap: 'wrap' },
  imageShell: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: colors.radii.lg,
    borderWidth: 1,
    justifyContent: 'center',
    maxHeight: 480,
    minHeight: 160,
    overflow: 'hidden',
    width: '100%',
  },
  stateStack: { alignItems: 'center', gap: colors.spacing[8] },
  stateText: { color: colors.mutedText, fontSize: 13, fontWeight: '800' },
  videoModalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.94)', flex: 1, justifyContent: 'center' },
  videoModalCloseButton: { alignItems: 'center', backgroundColor: 'rgba(6,3,20,0.78)', borderRadius: 999, height: 44, justifyContent: 'center', position: 'absolute', right: 18, top: 54, width: 44 },
  videoModalPlayer: { height: '100%', width: '100%' },
});
