package app.iwannalearn.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.iwannalearn.android.ui.statusLabel

@Composable fun LoadingState(label: String = "Getting things ready…") {
    Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        CircularProgressIndicator(modifier = Modifier.size(30.dp), strokeWidth = 3.dp)
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
@Composable fun ErrorState(message: String, retry: (() -> Unit)? = null) {
    Surface(color = MaterialTheme.colorScheme.errorContainer, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Outlined.CloudOff, null, tint = MaterialTheme.colorScheme.onErrorContainer)
                Text("A small pause", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onErrorContainer)
            }
            Text(message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onErrorContainer)
            if (retry != null) TextButton(onClick = retry) { Icon(Icons.Outlined.Refresh, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("Try again") }
        }
    }
}
@Composable fun EmptyState(title: String, detail: String, action: String? = null, onAction: (() -> Unit)? = null) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 30.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = CircleShape) { Icon(Icons.Outlined.AutoStories, null, Modifier.padding(16.dp).size(28.dp), tint = MaterialTheme.colorScheme.primary) }
        Text(title, style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
        Text(detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        if (action != null && onAction != null) Button(onClick = onAction, modifier = Modifier.heightIn(min = 48.dp)) { Text(action) }
    }
}
@Composable fun ScreenTitle(title: String, subtitle: String? = null, back: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        if (back != null) IconButton(onClick = back, modifier = Modifier.padding(end = 4.dp)) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Go back") }
        Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text(title, style = MaterialTheme.typography.headlineMedium)
            if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
@Composable fun SectionTitle(title: String, action: String? = null, onAction: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
        Text(title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
        if (action != null && onAction != null) TextButton(onClick = onAction) { Text(action); Icon(Icons.Outlined.ChevronRight, null, Modifier.size(18.dp)) }
    }
}
@Composable fun Pill(text: String, tone: String = "neutral", icon: androidx.compose.ui.graphics.vector.ImageVector? = null) {
    val container = when (tone) { "success" -> MaterialTheme.colorScheme.primaryContainer; "warn" -> MaterialTheme.colorScheme.secondaryContainer; "danger" -> MaterialTheme.colorScheme.errorContainer; else -> MaterialTheme.colorScheme.surfaceVariant }
    val foreground = when (tone) { "success" -> MaterialTheme.colorScheme.onPrimaryContainer; "warn" -> MaterialTheme.colorScheme.onSecondaryContainer; "danger" -> MaterialTheme.colorScheme.onErrorContainer; else -> MaterialTheme.colorScheme.onSurfaceVariant }
    Surface(color = container, contentColor = foreground, shape = RoundedCornerShape(50)) {
        Row(Modifier.padding(horizontal = 10.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            if (icon != null) Icon(icon, null, Modifier.size(12.dp))
            Text(text, style = MaterialTheme.typography.labelSmall)
        }
    }
}
@Composable fun StatusPill(status: String) = Pill(statusLabel(status).label, when (status) { "fulfilled" -> "success"; "waitlisted" -> "warn"; "declined" -> "danger"; else -> "neutral" })
@Composable fun InfoBox(text: String, warning: Boolean = false) {
    Surface(color = if (warning) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.primaryContainer, shape = MaterialTheme.shapes.medium) {
        Row(Modifier.padding(15.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(if (warning) Icons.Outlined.Info else Icons.Outlined.Shield, null, Modifier.size(20.dp))
            Text(text, style = MaterialTheme.typography.bodyMedium)
        }
    }
}
@Composable fun ActionButton(text: String, busy: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    Button(onClick = onClick, enabled = enabled && !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
        if (busy) { CircularProgressIndicator(Modifier.size(19.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary); Spacer(Modifier.width(10.dp)); Text("Working…") }
        else Text(text)
    }
}
@Composable fun ConfirmDialog(title: String, text: String, confirm: String, dismiss: () -> Unit, onConfirm: () -> Unit) {
    AlertDialog(onDismissRequest = dismiss, title = { Text(title) }, text = { Text(text) },
        confirmButton = { TextButton(onClick = onConfirm) { Text(confirm) } },
        dismissButton = { TextButton(onClick = dismiss) { Text("Keep it") } })
}
@Composable fun Metric(value: String, label: String, modifier: Modifier = Modifier) {
    Surface(modifier = modifier, color = MaterialTheme.colorScheme.surface, shape = MaterialTheme.shapes.medium, border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(value, style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary)
            Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
fun categoryColors(category: String): Pair<Color, Color> = when (category) {
    "Spreadsheets" -> Color(0xFFE3F0E3) to Color(0xFF24633D)
    "Data & Python" -> Color(0xFFE4EAF7) to Color(0xFF2C4479)
    "Design & Canva" -> Color(0xFFF9E9D6) to Color(0xFF8A4E1C)
    "Web development" -> Color(0xFFF2E6F2) to Color(0xFF69356B)
    "Video & content" -> Color(0xFFE6EEF3) to Color(0xFF2A566E)
    "Marketing & social" -> Color(0xFFFBEBDD) to Color(0xFF8C4A16)
    "Career & productivity" -> Color(0xFFECEAF7) to Color(0xFF463D86)
    else -> Color(0xFFE7EEE9) to Color(0xFF1F5B45)
}
fun categoryGlyph(category: String): String = when (category) { "Spreadsheets" -> "⊞"; "Data & Python" -> "λ"; "Design & Canva" -> "Aa"; "Web development" -> "</>"; "Video & content" -> "▶"; "Marketing & social" -> "#"; "Career & productivity" -> "◎"; else -> "✦" }
@Composable fun CategoryPoster(category: String, modifier: Modifier = Modifier, compact: Boolean = false) {
    val (background, foreground) = categoryColors(category)
    Box(modifier.background(Brush.linearGradient(listOf(background, background.copy(alpha = .72f)))), contentAlignment = Alignment.Center) {
        Text(categoryGlyph(category), style = if (compact) MaterialTheme.typography.headlineLarge else MaterialTheme.typography.displayLarge, color = foreground, modifier = Modifier.semantics { contentDescription = category })
        if (!compact) Icon(Icons.Outlined.PlayCircleOutline, null, Modifier.align(Alignment.BottomEnd).padding(14.dp).size(30.dp), tint = foreground.copy(alpha = .7f))
    }
}
