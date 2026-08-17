"use client";

import type { EchoFragment } from "../../lib/content";

type Props = {
  fragments: EchoFragment[];
  unlocked: string[];
  activeId: string | null;
  onSelect: (fragmentId: string) => void;
};

export function EchoTranscript({ fragments, unlocked, activeId, onSelect }: Props) {
  const active = fragments.find((fragment) => fragment.id === activeId && unlocked.includes(fragment.id));
  if (!active) return <div className="echo-transcript echo-transcript-empty" aria-hidden="true" />;

  return (
    <div className="echo-transcript">
      <p key={active.id} className="echo-transcript-copy" role="status" aria-live="polite">
        {active.text}
      </p>
      <div className="echo-transcript-markers" aria-label="已解锁回音">
        {fragments.map((fragment, index) => {
          const available = unlocked.includes(fragment.id);
          return (
            <button
              key={fragment.id}
              type="button"
              disabled={!available}
              className={fragment.id === active.id ? "active" : ""}
              aria-label={available ? `回看第 ${index + 1} 段` : `第 ${index + 1} 段尚未解锁`}
              onClick={() => available && onSelect(fragment.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
