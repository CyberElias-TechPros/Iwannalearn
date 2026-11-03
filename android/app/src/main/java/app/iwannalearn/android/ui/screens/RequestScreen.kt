package app.iwannalearn.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.iwannalearn.android.appContainer
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import app.iwannalearn.android.network.Bootstrap
import app.iwannalearn.android.ui.*
import app.iwannalearn.android.ui.components.*
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

private sealed interface RequestDialog {
    data object DeclineQuote : RequestDialog
    data object Revision : RequestDialog
    data object Refund : RequestDialog
    data object Feedback : RequestDialog
    data object Withdraw : RequestDialog
}

@Composable fun RequestScreen(
    slug: String, signedIn: Boolean, bootstrap: Bootstrap, onBack: () -> Unit, onLogin: () -> Unit,
    onRequest: (String) -> Unit, onCheckout: (String) -> Unit, onPlay: (String) -> Unit, onLesson: (String) -> Unit,
    vm: RequestViewModel = viewModel(),
) {
    val detail by vm.data.collectAsStateWithLifecycle(); val loading by vm.loading.collectAsStateWithLifecycle(); val error by vm.error.collectAsStateWithLifecycle(); val busy by vm.busy.collectAsStateWithLifecycle(); val checkout by vm.checkout.collectAsStateWithLifecycle()
    var dialog by remember { mutableStateOf<RequestDialog?>(null) }; var note by rememberSaveable { mutableStateOf("") }; var helpful by rememberSaveable { mutableStateOf(true) }
    val context = LocalContext.current
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { vm.load(slug) }
    LaunchedEffect(checkout?.reference) { if (checkout != null) onCheckout(slug) }
    val item = detail?.request
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item { ScreenTitle(item?.title ?: "Your request", item?.let { "${it.ref} · ${it.category} · ${relativeDate(it.createdAt)}" } ?: "The details, the progress, and your next step.", onBack) }
        if (error != null) item { ErrorState(error!!, { vm.load(slug) }) }
        if (loading && detail == null) item { LoadingState("Opening your request…") }
        if (item != null && detail != null) {
            val d = detail!!
            item { Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) { StatusPill(item.status); Pill(if (item.visibility == "private") "Private" else item.tier.replaceFirstChar(Char::uppercase), if (item.visibility == "private") "success" else "neutral", if (item.visibility == "private") Icons.Outlined.Lock else null) } }
            item {
                if (item.status == "declined") InfoBox(item.declineReason ?: "This request isn't going ahead. You can ask again with a narrower goal.", true)
                else if (item.status == "waitlisted") InfoBox(statusLabel(item.status).detail, true)
                else Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    val steps = listOf("Received", "Checked", "Scheduled", "Filmed", "Ready"); val current = statusLabel(item.status).step
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(5.dp)) { steps.forEachIndexed { index, label -> Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) { Surface(color = if (index < current) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant, shape = CircleShape) { Box(Modifier.size(28.dp), contentAlignment = Alignment.Center) { if (index < current) Icon(Icons.Outlined.Check, null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onPrimary) else Text((index + 1).toString(), style = MaterialTheme.typography.labelSmall) } }; Text(label, style = MaterialTheme.typography.labelSmall, maxLines = 1) } } }
                    LinearProgressIndicator(progress = { current / 5f }, modifier = Modifier.fillMaxWidth(), strokeCap = androidx.compose.ui.graphics.StrokeCap.Round)
                    Text(statusLabel(item.status).detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            item { DetailCard("The ask") { Text(item.goal, style = MaterialTheme.typography.bodyLarge); if (!item.tried.isNullOrBlank()) { Text("What I've tried", style = MaterialTheme.typography.titleSmall); Text(item.tried!!, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }; if (!item.contextLink.isNullOrBlank()) TextButton(onClick = { runCatching { context.openWeb(item.contextLink!!) }.onFailure { vm.error.value = it.message } }) { Icon(Icons.Outlined.Link, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("Open shared context") }; Text("Requested by ${item.ownerName ?: "a learner"} · ${levelLabel(item.level)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
            if (item.status in openStatuses && item.visibility == "public") item { OutlinedButton(onClick = { if (signedIn) vm.vote() else onLogin() }, enabled = !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 50.dp)) { Icon(if (item.viewerUpvoted) Icons.Outlined.ThumbUp else Icons.Outlined.ThumbUpOffAlt, null, Modifier.size(20.dp)); Spacer(Modifier.width(8.dp)); Text("${if (item.viewerUpvoted) "You're backing this" else "I want to learn this too"} · ${item.upvoteCount}") } }
            if (d.attachments.isNotEmpty()) item { DetailCard("Files shared with the creator") { d.attachments.forEach { file -> Surface(onClick = { vm.openAttachment(file) { f, mime -> runCatching { context.openAttachment(f, mime) }.onFailure { vm.error.value = it.message } } }, enabled = !busy, color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.small) { Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Outlined.AttachFile, null, Modifier.size(20.dp)); Spacer(Modifier.width(9.dp)); Column(Modifier.weight(1f)) { Text(file.filename, style = MaterialTheme.typography.labelLarge); Text("${fileSize(file.size)} · opens in your file viewer", style = MaterialTheme.typography.bodySmall) }; Icon(Icons.Outlined.OpenInNew, null, Modifier.size(18.dp)) } } } } }
            if (d.quote != null && item.isOwner) item {
                val quote = d.quote!!
                DetailCard(if (quote.status == "proposed") "Your quote — scope before money" else "Your agreed scope") {
                    Text(money(quote.amount_kobo), style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary)
                    Text(quote.scope, style = MaterialTheme.typography.bodyMedium)
                    quote.deliverables?.let { Text("Delivered as: $it", style = MaterialTheme.typography.bodyMedium) }
                    Text("${quote.turnaround_days?.let { "About $it days · " } ?: ""}${quote.revisions} revision${if (quote.revisions == 1) "" else "s"} · includes ${money(quote.taxKobo)} VAT", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    when (quote.status) {
                        "proposed" -> { InfoBox("Accepting agrees the scope. It does not charge you. Declining is free and leaves your request open for a new quote."); ActionButton("Accept this quote", busy) { vm.act("quote", JsonObject(mapOf("accept" to JsonPrimitive(true))), "Quote accepted. Payment is a separate step.") }; OutlinedButton(onClick = { note = ""; dialog = RequestDialog.DeclineQuote }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text("Decline or ask for a change") } }
                        "accepted" -> InfoBox("Scope is locked in. Nothing can silently re-price this quote.")
                        "declined" -> InfoBox("You declined this quote. Nothing was charged.${quote.decline_note?.let { " Your note: $it" } ?: ""}", true)
                    }
                }
            }
            if (item.isOwner && item.tier != "community") item {
                when (item.paymentStatus) {
                    "paid" -> InfoBox("Paid — ${money(item.priceKobo ?: d.payment?.amountKobo ?: 0)}. Your slot is confirmed.${d.payment?.reference?.let { " Reference: $it" } ?: ""}")
                    "refunded" -> InfoBox("This payment was refunded. Private access is closed.", true)
                    else -> {
                        if (d.quote?.status == "accepted") DetailCard("Ready when you are") { Text("Review the exact amount and terms on the next screen. No card details are collected by this app.", style = MaterialTheme.typography.bodyMedium); ActionButton("Continue to secure checkout", busy, bootstrap.pricing.enabled, vm::startCheckout); if (!bootstrap.pricing.enabled) Text("Payments are switched off on this server. Your request is safe.", style = MaterialTheme.typography.bodySmall) }
                        else if (d.quote?.status != "proposed") InfoBox("The creator is preparing your scope and price. Nothing is payable until you accept a quote.")
                    }
                }
            }
            if (item.hasLesson) item {
                DetailCard(if (item.visibility == "private") "Your private lesson" else "Your lesson is ready") {
                    Text(item.lessonTitle ?: "A lesson made for your request", style = MaterialTheme.typography.titleMedium)
                    if (d.canPlay) ActionButton(if (item.visibility == "private") "Play privately" else "Open the lesson", onClick = { if (item.visibility == "private") onPlay(item.id) else onLesson(item.slug) })
                    else InfoBox(if (signedIn) "Private access isn't active. Complete payment or contact support if you've already paid." else "Sign in with the account that commissioned this lesson.", true)
                    if (item.visibility == "private") Text("Authenticated native playback. No public or unlisted YouTube link. Access is checked again when playback opens.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            if (d.replies.isNotEmpty()) items(d.replies, key = { it.id }) { reply -> DetailCard(reply.videoTitle ?: "A note from the creator") { Text(reply.message, style = MaterialTheme.typography.bodyMedium); Text("${reply.authorName ?: "The creator"} · ${relativeDate(reply.createdAt)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant); reply.resources.forEach { resource -> TextButton(onClick = { runCatching { context.openWeb(resource.url) }.onFailure { vm.error.value = it.message } }) { Icon(Icons.Outlined.Link, null, Modifier.size(17.dp)); Spacer(Modifier.width(6.dp)); Text(resource.label) } } } }
            if (item.isOwner && item.fulfilledAt != null) item {
                DetailCard("Did it solve the stuck moment?") {
                    if (d.feedback != null) InfoBox(d.feedback!!.helpful == 1 ? "You marked this helpful. Glad it worked." else "You asked for a little more help. Your feedback is saved.")
                    else Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { OutlinedButton(onClick = { helpful = true; note = ""; dialog = RequestDialog.Feedback }, modifier = Modifier.weight(1f)) { Icon(Icons.Outlined.ThumbUp, null, Modifier.size(18.dp)); Spacer(Modifier.width(5.dp)); Text("It helped") }; OutlinedButton(onClick = { helpful = false; note = ""; dialog = RequestDialog.Feedback }, modifier = Modifier.weight(1f)) { Text("Not quite") } }
                    if (item.deliveryConfirmedAt == null) ActionButton("Confirm delivery & close", busy) { vm.act("confirm", message = "Confirmed and closed. Thanks — that helps us both.") }
                    else Text("Delivery confirmed. The revision window is closed.", style = MaterialTheme.typography.bodySmall)
                    if (item.revisionState == "none" && item.deliveryConfirmedAt == null) OutlinedButton(onClick = { note = ""; dialog = RequestDialog.Revision }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text("Ask for the included revision") }
                    else if (item.revisionState == "requested") InfoBox("Your revision request is with the creator.")
                }
            }
            if (item.isOwner && d.payment?.status == "paid") item {
                if (d.refund?.status == "open") InfoBox("Your refund request is open. The creator will respond; the decision appears here.", true)
                else OutlinedButton(onClick = { note = ""; dialog = RequestDialog.Refund }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text("Ask about a refund") }
                d.refund?.takeIf { it.status != "open" }?.let { InfoBox("Refund request ${it.status}.${it.resolution?.let { r -> " $r" } ?: ""}") }
            }
            if (item.isOwner && item.status in openStatuses) item { TextButton(onClick = { dialog = RequestDialog.Withdraw }, enabled = !busy, colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error), modifier = Modifier.fillMaxWidth()) { Text("Withdraw this request") } }
            if (item.visibility == "public") item { OutlinedButton(onClick = { context.shareText("${item.title}\n${context.appContainer.server.value}/requests/${item.slug}") }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Icon(Icons.Outlined.Share, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text("Share this request") } }
            if (d.related.isNotEmpty()) { item { SectionTitle("Other people are learning this too") }; items(d.related, key = { it.id }) { RequestCard(it, onClick = { onRequest(it.slug) }) } }
        }
    }
    if (dialog != null) {
        val current = dialog!!
        if (current == RequestDialog.Withdraw) ConfirmDialog("Withdraw this request?", "It will leave the queue. You can ask again any time. Paid work is refunded when a request is withdrawn.", "Withdraw", { dialog = null }) { vm.act("withdraw", message = "Request withdrawn."); dialog = null }
        else AlertDialog(onDismissRequest = { dialog = null }, title = { Text(when (current) { RequestDialog.DeclineQuote -> "What would make this work?"; RequestDialog.Revision -> "What missed the mark?"; RequestDialog.Refund -> "Tell us about the refund"; RequestDialog.Feedback -> if (helpful) "Glad it helped." else "Help us make it better."; else -> "" }) }, text = { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(when (current) { RequestDialog.DeclineQuote -> "Optional. Your note goes to the creator; declining costs nothing."; RequestDialog.Revision -> "One revision is included within ${bootstrap.pricing.refundWindowDays} days. Be specific about what to re-record."; RequestDialog.Refund -> "This opens a claim, not an automatic refund. Explain what happened."; else -> "Anything you'd like the creator to know? (optional)" });
            OutlinedTextField(note, { note = it }, label = { Text("Your note") }, minLines = 3, modifier = Modifier.fillMaxWidth())
        } }, confirmButton = { TextButton(enabled = !busy && (current == RequestDialog.DeclineQuote || current == RequestDialog.Feedback || note.trim().length >= 10), onClick = {
            when (current) { RequestDialog.DeclineQuote -> vm.act("quote", JsonObject(mapOf("accept" to JsonPrimitive(false), "note" to JsonPrimitive(note))), "Quote declined. Nothing was charged."); RequestDialog.Revision -> vm.act("revision", JsonObject(mapOf("note" to JsonPrimitive(note))), "Revision requested."); RequestDialog.Refund -> vm.act("refund", JsonObject(mapOf("reason" to JsonPrimitive(note))), "Refund request sent."); RequestDialog.Feedback -> vm.act("feedback", JsonObject(mapOf("helpful" to JsonPrimitive(helpful), "comment" to JsonPrimitive(note))), "Feedback saved. Thank you."); else -> Unit }
            dialog = null
        }) { Text("Send") } }, dismissButton = { TextButton(onClick = { dialog = null }) { Text("Cancel") } })
    }
}

@Composable private fun DetailCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    OutlinedCard(shape = MaterialTheme.shapes.large) { Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { Text(title, style = MaterialTheme.typography.titleMedium); content() } }
}

@Composable fun CheckoutScreen(slug: String, bootstrap: Bootstrap, onBack: () -> Unit, onPaid: () -> Unit, onTerms: () -> Unit, vm: RequestViewModel = viewModel()) {
    val detail by vm.data.collectAsStateWithLifecycle(); val checkout by vm.checkout.collectAsStateWithLifecycle(); val busy by vm.busy.collectAsStateWithLifecycle(); val error by vm.error.collectAsStateWithLifecycle()
    var agreed by rememberSaveable { mutableStateOf(false) }; val context = LocalContext.current
    LaunchedEffect(slug) { vm.load(slug) }
    LaunchedEffect(detail?.request?.id) { if (detail?.quote?.status == "accepted" && detail?.request?.paymentStatus != "paid") vm.startCheckout() }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        ScreenTitle("One clear price. Then you're set.", "Scope is already agreed. This is the separate payment step.", onBack)
        if (error != null) ErrorState(error!!, vm::startCheckout)
        val payment = checkout; val quote = detail?.quote
        if (payment == null) LoadingState("Preparing your checkout…") else {
            Pill(if (payment.mode == "mock") "TEST MODE · NO REAL MONEY" else "SECURE PROVIDER CHECKOUT", if (payment.mode == "mock") "warn" else "success")
            Text(payment.title, style = MaterialTheme.typography.headlineSmall)
            OutlinedCard { Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                quote?.let { Text(it.scope, style = MaterialTheme.typography.bodyMedium); it.deliverables?.let { d -> Text(d, style = MaterialTheme.typography.bodySmall) }; HorizontalDivider() }
                Row { Text("VAT included in total", modifier = Modifier.weight(1f)); Text(money(payment.taxKobo)) }
                Row(verticalAlignment = Alignment.CenterVertically) { Text("Total", style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f)); Text(money(payment.amountKobo), style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary) }
                Text("Reference ${payment.reference}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } }
            InfoBox("One revision within ${bootstrap.pricing.refundWindowDays} days for private work. If agreed scope isn't delivered, ask for a refund. Payment is confirmed by the server, not by a browser redirect.")
            TextButton(onClick = onTerms, modifier = Modifier.fillMaxWidth()) { Text("Read the terms & refund policy") }
            Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(agreed, { agreed = it }); Text("I agree to this scope, price and the refund terms.", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f)) }
            if (payment.mode == "mock") ActionButton("Confirm test payment · ${money(payment.amountKobo)}", busy, agreed) { vm.confirmTest(payment.reference, onPaid) }
            else ActionButton("Open secure provider checkout", busy, agreed && payment.url != null) { runCatching { context.openWeb(payment.url!!) }.onFailure { vm.error.value = it.message } }
            Text(if (payment.mode == "mock") "This exercises the real receipt and access path without moving money." else "Card and bank details stay with the payment provider. Return here after paying; we'll check the server-confirmed status.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (payment.mode == "live") OutlinedButton(onClick = { vm.load(slug); vm.startCheckout() }, modifier = Modifier.fillMaxWidth()) { Text("Check payment status") }
        }
    }
}
