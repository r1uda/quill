import ExpoModulesCore
import Vision
import UIKit
import ImageIO

public class QingriOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("QingriOcr")
    AsyncFunction("recognize") { (uri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        guard let url = URL(string: uri),
              let image = UIImage(contentsOfFile: url.path),
              let cgImage = image.cgImage else {
          promise.reject("IMAGE_FAILED", "无法读取这张图片")
          return
        }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"]
        request.usesLanguageCorrection = true
        let orientation: CGImagePropertyOrientation
        switch image.imageOrientation {
        case .up: orientation = .up
        case .down: orientation = .down
        case .left: orientation = .left
        case .right: orientation = .right
        case .upMirrored: orientation = .upMirrored
        case .downMirrored: orientation = .downMirrored
        case .leftMirrored: orientation = .leftMirrored
        case .rightMirrored: orientation = .rightMirrored
        @unknown default: orientation = .up
        }
        do {
          try VNImageRequestHandler(cgImage: cgImage, orientation: orientation).perform([request])
          let text = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
          promise.resolve(text)
        } catch {
          promise.reject("OCR_FAILED", error.localizedDescription)
        }
      }
    }
  }
}
