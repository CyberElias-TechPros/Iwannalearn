package app.iwannalearn.android.ui

import java.text.NumberFormat
import java.time.Duration
import java.time.Instant
import java.util.Locale

data class StatusLabel(val label: String, val detail: String, val step: Int)
fun statusLabel(status: String): StatusLabel = when (status) {
    "submitted" -> StatusLabel("Received", "Your request is in the queue for a first look.", 1)
    "under_review" -> StatusLabel("Being checked", "We're checking that the lesson fits what you asked.", 2)
    "planned" -> StatusLabel("Scheduled", "It has a filming slot. We'll tell you when it's ready.", 3)
    "in_production" -> StatusLabel("Being filmed", "Your lesson is being recorded.", 4)
    "waitlisted" -> StatusLabel("On the waitlist", "Your place is safe. It moves up when a filming slot opens.", 2)
    "fulfilled" -> StatusLabel("Lesson ready", "Your next little win is ready to watch.", 5)
    "declined" -> StatusLabel("Not this time", "The reason is on your request. You can ask again.", 0)
    else -> StatusLabel(status, "", 0)
}
val statusKeys = listOf("submitted", "under_review", "planned", "in_production", "waitlisted", "fulfilled", "declined")
val openStatuses = setOf("submitted", "under_review", "planned", "in_production", "waitlisted")
fun money(kobo: Long): String = NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-NG")).apply { currency = java.util.Currency.getInstance("NGN"); maximumFractionDigits = 0 }.format(kobo / 100.0)
fun levelLabel(level: String) = when (level) { "some" -> "Know some basics"; "confident" -> "Confident"; else -> "New to this" }
fun relativeDate(iso: String): String = runCatching {
    val minutes = Duration.between(Instant.parse(iso), Instant.now()).toMinutes().coerceAtLeast(0)
    when { minutes < 1 -> "Just now"; minutes < 60 -> "${minutes}m ago"; minutes < 1440 -> "${minutes / 60}h ago"; minutes < 43200 -> "${minutes / 1440}d ago"; else -> iso.take(10) }
}.getOrDefault("")
fun fileSize(bytes: Long): String = if (bytes < 1_048_576) "${(bytes / 1024).coerceAtLeast(1)} KB" else String.format(Locale.US, "%.1f MB", bytes / 1_048_576.0)
