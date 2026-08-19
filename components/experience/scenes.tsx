"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { finalCopy, signalChannels, type SignalChannel, type SignalChannelId } from "../../lib/content";
import { attractionProgress } from "../../lib/gestures";
import { elapsedSinceConfession } from "../../lib/relationship-time";
import { sceneTimelines, type RevealCue } from "../../lib/scene-timelines";

type BasicProps = { onComplete: () => void; onReveal: (fragmentId: string) => void; active?: boolean; paused?: boolean };

function useRevealOnce(onReveal: (fragmentId: string) => void) {
  const revealed = useRef(new Set<string>());
  const onRevealRef = useRef(onReveal);
  useEffect(() => { onRevealRef.current = onReveal; }, [onReveal]);
  return useCallback((fragmentId: string) => {
    if (revealed.current.has(fragmentId)) return;
    revealed.current.add(fragmentId);
    onRevealRef.current(fragmentId);
  }, []);
}

function useFirstReveal(fragmentId: string, onReveal: (fragmentId: string) => void, enabled: boolean) {
  const revealOnce = useRevealOnce(onReveal);
  useEffect(() => {
    if (enabled) revealOnce(fragmentId);
  }, [enabled, fragmentId, revealOnce]);
}

export function WakeScene({ onReveal, active = true, paused = false }: BasicProps) {
  const root = useRef<HTMLDivElement>(null);
  const ownerPointer = useRef<number | null>(null);
  const attractedRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [attracted, setAttracted] = useState(false);

  const releaseOwner = useCallback((reset = false, updateState = true) => {
    const pointerId = ownerPointer.current;
    const button = root.current?.querySelector<HTMLButtonElement>(".gravity-y");
    try {
      if (pointerId !== null && button?.hasPointerCapture?.(pointerId)) button.releasePointerCapture?.(pointerId);
    } catch {
      // Pointer capture can be implicitly released by the browser before teardown.
    } finally {
      ownerPointer.current = null;
    }
    if (reset && updateState && !attractedRef.current) setProgress(0);
  }, []);

  useEffect(() => {
    const cancel = () => releaseOwner(true);
    const hidden = () => { if (document.visibilityState === "hidden") cancel(); };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", hidden);
      releaseOwner(false, false);
    };
  }, [releaseOwner]);

  useEffect(() => { if (!active || paused) releaseOwner(true); }, [active, paused, releaseOwner]);

  useFirstReveal(sceneTimelines.wake.reveals[0].id, onReveal, active && attracted && !paused);

  const startAttraction = useCallback(() => {
    if (!active || paused || attractedRef.current) return;
    attractedRef.current = true;
    setAttracted(true);
  }, [active, paused]);

  const move = useCallback((clientX: number, clientY: number) => {
    const bounds = root.current?.getBoundingClientRect();
    if (!bounds || attractedRef.current) return;
    const target = { x: bounds.left + bounds.width * 0.64, y: bounds.top + bounds.height * 0.48 };
    const result = attractionProgress({ x: clientX, y: clientY }, target, Math.max(34, bounds.width * 0.1));
    setProgress(result.progress);
    if (result.attracted) {
      attractedRef.current = true;
      setAttracted(true);
    }
  }, []);

  const enabled = active && !paused && !attracted;
  return <div ref={root} className="gravity-intro" style={{ "--attraction": progress } as CSSProperties}>
    <button
      className="gravity-y"
      aria-label="把 Y 靠近 U"
      disabled={!enabled}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (!enabled || (event.button !== undefined && event.button !== 0) || event.isPrimary === false || ownerPointer.current !== null) return;
        ownerPointer.current = event.pointerId;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (ownerPointer.current === event.pointerId) move(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => { if (ownerPointer.current === event.pointerId) releaseOwner(false); }}
      onPointerCancel={(event) => { if (ownerPointer.current === event.pointerId) releaseOwner(true); }}
      onLostPointerCapture={(event) => { if (ownerPointer.current === event.pointerId) releaseOwner(true); }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        startAttraction();
      }}
    >Y</button>
    <span className="gravity-u" aria-hidden="true">U</span>
    <p>拖动 Y，靠近 U</p>
  </div>;
}

export function JealousyScene({ onReveal, active = true, paused = false }: BasicProps) {
  const [value, setValue] = useState(12);
  const done = value >= 92;
  useFirstReveal(sceneTimelines.jealousy.reveals[0].id, onReveal, active && done && !paused);
  return <div className="signal-scrub"><div className="waveform" style={{ "--clarity": `${value}%` } as CSSProperties}><span>{done ? "在意" : "心跳失序"}</span></div><label>向右解码<input aria-label="滑动解码心跳" type="range" min="0" max="100" value={value} disabled={!active || paused} onChange={(event) => { if (active && !paused) setValue(Number(event.target.value)); }} /></label></div>;
}

export function ConfessionScene({ onReveal, active = true, paused = false }: BasicProps) {
  useFirstReveal(sceneTimelines.confession.reveals[0].id, onReveal, active && !paused);
  return <div className="coordinate-lock-auto" role="img" aria-label="2026·05·23 正在自动锁定"><span>2026 · 05 · 23</span><p role="status">LOVE COORDINATE LOCKING</p></div>;
}

export function PrivilegeScene({ onReveal, active = true, paused = false }: BasicProps) {
  useFirstReveal(sceneTimelines.privilege.reveals[0].id, onReveal, active && !paused);
  return <div className="privilege-bloom" role="status" aria-label="偏爱轨道正在点亮"><span aria-hidden="true">{"✦\u3000✧\u3000✦"}</span><strong>偏爱轨道正在点亮</strong></div>;
}

export function resolveSignalCue(cue: RevealCue, channel: SignalChannel): RevealCue | null {
  if (!cue.id.startsWith("$response:")) return cue;
  const responseIndex = Number(cue.id.slice("$response:".length));
  if (!Number.isInteger(responseIndex) || responseIndex < 0 || responseIndex >= channel.responses.length) return null;
  return { ...cue, id: channel.responses[responseIndex].type };
}

export function SignalScene({ onReveal, onChannelSelected, activeId, active = true, paused = false }: BasicProps & { onChannelSelected: (channelId: SignalChannelId) => void; activeId: string | null }) {
  const [channelId, setChannelId] = useState<SignalChannelId | null>(null);
  const selected = useRef(false);
  const revealOnce = useRevealOnce(onReveal);
  const channel = useMemo(() => signalChannels.find((item) => item.id === channelId), [channelId]);

  if (!channel) return <div className="channel-grid">{signalChannels.map((item) => <button key={item.id} disabled={!active || paused} onClick={() => {
    if (!active || paused || selected.current) return;
    selected.current = true;
    onChannelSelected(item.id);
    const firstCue = resolveSignalCue(sceneTimelines.signal.reveals[0], item);
    if (firstCue) revealOnce(firstCue.id);
    setChannelId(item.id);
  }} aria-label={item.label}><i>{item.icon}</i><span>{item.label}</span></button>)}</div>;

  const latest = channel.responses.find((item) => item.type === activeId);
  return <div className="response-console"><p className="selected-channel">频道已接通 · {channel.label}</p><div className="response-live" role="status" aria-live="polite">{latest ? <><b>{latest.label}</b><span>{latest.text}</span></> : null}</div></div>;
}

export function GameScene({ onReveal, active = true, paused = false }: BasicProps) {
  useFirstReveal(sceneTimelines.game.reveals[0].id, onReveal, active && !paused);
  return <div className="dual-stream-gates" role="status" aria-label="双人副本的三道关卡正在自动开启"><div className="light-track"><i /><i /><span /></div><span>靠近</span><span>同步</span><span>穿越</span></div>;
}

export function NightScene({ onReveal, active = true, paused = false }: BasicProps) {
  useFirstReveal(sceneTimelines.night.reveals[0].id, onReveal, active && !paused);
  return <div className="frequency-link-auto" role="img" aria-label="Y 与 U 的深夜频率正在自动同频"><span className="frequency-line" /><b>我们正在同频</b></div>;
}

export function FinaleScene({ onReveal, onRestart, active = true, paused = false, finalRevealed = false }: BasicProps & { onRestart: () => void; finalRevealed?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useFirstReveal(sceneTimelines.finale.reveals[0].id, onReveal, active && !paused);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = useMemo(() => elapsedSinceConfession(now), [now]);
  return <div className="finale-copy"><div className="finale-coordinate" aria-hidden="true">05:23</div><div className="love-clock"><span><b>{elapsed.days}</b>天</span><span><b>{elapsed.hours}</b>时</span><span><b>{elapsed.minutes}</b>分</span><span><b>{elapsed.seconds}</b>秒</span></div>{finalRevealed ? <><p className="final-line">{finalCopy.lines[0]}<br />{finalCopy.lines[1]}</p><p className="signature">TO {finalCopy.to}<br />FROM {finalCopy.from}<br />SINCE {finalCopy.since}</p><button className="replay-button" onClick={onRestart}>重新进入这片宇宙</button></> : <p role="status">正在汇聚回音</p>}</div>;
}
