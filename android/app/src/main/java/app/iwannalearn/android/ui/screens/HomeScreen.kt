package app.iwannalearn.android.ui.screens

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import app.iwannalearn.android.network.Bootstrap
import app.iwannalearn.android.ui.HomeViewModel
import app.iwannalearn.android.ui.components.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun HomeScreen(
    bootstrap: Bootstrap, signedIn: Boolean, onCreate: () -> Unit, onExplore: (String, String, String) -> Unit,
    onLesson: (String) -> Unit, onRequest: (String) -> Unit, onHow: () -> Unit, onPricing: () -> Unit,
    vm: HomeViewModel = viewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()
    var query by rememberSaveable { mutableStateOf("") }
    PullToRefreshBox(isRefreshing = state.loading, onRefresh = vm::load) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
            item {
                Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = MaterialTheme.shapes.extraLarge) {
                    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Pill("SMALL LESSONS. REAL PROGRESS.", "success", Icons.Outlined.Spa)
                        Text("What do you want\nto learn?", style = MaterialTheme.typography.displaySmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
                        Text("Tell us the thing you're stuck on. Find a lesson, back a request, or ask for one made around you.", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onPrimaryContainer)
                        OutlinedTextField(value = query, onValueChange = { query = it }, modifier = Modifier.fillMaxWidth(), placeholder = { Text("Try “SQL”, “Canva”, “Python”…") }, leadingIcon = { Icon(Icons.Outlined.Search, null) }, singleLine = true, shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { onExplore(query, "", "lessons") }), colors = OutlinedTextFieldDefaults.colors(focusedContainerColor = MaterialTheme.colorScheme.surface, unfocusedContainerColor = MaterialTheme.colorScheme.surface))
                        Button(onClick = onCreate, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Icon(Icons.Outlined.Add, null, Modifier.size(20.dp)); Spacer(Modifier.width(8.dp)); Text("Ask for a lesson"); Spacer(Modifier.weight(1f)); Icon(Icons.AutoMirrored.Outlined.ArrowForward, null, Modifier.size(19.dp)) }
                        Text(if (signedIn) "Your draft saves automatically on this device." else "Free to ask. No charge until you agree a quote.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
                    }
                }
            }
            item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { Metric(bootstrap.stats.lessons.toString(), "lessons ready", Modifier.weight(1f)); Metric(bootstrap.stats.requests.toString(), "questions in the queue", Modifier.weight(1f)) } }
            if (state.error != null) item { ErrorState(state.error!!, vm::load) }
            item {
                SectionTitle("Find your next skill", "All topics", { onExplore("", "", "lessons") })
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    bootstrap.topics.take(6).forEach { topic -> AssistChip(onClick = { onExplore("", topic.category, "lessons") }, label = { Text(topic.title) }, leadingIcon = { Text(categoryGlyph(topic.category)) }) }
                }
            }
            item { SectionTitle("Ready for your next little win", "Explore", { onExplore("", "", "lessons") }) }
            if (state.lessons.isEmpty() && state.loading) item { LoadingState() }
            else item { LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) { items(state.lessons, key = { it.slug }) { LessonCard(it, onClick = { onLesson(it.slug) }) } } }
            item {
                Surface(onClick = onPricing, color = MaterialTheme.colorScheme.secondaryContainer, shape = MaterialTheme.shapes.large) {
                    Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        Icon(Icons.Outlined.WorkspacePremium, null, Modifier.size(32.dp), tint = MaterialTheme.colorScheme.onSecondaryContainer)
                        Column(Modifier.weight(1f)) { Text("Your pace. Your kind of lesson.", style = MaterialTheme.typography.titleMedium); Text("Community is free. Priority moves you up. Private is built around your files.", style = MaterialTheme.typography.bodyMedium) }
                        Icon(Icons.Outlined.ChevronRight, null)
                    }
                }
            }
            item { SectionTitle("Worth learning together", "See requests", { onExplore("", "", "requests") }) }
            items(state.requests, key = { it.id }) { RequestCard(it, onClick = { onRequest(it.slug) }) }
            item { TextButton(onClick = onHow, modifier = Modifier.fillMaxWidth()) { Text("New here? See how it works"); Icon(Icons.Outlined.ChevronRight, null) } }
            item { Text("Made for the moment between “I'm stuck” and “I've got this.”", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
    }
}

@Composable fun HowItWorksScreen(onCreate: () -> Unit, onBack: () -> Unit) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        item { ScreenTitle("A question becomes a little win.", "No endless course. Just the thing you need next.", onBack) }
        items(listOf(
            Triple("01", "Describe the stuck moment", "A specific outcome beats a broad subject. Tell us what you've tried and share a file if it helps."),
            Triple("02", "Find it, or ask for it", "Search the library first. If someone already asked, add your vote. Otherwise, send your own request."),
            Triple("03", "Agree before anything moves", "Community requests are free. For paid work, review the scope and exact price before accepting or paying."),
            Triple("04", "Watch, try it, tell us", "Get a notification when it's ready. Watch the lesson, confirm it helped, or ask for the included revision."),
        )) { (number, title, detail) -> Surface(color = MaterialTheme.colorScheme.surface, shape = MaterialTheme.shapes.large) { Row(Modifier.padding(20.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) { Text(number, style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary); Column(verticalArrangement = Arrangement.spacedBy(7.dp)) { Text(title, style = MaterialTheme.typography.titleMedium); Text(detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) } } } }
        item { ActionButton("Ask for your first lesson", onClick = onCreate) }
    }
}

@Composable fun PricingScreen(bootstrap: Bootstrap, onCreate: (String) -> Unit, onBack: () -> Unit) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { ScreenTitle("A fair way to learn.", "Public lessons stay free. Paid work starts with a quote you agree to.", onBack) }
        item { InfoBox("Nothing is charged when you ask. Accepting a quote agrees the scope; payment is a separate step. Prices include VAT.", bootstrap.pricing.mode != "live") }
        items(listOf("community", "priority", "private")) { key ->
            val tier = bootstrap.tiers[key] ?: return@items
            OutlinedCard(shape = MaterialTheme.shapes.large) { Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) { Text(tier.label, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f)); if (key == "private") Icon(Icons.Outlined.Lock, null, tint = MaterialTheme.colorScheme.primary) }
                Text(tier.price, style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary)
                Text(tier.tagline, style = MaterialTheme.typography.titleMedium)
                Text(tier.detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedButton(onClick = { onCreate(key) }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text(if (key == "community") "Ask the community" else "Request ${tier.label.lowercase()}") }
            } }
        }
        item { Text("Payments are ${if (bootstrap.pricing.enabled) if (bootstrap.pricing.mode == "mock") "in test mode — no real money moves." else "enabled; you still approve every charge." else "currently switched off."}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}
