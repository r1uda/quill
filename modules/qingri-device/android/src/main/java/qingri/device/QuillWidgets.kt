package qingri.device

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.util.TypedValue
import android.view.View
import android.net.Uri
import android.os.Bundle
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

open class QuillWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { ids.forEach { QuillWidgets.render(context, manager, it, javaClass.simpleName) } }
  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) { QuillWidgets.render(context, manager, id, javaClass.simpleName) }
  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action in listOf(Intent.ACTION_DATE_CHANGED, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED, Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED)) QuillWidgets.refresh(context)
  }
}
class QuillMonthWidget : QuillWidgetProvider()
class QuillTodayWidget : QuillWidgetProvider()
class QuillNextWidget : QuillWidgetProvider()
class QuillCompactWidget : QuillWidgetProvider()

object QuillWidgets {
  private val providers = arrayOf(QuillMonthWidget::class.java, QuillTodayWidget::class.java, QuillNextWidget::class.java, QuillCompactWidget::class.java)
  private fun prefs(ctx: Context) = ctx.getSharedPreferences("quill_widgets", Context.MODE_PRIVATE)
  fun pin(ctx: Context, size: String): Boolean {
    if (android.os.Build.VERSION.SDK_INT < 26) return false
    val provider = when (size) { "4x4" -> QuillMonthWidget::class.java; "4x2" -> QuillTodayWidget::class.java; "2x2" -> QuillNextWidget::class.java; "1x2" -> QuillCompactWidget::class.java; else -> throw IllegalArgumentException("未知的小组件尺寸") }
    val manager = AppWidgetManager.getInstance(ctx)
    return manager.isRequestPinAppWidgetSupported && manager.requestPinAppWidget(ComponentName(ctx, provider), null, null)
  }
  fun save(ctx: Context, json: String) {
    val data = JSONObject(json)
    require(data.optInt("version") == 1 && data.has("days")) { "小组件数据格式错误" }
    check(prefs(ctx).edit().putString("snapshot", json).commit()) { "小组件数据保存失败" }
    refresh(ctx)
  }
  fun refresh(ctx: Context) {
    val manager = AppWidgetManager.getInstance(ctx)
    providers.forEach { type -> manager.getAppWidgetIds(ComponentName(ctx, type)).forEach { render(ctx, manager, it, type.simpleName) } }
  }
  private fun action(ctx: Context, id: Int, route: String): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("quill://widget/$route"))
      .setClassName(ctx.packageName, "${ctx.packageName}.MainActivity")
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(ctx, id * 10 + if (route == "voice") 1 else 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
  fun render(ctx: Context, manager: AppWidgetManager, id: Int, type: String) {
    val month = type == "QuillMonthWidget"
    val wide = type == "QuillTodayWidget"
    val slim = type == "QuillCompactWidget"
    val layout = if (month) R.layout.quill_widget_month else if (wide) R.layout.quill_widget_today else if (slim) R.layout.quill_widget_compact else R.layout.quill_widget_next
    val views = RemoteViews(ctx.packageName, layout)
    val data = try { JSONObject(prefs(ctx).getString("snapshot", "{}") ?: "{}") } catch (_: Exception) { JSONObject() }
    val purple = data.optString("accent") == "purple"
    val accent = Color.parseColor(if (purple) "#9B83CA" else "#7389D9")
    val ink = Color.rgb(43, 47, 67); val muted = Color.rgb(143, 148, 169)
    fun text(view: Int, value: String, color: Int = ink) { views.setTextViewText(view, value); views.setTextColor(view, color) }
    val today = Calendar.getInstance()
    val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    val key = formatter.format(today.time)
    val days = data.optJSONObject("days") ?: JSONObject()
    val rows = days.optJSONArray(key)
    val week = arrayOf("日", "一", "二", "三", "四", "五", "六")[today.get(Calendar.DAY_OF_WEEK) - 1]
    val hour = SimpleDateFormat("HH:mm", Locale.US).format(today.time)
    val all = (0 until (rows?.length() ?: 0)).mapNotNull { rows?.optJSONObject(it) }
    val future = all.filter { it.optString("time") == "全天" || it.optString("time") >= hour }
    var next = future.firstOrNull()
    var nextDay = ""
    var nextDate = today.clone() as Calendar
    if (next == null) {
      val upcoming = today.clone() as Calendar
      for (n in 1..60) {
        upcoming.add(Calendar.DAY_OF_MONTH, 1)
        val dayRows = days.optJSONArray(formatter.format(upcoming.time))
        if (dayRows != null && dayRows.length() > 0) { next = dayRows.optJSONObject(0); nextDate = upcoming.clone() as Calendar; nextDay = if (n == 1) "明天" else "${upcoming.get(Calendar.MONTH) + 1}/${upcoming.get(Calendar.DAY_OF_MONTH)}"; break }
      }
    }
    fun agenda(items: List<JSONObject>) {
      views.removeAllViews(R.id.widget_agenda)
      if (items.isEmpty()) {
        val row = RemoteViews(ctx.packageName, R.layout.quill_widget_agenda_row)
        row.setTextViewText(R.id.widget_time, "")
        row.setTextViewText(R.id.widget_dot, "")
        row.setTextViewText(R.id.widget_title, if (data.has("days")) "今天留一点空白" else "打开 quill 同步")
        row.setTextColor(R.id.widget_title, muted)
        views.addView(R.id.widget_agenda, row)
      }
      items.take(2).forEachIndexed { i, e ->
        val row = RemoteViews(ctx.packageName, R.layout.quill_widget_agenda_row)
        row.setTextViewText(R.id.widget_time, e.optString("time"))
        row.setTextViewText(R.id.widget_title, e.optString("title"))
        row.setTextColor(R.id.widget_dot, if (i == 0) accent else Color.rgb(139, 175, 239))
        views.addView(R.id.widget_agenda, row)
      }
    }
    if (month) {
      text(R.id.widget_heading, "${today.get(Calendar.YEAR)}年${today.get(Calendar.MONTH) + 1}月")
      text(R.id.widget_today_label, "今天 · ${all.size}项安排")
      views.removeAllViews(R.id.widget_grid)
      val calendar = today.clone() as Calendar
      calendar.set(Calendar.DAY_OF_MONTH, 1)
      val offset = (calendar.get(Calendar.DAY_OF_WEEK) + 5) % 7
      val count = ((offset + calendar.getActualMaximum(Calendar.DAY_OF_MONTH) + 6) / 7) * 7
      val ids = intArrayOf(R.id.quill_day0, R.id.quill_day1, R.id.quill_day2, R.id.quill_day3, R.id.quill_day4, R.id.quill_day5, R.id.quill_day6)
      val weekdays = intArrayOf(R.id.weekday_0,R.id.weekday_1,R.id.weekday_2,R.id.weekday_3,R.id.weekday_4,R.id.weekday_5,R.id.weekday_6)
      weekdays.forEach { views.setTextColor(it, muted) }
      calendar.add(Calendar.DAY_OF_MONTH, -offset)
      for (r in 0 until count / 7) {
        val row = RemoteViews(ctx.packageName, R.layout.quill_widget_week)
        for (c in 0..6) {
          val k = formatter.format(calendar.time)
          val selected = key == k
          val hasEvent = (days.optJSONArray(k)?.length() ?: 0) > 0
          row.setTextViewText(ids[c], calendar.get(Calendar.DAY_OF_MONTH).toString() + if (hasEvent && !selected) "·" else "")
          row.setTextColor(ids[c], if (selected) Color.WHITE else if (calendar.get(Calendar.MONTH) == today.get(Calendar.MONTH)) ink else muted)
          row.setInt(ids[c], "setBackgroundResource", if (selected) if (purple) R.drawable.quill_widget_selected_bg else R.drawable.quill_widget_selected_blue_bg else android.R.color.transparent)
          calendar.add(Calendar.DAY_OF_MONTH, 1)
        }
        views.addView(R.id.widget_grid, row)
      }
      agenda(all)
      val occasions = data.optJSONArray("occasions")
      val special = (0 until (occasions?.length() ?: 0)).mapNotNull { occasions?.optJSONObject(it) }.firstOrNull { it.optString("date") >= key }
      text(R.id.widget_footer, special?.let { "${it.optString("date").substring(5).replace('-', '/')}  ${it.optString("title")}" } ?: "把每一天，慢慢安排好", accent)
    } else if (wide) {
      text(R.id.widget_kicker, "quill", accent)
      text(R.id.widget_date, today.get(Calendar.DAY_OF_MONTH).toString())
      text(R.id.widget_date_label, "${today.get(Calendar.MONTH) + 1}月 周$week", muted)
      agenda(future)
      text(R.id.widget_footer, "今天还有 ${future.size} 项安排", accent)
    } else {
      text(R.id.widget_kicker, if (slim) if (nextDay.isEmpty()) "周$week" else nextDay else if (nextDay.isEmpty()) "下一件事" else "下一件事 · $nextDay", muted)
      text(R.id.widget_time, next?.optString("time") ?: "今天", if (slim) accent else ink)
      text(R.id.widget_title, next?.optString("title") ?: if (data.has("days")) "暂无安排" else "打开同步")
      if (slim) text(R.id.widget_date, nextDate.get(Calendar.DAY_OF_MONTH).toString())
      else text(R.id.widget_location, next?.optString("location") ?: "", muted)
    }
    views.setOnClickPendingIntent(R.id.quill_widget_root, action(ctx, id, if (month) "calendar" else "agenda"))
    views.setOnClickPendingIntent(R.id.quill_widget_add, action(ctx, id, "quick"))
    manager.updateAppWidget(id, views)
  }
}
