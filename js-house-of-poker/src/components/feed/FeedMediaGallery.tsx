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

function FeedImage({ media }: { media: FeedImageMedia }) {
  const [imageState, setImageState] = useState<ImageState>('loading');
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  return (
    <>
      <Pressable accessibilityHint="Opens a full-screen preview" accessibilityLabel={`Preview ${media.altText}`} accessibilityRole="imagebutton" onPress={() => setIsPreviewVisible(true)} style={[styles.imageShell, { aspectRatio: mediaAspectRatio(media) }]}>
        {imageState !== 'error' ? (
          <Image accessibilityLabel={media.altText} onError={() => setImageState('error')} onLoad={() => setImageState('ready')} resizeMode="contain" source={{ uri: media.url }} style={StyleSheet.absoluteFillObject} />
        ) : null}
        {imageState === 'loading' ? <ActivityIndicator color={colors.secondary} size="large" /> : null}
        {imageState === 'error' ? (
          <View style={styles.stateStack}>
            <MaterialCommunityIcons color={colors.mutedText} name="image-off-outline" size={30} />
            <Text style={styles.stateText}>Image unavailable</Text>
          </View>
        ) : null}
      </Pressable>
      <Modal animationType="fade" onRequestClose={() => setIsPreviewVisible(false)} transparent visible={isPreviewVisible}>
        <View accessibilityViewIsModal style={styles.preview}>
          <Image accessibilityLabel={`Full-screen preview: ${media.altText}`} resizeMode="contain" source={{ uri: media.url }} style={StyleSheet.absoluteFillObject} />
          <Pressable accessibilityLabel="Close full-screen image preview" accessibilityRole="button" onPress={() => setIsPreviewVisible(false)} style={styles.closeButton}>
            <MaterialCommunityIcons color={colors.white} name="close" size={26} />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

export function FeedMediaGallery({ isActive = false, media, onRequestVideoActive }: FeedMediaGalleryProps) {
  if (media.length === 0) return null;

  return (
    <View accessibilityLabel={`${media.length} media attachment${media.length === 1 ? '' : 's'}`} style={styles.gallery}>
      {media.map((attachment, index) => attachment.type === 'video'
        ? <FeedVideo isActive={isActive} key={`${attachment.url}-${index}`} media={attachment} onRequestActive={onRequestVideoActive} />
        : <FeedImage key={`${attachment.url}-${index}`} media={attachment} />)}
    </View>
  );
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
  gallery: { gap: 10 },
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
