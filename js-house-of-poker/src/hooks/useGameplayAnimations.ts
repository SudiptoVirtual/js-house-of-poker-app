import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  type LayoutChangeEvent,
} from 'react-native';

import type { Point } from '../utils/pokerTable';

type PanLimits = {
  maxX: number;
  maxY: number;
};

type Options = {
  isLandscape: boolean;
  tableViewZoom: number;
  onShowdownBannerEnd: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function useGameplayAnimations({
  isLandscape,
  onShowdownBannerEnd,
  tableViewZoom,
}: Options) {
  const [isTableFocused, setIsTableFocused] = useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [tableLayout, setTableLayout] = useState({ height: 0, width: 0 });
  const [tablePanLimits, setTablePanLimits] = useState<PanLimits>({ maxX: 0, maxY: 0 });

  const ambientA = useRef(new Animated.Value(0.42)).current;
  const ambientB = useRef(new Animated.Value(0.72)).current;
  const focusProgress = useRef(new Animated.Value(0)).current;
  const showdownProgress = useRef(new Animated.Value(0)).current;
  const tablePan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const tablePanOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const tablePanLimitsRef = useRef<PanLimits>({ maxX: 0, maxY: 0 });

  useEffect(() => {
    const loopA = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientA, {
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(ambientA, {
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          toValue: 0.42,
          useNativeDriver: true,
        }),
      ]),
    );
    const loopB = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientB, {
          duration: 3400,
          easing: Easing.inOut(Easing.quad),
          toValue: 0.34,
          useNativeDriver: true,
        }),
        Animated.timing(ambientB, {
          duration: 3400,
          easing: Easing.inOut(Easing.quad),
          toValue: 0.88,
          useNativeDriver: true,
        }),
      ]),
    );

    loopA.start();
    loopB.start();

    return () => {
      loopA.stop();
      loopB.stop();
    };
  }, [ambientA, ambientB]);

  useEffect(() => {
    if (!isLandscape) {
      setIsLeftPanelOpen(false);
    }
  }, [isLandscape]);

  useEffect(() => {
    Animated.timing(focusProgress, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
      toValue: isTableFocused ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [focusProgress, isTableFocused]);

  useEffect(() => {
    tablePanLimitsRef.current = tablePanLimits;
  }, [tablePanLimits]);

  const shouldMaximizeTable = isLandscape || isTableFocused;

  useEffect(() => {
    tablePan.stopAnimation();
    tablePan.setValue({ x: 0, y: 0 });
    tablePanOffsetRef.current = { x: 0, y: 0 };
  }, [shouldMaximizeTable, tablePan, tableViewZoom]);

  const tablePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: () => {
          tablePan.stopAnimation((value) => {
            tablePanOffsetRef.current = { x: value.x, y: value.y };
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const maxX = tablePanLimitsRef.current.maxX;
          const maxY = tablePanLimitsRef.current.maxY;
          const nextX = clamp(tablePanOffsetRef.current.x + gestureState.dx, -maxX, maxX);
          const nextY = clamp(tablePanOffsetRef.current.y + gestureState.dy, -maxY, maxY);
          tablePan.setValue({ x: nextX, y: nextY });
        },
        onPanResponderRelease: () => {
          tablePan.flattenOffset();
          tablePan.stopAnimation((value) => {
            const maxX = tablePanLimitsRef.current.maxX;
            const maxY = tablePanLimitsRef.current.maxY;
            const clampedX = clamp(value.x, -maxX, maxX);
            const clampedY = clamp(value.y, -maxY, maxY);
            tablePanOffsetRef.current = { x: clampedX, y: clampedY };
            Animated.spring(tablePan, {
              bounciness: 8,
              speed: 18,
              toValue: { x: clampedX, y: clampedY },
              useNativeDriver: true,
            }).start();
          });
        },
      }),
    [tablePan],
  );

  function handleTableLayout(event: LayoutChangeEvent) {
    const { height, width } = event.nativeEvent.layout;

    if (Math.abs(width - tableLayout.width) < 1 && Math.abs(height - tableLayout.height) < 1) {
      return;
    }

    setTableLayout({ height, width });
    const maxX = Math.max(0, (width * tableViewZoom - width) / 2);
    const maxY = Math.max(0, (height * tableViewZoom - height) / 2);
    setTablePanLimits({ maxX, maxY });

    tablePan.stopAnimation((value) => {
      const clampedX = clamp(value.x, -maxX, maxX);
      const clampedY = clamp(value.y, -maxY, maxY);
      tablePan.setValue({ x: clampedX, y: clampedY });
      tablePanOffsetRef.current = { x: clampedX, y: clampedY };
    });
  }

  function animateShowdownBanner(showBanner: boolean) {
    if (!showBanner) {
      showdownProgress.setValue(0);
      return;
    }

    showdownProgress.setValue(0);
    Animated.sequence([
      Animated.spring(showdownProgress, {
        bounciness: 8,
        speed: 20,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.delay(850),
      Animated.timing(showdownProgress, {
        duration: 220,
        easing: Easing.in(Easing.quad),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onShowdownBannerEnd();
      }
    });
  }

  return {
    ambientA,
    ambientB,
    animateShowdownBanner,
    focusProgress,
    handleTableLayout,
    isLeftPanelOpen,
    isTableFocused,
    setIsLeftPanelOpen,
    setIsTableFocused,
    showdownProgress,
    tableLayout,
    tablePan,
    tablePanResponder,
  };
}
