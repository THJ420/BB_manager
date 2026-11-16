package com.bbmanager.orderalarm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Keep-alive foreground service for the incoming-order alarm loop. While it
 * runs, Android treats the terminal as foreground, so the looping alarm audio
 * and vibration are not suspended when the screen is off or the app is
 * backgrounded. The alarm audio itself lives in OrderAlarmModule; this service
 * only pins the process and shows a silent ongoing status notification.
 */
class OrderAlarmService : Service() {
  companion object {
    private const val CHANNEL_ID = "pickup-orders-service-v1"
    private const val NOTIFICATION_ID = 7003
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    ensureChannel()
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("Incoming order alarm")
      .setContentText("Ringing until the ticket is accepted or rejected.")
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setOngoing(true)
      .setSilent(true)
      .build()
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        )
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (error: Exception) {
      // Missing subtype permission or OEM restriction: never crash the terminal.
      stopSelf()
    }
    return START_STICKY
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    manager.createNotificationChannel(
      NotificationChannel(
        CHANNEL_ID,
        "Order alarm keep-alive",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Silent status notification while an order alarm is ringing."
        setSound(null, null)
        enableVibration(false)
        setShowBadge(false)
      }
    )
  }
}