declare module 'expo-video' {
  import type { ComponentType } from 'react';
  import type { StyleProp, ViewStyle } from 'react-native';

  export type VideoPlayer = {
    loop: boolean;
    muted: boolean;
    pause: () => void;
    play: () => void;
  };

  export const VideoView: ComponentType<{
    accessibilityLabel?: string;
    accessibilityRole?: string;
    contentFit?: 'contain' | 'cover' | 'fill';
    nativeControls?: boolean;
    player: VideoPlayer;
    style?: StyleProp<ViewStyle>;
  }>;

  export function useVideoPlayer(source: string, setup?: (player: VideoPlayer) => void): VideoPlayer;
}
