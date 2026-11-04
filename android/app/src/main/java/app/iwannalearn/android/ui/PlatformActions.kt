package app.iwannalearn.android.ui

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.content.FileProvider
import java.io.File

fun Context.findActivity(): Activity? = when (this) { is Activity -> this; is ContextWrapper -> baseContext.findActivity(); else -> null }
fun Context.openWeb(url: String) {
    val uri = Uri.parse(url)
    require(uri.scheme == "https" || uri.scheme == "http") { "This link can't be opened safely." }
    runCatching { CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(this, uri) }
        .recoverCatching { startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        .onFailure { throw IllegalArgumentException("No browser is available to open this link.") }
}
fun Context.openYouTube(id: String) {
    val appIntent = Intent(Intent.ACTION_VIEW, Uri.parse("vnd.youtube:$id")).setPackage("com.google.android.youtube")
    runCatching { startActivity(appIntent) }.onFailure { openWeb("https://www.youtube.com/watch?v=$id") }
}
fun Context.openAttachment(file: File, mime: String) {
    val uri = FileProvider.getUriForFile(this, "$packageName.files", file)
    val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    try { startActivity(intent) } catch (_: ActivityNotFoundException) { throw IllegalArgumentException("No installed app can open this file type.") }
}
fun Context.shareText(text: String) {
    val intent = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
    startActivity(Intent.createChooser(intent, "Share a lesson"))
}
