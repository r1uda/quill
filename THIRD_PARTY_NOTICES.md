# 内置离线语音识别（0.1.4）

- sherpa-onnx 1.12.20，k2-fsa，Apache-2.0：https://github.com/k2-fsa/sherpa-onnx
- SenseVoiceSmall：FunAudioLLM / Alibaba / FunASR。使用官方 sherpa 转换模型 sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2025-09-09；未微调权重。
- 模型源：https://huggingface.co/FunAudioLLM/SenseVoiceSmall
- 模型许可为 FunASR Model Open Source License Agreement（独立于推理库的 Apache-2.0）；全文随 APK 放在 assets/licenses/SenseVoice-FunASR-MODEL-LICENSE.txt。
- 模型权重 SHA256：12ca1a2ae7ecf3e0019ef2822307ee0b5cadc9196569e379b4c4026f8205276d。
- ONNX Runtime：Microsoft，MIT；许可一并保留在 assets/licenses。
- 0.1.4 已从依赖和 APK 中移除 Vosk/JNA 与旧模型，旧模型仅保存在 work/runtime/sherpa/previous-vosk-model 以便本地 A/B 比较。

中文识别在安卓本机执行，录音仅在内存中处理，不保存录音文件，不上传录音，不需要语音 API 密钥。日程使用用户配置的 AI 时，用户确认后的转写文字仍会按原流程发给该 AI。

# 旧版 0.1.2 / 0.1.3 的离线识别（历史）

- Vosk Android 0.3.75，Alpha Cephei，Apache-2.0：https://github.com/alphacep/vosk-api
- 中文模型 vosk-model-small-cn-0.22，Apache-2.0：https://alphacephei.com/vosk/models
- 官方模型下载：https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip
- 原始 ZIP SHA256：3af8b0e7e0f835ae9d414ce5df580237a3cfb08d586c9fbbb0f7ff29ad5b14ba
- 模型完整许可随模型打包在 speech-cn/LICENSE。
- JNA 5.18.1，双许可 LGPL-2.1-or-later / Apache-2.0，此项目按 Apache-2.0 使用：https://github.com/java-native-access/jna

中文识别在安卓本机执行，录音仅在内存中处理，不保存录音文件，不上传录音，不需要语音 API 密钥。日程使用用户配置的 AI 时，转写文字仍会按原流程发给该 AI。
