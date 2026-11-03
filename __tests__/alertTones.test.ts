import { existsSync } from 'fs';
import path from 'path';
import {
  ALERT_TONES,
  DEFAULT_ALERT_TONE_ID,
  getAlertTone,
  isAlertToneId,
} from '../src/lib/alertTones';
import { createDefaultTerminalSettings } from '../src/lib/seed';

describe('alert tone catalog', () => {
  it('offers ten unique built-in presets with the requested labels', () => {
    expect(ALERT_TONES).toHaveLength(10);
    expect(new Set(ALERT_TONES.map((tone) => tone.id)).size).toBe(10);

    const labels = ALERT_TONES.map((tone) => tone.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Classic Chime',
        'Kitchen Bell',
        'Digital Beep',
        'Loud Alarm',
        'Subtle Ping',
        'Double Gong',
        'Restaurant Order Chime',
        'High Pitch Alert',
        'Marimba',
        'Urgent Pulse',
      ])
    );
  });

  it('validates ids and falls back to the default tone', () => {
    expect(isAlertToneId(DEFAULT_ALERT_TONE_ID)).toBe(true);
    expect(isAlertToneId('not_a_real_tone')).toBe(false);
    expect(getAlertTone('not_a_real_tone').id).toBe(DEFAULT_ALERT_TONE_ID);
  });

  it('has a bundled WAV asset for every preset', () => {
    for (const tone of ALERT_TONES) {
      const assetPath = path.join(process.cwd(), 'assets', 'sounds', `${tone.id}.wav`);
      expect(existsSync(assetPath)).toBe(true);
    }
  });

  it('stores a valid, enabled default preference in terminal settings', () => {
    const settings = createDefaultTerminalSettings();

    expect(settings.soundAlertsEnabled).toBe(true);
    expect(settings.alertToneId).toBe(DEFAULT_ALERT_TONE_ID);
    expect(isAlertToneId(settings.alertToneId)).toBe(true);
  });
});
