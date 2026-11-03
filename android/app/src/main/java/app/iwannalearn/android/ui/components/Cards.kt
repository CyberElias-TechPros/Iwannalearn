package app.iwannalearn.android.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.iwannalearn.android.network.LessonItem
import app.iwannalearn.android.network.RequestItem
import app.iwannalearn.android.ui.levelLabel
import app.iwannalearn.android.ui.openStatuses

@Composable fun RequestCard(item: RequestItem, onClick: () -> Unit, onVote: (() -> Unit)? = null) {
    OutlinedCard(onClick = onClick, shape = MaterialTheme.shapes.large, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                StatusPill(item.status)
                if (item.visibility == "private") Pill("Private", icon = Icons.Outlined.Lock)
                else if (item.tier != "community") Pill(item.tier.replaceFirstChar(Char::uppercase), "warn")
                Spacer(Modifier.weight(1f))
                Text(item.ref, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(item.title, style = MaterialTheme.typography.titleMedium, maxLines = 3, overflow = TextOverflow.Ellipsis)
            Text(item.goal, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                Text(item.category, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                Text("·", color = MaterialTheme.colorScheme.outline)
                Text(levelLabel(item.level), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.weight(1f))
                if (onVote != null && item.visibility == "public" && item.status in openStatuses) {
                    Surface(onClick = onVote, shape = MaterialTheme.shapes.small, color = if (item.viewerUpvoted) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant, modifier = Modifier.heightIn(min = 48.dp)) {
                        Row(Modifier.padding(horizontal = 11.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                            Icon(if (item.viewerUpvoted) Icons.Outlined.ThumbUp else Icons.Outlined.ThumbUpOffAlt, if (item.viewerUpvoted) "Remove your vote" else "Back this request", Modifier.size(17.dp))
                            Text(item.upvoteCount.toString(), style = MaterialTheme.typography.labelLarge)
                        }
                    }
                } else if (item.hasLesson) Icon(Icons.Outlined.PlayCircle, "Lesson available", Modifier.size(23.dp), tint = MaterialTheme.colorScheme.primary)
                else { Icon(Icons.Outlined.ThumbUpOffAlt, null, Modifier.size(15.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant); Text(item.upvoteCount.toString(), style = MaterialTheme.typography.labelMedium) }
            }
        }
    }
}
@Composable fun LessonCard(item: LessonItem, onClick: () -> Unit, wide: Boolean = false) {
    OutlinedCard(onClick = onClick, shape = MaterialTheme.shapes.large, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), modifier = if (wide) Modifier.fillMaxWidth() else Modifier.width(265.dp)) {
        Column {
            CategoryPoster(item.category, Modifier.fillMaxWidth().height(if (wide) 170.dp else 132.dp))
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(item.category, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary, modifier = Modifier.weight(1f))
                    if (item.videoLength != null) Text(item.videoLength, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(item.title, style = MaterialTheme.typography.titleMedium, minLines = 2, maxLines = 3, overflow = TextOverflow.Ellipsis)
                Text(levelLabel(item.level), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
