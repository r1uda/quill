package qingri.ocr

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class QingriOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("QingriOcr")
    AsyncFunction("recognize") { uri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("NO_CONTEXT", "无法打开图片识别环境", null)
        return@AsyncFunction
      }
      val recognizer = TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build())
      try {
        val image = InputImage.fromFilePath(context, Uri.parse(uri))
        recognizer.process(image)
          .addOnSuccessListener { result ->
            promise.resolve(result.text)
            recognizer.close()
          }
          .addOnFailureListener { error ->
            promise.reject("OCR_FAILED", error.message, error)
            recognizer.close()
          }
      } catch (error: Exception) {
        recognizer.close()
        promise.reject("IMAGE_FAILED", "无法读取这张图片", error)
      }
    }
  }
}
