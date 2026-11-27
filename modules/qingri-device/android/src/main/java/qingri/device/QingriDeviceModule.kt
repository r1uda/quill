package qingri.device

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineSenseVoiceModelConfig
import java.util.concurrent.atomic.AtomicBoolean

class QingriDeviceModule : Module() {
  private var model: OfflineRecognizer? = null
  private val modelLock = Any()
  private data class Capture(val id: String, val stop: AtomicBoolean = AtomicBoolean(false), val cancel: AtomicBoolean = AtomicBoolean(false))
  @Volatile private var capture: Capture? = null
  private val context get() = appContext.reactContext ?: throw IllegalStateException("应用尚未准备好")

  private fun getModel(): OfflineRecognizer = synchronized(modelLock) {
    model?.let { return@synchronized it }
    OfflineRecognizer(context.assets, OfflineRecognizerConfig(modelConfig = OfflineModelConfig(
      senseVoice = OfflineSenseVoiceModelConfig(model = "sensevoice-20250909/model.int8.onnx", language = "zh", useInverseTextNormalization = true),
      tokens = "sensevoice-20250909/tokens.txt", numThreads = 2, provider = "cpu", debug = false,
    ))).also { model = it }
  }

  override fun definition() = ModuleDefinition {
    Name("QingriDevice")
    Events("speech")
    AsyncFunction("prepareSpeech") { getModel(); true }
    AsyncFunction("updateWidgets") { json: String -> QuillWidgets.save(context, json) }
    AsyncFunction("pinWidget") { size: String -> QuillWidgets.pin(context, size) }
    Function("startSpeech") { id: String ->
      check(capture == null) { "麦克风仍在结束上一次录音，请稍后再试" }
      val session = Capture(id)
      capture = session
      Thread({ record(session) }, "qingri-offline-speech").start()
    }
    Function("stopSpeech") { id: String -> capture?.takeIf { it.id == id }?.stop?.set(true) }
    Function("cancelSpeech") { id: String -> capture?.takeIf { it.id == id }?.let { it.cancel.set(true); it.stop.set(true) } }
    AsyncFunction("reminderStatus") { Reminders.status(context) }
    AsyncFunction("scheduleReminders") { json: String -> Reminders.replace(context, json) }
    AsyncFunction("testReminder") { mode: String -> Reminders.test(context, mode) }
    Function("openAlarmSettings") { Reminders.openAlarmSettings(context) }
    Function("openNotificationSettings") { Reminders.openNotificationSettings(context) }
    Function("stopAlarm") { context.stopService(android.content.Intent(context, AlarmService::class.java)) }
    OnDestroy { capture?.let { it.cancel.set(true); it.stop.set(true) } }
  }

  private fun record(session: Capture) {
    var recorder: AudioRecord? = null
    fun emit(type: String, text: String = "") {
      if (!session.cancel.get()) sendEvent("speech", mapOf("id" to session.id, "type" to type, "text" to text))
    }
    try {
      val loaded = getModel()
      if (session.stop.get()) return
      val bufferSize = maxOf(6400, AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT))
      recorder = AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufferSize)
      check(recorder.state == AudioRecord.STATE_INITIALIZED) { "麦克风初始化失败，可能被其他应用占用" }
      recorder.startRecording()
      check(recorder.recordingState == AudioRecord.RECORDSTATE_RECORDING) { "麦克风未能开始录音，请检查手机麦克风权限" }
      emit("start")
      val buffer = ShortArray(1600)
      // Preview the growing utterance without blocking microphone capture.
      // The final pass still recognizes the entire recording after release.
      val samples = ArrayList<Float>(16000 * 15)
      fun recognize(audio: FloatArray): String = synchronized(modelLock) {
        val peak = audio.maxOfOrNull { kotlin.math.abs(it) } ?: 0f
        if (peak <= 0.003f) return@synchronized ""
        val gain = if (peak < 0.2f) minOf(3f, 0.2f / peak) else 1f
        val stream = loaded.createStream()
        try {
          stream.acceptWaveform(FloatArray(audio.size) { audio[it] * gain }, 16000)
          loaded.decode(stream)
          loaded.getResult(stream).text.replace(Regex("<\\|[^|]*\\|>"), "").trim()
        } finally { stream.release() }
      }
      var preview: Thread? = null
      var previewSamples = 0
      val deadline = android.os.SystemClock.elapsedRealtime() + 45000
      var tailUntil = Long.MAX_VALUE
      while (!session.cancel.get() && android.os.SystemClock.elapsedRealtime() < deadline) {
        if (session.stop.get() && tailUntil == Long.MAX_VALUE) tailUntil = android.os.SystemClock.elapsedRealtime() + 180
        if (android.os.SystemClock.elapsedRealtime() >= tailUntil) break
        val n = recorder.read(buffer, 0, buffer.size)
        check(n >= 0) { "麦克风读取失败，请重新长按" }
        if (n == 0) continue
        for (i in 0 until n) samples.add(buffer[i] / 32768f)
        if (!session.stop.get() && samples.size - previewSamples >= 16000 && preview?.isAlive != true) {
          previewSamples = samples.size
          val snapshot = samples.toFloatArray()
          preview = Thread({
            try {
              val text = recognize(snapshot)
              if (!session.stop.get() && !session.cancel.get() && text.isNotBlank()) emit("text", text)
            } catch (_: Exception) { /* Final recognition reports errors. */ }
          }, "quill-speech-preview").also { it.start() }
        }
      }
      session.stop.set(true)
      recorder.stop()
      if (session.cancel.get()) return
      val peak = samples.maxOfOrNull { kotlin.math.abs(it) } ?: 0f
      check(samples.size >= 4800 && peak > 0.003f) { "声音太短或太轻，请等麦克风准备好后重新说一句。" }
      val result = recognize(samples.toFloatArray())
      emit("text", result)
      if (result.isBlank()) emit("error", "没有听清内容，请靠近手机重新长按说话。")
    } catch (e: Throwable) {
      emit("error", e.message ?: "离线语音识别失败，请重新长按。")
    } finally {
      try { recorder?.release() } catch (_: Exception) {}
      if (capture === session) capture = null
      emit("end")
    }
  }
}
