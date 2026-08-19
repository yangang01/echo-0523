"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { audioRecipe, type SoundName } from "../../lib/audio";
import {
  createAudioVolumeFader,
  type AudioVolumeFader,
} from "../../lib/audio-volume";

const NORMAL_VOLUME = 0.16;
const FINALE_VOLUME = 0.2;
const INITIAL_FADE_MS = 2_500;
const MIX_FADE_MS = 1_200;
const STOP_FADE_MS = 450;
const LOOP_FADE_MS = 700;
const CUE_GAIN_SCALE = 0.35;

export type AudioEngineHandle = {
  requestStart: () => Promise<boolean>;
};

type Props = {
  enabled: boolean;
  paused: boolean;
  finale?: boolean;
  cue: SoundName;
  onPlaybackChange?: (playing: boolean) => void;
};

export const AudioEngine = forwardRef<AudioEngineHandle, Props>(
  function AudioEngine(
    {
      enabled,
      paused,
      finale = false,
      cue,
      onPlaybackChange = () => undefined,
    },
    ref,
  ) {
    const contextRef = useRef<AudioContext | null>(null);
    const previousCue = useRef(cue);
    const musicRef = useRef<HTMLAudioElement>(null);
    const faderRef = useRef<AudioVolumeFader | null>(null);
    const pendingPlay = useRef<Promise<boolean> | null>(null);
    const mediaPaused = useRef(true);
    const mixed = useRef(false);
    const loopFading = useRef(false);
    const enabledRef = useRef(enabled);
    const pausedRef = useRef(paused);
    const targetVolumeRef = useRef(
      finale ? FINALE_VOLUME : NORMAL_VOLUME,
    );
    const playbackChangeRef = useRef(onPlaybackChange);

    enabledRef.current = enabled;
    pausedRef.current = paused;
    targetVolumeRef.current = finale ? FINALE_VOLUME : NORMAL_VOLUME;
    playbackChangeRef.current = onPlaybackChange;

    const requestMusic = useCallback(() => {
      const music = musicRef.current;
      if (!music) return Promise.resolve(false);
      if (!mediaPaused.current) return Promise.resolve(true);
      if (pendingPlay.current) return pendingPlay.current;

      let playResult: Promise<void> | void;
      try {
        playResult = music.play();
      } catch {
        mediaPaused.current = true;
        playbackChangeRef.current(false);
        return Promise.resolve(false);
      }

      const attempt = Promise.resolve(playResult)
        .then(() => {
          mediaPaused.current = false;
          return true;
        })
        .catch(() => {
          mediaPaused.current = true;
          playbackChangeRef.current(false);
          return false;
        })
        .finally(() => {
          pendingPlay.current = null;
        });
      pendingPlay.current = attempt;
      return attempt;
    }, []);

    useImperativeHandle(ref, () => ({
      requestStart() {
        const music = musicRef.current;
        if (music) music.volume = Math.min(music.volume, 0.001);
        return requestMusic();
      },
    }), [requestMusic]);

    useEffect(() => {
      const music = musicRef.current;
      if (!music) return;
      music.volume = 0;
      const fader = createAudioVolumeFader(music);
      faderRef.current = fader;

      const handleTimeUpdate = () => {
        if (
          loopFading.current
          || !enabledRef.current
          || pausedRef.current
          || !Number.isFinite(music.duration)
          || music.duration <= 0
          || music.duration - music.currentTime > 0.8
        ) return;
        loopFading.current = true;
        fader.to(0, LOOP_FADE_MS);
      };

      const handleEnded = () => {
        music.currentTime = 0;
        mediaPaused.current = true;
        loopFading.current = false;
        if (!enabledRef.current || pausedRef.current) return;
        void requestMusic().then((started) => {
          if (!started || !enabledRef.current || pausedRef.current) return;
          fader.to(targetVolumeRef.current, INITIAL_FADE_MS);
        });
      };

      music.addEventListener("timeupdate", handleTimeUpdate);
      music.addEventListener("ended", handleEnded);
      return () => {
        music.removeEventListener("timeupdate", handleTimeUpdate);
        music.removeEventListener("ended", handleEnded);
        fader.cancel();
        music.pause();
        mediaPaused.current = true;
        faderRef.current = null;
      };
    }, [requestMusic]);

    useEffect(() => {
      const music = musicRef.current;
      const fader = faderRef.current;
      if (!music || !fader) return;

      if (paused) {
        fader.cancel();
        music.pause();
        mediaPaused.current = true;
        return;
      }

      if (!enabled) {
        mixed.current = false;
        fader.to(0, STOP_FADE_MS, () => {
          if (enabledRef.current || pausedRef.current) return;
          music.pause();
          mediaPaused.current = true;
        });
        return;
      }

      const fadeDuration = mixed.current ? MIX_FADE_MS : INITIAL_FADE_MS;
      if (!mediaPaused.current) {
        fader.to(targetVolumeRef.current, fadeDuration);
        mixed.current = true;
        return;
      }
      void requestMusic().then((started) => {
        if (!started || !enabledRef.current || pausedRef.current) return;
        fader.to(targetVolumeRef.current, fadeDuration);
        mixed.current = true;
      });
    }, [enabled, finale, paused, requestMusic]);

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
      oscillator.frequency.setValueAtTime(
        recipe.frequency,
        context.currentTime,
      );
      oscillator.frequency.exponentialRampToValueAtTime(
        recipe.frequency * 1.7,
        context.currentTime + recipe.duration,
      );
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        recipe.gain * CUE_GAIN_SCALE,
        context.currentTime + 0.03,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + recipe.duration,
      );
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

    useEffect(() => () => {
      faderRef.current?.cancel();
      musicRef.current?.pause();
      void contextRef.current?.close();
    }, []);

    return (
      // Instrumental background score has no spoken content to caption.
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <audio
        ref={musicRef}
        src="audio/a-moment-apart.mp3"
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
        hidden
      />
    );
  },
);
