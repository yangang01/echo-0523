"use client";

import type { ReactNode } from "react";
import { sceneCopy } from "../../lib/content";
import type { SceneId } from "../../lib/experience";

export function ScenePanel({ scene, children }: { scene: SceneId; children: ReactNode }) {
  const copy = sceneCopy[scene];
  return (
    <section className={`scene-panel scene-${scene}`} aria-labelledby={`scene-${scene}-title`}>
      <p className="scene-kicker">{copy.kicker}</p>
      <h1 id={`scene-${scene}-title`}>{copy.title}</h1>
      <p className="scene-body">{copy.body}</p>
      <div className="scene-action">{children}</div>
    </section>
  );
}
