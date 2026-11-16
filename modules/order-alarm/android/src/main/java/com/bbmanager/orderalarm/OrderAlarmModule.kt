package com.bbmanager.orderalarm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Lock-screen incoming-order alarm engine.
 *
 * A heads-up notification alone cannot surface UI over the keyguard. This
 * module posts an IMPORTANCE_HIGH alarm-category notification carrying
 * setFullScreenIntent(MainActivity), which Android launches full-screen over
 * the lock screen (or as a heads-up banner when the screen is already on).
 * A short screen-bright wake lock guarantees the display turns on for it.
 *
 * Sound and vibration are owned by a native looping MediaPlayer + Vibrator
 * (startLoop/stopLoop), not by the notification channel: MediaPlayer loops a
 * local resource gaplessly, and the alarm-stream vibration repeats with zero
 * off-time, so the terminal rings non-stop until Accept/Reject dismisses it.
 */
class OrderAlarmModule : Module() {
  companion object {
    // v2 is silent: channel settings are immutable once created, and the
    // continuous loop (not the one-shot channel sound) owns the alarm audio.
    private const val CHANNEL_ID = "pickup-orders-fsi-v2"
    private const val NOTIFICATION_ID = 7001
    private const val REQUEST_CODE = 7002
    private const val WAKE_TIMEOUT_MS = 10_000L
    private val VIBRATION_PATTERN = longArrayOf(0, 2000)
  }

  private var wakeLock: PowerManager.WakeLock? = null
  private var mediaPlayer: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var serviceContext: Context? = null

  override fun definition() = ModuleDefinition {
    Name("OrderAlarm")

    Function("present") { title: String, body: String, orderId: String ->
      val context = appContext.reactContext ?: return@Function false
      presentAlarm(context, title, body, orderId)
    }

    Function("dismiss") {
      val context = appContext.reactContext
      if (context != null) {
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
      }
      stopAlarmLoop()
      releaseWakeLock()
    }

    Function("startLoop") { tone: String ->
      val context = appContext.reactContext ?: return@Function false
      startAlarmLoop(context, tone)
    }

    Function("stopLoop") {
      stopAlarmLoop()
    }

    Function("canUseFullScreenIntent") {
      val context = appContext.reactContext ?: return@Function false
      canUseFullScreenIntent(context)
    }

    Function("openFullScreenIntentSettings") {
      val context = appContext.reactContext ?: return@Function false
      openFullScreenIntentSettings(context)
    }
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Pickup order alarms",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "Full-screen incoming pickup order alarms for this terminal."
      setBypassDnd(true)
      lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
      // The looping engine owns audio and vibration; a channel sound would
      // double-ring once on every re-post while the loop is already running.
      setSound(null, null)
      enableVibration(false)
    }
    manager.createNotificationChannel(channel)
  }

  private fun alarmSoundUri(context: Context): Uri {
    // expo-notifications bundles loud_alarm.wav into res/raw; fall back to the
    // system alarm tone if the resource is absent (e.g. a stripped build).
    val resId = context.resources.getIdentifier("loud_alarm", "raw", context.packageName)
    return if (resId != 0) {
      Uri.parse("android.resource://${context.packageName}/$resId")
    } else {
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
    }
  }

  /**
   * Gapless alarm audio + continuous vibration until stopAlarmLoop().
   * Returns false when no audio source could be opened so the JS layer can
   * fall back to its expo-audio loop; vibration still runs either way.
   */
  private fun startAlarmLoop(context: Context, tone: String): Boolean {
    stopAlarmLoop()
    startKeepAliveService(context)
    startVibration(context)

    val player = MediaPlayer()
    return try {
      player.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
      val resId = context.resources.getIdentifier(tone, "raw", context.packageName)
      if (resId != 0) {
        player.setDataSource(context, Uri.parse("android.resource://${context.packageName}/$resId"))
      } else {
        player.setDataSource(context, alarmSoundUri(context))
      }
      // MediaPlayer repeats a local resource without the rebuffer gap that
      // JS-side player restarts produce.
      player.isLooping = true
      player.prepare()
      player.start()
      mediaPlayer = player
      true
    } catch (error: Exception) {
      try {
        player.release()
      } catch (_: Exception) {
      }
      false
    }
  }

  private fun stopAlarmLoop() {
    try {
      mediaPlayer?.let { player ->
        if (player.isPlaying) player.stop()
        player.release()
      }
    } catch (_: Exception) {
    }
    mediaPlayer = null
    try {
      vibrator?.cancel()
    } catch (_: Exception) {
    }
    vibrator = null
    stopKeepAliveService()
  }

  private fun startKeepAliveService(context: Context) {
    try {
      val intent = Intent(context, OrderAlarmService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      serviceContext = context.applicationContext
    } catch (_: Exception) {
      // Android 12+ can block background foreground-service starts; the alarm
      // audio still plays and the full-screen intent brings the app forward.
    }
  }

  private fun stopKeepAliveService() {
    try {
      serviceContext?.let { context ->
        context.stopService(Intent(context, OrderAlarmService::class.java))
      }
    } catch (_: Exception) {
    }
    serviceContext = null
  }

  @Suppress("DEPRECATION")
  private fun startVibration(context: Context) {
    try {
      val device = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
        manager.defaultVibrator
      } else {
        context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
      }
      if (!device.hasVibrator()) return
      // Repeat from index 0 with zero wait: vibration never pauses.
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val effect = VibrationEffect.createWaveform(VIBRATION_PATTERN, 0)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          device.vibrate(
            effect,
            VibrationAttributes.Builder()
              .setUsage(VibrationAttributes.USAGE_ALARM)
              .build()
          )
        } else {
          device.vibrate(
            effect,
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_ALARM)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build()
          )
        }
      } else {
        device.vibrate(VIBRATION_PATTERN, 0)
      }
      vibrator = device
    } catch (_: Exception) {
      // Vibration is best-effort; the audio loop must not fail because of it.
    }
  }

  private fun presentAlarm(context: Context, title: String, body: String, orderId: String): Boolean {
    ensureChannel(context)

    val launchIntent = Intent()
      .setClassName(context.packageName, "${context.packageName}.MainActivity")
      .addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_SINGLE_TOP
      )
      .putExtra("orderId", orderId)
    val pendingIntent = PendingIntent.getActivity(
      context,
      REQUEST_CODE,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(true)
      .setContentIntent(pendingIntent)
      // The flag that forces the alarm screen over the lock screen. No
      // timeout: the alarm persists until Accept/Reject dismisses it.
      .setFullScreenIntent(pendingIntent, true)
      .build()

    wakeScreen(context)

    // Keep the launched activity above the keyguard while the alarm is live.
    appContext.currentActivity?.let { activity ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        activity.setShowWhenLocked(true)
        activity.setTurnScreenOn(true)
      }
    }

    return try {
      NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
      true
    } catch (security: SecurityException) {
      // POST_NOTIFICATIONS denied: nothing can be shown until the user grants it.
      false
    }
  }

  @Suppress("DEPRECATION")
  private fun wakeScreen(context: Context) {
    releaseWakeLock()
    try {
      val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      wakeLock = power.newWakeLock(
        PowerManager.SCREEN_BRIGHT_WAKE_LOCK or
          PowerManager.ACQUIRE_CAUSES_WAKEUP or
          PowerManager.ON_AFTER_RELEASE,
        "bbmanager:order-alarm"
      ).apply { acquire(WAKE_TIMEOUT_MS) }
    } catch (error: Exception) {
      // Some OEMs restrict wake locks; the full-screen intent still fires.
    }
  }

  private fun releaseWakeLock() {
    try {
      wakeLock?.let { if (it.isHeld) it.release() }
    } catch (error: Exception) {
      // Already released by the timeout.
    }
    wakeLock = null
  }

  private fun canUseFullScreenIntent(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < 34) return true
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    return manager.canUseFullScreenIntent()
  }

  private fun openFullScreenIntentSettings(context: Context): Boolean {
    return try {
      val intent = Intent(
        Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
        Uri.parse("package:${context.packageName}")
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      true
    } catch (error: Exception) {
      false
    }
  }
}