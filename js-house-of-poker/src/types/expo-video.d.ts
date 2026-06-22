declare module 'expo-video' {
  import type { ComponentType } from 'react';
  import type { StyleProp, ViewStyle } from 'react-native';

  export type VideoPlayerStatus = 'idle' | 'loading' | 'readyToPlay' | 'error';

  export type PlayerError = {
    message: string;
  };

  export type StatusChangeEventPayload = {
    error?: PlayerError;
    oldStatus?: VideoPlayerStatus;
    status: VideoPlayerStatus;
  };

  export type VideoPlayer = {
    readonly status: VideoPlayerStatus;
    loop: boolean;
    muted: boolean;
    addListener: (eventName: 'statusChange', listener: (payload: StatusChangeEventPayload) => void) => { remove: () => void };
    pause: () => void;
    play: () => void;
    replace: (source: string) => void;
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
