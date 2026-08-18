"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { EchoFragment } from "../../lib/content";

type Props = {
  fragments: EchoFragment[];
  unlocked: string[];
  activeId: string | null;
  onSelect: (fragmentId: string) => void;
  onReadingChange?: (paused: boolean) => void;
};

const noopReadingChange = () => undefined;

export function EchoTranscript({ fragments, unlocked, activeId, onSelect, onReadingChange = noopReadingChange }: Props) {
  const active = fragments.find((fragment) => fragment.id === activeId && unlocked.includes(fragment.id));
  const onReadingChangeRef = useRef(onReadingChange);
  const ownerPointer = useRef<number | null>(null);
  const pointerTarget = useRef<HTMLDivElement | null>(null);
  const pointerReading = useRef(false);
  const focusReading = useRef(false);
  const reportedReading = useRef(false);

  useEffect(() => { onReadingChangeRef.current = onReadingChange; }, [onReadingChange]);

  const reportReading = useCallback(() => {
    const reading = pointerReading.current || focusReading.current;
    if (reportedReading.current === reading) return;
    reportedReading.current = reading;
    onReadingChangeRef.current(reading);
  }, []);

  const releasePointer = useCallback((pointerId?: number) => {
    const owned = ownerPointer.current;
    if (owned === null || (pointerId !== undefined && owned !== pointerId)) return;
    const target = pointerTarget.current;
    ownerPointer.current = null;
    pointerTarget.current = null;
    try {
      if (target?.hasPointerCapture?.(owned)) target.releasePointerCapture?.(owned);
    } catch {
      // Browsers may implicitly release capture before blur, cancellation, or teardown.
    }
    pointerReading.current = false;
    reportReading();
  }, [reportReading]);

  const stopAllReading = useCallback(() => {
    releasePointer();
    focusReading.current = false;
    reportReading();
  }, [releasePointer, reportReading]);

  useEffect(() => {
    const endPointer = (event: globalThis.PointerEvent) => releasePointer(event.pointerId);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stopAllReading();
    };
    window.addEventListener("pointerup", endPointer);
    window.addEventListener("pointercancel", endPointer);
    window.addEventListener("blur", stopAllReading);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointerup", endPointer);
      window.removeEventListener("pointercancel", endPointer);
      window.removeEventListener("blur", stopAllReading);
      document.removeEventListener("visibilitychange", onVisibility);
      stopAllReading();
    };
  }, [releasePointer, stopAllReading]);

  const beginPointerReading = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button > 0 || ownerPointer.current !== null) return;
    ownerPointer.current = event.pointerId;
    pointerTarget.current = event.currentTarget;
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
      <div
        className="echo-transcript-live"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        onPointerDown={beginPointerReading}
        onPointerUp={(event) => releasePointer(event.pointerId)}
        onPointerCancel={(event) => releasePointer(event.pointerId)}
        onLostPointerCapture={(event) => releasePointer(event.pointerId)}
      >
        {active ? (
          <div key={active.id} className="echo-transcript-reveal">
            <p className="echo-transcript-copy">{active.text}</p>
          </div>
        ) : null}
      </div>
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
