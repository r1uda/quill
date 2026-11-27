package qingri.device

import android.app.Service
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.*
import org.json.JSONObject

class AlarmService : Service() {
  private var player: MediaPlayer? = null
  private var wake: PowerManager.WakeLock? = null
  private val handler = Handler(Looper.getMainLooper())
  private val timeout = Runnable { stopSelf() }
  override fun onBind(intent: Intent?) = null
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == "stop") { stopSelf(); return START_NOT_STICKY }
    val raw = intent?.getStringExtra("item") ?: return START_NOT_STICKY.also { stopSelf() }
    try {
      val item = JSONObject(raw)
      startForeground(7391, Reminders.notification(this, item, true))
      handler.removeCallbacks(timeout)
      handler.postDelayed(timeout, 120000)
      if (wake == null) wake = (getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "qingri:alarm").apply { acquire(125000) }
      player?.release()
      player = MediaPlayer().apply {
        setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        setDataSource(this@AlarmService, uri)
        isLooping = true
        setOnErrorListener { _, what, extra ->
          Reminders.prefs(this@AlarmService).edit().putString("error", "闹铃播放失败：$what/$extra").apply()
          stopSelf(); true
        }
        prepare()
        start()
      }
    } catch (e: Exception) {
      Reminders.prefs(this).edit().putString("error", "闹铃播放失败：${e.message}").apply()
      stopSelf()
    }
    return START_NOT_STICKY
  }
  override fun onDestroy() {
    handler.removeCallbacks(timeout)
    player?.release(); player = null
    wake?.let { if (it.isHeld) it.release() }; wake = null
    stopForeground(STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }
}
