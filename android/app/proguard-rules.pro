# Keep generated kotlinx serializers and the public DTO names they map to.
-keepattributes Signature,InnerClasses,EnclosingMethod,AnnotationDefault
-keepclassmembers class app.iwannalearn.android.network.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class app.iwannalearn.android.network.**$$serializer { *; }
-keepclassmembers class app.iwannalearn.android.network.** { *; }
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
