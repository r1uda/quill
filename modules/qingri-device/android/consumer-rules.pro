# JNA uses reflection to bind exported native symbols. Based on the official
# Vosk Android demo's ProGuard rules; desktop-only AWT is never used on Android.
-keep class com.sun.jna.** { *; }
-keepclassmembers class * extends com.sun.jna.* { public *; }
-keep class org.vosk.** { *; }
-dontwarn java.awt.**
-keep class com.k2fsa.sherpa.onnx.** { *; }
