"use client";

import { type KeyboardEvent, type PointerEvent, type ReactNode, type WheelEvent, useCallback, useEffect, useRef } from "react";
import { classifySwipe, type TimedPoint } from "../../lib/gestures";

type GestureSurfaceProps = {
  enabled: boolean;
  onAdvance: () => void;
  onPause: (paused: boolean) => void;
  children: ReactNode;
};

type ActiveGesture = {
  point: TimedPoint;
  pointerId: number;
  target: HTMLDivElement;
};

const WHEEL_LOCK_MS = 400;

export function GestureSurface({ enabled, onAdvance, onPause, children }: GestureSurfaceProps) {
  const activeGestureRef = useRef<ActiveGesture | null>(null);
  const onPauseRef = useRef(onPause);
  const wheelLockedRef = useRef(false);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onPauseRef.current = onPause; }, [onPause]);

  const releaseGesture = useCallback(() => {
    const activeGesture = activeGestureRef.current;
    if (!activeGesture) return;

    activeGestureRef.current = null;
    activeGesture.target.releasePointerCapture?.(activeGesture.pointerId);
    onPauseRef.current(false);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") releaseGesture();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      releaseGesture();
      if (wheelTimerRef.current) {
        clearTimeout(wheelTimerRef.current);
        wheelTimerRef.current = null;
      }
    };
  }, [releaseGesture]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    activeGestureRef.current = {
      point: { x: event.clientX, y: event.clientY, at: performance.now() },
      pointerId: event.pointerId,
      target: event.currentTarget,
    };
    onPauseRef.current(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const activeGesture = activeGestureRef.current;
    if (activeGesture && enabled && classifySwipe(activeGesture.point, { x: event.clientX, y: event.clientY, at: performance.now() }) === "up") {
      onAdvance();
    }
    releaseGesture();
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!enabled || event.deltaY <= 36 || wheelLockedRef.current) return;

    wheelLockedRef.current = true;
    onAdvance();
    wheelTimerRef.current = setTimeout(() => {
      wheelLockedRef.current = false;
      wheelTimerRef.current = null;
    }, WHEEL_LOCK_MS);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!enabled || event.repeat || !["ArrowDown", "PageDown", " "].includes(event.key)) return;

    event.preventDefault();
    onAdvance();
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- This focusable group provides cinematic navigation keys without falsely presenting its arbitrary children as one button.
    <div
      className="gesture-surface"
      data-testid="gesture-surface"
      role="group"
      aria-label="电影场景手势控制"
      onKeyDown={handleKeyDown}
      onPointerCancel={releaseGesture}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- This group must receive the specified keyboard gestures.
      tabIndex={0}
    >
      {children}
    </div>
  );
}
