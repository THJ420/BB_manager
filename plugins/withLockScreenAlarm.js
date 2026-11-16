const { withMainActivity } = require('@expo/config-plugins');

const ANCHOR = 'super.onCreate(null)';
const INJECTION = `${ANCHOR}
    // Incoming-order full-screen alarms must render above the keyguard and
    // wake the display (API 27+; guarded for older terminals).
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    }`;

/**
 * Keeps the lock-screen alarm flags in the generated MainActivity so they
 * survive `expo prebuild --clean` in the CI Gradle fallback. The committed
 * android/ project carries the same edit for bare EAS builds.
 */
module.exports = function withLockScreenAlarm(config) {
  return withMainActivity(config, (cfg) => {
    const { modResults } = cfg;
    if (modResults.language !== 'kt') {
      throw new Error('withLockScreenAlarm: expected a Kotlin MainActivity');
    }
    if (modResults.contents.includes('setShowWhenLocked')) return cfg;
    if (!modResults.contents.includes(ANCHOR)) {
      throw new Error('withLockScreenAlarm: MainActivity onCreate anchor not found');
    }
    modResults.contents = modResults.contents.replace(ANCHOR, INJECTION);
    return cfg;
  });
};