import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';
import type { FeedImageMedia, FeedMedia } from '../../types/feed';
import { FeedVideo } from './FeedVideo';

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

export function FeedMediaGallery({ isActive = false, media, onRequestVideoActive }: FeedMediaGalleryProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  if (media.length === 0) return null;
  const images = media.filter((item): item is FeedImageMedia => item.type === 'image');
  const videos = media.filter((item) => item.type === 'video');
  const move = (delta: number) => setPreviewIndex((index) => index === null ? null : (index + delta + images.length) % images.length);
  const tile = (image: FeedImageMedia, index: number) => <FeedImage collage key={`${image.url}-${index}`} media={image} onPress={() => setPreviewIndex(index)} />;
  const collage = images.length === 2 || images.length === 4
    ? <View style={[styles.collage, images.length === 4 && styles.wrap]}>{images.map(tile)}</View>
    : <View style={styles.collage}><View style={styles.lead}>{tile(images[0], 0)}</View><View style={styles.column}>{images.slice(1).map((image, index) => tile(image, index + 1))}</View></View>;
  return <View accessibilityLabel={`${media.length} media attachment${media.length === 1 ? '' : 's'}`} style={styles.gallery}>
    {images.length === 1 ? <FeedImage media={images[0]} onPress={() => setPreviewIndex(0)} /> : images.length > 1 ? collage : null}
    {videos.map((item, index) => <FeedVideo isActive={isActive} key={`${item.url}-${index}`} media={item} onRequestActive={onRequestVideoActive} />)}
    <Modal animationType="fade" onRequestClose={() => setPreviewIndex(null)} transparent visible={previewIndex !== null}><View accessibilityViewIsModal style={styles.preview}>
      {previewIndex !== null ? <Image accessibilityLabel={`Full-screen preview: ${images[previewIndex].altText}`} resizeMode="contain" source={{ uri: images[previewIndex].url }} style={StyleSheet.absoluteFillObject} /> : null}
      <Pressable accessibilityLabel="Close full-screen image preview" accessibilityRole="button" onPress={() => setPreviewIndex(null)} style={styles.closeButton}><MaterialCommunityIcons color={colors.white} name="close" size={26} /></Pressable>
      {images.length > 1 ? <><Pressable accessibilityLabel="Previous image" accessibilityRole="button" onPress={() => move(-1)} style={[styles.nav, styles.previous]}><MaterialCommunityIcons color={colors.white} name="chevron-left" size={36} /></Pressable><Pressable accessibilityLabel="Next image" accessibilityRole="button" onPress={() => move(1)} style={[styles.nav, styles.next]}><MaterialCommunityIcons color={colors.white} name="chevron-right" size={36} /></Pressable></> : null}
    </View></Modal>
  </View>;
}

const styles = StyleSheet.create({
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(21,16,53,0.86)',
    borderRadius: 999,
    height: 46,
    justifyContent: 'center',
    position: 'absolute',
    right: 18,
    top: 54,
    width: 46,
  },
  collage: { flexDirection: 'row', flexWrap: 'nowrap', gap: 4, height: 240 },
  collageTile: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center', minWidth: '48%', overflow: 'hidden' },
  column: { flex: 1, gap: 4 },
  gallery: {
    backgroundColor: colors.background,
    borderRadius: 18,
    gap: 10,
    padding: 15,
  },
  lead: { flex: 1.35 },
  nav: { alignItems: 'center', backgroundColor: 'rgba(21,16,53,0.72)', borderRadius: 999, height: 52, justifyContent: 'center', marginTop: -26, position: 'absolute', top: '50%', width: 52 },
  next: { right: 14 }, previous: { left: 14 },
  wrap: { flexWrap: 'wrap' },
  imageShell: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    maxHeight: 480,
    minHeight: 160,
    overflow: 'hidden',
    width: '100%',
  },
  preview: { backgroundColor: 'rgba(6,3,20,0.98)', flex: 1 },
  stateStack: { alignItems: 'center', gap: 7 },
  stateText: { color: colors.mutedText, fontSize: 13, fontWeight: '800' },
});
