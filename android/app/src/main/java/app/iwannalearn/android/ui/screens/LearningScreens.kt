package app.iwannalearn.android.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import app.iwannalearn.android.network.RequestItem
import app.iwannalearn.android.ui.*
import app.iwannalearn.android.ui.components.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun DashboardScreen(signedIn: Boolean, onLogin: () -> Unit, onCreate: () -> Unit, onRequest: (String) -> Unit, vm: DashboardViewModel = viewModel()) {
    val data by vm.data.collectAsStateWithLifecycle(); val loading by vm.loading.collectAsStateWithLifecycle(); val error by vm.error.collectAsStateWithLifecycle()
    LaunchedEffect(signedIn) { if (signedIn) vm.load() }
    if (!signedIn) { Box(Modifier.fillMaxSize().padding(20.dp), contentAlignment = Alignment.Center) { EmptyState("Your next little win, kept together.", "Sign in to follow your requests, open private lessons and see what's ready for you.", "Sign in", onLogin) }; return }
    PullToRefreshBox(isRefreshing = loading, onRefresh = vm::load) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item { ScreenTitle("My learning", "A clear view of what's ready, what's coming, and what needs you.") }
            if (error != null) item { ErrorState(error!!, vm::load) }
            if (loading && data.requests.isEmpty()) item { LoadingState() }
            val ready = data.requests.filter { it.status == "fulfilled" }
            val waiting = data.requests.filter { it.status != "fulfilled" && it.status != "declined" && (it.paymentStatus == "pending" || it.tier != "community" && it.priceKobo != null) }
            val progress = data.requests.filter { it.status in openStatuses && it !in waiting }
            val closed = data.requests.filter { it.status == "declined" }
            if (ready.isNotEmpty()) { item { SectionTitle("Ready to watch", "${ready.size} lessons") }; items(ready, key = { "ready-${it.id}" }) { RequestCard(it, onClick = { onRequest(it.slug) }) } }
            if (waiting.isNotEmpty()) { item { SectionTitle("Waiting on you", "Agree a quote or complete checkout") }; items(waiting, key = { "waiting-${it.id}" }) { RequestCard(it, onClick = { onRequest(it.slug) }) } }
            item { SectionTitle("In the works", action = "Ask something new", onAction = onCreate) }
            if (progress.isEmpty()) item { EmptyState("Make room for a new skill.", "Describe one thing you want to do better. We'll help you find it — or make it.", "Ask for a lesson", onCreate) }
            else items(progress, key = { it.id }) { Column(verticalArrangement = Arrangement.spacedBy(7.dp)) { RequestCard(it, onClick = { onRequest(it.slug) }); LinearProgressIndicator(progress = { statusLabel(it.status).step / 5f }, modifier = Modifier.fillMaxWidth().padding(horizontal = 6.dp), strokeCap = androidx.compose.ui.graphics.StrokeCap.Round) } }
            if (data.backed.isNotEmpty()) { item { SectionTitle("Requests you've backed") }; items(data.backed, key = { "backed-${it.id}" }) { RequestCard(it, onClick = { onRequest(it.slug) }) } }
            if (closed.isNotEmpty()) { item { SectionTitle("Not going ahead") }; items(closed, key = { "closed-${it.id}" }) { RequestCard(it, onClick = { onRequest(it.slug) }) } }
            item { InfoBox("Your lesson updates live here and in Alerts. Background Android checks are optional; email and sign-in receipts follow your account preferences.") }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun NotificationsScreen(signedIn: Boolean, onLogin: () -> Unit, onOpen: (String) -> Unit, vm: NotificationsViewModel = viewModel()) {
    val data by vm.data.collectAsStateWithLifecycle(); val loading by vm.loading.collectAsStateWithLifecycle(); val error by vm.error.collectAsStateWithLifecycle(); val busy by vm.busy.collectAsStateWithLifecycle()
    LaunchedEffect(signedIn) { if (signedIn) vm.load() }
    if (!signedIn) { Box(Modifier.fillMaxSize().padding(20.dp), contentAlignment = Alignment.Center) { EmptyState("Good news belongs here.", "Sign in to see request progress, quotes and lessons made for you.", "Sign in", onLogin) }; return }
    PullToRefreshBox(isRefreshing = loading, onRefresh = vm::load) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item { Row(verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text("Your updates", style = MaterialTheme.typography.headlineMedium); Text("${data.unread} unread", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }; TextButton(onClick = { vm.read() }, enabled = !busy && data.unread > 0) { Text("Mark all read") } } }
            if (error != null) item { ErrorState(error!!, vm::load) }
            if (loading && data.notifications.isEmpty()) item { LoadingState() }
            if (!loading && data.notifications.isEmpty()) item { EmptyState("You're all caught up.", "When a lesson is ready or a request moves forward, you'll hear about it here.") }
            items(data.notifications, key = { it.id }) { item ->
                Surface(onClick = { if (item.readAt == null) vm.read(item.id); item.href?.let(onOpen) }, shape = MaterialTheme.shapes.medium, color = if (item.readAt == null) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface) {
                    Row(Modifier.padding(17.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Icon(when (item.kind) { "lesson_ready" -> Icons.Outlined.PlayCircle; "payment" -> Icons.Outlined.ReceiptLong; else -> Icons.Outlined.Notifications }, null, Modifier.size(23.dp), tint = MaterialTheme.colorScheme.primary)
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) { Text(item.title, style = MaterialTheme.typography.titleSmall); Text(item.body, style = MaterialTheme.typography.bodyMedium); Text(relativeDate(item.createdAt), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        if (item.readAt == null) Badge(Modifier.padding(top = 5.dp))
                    }
                }
            }
        }
    }
}
