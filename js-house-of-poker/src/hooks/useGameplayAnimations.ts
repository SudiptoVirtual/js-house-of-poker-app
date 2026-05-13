import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  onShowdownBannerEnd: () => void;
};

type TableLayout = {
  height: number;
  width: number;
};

type TableGestureState = {
  panStart: Point;
  pinchStartDistance: number;
  pinchStartZoom: number;
};

type TouchPoint = {
  pageX: number;
  pageY: number;
};

const maxTableViewZoom = 1.55;
const minTableViewZoom = 0.72;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getTouchDistance(touches: ArrayLike<TouchPoint>) {
  if (touches.length < 2) {
    return 0;
  }

  const first = touches[0];
  const second = touches[1];
  const deltaX = first.pageX - second.pageX;
  const deltaY = first.pageY - second.pageY;

  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

function getTablePanLimits(layout: TableLayout, zoom: number): PanLimits {
  const fallbackMaxX = 160;
  const fallbackMaxY = 110;

  if (layout.width <= 0 || layout.height <= 0) {
    return { maxX: fallbackMaxX, maxY: fallbackMaxY };
  }

  const zoomOverflowX = Math.max(0, (layout.width * zoom - layout.width) / 2);
  const zoomOverflowY = Math.max(0, (layout.height * zoom - layout.height) / 2);

  return {
    maxX: layout.width * 0.45 + zoomOverflowX,
    maxY: layout.height * 0.5 + zoomOverflowY,
  };
}

function clampTablePan(value: Point, layout: TableLayout, zoom: number): Point {
  const { maxX, maxY } = getTablePanLimits(layout, zoom);

  return {
    x: clamp(value.x, -maxX, maxX),
    y: clamp(value.y, -maxY, maxY),
  };
}

export function useGameplayAnimations({
  isLandscape,
  onShowdownBannerEnd,
}: Options) {
  const [isTableFocused, setIsTableFocused] = useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [tableLayout, setTableLayout] = useState({ height: 0, width: 0 });

  const ambientA = useRef(new Animated.Value(0.42)).current;
  const ambientB = useRef(new Animated.Value(0.72)).current;
  const focusProgress = useRef(new Animated.Value(0)).current;
  const showdownProgress = useRef(new Animated.Value(0)).current;
  const tablePan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const tableViewZoom = useRef(new Animated.Value(1)).current;

  const tableLayoutRef = useRef<TableLayout>({ height: 0, width: 0 });
  const tablePanOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const tableViewZoomRef = useRef(1);
  const tableGestureRef = useRef<TableGestureState>({
    panStart: { x: 0, y: 0 },
    pinchStartDistance: 0,
    pinchStartZoom: 1,
  });

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

  const shouldMaximizeTable = isLandscape || isTableFocused;

  useEffect(() => {
    tablePan.stopAnimation();
    tableViewZoom.stopAnimation();
    tablePan.setValue({ x: 0, y: 0 });
    tableViewZoom.setValue(1);
    tablePanOffsetRef.current = { x: 0, y: 0 };
    tableViewZoomRef.current = 1;
    tableGestureRef.current = {
      panStart: { x: 0, y: 0 },
      pinchStartDistance: 0,
      pinchStartZoom: 1,
    };
  }, [shouldMaximizeTable, tablePan, tableViewZoom]);

  const resetTableView = useCallback(() => {
    tablePan.stopAnimation();
    tableViewZoom.stopAnimation();
    tablePanOffsetRef.current = { x: 0, y: 0 };
    tableViewZoomRef.current = 1;
    tableGestureRef.current = {
      panStart: { x: 0, y: 0 },
      pinchStartDistance: 0,
      pinchStartZoom: 1,
    };

    Animated.parallel([
      Animated.spring(tablePan, {
        bounciness: 7,
        speed: 18,
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
      }),
      Animated.spring(tableViewZoom, {
        bounciness: 7,
        speed: 18,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [tablePan, tableViewZoom]);

  const tablePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (event) =>
          event.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,
        onMoveShouldSetPanResponderCapture: (event, gestureState) =>
          event.nativeEvent.touches.length >= 2 ||
          Math.abs(gestureState.dx) > 4 ||
          Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: (event) => {
          const gesture = tableGestureRef.current;
          const touchDistance = getTouchDistance(event.nativeEvent.touches);

          tablePan.stopAnimation((value) => {
            const clampedPan = clampTablePan(
              value,
              tableLayoutRef.current,
              tableViewZoomRef.current,
            );
            tablePanOffsetRef.current = clampedPan;
            gesture.panStart = clampedPan;
            tablePan.setValue(clampedPan);
          });
          tableViewZoom.stopAnimation((value) => {
            const clampedZoom = clamp(value, minTableViewZoom, maxTableViewZoom);
            tableViewZoomRef.current = clampedZoom;
            gesture.pinchStartDistance = touchDistance;
            gesture.pinchStartZoom = clampedZoom;
            tableViewZoom.setValue(clampedZoom);
          });
        },
        onPanResponderMove: (event, gestureState) => {
          const gesture = tableGestureRef.current;
          const touchDistance = getTouchDistance(event.nativeEvent.touches);
          let nextZoom = tableViewZoomRef.current;

          if (touchDistance > 0) {
            if (gesture.pinchStartDistance <= 0) {
              gesture.pinchStartDistance = touchDistance;
              gesture.pinchStartZoom = tableViewZoomRef.current;
            }

            nextZoom = clamp(
              gesture.pinchStartZoom * (touchDistance / gesture.pinchStartDistance),
              minTableViewZoom,
              maxTableViewZoom,
            );
            tableViewZoomRef.current = nextZoom;
            tableViewZoom.setValue(nextZoom);
          } else {
            gesture.pinchStartDistance = 0;
            gesture.pinchStartZoom = tableViewZoomRef.current;
          }

          const nextPan = clampTablePan(
            {
              x: gesture.panStart.x + gestureState.dx,
              y: gesture.panStart.y + gestureState.dy,
            },
            tableLayoutRef.current,
            nextZoom,
          );

          tablePanOffsetRef.current = nextPan;
          tablePan.setValue(nextPan);
        },
        onPanResponderRelease: () => {
          tableViewZoom.stopAnimation((zoomValue) => {
            const clampedZoom = clamp(zoomValue, minTableViewZoom, maxTableViewZoom);
            tableViewZoomRef.current = clampedZoom;

            tablePan.stopAnimation((panValue) => {
              const clampedPan = clampTablePan(panValue, tableLayoutRef.current, clampedZoom);
              tablePanOffsetRef.current = clampedPan;
              tableGestureRef.current.panStart = clampedPan;

              Animated.parallel([
                Animated.spring(tablePan, {
                  bounciness: 8,
                  speed: 18,
                  toValue: clampedPan,
                  useNativeDriver: true,
                }),
                Animated.spring(tableViewZoom, {
                  bounciness: 8,
                  speed: 18,
                  toValue: clampedZoom,
                  useNativeDriver: true,
                }),
              ]).start();
            });
          });
        },
        onPanResponderTerminate: () => {
          tablePan.stopAnimation((value) => {
            const clampedPan = clampTablePan(
              value,
              tableLayoutRef.current,
              tableViewZoomRef.current,
            );
            tablePanOffsetRef.current = clampedPan;
            tableGestureRef.current.panStart = clampedPan;
            tablePan.setValue(clampedPan);
          });
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [tablePan, tableViewZoom],
  );

  function handleTableLayout(event: LayoutChangeEvent) {
    const { height, width } = event.nativeEvent.layout;

    if (Math.abs(width - tableLayout.width) < 1 && Math.abs(height - tableLayout.height) < 1) {
      return;
    }

    setTableLayout({ height, width });
    tableLayoutRef.current = { height, width };

    tablePan.stopAnimation((value) => {
      const clampedPan = clampTablePan(
        value,
        tableLayoutRef.current,
        tableViewZoomRef.current,
      );
      tablePan.setValue(clampedPan);
      tablePanOffsetRef.current = clampedPan;
      tableGestureRef.current.panStart = clampedPan;
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
    resetTableView,
    setIsLeftPanelOpen,
    setIsTableFocused,
    showdownProgress,
    tableLayout,
    tablePan,
    tablePanResponder,
    tableViewZoom,
  };
}
