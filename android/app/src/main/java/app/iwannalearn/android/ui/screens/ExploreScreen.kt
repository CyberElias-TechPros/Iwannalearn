package app.iwannalearn.android.ui.screens

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import app.iwannalearn.android.network.Bootstrap
import app.iwannalearn.android.ui.ExploreViewModel
import app.iwannalearn.android.ui.components.*

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable fun ExploreScreen(
    bootstrap: Bootstrap, initialQuery: String = "", initialCategory: String = "", initialTab: String = "lessons",
    onLesson: (String) -> Unit, onRequest: (String) -> Unit, onCreate: (String) -> Unit,
    vm: ExploreViewModel = viewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val cachedLessons by vm.cachedLessons.collectAsStateWithLifecycle(emptyList())
    val cachedRequests by vm.cachedRequests.collectAsStateWithLifecycle(emptyList())
    var filters by remember { mutableStateOf(false) }
    LaunchedEffect(initialQuery, initialCategory, initialTab) { vm.start(initialQuery, initialCategory, initialTab) }
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Find your next little win.", style = MaterialTheme.typography.headlineMedium)
            OutlinedTextField(value = state.query, onValueChange = vm::query, modifier = Modifier.fillMaxWidth(), placeholder = { Text("What are you stuck on?") }, leadingIcon = { Icon(Icons.Outlined.Search, null) }, trailingIcon = { if (state.query.isNotEmpty()) IconButton(onClick = { vm.query("") }) { Icon(Icons.Outlined.Close, "Clear search") } }, singleLine = true, shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { vm.load() }))
            PrimaryTabRow(selectedTabIndex = if (state.tab == "lessons") 0 else 1, containerColor = MaterialTheme.colorScheme.background) {
                Tab(selected = state.tab == "lessons", onClick = { vm.tab("lessons") }, text = { Text("Ready to watch") })
                Tab(selected = state.tab == "requests", onClick = { vm.tab("requests") }, text = { Text("Open requests") })
            }
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                Text("${state.total} ${if (state.tab == "lessons") "lessons" else "requests"}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
                TextButton(onClick = { filters = true }) { Icon(Icons.Outlined.Tune, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("Filters${if (state.category.isNotBlank() || state.level.isNotBlank()) " •" else ""}") }
            }
            if (state.category.isNotBlank() || state.level.isNotBlank()) Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (state.category.isNotBlank()) InputChip(selected = true, onClick = { vm.filter(category = "") }, label = { Text(state.category) }, trailingIcon = { Icon(Icons.Outlined.Close, "Remove topic filter", Modifier.size(16.dp)) })
                if (state.level.isNotBlank()) InputChip(selected = true, onClick = { vm.filter(level = "") }, label = { Text(app.iwannalearn.android.ui.levelLabel(state.level)) }, trailingIcon = { Icon(Icons.Outlined.Close, "Remove level filter", Modifier.size(16.dp)) })
            }
        }
        PullToRefreshBox(isRefreshing = state.loading, onRefresh = { vm.load() }, modifier = Modifier.weight(1f)) {
            val offline = state.error != null && state.lessons.isEmpty() && state.requests.isEmpty()
            val lessons = if (offline) cachedLessons.filter { (state.query.isBlank() || "${it.title} ${it.goal} ${it.category}".contains(state.query, true)) && (state.category.isBlank() || it.category == state.category) && (state.level.isBlank() || it.level == state.level) } else state.lessons
            val requests = if (offline) cachedRequests.filter { (state.query.isBlank() || "${it.title} ${it.goal}".contains(state.query, true)) && (state.category.isBlank() || it.category == state.category) && (state.level.isBlank() || it.level == state.level) } else state.requests
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                if (state.error != null) item { ErrorState(if (offline) "You're offline. Showing public lessons and requests saved on this device. Video playback needs a connection." else state.error!!) { vm.load() } }
                if (state.loading && lessons.isEmpty() && requests.isEmpty()) item { LoadingState("Finding the useful stuff…") }
                if (state.tab == "lessons") items(lessons, key = { it.slug }) { LessonCard(it, onClick = { onLesson(it.slug) }, wide = true) }
                else items(requests, key = { it.id }) { RequestCard(it, onClick = { onRequest(it.slug) }, onVote = { vm.vote(it) }) }
                if (!state.loading && lessons.isEmpty() && requests.isEmpty()) item { EmptyState("Nothing here just yet.", "A missing answer is a good reason to ask. Turn your search into a specific lesson request.", "Ask for this lesson") { onCreate(state.query) } }
                val hasMore = state.page * state.pageSize < state.total
                if (hasMore && !offline) item { OutlinedButton(onClick = { vm.load(more = true) }, enabled = !state.more, modifier = Modifier.fillMaxWidth().heightIn(min = 50.dp)) { Text(if (state.more) "Loading more…" else "Show more") } }
            }
        }
    }
    if (filters) AlertDialog(onDismissRequest = { filters = false }, title = { Text("Narrow it down") }, text = {
        Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Topic", style = MaterialTheme.typography.titleSmall)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) { FilterChip(selected = state.category.isEmpty(), onClick = { vm.filter(category = "") }, label = { Text("All") }); bootstrap.categories.forEach { FilterChip(selected = state.category == it, onClick = { vm.filter(category = it) }, label = { Text(it) }) } }
            Text("Your level", style = MaterialTheme.typography.titleSmall)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) { FilterChip(selected = state.level.isEmpty(), onClick = { vm.filter(level = "") }, label = { Text("Any level") }); bootstrap.levels.forEach { (key, value) -> FilterChip(selected = state.level == key, onClick = { vm.filter(level = key) }, label = { Text(value.label) }) } }
            Text("Sort by", style = MaterialTheme.typography.titleSmall)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) { listOf("newest" to "Newest", "popular" to "Most wanted", "oldest" to "Oldest").forEach { (key, label) -> FilterChip(selected = state.sort == key, onClick = { vm.filter(sort = key) }, label = { Text(label) }) } }
        }
    }, confirmButton = { TextButton(onClick = { filters = false }) { Text("Show results") } })
}
