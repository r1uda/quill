package qingri.device

import android.app.*
import android.content.*
import android.net.Uri
import android.os.Build
import android.provider.Settings
import org.json.JSONArray
import org.json.JSONObject

object Reminders {
  private const val STORE = "qingri-reminders-v2"
  fun prefs(ctx: Context) = ctx.getSharedPreferences(STORE, Context.MODE_PRIVATE)
  private fun manager(ctx: Context) = ctx.getSystemService(AlarmManager::class.java)
  fun notificationManager(ctx: Context) = ctx.getSystemService(NotificationManager::class.java)
  fun exact(ctx: Context) = Build.VERSION.SDK_INT < 31 || manager(ctx).canScheduleExactAlarms()
  fun channels(ctx: Context) {
    if (Build.VERSION.SDK_INT < 26) return
    val nm = notificationManager(ctx)
    nm.createNotificationChannel(NotificationChannel("qingri-message-v2", "消息提醒", NotificationManager.IMPORTANCE_HIGH))
    nm.createNotificationChannel(NotificationChannel("qingri-silent-v2", "消息提醒（静音）", NotificationManager.IMPORTANCE_HIGH).apply { setSound(null, null) })
    // Alarm audio is played by the foreground service, independently of notification volume.
    nm.createNotificationChannel(NotificationChannel("qingri-alarm-v2", "闹铃提醒", NotificationManager.IMPORTANCE_HIGH).apply { setSound(null, null) })
  }
  fun status(ctx: Context): Map<String, Any> {
    channels(ctx)
    val p = prefs(ctx)
    val pending = JSONArray(p.getString("plan", "[]"))
    val now = System.currentTimeMillis()
    var count = 0
    for (i in 0 until pending.length()) if (time(pending.getJSONObject(i)) > now) count++
    return mapOf("notifications" to notificationManager(ctx).areNotificationsEnabled(), "exact" to exact(ctx), "count" to count,
      "messageChannel" to (Build.VERSION.SDK_INT < 26 || notificationManager(ctx).getNotificationChannel("qingri-message-v2").importance != NotificationManager.IMPORTANCE_NONE),
      "alarmChannel" to (Build.VERSION.SDK_INT < 26 || notificationManager(ctx).getNotificationChannel("qingri-alarm-v2").importance != NotificationManager.IMPORTANCE_NONE),
      "lastFired" to p.getLong("lastFired", 0), "error" to (p.getString("error", "") ?: ""))
  }
  fun openAlarmSettings(ctx: Context) {
    if (Build.VERSION.SDK_INT >= 31) ctx.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${ctx.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }
  fun openNotificationSettings(ctx: Context) {
    ctx.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }
  private fun pending(ctx: Context, item: JSONObject): PendingIntent {
    val key = item.getString("id")
    return PendingIntent.getBroadcast(ctx, 0, Intent(ctx, ReminderReceiver::class.java).setData(Uri.parse("qingri://reminder/${Uri.encode(key)}")).putExtra("item", item.toString()), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
  // Reconstruct wall-clock time after timezone changes. Test reminders use an absolute timestamp.
  fun time(item: JSONObject): Long {
    val local = item.optString("local", "")
    return if (local.isNotEmpty()) java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm", java.util.Locale.ROOT).apply { isLenient = false }.parse(local)!!.time else item.getLong("when")
  }
  private fun arm(ctx: Context, item: JSONObject) {
    val whenAt = time(item)
    if (whenAt <= System.currentTimeMillis()) return
    if (item.optString("mode") == "alarm") {
      val show = PendingIntent.getActivity(ctx, 0, ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)!!, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      manager(ctx).setAlarmClock(AlarmManager.AlarmClockInfo(whenAt, show), pending(ctx, item))
    } else manager(ctx).setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, whenAt, pending(ctx, item))
  }
  @Synchronized fun replace(ctx: Context, json: String): Int {
    channels(ctx)
    val plan = JSONArray(json)
    val previous = JSONArray(prefs(ctx).getString("plan", "[]"))
    // A settings test must survive an ordinary background resync, without replacing real schedules.
    var hasTest = false
    for (i in 0 until plan.length()) if (plan.getJSONObject(i).getString("id") == "qingri:test") hasTest = true
    if (!hasTest) for (i in 0 until previous.length()) {
      val old = previous.getJSONObject(i)
      if (old.getString("id") == "qingri:test" && time(old) > System.currentTimeMillis()) plan.put(old)
    }
    check(plan.length() <= 65) { "提醒数量超过本次排程上限" }
    val wanted = mutableSetOf<String>()
    for (i in 0 until plan.length()) check(wanted.add(plan.getJSONObject(i).getString("id"))) { "提醒标识重复" }
    // OFF/deletion must cancel old alarms even when permission for other ON entries is missing.
    val retained = JSONArray()
    for (i in 0 until previous.length()) {
      val old = previous.getJSONObject(i)
      if (wanted.contains(old.getString("id"))) retained.put(old) else manager(ctx).cancel(pending(ctx, old))
    }
    check(prefs(ctx).edit().putString("plan", retained.toString()).commit()) { "提醒计划写入失败" }
    if (plan.length() > 0) {
      check(notificationManager(ctx).areNotificationsEnabled()) { "通知权限尚未开启，请到我的→提醒设置中允许通知。" }
      check(exact(ctx)) { "准时提醒权限尚未开启，请到我的→提醒设置中允许闹钟和提醒。" }
    }
    val keys = mutableSetOf<String>()
    try {
      for (i in 0 until plan.length()) {
        val item = plan.getJSONObject(i)
        check(keys.add(item.getString("id"))) { "提醒标识重复" }
        arm(ctx, item)
      }
    } catch (e: Exception) {
      for (i in 0 until plan.length()) manager(ctx).cancel(pending(ctx, plan.getJSONObject(i)))
      for (i in 0 until retained.length()) try { arm(ctx, retained.getJSONObject(i)) } catch (_: Exception) {}
      throw e
    }
    for (i in 0 until previous.length()) {
      val old = previous.getJSONObject(i)
      if (!keys.contains(old.getString("id"))) manager(ctx).cancel(pending(ctx, old))
    }
    check(prefs(ctx).edit().putString("plan", plan.toString()).commit()) { "提醒计划写入失败" }
    return plan.length()
  }
  @Synchronized fun test(ctx: Context, mode: String): Int {
    check(mode == "alarm" || mode == "notification") { "提醒方式不正确" }
    val old = JSONArray(prefs(ctx).getString("plan", "[]"))
    val plan = JSONArray()
    for (i in 0 until old.length()) {
      val item = old.getJSONObject(i)
      if (item.getString("id") != "qingri:test" && time(item) > System.currentTimeMillis()) plan.put(item)
    }
    plan.put(JSONObject().put("id", "qingri:test").put("title", if (mode == "alarm") "闹铃测试" else "消息提醒测试")
      .put("body", "这是一条测试提醒，可在通知栏停止闹铃。").put("mode", mode).put("sound", true).put("when", System.currentTimeMillis() + 10000))
    return replace(ctx, plan.toString())
  }
  @Synchronized fun restore(ctx: Context) {
    try {
      val plan = JSONArray(prefs(ctx).getString("plan", "[]"))
      for (i in 0 until plan.length()) arm(ctx, plan.getJSONObject(i))
      prefs(ctx).edit().putString("error", "").apply()
    } catch (e: Exception) { prefs(ctx).edit().putString("error", e.message).apply() }
  }
  fun notification(ctx: Context, item: JSONObject, alarm: Boolean): Notification {
    channels(ctx)
    val channel = if (alarm) "qingri-alarm-v2" else if (item.optBoolean("sound", true)) "qingri-message-v2" else "qingri-silent-v2"
    val launch = PendingIntent.getActivity(ctx, 0, ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)!!, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = (if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, channel) else Notification.Builder(ctx).setPriority(Notification.PRIORITY_HIGH)
      .setSound(if (!alarm && item.optBoolean("sound", true)) android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION) else null))
      .setSmallIcon(android.R.drawable.ic_popup_reminder)
      .setContentTitle(item.optString("title", "日程提醒")).setContentText(item.optString("body", ""))
      .setStyle(Notification.BigTextStyle().bigText(item.optString("body", "")))
      .setContentIntent(launch).setCategory(if (alarm) Notification.CATEGORY_ALARM else Notification.CATEGORY_REMINDER)
      .setAutoCancel(!alarm).setOngoing(alarm).setVisibility(Notification.VISIBILITY_PUBLIC)
    if (alarm) {
      val stop = PendingIntent.getService(ctx, 1, Intent(ctx, AlarmService::class.java).setAction("stop"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      builder.addAction(Notification.Action.Builder(null, "停止闹铃", stop).build())
    }
    return builder.build()
  }
}

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val raw = intent.getStringExtra("item") ?: return
    try {
      val item = JSONObject(raw)
      Reminders.prefs(ctx).edit().putLong("lastFired", System.currentTimeMillis()).putString("error", "").apply()
      if (item.optString("mode") == "alarm") {
        try {
          val service = Intent(ctx, AlarmService::class.java).putExtra("item", raw)
          if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(service) else ctx.startService(service)
        }
        catch (e: Exception) {
          Reminders.notificationManager(ctx).notify(item.getString("id").hashCode(), Reminders.notification(ctx, item, false))
          Reminders.prefs(ctx).edit().putString("error", "闹铃启动失败：${e.message}").apply()
        }
      } else Reminders.notificationManager(ctx).notify(item.getString("id").hashCode(), Reminders.notification(ctx, item, false))
    } catch (e: Exception) { Reminders.prefs(ctx).edit().putString("error", e.message).apply() }
  }
}
class RestoreReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) { Reminders.restore(ctx) }
}
