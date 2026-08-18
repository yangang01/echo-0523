"use client";

import { useEffect, useRef } from "react";
import { audioRecipe, type SoundName } from "../../lib/audio";

export function AudioEngine({ enabled, paused, cue }: { enabled: boolean; paused: boolean; cue: SoundName }) {
  const contextRef = useRef<AudioContext | null>(null);
  const previousCue = useRef(cue);

  useEffect(() => {
    if (!enabled || paused || typeof AudioContext === "undefined") return;
    const context = contextRef.current ?? new AudioContext();
    contextRef.current = context;
    void context.resume();
    if (previousCue.current === cue && context.currentTime > 0.2) return;
    previousCue.current = cue;
    const recipe = audioRecipe(cue);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = recipe.type;
    oscillator.frequency.setValueAtTime(recipe.frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(recipe.frequency * 1.7, context.currentTime + recipe.duration);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(recipe.gain, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + recipe.duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + recipe.duration + 0.02);
  }, [cue, enabled, paused]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    if (paused || !enabled) void context.suspend();
    else void context.resume();
  }, [enabled, paused]);

  useEffect(() => () => { void contextRef.current?.close(); }, []);
  return null;
}
