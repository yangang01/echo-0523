"use client";

import type { ReactNode } from "react";
import { sceneCopy, type EchoFragment } from "../../lib/content";
import type { SceneId } from "../../lib/experience";
import { EchoTranscript } from "./EchoTranscript";

type Props = {
  scene: SceneId;
  children: ReactNode;
  fragments: EchoFragment[];
  unlocked: string[];
  activeId: string | null;
  onSelect: (fragmentId: string) => void;
  onReadingChange: (paused: boolean) => void;
};

export function ScenePanel({ scene, children, fragments, unlocked, activeId, onSelect, onReadingChange }: Props) {
  const copy = sceneCopy[scene];
  return (
    <section className={`scene-panel scene-${scene}`} aria-labelledby={`scene-${scene}-title`}>
      <p className="scene-kicker">{copy.kicker}</p>
      <h1 id={`scene-${scene}-title`}>{copy.title}</h1>
      <p className="scene-body">{copy.body}</p>
      <EchoTranscript fragments={fragments} unlocked={unlocked} activeId={activeId} onSelect={onSelect} onReadingChange={onReadingChange} />
      <div className="scene-action">{children}</div>
    </section>
  );
}
