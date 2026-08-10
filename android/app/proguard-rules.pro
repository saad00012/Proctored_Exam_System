# Firebase
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.google.firebase.** { *; }
-keep class edu.dnyanshree.exam.** { *; }

# Kotlin Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}

# Compose
-dontwarn androidx.compose.**
