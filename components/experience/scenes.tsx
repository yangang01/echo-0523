"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { finalCopy, signalChannels } from "../../lib/content";
import type { ResponseType } from "../../lib/experience";
import { elapsedSinceConfession } from "../../lib/relationship-time";

type BasicProps = { onComplete: () => void };

export function WakeScene({ onComplete }: BasicProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completed = useRef(false);
  const [holding, setHolding] = useState(false);
  const [taps, setTaps] = useState(0);
  const finish = () => { if (!completed.current) { completed.current = true; onComplete(); } };
  const start = () => { setHolding(true); timer.current = setTimeout(finish, 3000); };
  const cancel = () => { setHolding(false); if (timer.current) clearTimeout(timer.current); };
  const tap = () => setTaps((value) => { const next = Math.min(3, value + 1); if (next === 3) finish(); return next; });
  useEffect(() => cancel, []);
  return <button className={`hold-orb ${holding ? "is-holding" : ""}`} aria-label="长按唤醒宇宙" onPointerDown={start} onPointerUp={cancel} onPointerLeave={cancel} onClick={tap} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !holding) start(); }} onKeyUp={cancel}><span>{taps ? `继续触碰 ${taps}/3` : "长按 3 秒"}</span><i /></button>;
}

export function JealousyScene({ onComplete }: BasicProps) {
  const [value, setValue] = useState(12);
  const done = value >= 92;
  useEffect(() => { if (done) onComplete(); }, [done, onComplete]);
  return <div className="signal-scrub"><div className="waveform" style={{ "--clarity": `${value}%` } as React.CSSProperties}><span>{done ? "在意" : "心跳失序"}</span></div><label>向右解码<input aria-label="滑动解码心跳" type="range" min="0" max="100" value={value} onChange={(e) => setValue(Number(e.target.value))} /></label><button className="decode-pulse" aria-label="发送解码脉冲" onClick={() => setValue((current) => Math.min(100, current + 25))}>{done ? "信号已解码" : "触碰发送脉冲"}</button></div>;
}

export function ConfessionScene({ onComplete }: BasicProps) {
  const targets = ["2026", "05", "23"];
  const [locked, setLocked] = useState([false, false, false]);
  const allLocked = locked.every(Boolean);
  useEffect(() => { if (allLocked) onComplete(); }, [allLocked, onComplete]);
  return <div className="coordinate-lock"><div className="orbital-dial">{targets.map((target, index) => <button key={target} aria-label={`锁定 ${target}`} className={locked[index] ? "locked" : ""} onClick={() => setLocked((current) => current.map((item, itemIndex) => itemIndex === index ? true : item))}><span>{target}</span></button>)}</div><p aria-live="polite">{allLocked ? "LOVE COORDINATE LOCKED" : "依次触碰三层星轨"}</p></div>;
}

export function PrivilegeScene({ onComplete }: BasicProps) {
  const [lights, setLights] = useState(0);
  const done = lights >= 3;
  useEffect(() => { if (done) onComplete(); }, [done, onComplete]);
  return <button className="privilege-field" onClick={() => setLights((value) => Math.min(3, value + 1))} aria-label="点亮偏爱星群"><span className={`privilege-stars lights-${lights}`}>✦　✧　✦</span><strong>{done ? "整片宇宙的例外，都给小宝贝" : `点亮偏爱 ${lights} / 3`}</strong></button>;
}

export function SignalScene({ onResponse, onComplete }: BasicProps & { onResponse: (type: ResponseType) => void }) {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [heard, setHeard] = useState<ResponseType[]>([]);
  const channel = signalChannels.find((item) => item.id === channelId);
  const chooseResponse = (type: ResponseType) => {
    if (heard.includes(type)) return;
    onResponse(type);
    const next = [...heard, type];
    setHeard(next);
    if (next.length === 3) onComplete();
  };
  if (!channel) return <div className="channel-grid">{signalChannels.map((item) => <button key={item.id} onClick={() => setChannelId(item.id)} aria-label={item.label}><i>{item.icon}</i><span>{item.label}</span></button>)}</div>;
  return <div className="response-console"><p className="selected-channel">频道已接通 · {channel.label}</p>{channel.responses.map((item) => <button key={item.type} className={heard.includes(item.type) ? "heard" : ""} onClick={() => chooseResponse(item.type)} aria-label={item.label}><b>{item.label}</b><span>{item.text}</span></button>)}</div>;
}

export function GameScene({ onComplete }: BasicProps) {
  const [gate, setGate] = useState(0);
  const labels = ["靠近", "同步", "穿越"];
  const advance = () => { const next = Math.min(3, gate + 1); setGate(next); if (next === 3) onComplete(); };
  return <div className="coop-game"><div className={`light-track gate-${gate}`}><i /><i /><span /></div><button onClick={advance} disabled={gate === 3}>{gate === 3 ? "双人副本完成" : `${labels[gate]} · ${gate + 1}/3`}</button></div>;
}

export function NightScene({ onComplete }: BasicProps) {
  const [progress, setProgress] = useState(0);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const completed = useRef(false);
  const finish = () => { if (!completed.current) { completed.current = true; onComplete(); } };
  const update = (amount: number) => setProgress((value) => { const next = Math.min(100, value + amount); if (next === 100) { if (interval.current) clearInterval(interval.current); finish(); } return next; });
  const start = () => { interval.current = setInterval(() => update(2), 60); };
  const stop = () => { if (interval.current) clearInterval(interval.current); };
  useEffect(() => stop, []);
  return <button className="frequency-link" onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onClick={() => update(34)} aria-label="按住连接深夜频率"><span className="frequency-line" style={{ width: `${progress}%` }} /><b>{progress === 100 ? "我们同频了" : "按住，或触碰三次，让两端慢慢靠近"}</b><small>{progress}%</small></button>;
}

export function FinaleScene({ onComplete, onRestart }: BasicProps & { onRestart: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { onComplete(); const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, [onComplete]);
  const elapsed = useMemo(() => elapsedSinceConfession(now), [now]);
  return <div className="finale-copy"><div className="finale-coordinate" aria-hidden="true">05:23</div><p className="final-line">{finalCopy.lines[0]}<br />{finalCopy.lines[1]}</p><div className="love-clock"><span><b>{elapsed.days}</b>天</span><span><b>{elapsed.hours}</b>时</span><span><b>{elapsed.minutes}</b>分</span><span><b>{elapsed.seconds}</b>秒</span></div><p className="signature">TO {finalCopy.to}<br />FROM {finalCopy.from}<br />SINCE {finalCopy.since}</p><button className="replay-button" onClick={onRestart}>重新进入这片宇宙</button></div>;
}
