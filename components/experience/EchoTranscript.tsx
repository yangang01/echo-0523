"use client";

import type { EchoFragment } from "../../lib/content";

type Props = {
  fragments: EchoFragment[];
  unlocked: string[];
  activeId: string | null;
  onSelect: (fragmentId: string) => void;
  onReadingChange?: (paused: boolean) => void;
};

export function EchoTranscript({ fragments, unlocked, activeId, onSelect, onReadingChange = () => undefined }: Props) {
  const active = fragments.find((fragment) => fragment.id === activeId && unlocked.includes(fragment.id));

  return (
    <div
      className={`echo-transcript${active ? "" : " echo-transcript-empty"}`}
      onFocusCapture={() => onReadingChange(true)}
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        onReadingChange(false);
      }}
    >
      <div
        className="echo-transcript-live"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        onPointerDown={() => onReadingChange(true)}
        onPointerUp={() => onReadingChange(false)}
        onPointerCancel={() => onReadingChange(false)}
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
