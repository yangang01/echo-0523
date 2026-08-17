"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { finalCopy, signalChannels, type SignalChannelId } from "../../lib/content";
import type { ResponseType } from "../../lib/experience";
import { elapsedSinceConfession } from "../../lib/relationship-time";

type BasicProps = { onComplete: () => void; onReveal: (fragmentId: string) => void };

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

export function WakeScene({ onComplete, onReveal }: BasicProps) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completed = useRef(false);
  const [holding, setHolding] = useState(false);
  const [taps, setTaps] = useState(0);
  const tapsRef = useRef(0);
  const suppressClick = useRef(false);
  const revealOnce = useRevealOnce(onReveal);
  const finish = () => { if (!completed.current) { completed.current = true; onComplete(); } };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const start = () => {
    if (completed.current || timers.current.length) return;
    setHolding(true);
    (["spark", "archive", "receiver"] as const).forEach((id, index) => {
      timers.current.push(setTimeout(() => {
        revealOnce(id);
        if (index === 2) { suppressClick.current = true; setHolding(false); finish(); }
      }, (index + 1) * 1000));
    });
  };
  const cancel = () => { setHolding(false); clearTimers(); };
  const tap = () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    const next = Math.min(3, tapsRef.current + 1);
    tapsRef.current = next;
    setTaps(next);
    revealOnce(["spark", "archive", "receiver"][next - 1]);
    if (next === 3) finish();
  };
  useEffect(() => clearTimers, []);
  return <button className={`hold-orb ${holding ? "is-holding" : ""}`} aria-label="长按唤醒宇宙" onPointerDown={start} onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel} onClick={tap} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !holding) start(); }} onKeyUp={cancel}><span>{taps ? `继续触碰 ${taps}/3` : "长按 3 秒"}</span><i /></button>;
}

export function JealousyScene({ onComplete, onReveal }: BasicProps) {
  const [value, setValue] = useState(12);
  const completed = useRef(false);
  const revealOnce = useRevealOnce(onReveal);
  const done = value >= 92;
  useEffect(() => {
    if (value >= 35) revealOnce("praise");
    if (value >= 60) revealOnce("smile");
    if (value >= 85) revealOnce("meaning");
    if (done && !completed.current) { completed.current = true; onComplete(); }
  }, [done, onComplete, revealOnce, value]);
  return <div className="signal-scrub"><div className="waveform" style={{ "--clarity": `${value}%` } as React.CSSProperties}><span>{done ? "在意" : "心跳失序"}</span></div><label>向右解码<input aria-label="滑动解码心跳" type="range" min="0" max="100" value={value} onChange={(e) => setValue(Number(e.target.value))} /></label><button className="decode-pulse" aria-label="发送解码脉冲" onClick={() => setValue((current) => Math.min(100, current + 25))}>{done ? "信号已解码" : "触碰发送脉冲"}</button></div>;
}

export function ConfessionScene({ onComplete, onReveal }: BasicProps) {
  const targets = ["2026", "05", "23"];
  const [locked, setLocked] = useState([false, false, false]);
  const completed = useRef(false);
  const revealOnce = useRevealOnce(onReveal);
  const allLocked = locked.every(Boolean);
  useEffect(() => {
    if (!allLocked || completed.current) return;
    revealOnce("locked");
    completed.current = true;
    onComplete();
  }, [allLocked, onComplete, revealOnce]);
  const lock = (index: number) => {
    revealOnce(["year", "month", "day"][index]);
    setLocked(locked.map((item, itemIndex) => itemIndex === index ? true : item));
  };
  return <div className="coordinate-lock"><div className="orbital-dial">{targets.map((target, index) => <button key={target} aria-label={`锁定 ${target}`} className={locked[index] ? "locked" : ""} disabled={index > 0 && !locked[index - 1]} onClick={() => lock(index)}><span>{target}</span></button>)}</div><p aria-live="polite">{allLocked ? "LOVE COORDINATE LOCKED" : "依次触碰三层星轨"}</p></div>;
}

export function PrivilegeScene({ onComplete, onReveal }: BasicProps) {
  const [lights, setLights] = useState(0);
  const completed = useRef(false);
  const revealOnce = useRevealOnce(onReveal);
  const done = lights >= 3;
  const advance = () => {
    const next = Math.min(3, lights + 1);
    setLights(next);
    revealOnce(["diary", "remembered", "seen"][next - 1]);
    if (next === 3) {
      revealOnce("action");
      if (!completed.current) { completed.current = true; onComplete(); }
    }
  };
  return <button className="privilege-field" onClick={advance} aria-label="点亮偏爱星群"><span className={`privilege-stars lights-${lights}`}>{"✦　✧　✦"}</span><strong>{done ? "整片宇宙的例外，都给小宝贝" : `点亮偏爱 ${lights} / 3`}</strong></button>;
}

export function SignalScene({ onResponse, onComplete, onReveal, onChannelSelected }: BasicProps & { onResponse: (type: ResponseType) => void; onChannelSelected: (channelId: SignalChannelId) => void }) {
  const [channelId, setChannelId] = useState<SignalChannelId | null>(null);
  const [heard, setHeard] = useState<ResponseType[]>([]);
  const completed = useRef(false);
  const revealOnce = useRevealOnce(onReveal);
  const channel = signalChannels.find((item) => item.id === channelId);
  const chooseResponse = (type: ResponseType) => {
    if (heard.includes(type)) return;
    onResponse(type);
    revealOnce(type);
    const next = [...heard, type];
    setHeard(next);
    if (next.length === 3) {
      revealOnce("close");
      if (!completed.current) { completed.current = true; onComplete(); }
    }
  };
  if (!channel) return <div className="channel-grid">{signalChannels.map((item) => <button key={item.id} onClick={() => { onChannelSelected(item.id); setChannelId(item.id); }} aria-label={item.label}><i>{item.icon}</i><span>{item.label}</span></button>)}</div>;
  return <div className="response-console"><p className="selected-channel">频道已接通 · {channel.label}</p>{channel.responses.map((item) => <button key={item.type} className={heard.includes(item.type) ? "heard" : ""} onClick={() => chooseResponse(item.type)} aria-label={item.label}><b>{item.label}</b><span>{item.text}</span></button>)}</div>;
}

export function GameScene({ onComplete, onReveal }: BasicProps) {
  const [gate, setGate] = useState(0);
  const completed = useRef(false);
  const revealOnce = useRevealOnce(onReveal);
  const labels = ["靠近", "同步", "穿越"];
  const advance = () => {
    const next = Math.min(3, gate + 1);
    setGate(next);
    revealOnce(["near", "sync", "through"][next - 1]);
    if (next === 3) {
      revealOnce("complete");
      if (!completed.current) { completed.current = true; onComplete(); }
    }
  };
  return <div className="coop-game"><div className={`light-track gate-${gate}`}><i /><i /><span /></div><button onClick={advance} disabled={gate === 3}>{gate === 3 ? "双人副本完成" : `${labels[gate]} · ${gate + 1}/3`}</button></div>;
}

export function NightScene({ onComplete, onReveal }: BasicProps) {
  const holdThreshold = 180;
  const [progress, setProgress] = useState(0);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureActive = useRef(false);
  const holdHandled = useRef(false);
  const suppressClick = useRef(false);
  const clickResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completed = useRef(false);
  const revealOnce = useRevealOnce(onReveal);
  const finish = useCallback(() => { if (!completed.current) { completed.current = true; onComplete(); } }, [onComplete]);
  const update = useCallback((amount: number) => setProgress((value) => Math.min(100, value + amount)), []);
  const armClickSuppression = useCallback(() => {
    suppressClick.current = true;
    if (clickResetTimer.current) clearTimeout(clickResetTimer.current);
    clickResetTimer.current = setTimeout(() => { suppressClick.current = false; clickResetTimer.current = null; }, 0);
  }, []);
  const start = () => {
    if (gestureActive.current) return;
    if (clickResetTimer.current) clearTimeout(clickResetTimer.current);
    suppressClick.current = false;
    gestureActive.current = true;
    holdHandled.current = false;
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      if (!gestureActive.current) return;
      holdHandled.current = true;
      interval.current = setInterval(() => update(2), 60);
    }, holdThreshold);
  };
  const stop = useCallback((cancelled: boolean) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    if (interval.current) clearInterval(interval.current);
    interval.current = null;
    if (!gestureActive.current) return;
    gestureActive.current = false;
    if (!cancelled && !holdHandled.current) update(34);
    if (!cancelled || holdHandled.current) armClickSuppression();
    holdHandled.current = false;
  }, [armClickSuppression, update]);
  const tap = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      if (clickResetTimer.current) clearTimeout(clickResetTimer.current);
      clickResetTimer.current = null;
      return;
    }
    update(34);
  };
  useEffect(() => () => {
    if (interval.current) clearInterval(interval.current);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (clickResetTimer.current) clearTimeout(clickResetTimer.current);
  }, []);
  useEffect(() => {
    if (progress >= 33) revealOnce("third");
    if (progress >= 66) revealOnce("two-thirds");
    if (progress >= 100) { revealOnce("connected"); revealOnce("frequency"); stop(true); finish(); }
  }, [finish, progress, revealOnce, stop]);
  return <button className="frequency-link" onPointerDown={start} onPointerUp={() => stop(false)} onPointerCancel={() => stop(true)} onPointerLeave={() => stop(true)} onClick={tap} aria-label="按住连接深夜频率"><span className="frequency-line" style={{ width: `${progress}%` }} /><b>{progress === 100 ? "我们同频了" : "按住，或触碰三次，让两端慢慢靠近"}</b><small>{progress}%</small></button>;
}

export function FinaleScene({ onComplete, onReveal, onRestart }: BasicProps & { onRestart: () => void }) {
  const [now, setNow] = useState(() => new Date());
  const [step, setStep] = useState(0);
  const completed = useRef(false);
  const revealOnce = useRevealOnce(onReveal);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  const elapsed = useMemo(() => elapsedSinceConfession(now), [now]);
  const advance = () => {
    const next = Math.min(3, step + 1);
    setStep(next);
    revealOnce(["recap", "present", "echo"][next - 1]);
    if (next === 3 && !completed.current) { completed.current = true; onComplete(); }
  };
  const label = step === 0 ? "读取回音 1 / 3" : step === 1 ? "读取回音 2 / 3" : "展开无限回音";
  return <div className="finale-copy"><div className="finale-coordinate" aria-hidden="true">05:23</div>{step < 3 ? <button className="finale-reveal" onClick={advance}>{label}</button> : <><p className="final-line">{finalCopy.lines[0]}<br />{finalCopy.lines[1]}</p><div className="love-clock"><span><b>{elapsed.days}</b>天</span><span><b>{elapsed.hours}</b>时</span><span><b>{elapsed.minutes}</b>分</span><span><b>{elapsed.seconds}</b>秒</span></div><p className="signature">TO {finalCopy.to}<br />FROM {finalCopy.from}<br />SINCE {finalCopy.since}</p><button className="replay-button" onClick={onRestart}>重新进入这片宇宙</button></>}</div>;
}
