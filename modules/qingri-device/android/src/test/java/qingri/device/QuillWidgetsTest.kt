package qingri.device

import android.appwidget.AppWidgetManager
import android.content.Context
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import android.graphics.drawable.BitmapDrawable
import android.os.Bundle
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Typeface
import android.view.View
import android.view.ViewGroup
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class QuillWidgetsTest {
  @Test fun compactFutureDateMatchesItsTomorrowLabel() {
    val ctx=RuntimeEnvironment.getApplication() as Context
    val tomorrow=java.util.Calendar.getInstance().apply { add(java.util.Calendar.DAY_OF_MONTH,1) }
    val key=SimpleDateFormat("yyyy-MM-dd",Locale.US).format(tomorrow.time)
    QuillWidgets.save(ctx,"""{"version":1,"days":{"$key":[{"title":"明日讨论","time":"09:00"}]},"occasions":[]}""")
    val shadow=shadowOf(AppWidgetManager.getInstance(ctx))
    val id=shadow.createWidget(QuillCompactWidget::class.java,R.layout.quill_widget_compact)
    val view=shadow.getViewFor(id)
    assertEquals("明天",view.findViewById<TextView>(R.id.widget_kicker).text.toString())
    assertEquals(tomorrow.get(java.util.Calendar.DAY_OF_MONTH).toString(),view.findViewById<TextView>(R.id.widget_date).text.toString())
  }
  @Test @GraphicsMode(GraphicsMode.Mode.NATIVE) @Config(qualifiers = "zh-rCN-xxhdpi")
  fun renderNativeWidgetPreviews() {
    val ctx = RuntimeEnvironment.getApplication() as Context
    val manager = AppWidgetManager.getInstance(ctx)
    val shadow = shadowOf(manager)
    val key = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
    QuillWidgets.save(ctx, """{"version":1,"accent":"purple","days":{"$key":[{"title":"小组讨论","time":"14:00","location":"创新工坊"},{"title":"取快递","time":"18:30","location":"驿站"}]},"occasions":[{"title":"妈妈生日","date":"$key"}]}""")
    val cases = listOf(Triple(QuillMonthWidget::class.java, R.layout.quill_widget_month, Pair(360,360)), Triple(QuillTodayWidget::class.java,R.layout.quill_widget_today,Pair(360,176)), Triple(QuillNextWidget::class.java,R.layout.quill_widget_next,Pair(176,176)), Triple(QuillCompactWidget::class.java,R.layout.quill_widget_compact,Pair(84,176)))
    val font = File("C:/Windows/Fonts/msyh.ttc")
    fun fonts(v: View) {
      if (v is TextView && font.exists()) v.typeface = Typeface.create(Typeface.createFromFile(font), if (v.typeface?.isBold == true) Typeface.BOLD else Typeface.NORMAL)
      if (v is ViewGroup) for (i in 0 until v.childCount) fonts(v.getChildAt(i))
    }
    for ((i, spec) in cases.withIndex()) {
      val id = shadow.createWidget(spec.first, spec.second)
      manager.updateAppWidgetOptions(id, Bundle().apply { putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,spec.third.first);putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT,spec.third.second) })
      val v=shadow.getViewFor(id);fonts(v)
      val density=ctx.resources.displayMetrics.density
      val w=(spec.third.first*density).toInt();val h=(spec.third.second*density).toInt()
      v.measure(View.MeasureSpec.makeMeasureSpec(w,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(h,View.MeasureSpec.EXACTLY));v.layout(0,0,w,h)
      val image=Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888);v.draw(Canvas(image))
      val output=File("../../../outputs/widgets-0.1.5/native-$i.png").canonicalFile
      output.parentFile.mkdirs();output.outputStream().use { image.compress(Bitmap.CompressFormat.PNG,100,it) }
      assertTrue(v.findViewById<ImageButton>(R.id.quill_widget_add).width>0)
    }
  }
  @Test fun pinningReportsLauncherSupportAndIncludesAllFourSizes() {
    val ctx = RuntimeEnvironment.getApplication() as Context
    val shadow = shadowOf(AppWidgetManager.getInstance(ctx))
    shadow.setRequestPinAppWidgetSupported(false)
    assertFalse(QuillWidgets.pin(ctx, "1x2"))
    shadow.setRequestPinAppWidgetSupported(true)
    for (size in listOf("4x4", "4x2", "2x2", "1x2")) assertTrue(QuillWidgets.pin(ctx, size))
    try { QuillWidgets.pin(ctx, "3x3"); fail("invalid size accepted") } catch (_: IllegalArgumentException) { }
  }
  @Test fun allSizesUseNativeTextAndPlusOpensQuickAdd() {
    val ctx = RuntimeEnvironment.getApplication() as Context
    val manager = AppWidgetManager.getInstance(ctx)
    val shadow = shadowOf(manager)
    val classes = arrayOf(QuillMonthWidget::class.java, QuillTodayWidget::class.java, QuillNextWidget::class.java, QuillCompactWidget::class.java)
    for ((i, type) in classes.withIndex()) {
      val layouts = intArrayOf(R.layout.quill_widget_month, R.layout.quill_widget_today, R.layout.quill_widget_next, R.layout.quill_widget_compact)
      val id = shadow.createWidget(type, layouts[i])
      manager.updateAppWidgetOptions(id, Bundle().apply {
        putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, if (i < 2) 320 else if (i == 2) 155 else 70)
        putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, if (i == 0) 340 else 155)
      })
      val view = shadow.getViewFor(id)
      assertTrue(view.findViewById<TextView>(if (i == 0) R.id.widget_heading else R.id.widget_kicker).text.isNotEmpty())
      assertTrue(view.findViewById<ImageButton>(R.id.quill_widget_add).performClick())
      assertEquals("quill://widget/quick", shadowOf(RuntimeEnvironment.getApplication()).nextStartedActivity.data.toString())
    }
  }
  @Test fun cacheReplacementAlsoRefreshesExistingWidgetAndRejectsInvalidData() {
    val ctx = RuntimeEnvironment.getApplication() as Context
    val shadow = shadowOf(AppWidgetManager.getInstance(ctx))
    val id = shadow.createWidget(QuillTodayWidget::class.java, R.layout.quill_widget_today)
    QuillWidgets.save(ctx, """{"version":1,"days":{},"occasions":[]}""")
    assertNotNull(shadow.getViewFor(id))
    assertEquals(1, JSONObject(ctx.getSharedPreferences("quill_widgets", Context.MODE_PRIVATE).getString("snapshot", "")!!).getInt("version"))
    try { QuillWidgets.save(ctx, "{}"); fail("invalid cache accepted") } catch (_: IllegalArgumentException) { }
  }
}
