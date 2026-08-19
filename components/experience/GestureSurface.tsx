"use client";

import { type FocusEvent, type KeyboardEvent, type PointerEvent, type ReactNode, type WheelEvent, useCallback, useEffect, useRef } from "react";
import { classifySwipe, type TimedPoint } from "../../lib/gestures";

export type GesturePauseSource = "gesture" | "surface-focus";

type GestureSurfaceProps = {
  enabled: boolean;
  onAdvance: () => void;
  onPause: (source: GesturePauseSource, paused: boolean) => void;
  children: ReactNode;
};

type ActiveGesture = {
  point: TimedPoint;
  pointerId: number;
  target: HTMLDivElement;
};

const WHEEL_LOCK_MS = 400;
const GESTURE_IGNORE_SELECTOR = "button,a,input,select,textarea,[contenteditable=\"true\"],[data-gesture-ignore]";

function isIgnoredGestureTarget(target: EventTarget | null, surface: HTMLDivElement) {
  if (!(target instanceof Element) || target === surface) return false;
  const ignoredTarget = target.closest(GESTURE_IGNORE_SELECTOR);
  return ignoredTarget !== null && surface.contains(ignoredTarget);
}

export function GestureSurface({ enabled, onAdvance, onPause, children }: GestureSurfaceProps) {
  const activeGestureRef = useRef<ActiveGesture | null>(null);
  const onPauseRef = useRef(onPause);
  const pointerFocusIntentRef = useRef(false);
  const surfaceFocusPausedRef = useRef(false);
  const wheelLockedRef = useRef(false);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onPauseRef.current = onPause; }, [onPause]);

  const releaseGesture = useCallback(() => {
    const activeGesture = activeGestureRef.current;
    if (!activeGesture) return;

    activeGestureRef.current = null;
    try {
      if (activeGesture.target.hasPointerCapture?.(activeGesture.pointerId) !== false) {
        activeGesture.target.releasePointerCapture?.(activeGesture.pointerId);
      }
    } catch {
      // Pointer capture can be implicitly released before this handler runs.
    }
    onPauseRef.current("gesture", false);
  }, []);

  const releaseSurfaceFocus = useCallback(() => {
    if (!surfaceFocusPausedRef.current) return;
    surfaceFocusPausedRef.current = false;
    onPauseRef.current("surface-focus", false);
  }, []);

  const clearWheelLock = useCallback(() => {
    wheelLockedRef.current = false;
    if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    wheelTimerRef.current = null;
  }, []);

  const cancelGesture = useCallback(() => {
    releaseGesture();
    pointerFocusIntentRef.current = false;
    clearWheelLock();
  }, [clearWheelLock, releaseGesture]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") cancelGesture();
    };
    const onWindowBlur = () => {
      cancelGesture();
      releaseSurfaceFocus();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      cancelGesture();
      releaseSurfaceFocus();
    };
  }, [cancelGesture, releaseSurfaceFocus]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button > 0 || activeGestureRef.current || isIgnoredGestureTarget(event.target, event.currentTarget)) return;

    activeGestureRef.current = {
      point: { x: event.clientX, y: event.clientY, at: performance.now() },
      pointerId: event.pointerId,
      target: event.currentTarget,
    };
    pointerFocusIntentRef.current = true;
    onPauseRef.current("gesture", true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const activeGesture = activeGestureRef.current;
    if (!activeGesture || activeGesture.pointerId !== event.pointerId) return;

    const shouldAdvance = enabled && classifySwipe(activeGesture.point, { x: event.clientX, y: event.clientY, at: performance.now() }) === "up";
    releaseGesture();
    pointerFocusIntentRef.current = false;
    if (shouldAdvance) onAdvance();
  };

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (activeGestureRef.current?.pointerId === event.pointerId) {
      releaseGesture();
      pointerFocusIntentRef.current = false;
    }
  };

  const handleLostPointerCapture = (event: PointerEvent<HTMLDivElement>) => {
    if (activeGestureRef.current?.pointerId === event.pointerId) {
      releaseGesture();
      pointerFocusIntentRef.current = false;
    }
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!enabled || event.deltaY <= 36 || wheelLockedRef.current || isIgnoredGestureTarget(event.target, event.currentTarget)) return;

    wheelLockedRef.current = true;
    onAdvance();
    wheelTimerRef.current = setTimeout(() => {
      wheelLockedRef.current = false;
      wheelTimerRef.current = null;
    }, WHEEL_LOCK_MS);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!enabled || event.target !== event.currentTarget || event.repeat || !["ArrowDown", "PageDown", " "].includes(event.key)) return;

    event.preventDefault();
    releaseSurfaceFocus();
    onAdvance();
  };

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || surfaceFocusPausedRef.current) return;
    if (pointerFocusIntentRef.current) {
      pointerFocusIntentRef.current = false;
      return;
    }
    surfaceFocusPausedRef.current = true;
    onPauseRef.current("surface-focus", true);
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) releaseSurfaceFocus();
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- This focusable group provides cinematic navigation keys without falsely presenting its arbitrary children as one button.
    <div
      className="gesture-surface"
      data-testid="gesture-surface"
      role="group"
      aria-label="电影场景手势控制"
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      onLostPointerCapture={handleLostPointerCapture}
      onPointerCancel={handlePointerCancel}
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
