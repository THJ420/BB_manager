/**
 * Dynamic Expo config for BB Manager.
 *
 * `process.env.EXPO_PUBLIC_*` values are inlined into the JavaScript bundle by
 * Metro at build time. That is fragile for standalone/EAS builds: if the
 * bundler runs in a step where the variable was not exported, the app silently
 * boots into local demo mode. This config is evaluated by the Expo CLI on the
 * build machine (EAS cloud, `eas build --local`, GitHub Actions, `expo
 * prebuild`) and its `extra` object is embedded into the native manifest, so
 * `Constants.expoConfig.extra.pocketbaseUrl` is always available at runtime.
 *
 * Demo mode is opt-in only: set EXPO_PUBLIC_POCKETBASE_URL=demo.
 */

const DEFAULT_POCKETBASE_URL = 'https://pocket.enjoydonerkebab.pl';
const DEMO_MODE_VALUE = 'demo';
const DEFAULT_EAS_PROJECT_ID = 'b0d2e86f-688f-455f-9ec7-cbac2dea3c75';

/** Trim whitespace and every trailing slash so `//api/...` redirects never happen. */
const normalizeUrl = (value) =>
  typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';

const rawPocketBaseUrl =
  typeof process.env.EXPO_PUBLIC_POCKETBASE_URL === 'string'
    ? process.env.EXPO_PUBLIC_POCKETBASE_URL.trim()
    : '';

const isDemoRequested = rawPocketBaseUrl.toLowerCase() === DEMO_MODE_VALUE;

// A missing/blank env var is NOT a reason to disable the live backend: default
// to the production PocketBase host. Only an explicit `demo` opts out.
const pocketbaseUrl = isDemoRequested
  ? DEMO_MODE_VALUE
  : normalizeUrl(rawPocketBaseUrl) || DEFAULT_POCKETBASE_URL;

const easProjectId =
  process.env.EAS_PROJECT_ID ||
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
  DEFAULT_EAS_PROJECT_ID;

module.exports = {
  expo: {
    name: 'BB Manager',
    slug: 'bb-manager',
    version: '1.5.2',
    orientation: 'default',
    scheme: 'bbmanager',
    userInterfaceStyle: 'dark',
    backgroundColor: '#0F1117',
    icon: './assets/icon.png',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0F1117',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.bbmanager.app',
      infoPlist: {
        // Keeps the incoming-order alarm audible after backgrounding/locking and
        // lets the OS deliver silent/wake pushes for the pickup fan-out.
        UIBackgroundModes: ['audio', 'remote-notification'],
      },
    },
    android: {
      package: 'com.bbmanager.app',
      edgeToEdgeEnabled: true,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0F1117',
      },
      permissions: [
        'android.permission.INTERNET',
        'android.permission.CAMERA',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.VIBRATE',
        'android.permission.WAKE_LOCK',
        'android.permission.RECEIVE_BOOT_COMPLETED',
        // Base foreground-service permission; expo-audio adds the
        // FOREGROUND_SERVICE_MEDIA_PLAYBACK subtype for the alarm loop.
        'android.permission.FOREGROUND_SERVICE',
        // The order-alarm keep-alive service runs as mediaPlayback so the
        // looping alarm survives a locked screen (explicit, not inherited).
        'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
        // Lets the first-launch flow offer the battery-optimisation exemption
        // so Doze cannot silence incoming-order alarms.
        'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
        // Full-screen intent notifications launch the incoming-order alarm
        // over the lock screen; SYSTEM_ALERT_WINDOW covers overlay fallback.
        'android.permission.USE_FULL_SCREEN_INTENT',
        'android.permission.SYSTEM_ALERT_WINDOW',
        // Required to launch the APK installer for in-app GitHub updates.
        'android.permission.REQUEST_INSTALL_PACKAGES',
      ],
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      './plugins/withLockScreenAlarm',
      [
        'expo-sqlite',
        {
          enableFTS: true,
          useSQLCipher: false,
        },
      ],
      [
        'expo-audio',
        {
          microphonePermission: false,
          recordAudioAndroid: false,
          enableBackgroundRecording: false,
          // Adds UIBackgroundModes:audio (iOS) and the mediaPlayback foreground
          // service + FOREGROUND_SERVICE_MEDIA_PLAYBACK (Android) so the alarm
          // loop keeps ringing on a locked/minimised terminal.
          enableBackgroundPlayback: true,
        },
      ],
      [
        'expo-notifications',
        {
          color: '#6366F1',
          // Bundles the alarm into android res/raw so the pickup channel and
          // remote pushes ring with the same loud tone as the in-app loop.
          sounds: ['./assets/sounds/loud_alarm.wav'],
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'BB Manager uses your photo library to attach dish photos to menu items.',
          cameraPermission: 'BB Manager uses the camera to capture dish photos for the menu.',
          microphonePermission: false,
        },
      ],
      [
        'expo-dev-client',
        {
          launcherMode: 'default',
        },
      ],
    ],
    extra: {
      router: {
        asyncRoutes: {
          web: true,
        },
      },
      pocketbaseUrl,
      // Public release feed used by the in-app updater.
      githubRepo: 'THJ420/BB_manager',
      // Useful when diagnosing a build that unexpectedly boots into demo mode.
      pocketbaseUrlSource: isDemoRequested
        ? 'demo'
        : normalizeUrl(rawPocketBaseUrl)
          ? 'env'
          : 'default',
      eas: {
        projectId: easProjectId,
      },
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: `https://u.expo.dev/${easProjectId}`,
    },
  },
};
