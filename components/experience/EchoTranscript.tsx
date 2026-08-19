"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { EchoFragment } from "../../lib/content";
import { classifyHorizontalSwipe, type TimedPoint } from "../../lib/gestures";

type Props = {
  fragments: EchoFragment[];
  unlocked: string[];
  activeId: string | null;
  onSelect: (fragmentId: string) => void;
  onReveal?: (fragmentId: string) => void;
  onComplete?: () => void;
  onReadingChange?: (paused: boolean) => void;
};

const noopReadingChange = () => undefined;
const noop = () => undefined;

export function EchoTranscript({ fragments, unlocked, activeId, onSelect, onReveal = noop, onComplete = noop, onReadingChange = noopReadingChange }: Props) {
  const active = fragments.find((fragment) => fragment.id === activeId && unlocked.includes(fragment.id));
  const activeIndex = active ? fragments.findIndex((fragment) => fragment.id === active.id) : -1;
  const onReadingChangeRef = useRef(onReadingChange);
  const ownerPointer = useRef<number | null>(null);
  const pointerTarget = useRef<HTMLButtonElement | null>(null);
  const pointerStart = useRef<TimedPoint | null>(null);
  const pointerReading = useRef(false);
  const focusReading = useRef(false);
  const reportedReading = useRef(false);
  const completed = useRef(false);

  useEffect(() => { onReadingChangeRef.current = onReadingChange; }, [onReadingChange]);

  const reportReading = useCallback(() => {
    const reading = pointerReading.current || focusReading.current;
    if (reportedReading.current === reading) return;
    reportedReading.current = reading;
    onReadingChangeRef.current(reading);
  }, []);

  const navigate = useCallback((direction: "left" | "right") => {
    if (activeIndex < 0) return;
    const targetIndex = direction === "left" ? activeIndex + 1 : activeIndex - 1;
    if (targetIndex < 0 || targetIndex >= fragments.length) return;
    const target = fragments[targetIndex];
    if (unlocked.includes(target.id)) onSelect(target.id);
    else onReveal(target.id);
    if (targetIndex === fragments.length - 1 && !completed.current) {
      completed.current = true;
      onComplete();
    }
  }, [activeIndex, fragments, onComplete, onReveal, onSelect, unlocked]);

  const releasePointer = useCallback((pointerId?: number, end?: TimedPoint) => {
    const owned = ownerPointer.current;
    if (owned === null || (pointerId !== undefined && owned !== pointerId)) return;
    const target = pointerTarget.current;
    const start = pointerStart.current;
    ownerPointer.current = null;
    pointerTarget.current = null;
    pointerStart.current = null;
    try {
      if (target?.hasPointerCapture?.(owned)) target.releasePointerCapture?.(owned);
    } catch {
      // Browsers may implicitly release capture before blur, cancellation, or teardown.
    }
    pointerReading.current = false;
    reportReading();
    if (start && end) {
      const swipe = classifyHorizontalSwipe(start, end);
      if (swipe !== "none") navigate(swipe);
    }
  }, [navigate, reportReading]);

  const stopAllReading = useCallback(() => {
    releasePointer();
    focusReading.current = false;
    reportReading();
  }, [releasePointer, reportReading]);

  useEffect(() => {
    const endPointer = (event: globalThis.PointerEvent) => releasePointer(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
    });
    const cancelPointer = (event: globalThis.PointerEvent) => releasePointer(event.pointerId);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stopAllReading();
    };
    window.addEventListener("pointerup", endPointer);
    window.addEventListener("pointercancel", cancelPointer);
    window.addEventListener("blur", stopAllReading);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointerup", endPointer);
      window.removeEventListener("pointercancel", cancelPointer);
      window.removeEventListener("blur", stopAllReading);
      document.removeEventListener("visibilitychange", onVisibility);
      stopAllReading();
    };
  }, [releasePointer, stopAllReading]);

  const beginPointerReading = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button > 0 || ownerPointer.current !== null) return;
    ownerPointer.current = event.pointerId;
    pointerTarget.current = event.currentTarget;
    pointerStart.current = { x: event.clientX, y: event.clientY, at: performance.now() };
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Window-level release listeners still balance the review if capture fails.
    }
    pointerReading.current = true;
    reportReading();
  };

  return (
    <div
      className={`echo-transcript${active ? "" : " echo-transcript-empty"}`}
      data-gesture-ignore
      onFocusCapture={() => {
        focusReading.current = true;
        reportReading();
      }}
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        focusReading.current = false;
        reportReading();
      }}
    >
      <button
        type="button"
        className="echo-transcript-live"
        aria-live="polite"
        aria-atomic="true"
        aria-label="回音正文，左右方向键切换"
        tabIndex={active ? 0 : -1}
        onPointerDown={beginPointerReading}
        onPointerUp={(event) => releasePointer(event.pointerId, { x: event.clientX, y: event.clientY, at: performance.now() })}
        onPointerCancel={(event) => releasePointer(event.pointerId)}
        onLostPointerCapture={(event) => releasePointer(event.pointerId)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          navigate(event.key === "ArrowRight" ? "left" : "right");
        }}
      >
        {active ? (
          <div key={active.id} className="echo-transcript-reveal">
            <p className="echo-transcript-copy">{active.text}</p>
          </div>
        ) : null}
      </button>
      {active ? (
        <div className="echo-transcript-markers" role="group" aria-label="回音片段">
          {fragments.map((fragment, index) => {
            const available = unlocked.includes(fragment.id);
            return (
              <button
                key={fragment.id}
                type="button"
                disabled={!available}
                className={fragment.id === active.id ? "active" : ""}
                aria-current={fragment.id === active.id ? "true" : undefined}
                aria-label={available ? `回看第 ${index + 1} 段` : `第 ${index + 1} 段尚未解锁`}
                onClick={() => available && onSelect(fragment.id)}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
