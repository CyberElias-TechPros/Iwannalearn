package app.iwannalearn.android.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import app.iwannalearn.android.appContainer
import app.iwannalearn.android.ui.LessonViewModel
import app.iwannalearn.android.ui.components.*
import app.iwannalearn.android.ui.levelLabel
import app.iwannalearn.android.ui.openWeb
import app.iwannalearn.android.ui.shareText

@Composable fun LessonScreen(slug: String, onBack: () -> Unit, onPlay: (String) -> Unit, onRequest: (String) -> Unit, vm: LessonViewModel = viewModel()) {
    val loaded by vm.data.collectAsStateWithLifecycle(); val loading by vm.loading.collectAsStateWithLifecycle(); val error by vm.error.collectAsStateWithLifecycle(); val cached by vm.cached.collectAsStateWithLifecycle(emptyList())
    val context = LocalContext.current
    LaunchedEffect(slug) { vm.load(slug) }
    val lesson = loaded ?: cached.find { it.slug == slug }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        ScreenTitle(lesson?.title ?: "A lesson for a real question", lesson?.category ?: "Made to answer a specific request.", onBack)
        if (error != null) ErrorState(if (lesson != null) "Showing saved lesson details. Connect to the server to play or refresh." else error!!, { vm.load(slug) })
        if (loading && lesson == null) LoadingState()
        if (lesson != null) {
            CategoryPoster(lesson.category, Modifier.fillMaxWidth().height(210.dp).clip(MaterialTheme.shapes.large))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { Pill("Free forever", "success"); Pill(levelLabel(lesson.level)); lesson.videoLength?.let { Pill(it) } }
            Text(lesson.goal, style = MaterialTheme.typography.bodyLarge)
            ActionButton(if (lesson.videoProvider == "youtube") "Watch this lesson" else "Play lesson", onClick = { onPlay(lesson.requestId) })
            if (lesson.videoProvider == "youtube") Text("YouTube opens in its Android app, or your browser if it isn't installed. The learning app itself never renders a WebView.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            OutlinedCard { Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { Text("A note from the creator", style = MaterialTheme.typography.titleMedium); Text(lesson.cameraMessage, style = MaterialTheme.typography.bodyMedium); Text("Made for ${lesson.ownerName ?: "a learner"} · ${lesson.upvoteCount} people wanted this", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
            if (lesson.resources.isNotEmpty()) { Text("Keep these handy", style = MaterialTheme.typography.titleLarge); lesson.resources.forEach { resource -> OutlinedButton(onClick = { runCatching { context.openWeb(resource.url) } }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Icon(Icons.Outlined.Link, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text(resource.label, modifier = Modifier.weight(1f)); Icon(Icons.Outlined.OpenInNew, null, Modifier.size(17.dp)) } } }
            OutlinedButton(onClick = { context.shareText("${lesson.title}\n${context.appContainer.server.value}/tutorials/${lesson.slug}") }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Icon(Icons.Outlined.Share, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text("Share this free lesson") }
            TextButton(onClick = { onRequest(lesson.slug) }, modifier = Modifier.fillMaxWidth()) { Text("See the request behind this lesson"); Icon(Icons.Outlined.ChevronRight, null, Modifier.size(18.dp)) }
        }
    }
}