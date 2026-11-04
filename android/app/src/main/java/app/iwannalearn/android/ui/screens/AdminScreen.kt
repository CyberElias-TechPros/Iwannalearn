package app.iwannalearn.android.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import app.iwannalearn.android.network.*
import app.iwannalearn.android.ui.*
import app.iwannalearn.android.ui.components.*
import kotlinx.serialization.json.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun AdminScreen(isCreator: Boolean, onBack: () -> Unit, onRequest: (String) -> Unit, onExplore: (String) -> Unit, vm: AdminViewModel = viewModel()) {
    val data by vm.data.collectAsStateWithLifecycle(); val loading by vm.loading.collectAsStateWithLifecycle(); val busy by vm.busy.collectAsStateWithLifecycle(); val error by vm.error.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableIntStateOf(0) }; var query by rememberSaveable { mutableStateOf("") }; var filter by rememberSaveable { mutableStateOf("all") }
    var manage by remember { mutableStateOf<RequestItem?>(null) }; var editor by remember { mutableStateOf<Pair<String, RequestItem>?>(null) }; var reuse by remember { mutableStateOf<LibraryItem?>(null) }
    var paymentRefund by remember { mutableStateOf<Payment?>(null) }; var claimDecision by remember { mutableStateOf<Pair<RefundClaim, Boolean>?>(null) }
    LaunchedEffect(isCreator) { if (isCreator) vm.load() }
    if (!isCreator) { Box(Modifier.fillMaxSize().padding(20.dp)) { EmptyState("Creator access only", "Your account doesn't have access to the studio.", "Go back", onBack) }; return }
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.padding(start = 12.dp, end = 20.dp, top = 10.dp), verticalAlignment = Alignment.CenterVertically) { IconButton(onClick = onBack) { Icon(Icons.Outlined.Close, "Close studio") }; Column(Modifier.weight(1f)) { Text("Creator studio", style = MaterialTheme.typography.headlineSmall); Text("A small queue. A real person. Useful lessons.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }; IconButton(onClick = vm::load) { Icon(Icons.Outlined.Refresh, "Refresh studio") } }
        ScrollableTabRow(selectedTabIndex = tab, edgePadding = 12.dp, containerColor = MaterialTheme.colorScheme.background) { listOf("Queue", "Quotes", "Money", "Library", "Inbox", "Insights", "Settings").forEachIndexed { index, title -> Tab(selected = tab == index, onClick = { tab = index; query = "" }, text = { Text(title) }) } }
        if (error != null) Box(Modifier.padding(16.dp)) { ErrorState(error!!, vm::load) }
        PullToRefreshBox(isRefreshing = loading, onRefresh = vm::load, modifier = Modifier.weight(1f)) {
            val snapshot = data
            if (snapshot == null) LoadingState("Opening the studio…") else LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                when (tab) {
                    0 -> {
                        item { Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) { Metric(snapshot.stats.inQueue.toString(), "in the queue", Modifier.weight(1f)); Metric(snapshot.stats.flagged.toString(), "need moderation", Modifier.weight(1f)); Metric("${snapshot.stats.deliveredThisWeek}/${snapshot.settings.capacity}", "filmed / capacity", Modifier.weight(1f)) } }
                        item { OutlinedTextField(query, { query = it }, label = { Text("Search the queue") }, singleLine = true, modifier = Modifier.fillMaxWidth(), leadingIcon = { Icon(Icons.Outlined.Search, null) }) }
                        item { Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) { listOf("all" to "All", "review" to "Review", "flagged" to "Flagged", "filming" to "Filming", "waitlisted" to "Waitlist").forEach { (key, label) -> FilterChip(selected = filter == key, onClick = { filter = key }, label = { Text(label) }) } } }
                        val queue = snapshot.queue.filter { (query.isBlank() || "${it.title} ${it.ref} ${it.ownerName}".contains(query, true)) && when (filter) { "review" -> it.status in listOf("submitted", "under_review"); "flagged" -> it.moderationFlag; "filming" -> it.status == "in_production"; "waitlisted" -> it.status == "waitlisted"; else -> true } }
                        items(queue, key = { it.id }) { request -> Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                            if (request.moderationFlag) InfoBox("Review: ${request.moderationNote ?: "Possible prohibited topic"}", true)
                            RequestCard(request, onClick = { onRequest(request.slug) })
                            Row(verticalAlignment = Alignment.CenterVertically) { Text("${request.ageDays}d old · ${request.internalNoteCount} notes", style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f)); if (request.moderationFlag) TextButton(onClick = { editor = "moderate" to request }, enabled = !busy) { Text("Moderate") }; Button(onClick = { manage = request }, enabled = !busy, contentPadding = PaddingValues(horizontal = 16.dp)) { Text("Manage") } }
                        } }
                        if (queue.isEmpty()) item { EmptyState("Nothing in this view.", "Try another filter, or enjoy the rare quiet moment.") }
                    }
                    1 -> {
                        item { ScreenTitle("Scope before money.", "${snapshot.stats.awaitingQuotes} quotes waiting for an answer") }
                        items(snapshot.quotes, key = { it.id }) { quote -> AdminCard(quote.title, "${money(quote.amount_kobo)} · ${quote.status}") { Text(quote.scope, style = MaterialTheme.typography.bodyMedium); Text("${quote.revisions} revisions · ${quote.turnaround_days ?: "—"} days", style = MaterialTheme.typography.bodySmall); TextButton(onClick = { onRequest(snapshot.queue.find { it.id == quote.request_id }?.slug ?: "") }) { Text("Open request") } } }
                        if (snapshot.quotes.isEmpty()) item { EmptyState("No quotes yet.", "Open a paid request in the queue and choose Manage → Send quote.") }
                    }
                    2 -> {
                        item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { Metric(money(snapshot.paymentSummary.revenueKobo), "collected", Modifier.weight(1f)); Metric(money(snapshot.paymentSummary.taxKobo), "VAT inside it", Modifier.weight(1f)) } }
                        item { InfoBox("Mode: ${snapshot.settings.paymentsMode}. Refunds revoke private access and notify both sides. Live provider credentials remain on the server.", snapshot.settings.paymentsMode != "live") }
                        if (snapshot.refunds.any { it.status == "open" }) item { SectionTitle("Learner refund claims") }
                        items(snapshot.refunds.filter { it.status == "open" }, key = { it.id }) { claim -> AdminCard("Refund requested", claim.reason) { Text("Opened ${relativeDate(claim.created_at)}", style = MaterialTheme.typography.bodySmall); Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { Button(onClick = { claimDecision = claim to true }, enabled = !busy) { Text("Approve") }; OutlinedButton(onClick = { claimDecision = claim to false }, enabled = !busy) { Text("Decline") } } } }
                        item { SectionTitle("Payments") }
                        items(snapshot.payments, key = { it.reference }) { payment -> AdminCard(payment.title, "${money(payment.amountKobo)} · ${payment.status}") { Text("${payment.learner ?: payment.email ?: "Learner"} · ${payment.provider}", style = MaterialTheme.typography.bodySmall); Text(payment.reference, style = MaterialTheme.typography.labelSmall); TextButton(onClick = { onRequest(payment.slug) }) { Text("Open request") }; if (payment.status == "paid") OutlinedButton(onClick = { paymentRefund = payment }, enabled = !busy) { Text("Refund payment") } } }
                    }
                    3 -> {
                        item { ScreenTitle("Film it once. Help again.", "${snapshot.library.size} public lessons ready to reuse") }
                        item { OutlinedTextField(query, { query = it }, label = { Text("Search the library") }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
                        items(snapshot.library.filter { query.isBlank() || "${it.title} ${it.videoTitle} ${it.category}".contains(query, true) }, key = { it.replyId }) { lesson -> AdminCard(lesson.videoTitle, "${lesson.category} · reused ${lesson.reuseCount} times") { Text(lesson.message, maxLines = 3, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyMedium); Row { TextButton(onClick = { onRequest(lesson.slug) }) { Text("View lesson") }; Spacer(Modifier.weight(1f)); Button(onClick = { reuse = lesson }, enabled = !busy) { Text("Send to a request") } } } }
                    }
                    4 -> inbox(snapshot, query, { query = it }, busy, vm)
                    5 -> insights(snapshot, onExplore)
                    else -> item { StudioSettings(snapshot.settings, busy, vm::settings) }
                }
            }
        }
    }
    manage?.let { request -> AlertDialog(onDismissRequest = { manage = null }, title = { Text(request.title) }, text = { Column { listOf("status" to "Move through the queue", "quote" to "Send or revise a quote", "publish" to "Publish a lesson", "note" to "Add an internal note", "priority" to "Toggle the priority flag").forEach { (key, label) -> TextButton(onClick = { if (key == "priority") { vm.act("requests/${request.id}/priority"); manage = null } else if (key == "quote" && request.tier == "community") { vm.error.value = "Community requests are free — no quote needed." } else { editor = key to request; manage = null } }, modifier = Modifier.fillMaxWidth()) { Text(label, modifier = Modifier.weight(1f)); Icon(Icons.Outlined.ChevronRight, null, Modifier.size(18.dp)) } } } }, confirmButton = { TextButton(onClick = { manage = null }) { Text("Done") } }) }
    editor?.let { (kind, request) -> AdminEditor(kind, request, busy, onClose = { editor = null }) { payload -> vm.act("requests/${request.id}/$kind", payload); editor = null } }
    reuse?.let { source -> ReuseDialog(source, data?.queue.orEmpty().filter { it.visibility == "public" && it.status in openStatuses }, busy, { reuse = null }) { target, note -> vm.act("requests/$target/reuse", jsonObject("sourceReplyId" to JsonPrimitive(source.replyId), "note" to JsonPrimitive(note))); reuse = null } }
    paymentRefund?.let { payment -> NoteDialog("Refund ${money(payment.amountKobo)}?", "The learner is notified and private access is revoked.", "Reason for the refund", "Refund", { paymentRefund = null }) { note -> vm.act("payments/${payment.reference}/refund", jsonObject("reason" to JsonPrimitive(note))); paymentRefund = null } }
    claimDecision?.let { (claim, approve) -> NoteDialog(if (approve) "Approve this refund?" else "Decline this claim?", if (approve) "Access will be revoked and the payment returned through the provider." else "Give the learner a clear reason.", "Decision note", if (approve) "Approve refund" else "Decline claim", { claimDecision = null }) { note -> vm.act("refunds/${claim.id}/resolve", jsonObject("approve" to JsonPrimitive(approve), "note" to JsonPrimitive(note))); claimDecision = null } }
}

@OptIn(ExperimentalMaterial3Api::class)
private fun LazyListScope.inbox(data: AdminSnapshot, query: String, setQuery: (String) -> Unit, busy: Boolean, vm: AdminViewModel) {
    item { PrimaryTabRow(selectedTabIndex = if (query == "email") 1 else 0) { Tab(selected = query != "email", onClick = { setQuery("") }, text = { Text("Support (${data.support.size})") }); Tab(selected = query == "email", onClick = { setQuery("email") }, text = { Text("Email outbox") }) } }
    if (query == "email") items(data.outbox, key = { it.id }) { message -> AdminCard(message.subject, "${message.toEmail} · ${message.status}") { var expanded by remember { mutableStateOf(false) }; Text(message.body, style = MaterialTheme.typography.bodySmall, maxLines = if (expanded) Int.MAX_VALUE else 3); TextButton(onClick = { expanded = !expanded }) { Text(if (expanded) "Show less" else "Read message") }; Text("${message.attempts} attempts${message.lastError?.let { " · $it" } ?: ""}", style = MaterialTheme.typography.bodySmall); Row { TextButton(onClick = { vm.act("outbox/${message.id}/retry") }, enabled = !busy) { Text("Retry") }; TextButton(onClick = { vm.act("outbox/${message.id}/bounce") }, enabled = !busy) { Text("Simulate bounce") } } } }
    else items(data.support, key = { it.id }) { message -> AdminCard(message.subject, "${message.email} · ${message.status}") { Text(message.body, style = MaterialTheme.typography.bodyMedium); Text(relativeDate(message.createdAt), style = MaterialTheme.typography.bodySmall); if (message.status == "open") Button(onClick = { vm.act("support/${message.id}/resolve") }, enabled = !busy) { Text("Mark resolved") } } }
}
private fun LazyListScope.insights(data: AdminSnapshot, onExplore: (String) -> Unit) {
    val a = data.analytics
    item { ScreenTitle("Make the next lesson count.", "Signals from the last seven days, unless noted.") }
    item { Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) { Metric(a.funnel.requestsSubmitted.toString(), "requests", Modifier.weight(1f)); Metric(a.funnel.lessonsDelivered.toString(), "delivered", Modifier.weight(1f)); Metric(a.helpfulness?.let { "$it%" } ?: "—", "helpful", Modifier.weight(1f)) } }
    item { AdminCard("The last 14 days", "Requests and lesson plays") { val primary = MaterialTheme.colorScheme.primary; val secondary = MaterialTheme.colorScheme.secondary; Canvas(Modifier.fillMaxWidth().height(130.dp)) { val max = (a.daily.maxOfOrNull { maxOf(it.requests, it.lessons) } ?: 1).coerceAtLeast(1); val step = size.width / a.daily.size.coerceAtLeast(1); a.daily.forEachIndexed { index, day -> val x = index * step; drawRoundRect(primary, Offset(x + 2, size.height - day.requests.toFloat() / max * size.height), Size(step * .35f, day.requests.toFloat() / max * size.height), CornerRadius(3f)); drawRoundRect(secondary, Offset(x + step * .45f + 2, size.height - day.lessons.toFloat() / max * size.height), Size(step * .35f, day.lessons.toFloat() / max * size.height), CornerRadius(3f)) } }; Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) { Pill("Requests", "success"); Pill("Lesson plays", "warn") } } }
    item { Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) { Metric(a.medianDaysToDelivery?.toString() ?: "—", "median days to delivery", Modifier.weight(1f)); Metric("${a.returningUsers}/${a.activeUsers}", "returning learners", Modifier.weight(1f)) } }
    item { SectionTitle("Demand gaps", "Searches with no answer") }
    items(a.gaps, key = { it.term }) { gap -> AdminCard(gap.term, "${gap.count} searches · no result") { TextButton(onClick = { onExplore(gap.term) }) { Text("Explore this question") } } }
    if (a.gaps.isEmpty()) item { Text("No zero-result searches yet.", style = MaterialTheme.typography.bodyMedium) }
    item { SectionTitle("What learners said") }
    items(data.feedback.size) { index -> val feedback = data.feedback[index]; AdminCard(feedback.title, if (feedback.helpful == 1) "Helpful" else "Needs more help") { Text(feedback.comment ?: "No written comment.", style = MaterialTheme.typography.bodyMedium); Text(feedback.learner ?: "A learner", style = MaterialTheme.typography.bodySmall) } }
}

@Composable private fun AdminCard(title: String, subtitle: String, content: @Composable ColumnScope.() -> Unit) { OutlinedCard(shape = MaterialTheme.shapes.medium) { Column(Modifier.padding(17.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) { Text(title, style = MaterialTheme.typography.titleMedium); Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary); content() } } }

@OptIn(ExperimentalLayoutApi::class)
@Composable private fun AdminEditor(kind: String, request: RequestItem, busy: Boolean, onClose: () -> Unit, onSave: (JsonObject) -> Unit) {
    var status by rememberSaveable { mutableStateOf(request.status) }; var reason by rememberSaveable { mutableStateOf("") }
    var title by rememberSaveable { mutableStateOf(request.lessonTitle ?: request.title) }; var message by rememberSaveable { mutableStateOf("") }; var video by rememberSaveable { mutableStateOf("") }; var stream by rememberSaveable { mutableStateOf("") }; var length by rememberSaveable { mutableStateOf("") }; var resources by rememberSaveable { mutableStateOf("") }
    var amount by rememberSaveable { mutableStateOf(if (request.tier == "priority") "4000" else "25000") }; var scope by rememberSaveable { mutableStateOf("") }; var deliverables by rememberSaveable { mutableStateOf("") }; var days by rememberSaveable { mutableStateOf("10") }; var revisions by rememberSaveable { mutableStateOf("1") }; var approve by rememberSaveable { mutableStateOf(true) }
    val names = mapOf("status" to "Move this request", "quote" to "Agree the scope and price", "publish" to "Deliver a useful lesson", "note" to "An internal note", "moderate" to "Review this request")
    AlertDialog(onDismissRequest = onClose, title = { Text(names[kind] ?: "Edit request") }, text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(request.title, style = MaterialTheme.typography.titleSmall)
        when (kind) {
            "status" -> { FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) { statusKeys.forEach { FilterChip(selected = status == it, onClick = { status = it }, label = { Text(statusLabel(it).label) }) } }; OutlinedTextField(reason, { reason = it }, label = { Text(if (status == "declined") "Reason (required)" else "Context (optional)") }, minLines = 2, modifier = Modifier.fillMaxWidth()) }
            "note" -> OutlinedTextField(message, { message = it }, label = { Text("Only the creator sees this") }, minLines = 4, modifier = Modifier.fillMaxWidth())
            "moderate" -> { InfoBox(request.moderationNote ?: "Check this against the not-covered list.", true); Row(verticalAlignment = Alignment.CenterVertically) { Switch(approve, { approve = it }); Text(if (approve) "Approve and schedule" else "Decline with a reason") }; if (!approve) OutlinedTextField(reason, { reason = it }, label = { Text("Reason sent to the learner") }, minLines = 3, modifier = Modifier.fillMaxWidth()) }
            "quote" -> { OutlinedTextField(amount, { amount = it }, label = { Text("Whole naira amount") }, singleLine = true, modifier = Modifier.fillMaxWidth()); OutlinedTextField(scope, { scope = it }, label = { Text("Exactly what is included") }, minLines = 3, modifier = Modifier.fillMaxWidth()); OutlinedTextField(deliverables, { deliverables = it }, label = { Text("Deliverables") }, minLines = 2, modifier = Modifier.fillMaxWidth()); Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { OutlinedTextField(days, { days = it }, label = { Text("Days") }, singleLine = true, modifier = Modifier.weight(1f)); OutlinedTextField(revisions, { revisions = it }, label = { Text("Revisions") }, singleLine = true, modifier = Modifier.weight(1f)) }; Text("The learner must accept before payment. Accepted quotes cannot be re-priced.", style = MaterialTheme.typography.bodySmall) }
            "publish" -> { OutlinedTextField(title, { title = it }, label = { Text("Lesson title") }, modifier = Modifier.fillMaxWidth()); OutlinedTextField(message, { message = it }, label = { Text("Where should the learner start?") }, minLines = 3, modifier = Modifier.fillMaxWidth()); if (request.visibility != "private") OutlinedTextField(video, { video = it }, label = { Text("Public YouTube URL") }, modifier = Modifier.fillMaxWidth()); OutlinedTextField(stream, { stream = it }, label = { Text(if (request.visibility == "private") "Protected HTTPS video / HLS URL (required)" else "Direct HTTPS video / HLS URL (optional)") }, modifier = Modifier.fillMaxWidth()); OutlinedTextField(length, { length = it }, label = { Text("Length, e.g. 8 min") }, modifier = Modifier.fillMaxWidth()); OutlinedTextField(resources, { resources = it }, label = { Text("Resources: Label | https://… per line") }, minLines = 2, modifier = Modifier.fillMaxWidth()); Text("Direct hosts must be allowlisted in STREAM_ALLOWED_HOSTS. Private work never uses YouTube.", style = MaterialTheme.typography.bodySmall) }
        }
    } }, confirmButton = { TextButton(enabled = !busy && when (kind) { "status" -> status != "declined" || reason.isNotBlank(); "moderate" -> approve || reason.isNotBlank(); "note" -> message.isNotBlank(); "quote" -> amount.toLongOrNull() != null && scope.trim().length >= 20; "publish" -> title.length >= 4 && message.length >= 10 && (if (request.visibility == "private") stream.isNotBlank() else video.isNotBlank() || stream.isNotBlank()); else -> true }, onClick = {
        val payload = when (kind) {
            "status" -> jsonObject("status" to JsonPrimitive(status), "reason" to JsonPrimitive(reason))
            "note" -> jsonObject("message" to JsonPrimitive(message))
            "moderate" -> jsonObject("approve" to JsonPrimitive(approve), "reason" to JsonPrimitive(reason))
            "quote" -> jsonObject("amountKobo" to JsonPrimitive((amount.toLongOrNull() ?: 0) * 100), "scope" to JsonPrimitive(scope), "deliverables" to JsonPrimitive(deliverables), "turnaroundDays" to JsonPrimitive(days.toIntOrNull() ?: 10), "revisions" to JsonPrimitive(revisions.toIntOrNull() ?: 1))
            else -> jsonObject("videoTitle" to JsonPrimitive(title), "message" to JsonPrimitive(message), "videoUrl" to JsonPrimitive(video.ifBlank { "" }), "streamUrl" to JsonPrimitive(stream.ifBlank { "" }), "videoLength" to JsonPrimitive(length), "resources" to JsonArray(resources.lines().filter { it.isNotBlank() }.map { line -> val parts = line.split("|", limit = 2); jsonObject("label" to JsonPrimitive(parts.first().trim()), "url" to JsonPrimitive(parts.last().trim())) }))
        }
        onSave(payload)
    }) { Text(if (kind == "publish") "Publish & notify" else "Save") } }, dismissButton = { TextButton(onClick = onClose) { Text("Cancel") } })
}

@Composable private fun ReuseDialog(source: LibraryItem, targets: List<RequestItem>, busy: Boolean, onClose: () -> Unit, onSave: (String, String) -> Unit) {
    var target by rememberSaveable { mutableStateOf("") }; var note by rememberSaveable { mutableStateOf("") }
    AlertDialog(onDismissRequest = onClose, title = { Text("Send an existing lesson") }, text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) { Text(source.videoTitle, style = MaterialTheme.typography.titleSmall); targets.forEach { FilterChip(selected = target == it.id, onClick = { target = it.id }, label = { Text("${it.ref} · ${it.title}") }, modifier = Modifier.fillMaxWidth()) }; OutlinedTextField(note, { note = it }, label = { Text("A personal note (optional)") }, minLines = 2, modifier = Modifier.fillMaxWidth()) } }, confirmButton = { TextButton(enabled = !busy && target.isNotBlank(), onClick = { onSave(target, note) }) { Text("Send & notify") } }, dismissButton = { TextButton(onClick = onClose) { Text("Cancel") } })
}
@Composable private fun NoteDialog(title: String, detail: String, label: String, action: String, onClose: () -> Unit, onSave: (String) -> Unit) {
    var note by rememberSaveable { mutableStateOf("") }
    AlertDialog(onDismissRequest = onClose, title = { Text(title) }, text = { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { Text(detail); OutlinedTextField(note, { note = it }, label = { Text(label) }, minLines = 3, modifier = Modifier.fillMaxWidth()) } }, confirmButton = { TextButton(enabled = note.trim().length >= 3, onClick = { onSave(note.trim()) }) { Text(action) } }, dismissButton = { TextButton(onClick = onClose) { Text("Cancel") } })
}

@OptIn(ExperimentalLayoutApi::class)
@Composable private fun StudioSettings(settings: AdminSettings, busy: Boolean, save: (AdminSettings) -> Unit) {
    var capacity by rememberSaveable(settings) { mutableStateOf(settings.capacity.toString()) }; var vat by rememberSaveable(settings) { mutableStateOf(settings.vatRate.toString()) }; var window by rememberSaveable(settings) { mutableStateOf(settings.refundWindow.toString()) }; var email by rememberSaveable(settings) { mutableStateOf(settings.supportEmail) }; var day by rememberSaveable(settings) { mutableStateOf(settings.digestDay) }; var mode by rememberSaveable(settings) { mutableStateOf(settings.paymentsMode) }
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        ScreenTitle("The practical things.", "Capacity, promises, and how the studio runs.")
        OutlinedTextField(capacity, { capacity = it }, label = { Text("Weekly filming capacity (0–50)") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(vat, { vat = it }, label = { Text("VAT percentage, included in prices") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(window, { window = it }, label = { Text("Revision / refund window in days") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(email, { email = it }, label = { Text("Support email") }, modifier = Modifier.fillMaxWidth())
        Text("Digest day", style = MaterialTheme.typography.titleSmall); FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) { listOf("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday").forEach { FilterChip(selected = day == it, onClick = { day = it }, label = { Text(it.take(3).replaceFirstChar(Char::uppercase)) }) } }
        Text("Payment mode", style = MaterialTheme.typography.titleSmall); Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) { listOf("off", "mock", "live").forEach { FilterChip(selected = mode == it, onClick = { mode = it }, label = { Text(it) }) } }
        InfoBox("Live mode requires provider keys on the server. Never enter secret keys into the app.", true)
        ActionButton("Save studio settings", busy, (capacity.toIntOrNull() ?: -1) in 0..50 && (vat.toDoubleOrNull() ?: -1.0) in 0.0..30.0 && (window.toIntOrNull() ?: -1) in 1..90 && email.contains("@")) { save(AdminSettings(capacity.toInt(), vat.toDouble(), window.toInt(), email.trim(), day, mode)) }
    }
}

private fun jsonObject(vararg pairs: Pair<String, JsonElement>): JsonObject = JsonObject(pairs.toMap())
