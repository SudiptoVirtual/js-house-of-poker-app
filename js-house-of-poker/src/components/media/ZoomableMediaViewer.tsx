import { type ReactNode, useMemo, useRef } from 'react';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';

type ZoomableMediaViewerProps = {
  accessibilityLabel: string;
  children?: ReactNode;
  onClose: () => void;
  uri?: string;
  visible: boolean;
};

type GestureState = {
  lastPan: { x: number; y: number };
  lastScale: number;
  pinchDistance: number;
  startPan: { x: number; y: number };
  startScale: number;
};

const minScale = 1;
const maxScale = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function distance(touches: Array<{ pageX: number; pageY: number }>) {
  if (touches.length < 2) return 0;
  const [first, second] = touches;
  return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}

export function ZoomableMediaViewer({ accessibilityLabel, children, onClose, uri, visible }: ZoomableMediaViewerProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY()).current;
  const gesture = useRef<GestureState>({
    lastPan: { x: 0, y: 0 },
    lastScale: 1,
    pinchDistance: 0,
    startPan: { x: 0, y: 0 },
    startScale: 1,
  }).current;

  const reset = () => {
    gesture.lastPan = { x: 0, y: 0 };
    gesture.lastScale = 1;
    gesture.pinchDistance = 0;
    gesture.startPan = { x: 0, y: 0 };
    gesture.startScale = 1;
    pan.setValue({ x: 0, y: 0 });
    scale.setValue(1);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, state) => Math.abs(state.dx) > 2 || Math.abs(state.dy) > 2 || state.numberActiveTouches > 1,
    onPanResponderGrant: (event) => {
      gesture.startPan = gesture.lastPan;
      gesture.startScale = gesture.lastScale;
      gesture.pinchDistance = distance(event.nativeEvent.touches);
    },
    onPanResponderMove: (event, state) => {
      if (event.nativeEvent.touches.length > 1) {
        const nextDistance = distance(event.nativeEvent.touches);
        if (gesture.pinchDistance <= 0) gesture.pinchDistance = nextDistance;
        const nextScale = clamp(gesture.startScale * (nextDistance / gesture.pinchDistance), minScale, maxScale);
        gesture.lastScale = nextScale;
        scale.setValue(nextScale);
        return;
      }

      const nextPan = {
        x: gesture.startPan.x + state.dx,
        y: gesture.startPan.y + state.dy,
      };
      gesture.lastPan = nextPan;
      pan.setValue(nextPan);
    },
    onPanResponderRelease: () => {
      gesture.pinchDistance = 0;
      if (gesture.lastScale <= 1.02) {
        reset();
      }
    },
    onPanResponderTerminate: () => {
      gesture.pinchDistance = 0;
    },
    onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length > 1,
  }), [gesture, pan, scale]);

  return (
    <Modal animationType="fade" onRequestClose={handleClose} transparent visible={visible}>
      <View accessibilityViewIsModal style={styles.preview}>
        {uri ? (
          <Animated.Image
            accessibilityLabel={accessibilityLabel}
            resizeMode="contain"
            source={{ uri }}
            style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }] }]}
            {...responder.panHandlers}
          />
        ) : null}
        {children}
        <Pressable accessibilityLabel="Close full-screen image preview" accessibilityRole="button" onPress={handleClose} style={styles.closeButton}>
          <MaterialCommunityIcons color={colors.white} name="close" size={26} />
        </Pressable>
      </View>
    </Modal>
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
  preview: { backgroundColor: 'rgba(6,3,20,0.98)', flex: 1 },
});
