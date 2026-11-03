import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import classicChime from '../../assets/sounds/classic_chime.wav';
import kitchenBell from '../../assets/sounds/kitchen_bell.wav';
import digitalBeep from '../../assets/sounds/digital_beep.wav';
import loudAlarm from '../../assets/sounds/loud_alarm.wav';
import subtlePing from '../../assets/sounds/subtle_ping.wav';
import doubleGong from '../../assets/sounds/double_gong.wav';
import restaurantChime from '../../assets/sounds/restaurant_chime.wav';
import highPitch from '../../assets/sounds/high_pitch.wav';
import marimba from '../../assets/sounds/marimba.wav';
import urgentPulse from '../../assets/sounds/urgent_pulse.wav';
import { getAlertTone } from '../lib/alertTones';
import { AlertToneId } from '../types';

const TONE_ASSETS: Record<AlertToneId, number> = {
  classic_chime: classicChime,
  kitchen_bell: kitchenBell,
  digital_beep: digitalBeep,
  loud_alarm: loudAlarm,
  subtle_ping: subtlePing,
  double_gong: doubleGong,
  restaurant_chime: restaurantChime,
  high_pitch: highPitch,
  marimba,
  urgent_pulse: urgentPulse,
};

interface PlaybackSubscription {
  remove(): void;
}

let activePlayer: AudioPlayer | null = null;
let activeSubscription: PlaybackSubscription | null = null;
let activeTimer: ReturnType<typeof setTimeout> | null = null;
let playbackToken = 0;
let audioModePromise: Promise<void> | null = null;

function ensureAudioMode(): Promise<void> {
  if (!audioModePromise) {
    audioModePromise = setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      allowsRecording: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    }).catch((error: unknown) => {
      audioModePromise = null;
      throw error;
    });
  }
  return audioModePromise;
}

function releaseActivePlayer(): void {
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
  activeSubscription?.remove();
  activeSubscription = null;

  const player = activePlayer;
  activePlayer = null;
  if (player) {
    try {
      player.pause();
      player.remove();
    } catch {
      // The player may already have been released by the platform.
    }
  }
}

/** Stops any preview or incoming-order tone currently playing. */
export function stopAlertTone(): void {
  playbackToken += 1;
  releaseActivePlayer();
}

/**
 * Plays one of the bundled alert tones. Returns false when the device/browser
 * blocks playback so callers can clear their preview state.
 */
export async function playAlertTone(
  toneId: AlertToneId,
  onEnded?: () => void
): Promise<boolean> {
  const source = TONE_ASSETS[toneId];
  if (source === undefined) return false;

  const token = playbackToken + 1;
  playbackToken = token;
  releaseActivePlayer();

  try {
    await ensureAudioMode();
  } catch (error) {
    console.warn('Unable to configure terminal alert audio', error);
  }

  if (token !== playbackToken) return false;

  const tone = getAlertTone(toneId);
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    if (token !== playbackToken) return;
    playbackToken += 1;
    releaseActivePlayer();
    onEnded?.();
  };

  try {
    const player = createAudioPlayer(source, { updateInterval: 100 });
    activePlayer = player;
    activeSubscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish || status.error) finish();
    });
    player.volume = 1;
    player.play();

    // Some web browsers suppress automatic playback. This fallback prevents a
    // preview button from remaining stuck in the playing state.
    activeTimer = setTimeout(finish, tone.durationMs + 700);
    return true;
  } catch (error) {
    console.warn('Unable to play terminal alert tone', error);
    if (token === playbackToken) {
      playbackToken += 1;
      releaseActivePlayer();
      onEnded?.();
    }
    return false;
  }
}
