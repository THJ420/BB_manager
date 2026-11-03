import { AlertToneId } from '../types';

export interface AlertToneOption {
  id: AlertToneId;
  label: string;
  description: string;
  durationMs: number;
}

export const DEFAULT_ALERT_TONE_ID: AlertToneId = 'classic_chime';

/** Built-in terminal sounds. Assets live in assets/sounds and are bundled locally. */
export const ALERT_TONES: readonly AlertToneOption[] = [
  {
    id: 'classic_chime',
    label: 'Classic Chime',
    description: 'Warm three-note service chime',
    durationMs: 1150,
  },
  {
    id: 'kitchen_bell',
    label: 'Kitchen Bell',
    description: 'Bright pass-counter bell',
    durationMs: 1350,
  },
  {
    id: 'digital_beep',
    label: 'Digital Beep',
    description: 'Short terminal confirmation beeps',
    durationMs: 620,
  },
  {
    id: 'loud_alarm',
    label: 'Loud Alarm',
    description: 'High-priority alternating alarm',
    durationMs: 1180,
  },
  {
    id: 'subtle_ping',
    label: 'Subtle Ping',
    description: 'Quiet single ping for low-noise floors',
    durationMs: 550,
  },
  {
    id: 'double_gong',
    label: 'Double Gong',
    description: 'Deep two-strike dining gong',
    durationMs: 1650,
  },
  {
    id: 'restaurant_chime',
    label: 'Restaurant Order Chime',
    description: 'Ascending four-note order call',
    durationMs: 1250,
  },
  {
    id: 'high_pitch',
    label: 'High Pitch Alert',
    description: 'Cut-through high-frequency alert',
    durationMs: 620,
  },
  {
    id: 'marimba',
    label: 'Marimba',
    description: 'Light wooden mallet melody',
    durationMs: 1100,
  },
  {
    id: 'urgent_pulse',
    label: 'Urgent Pulse',
    description: 'Fast repeating kitchen pulse',
    durationMs: 1080,
  },
];

export function isAlertToneId(value: unknown): value is AlertToneId {
  return ALERT_TONES.some((tone) => tone.id === value);
}

export function getAlertTone(toneId: string | null | undefined): AlertToneOption {
  return ALERT_TONES.find((tone) => tone.id === toneId) ?? ALERT_TONES[0]!;
}
