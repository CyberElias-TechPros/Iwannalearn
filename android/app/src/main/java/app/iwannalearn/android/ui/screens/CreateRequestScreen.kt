package app.iwannalearn.android.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import app.iwannalearn.android.network.Bootstrap
import app.iwannalearn.android.data.RequestRules
import app.iwannalearn.android.ui.CreateRequestViewModel
import app.iwannalearn.android.ui.components.*
import app.iwannalearn.android.ui.fileSize

@OptIn(ExperimentalLayoutApi::class)
@Composable fun CreateRequestScreen(
    bootstrap: Bootstrap, signedIn: Boolean, initialTier: String = "", onBack: () -> Unit,
    onLogin: () -> Unit, onCreated: (String) -> Unit, onRequest: (String) -> Unit, vm: CreateRequestViewModel = viewModel(),
) {
    val draft by vm.draft.collectAsStateWithLifecycle(); val busy by vm.busy.collectAsStateWithLifecycle(); val uploading by vm.uploading.collectAsStateWithLifecycle(); val error by vm.error.collectAsStateWithLifecycle(); val matches by vm.matches.collectAsStateWithLifecycle()
    var validation by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var agreed by remember { mutableStateOf(false) }
    LaunchedEffect(initialTier) { if (initialTier in listOf("community", "priority", "private")) vm.update { it.copy(tier = initialTier) } }
    LaunchedEffect(draft.title) { vm.findMatches() }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> uri?.let(vm::upload) }
    fun back() { if (draft.step > 0) vm.update { it.copy(step = draft.step - 1) } else onBack() }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        ScreenTitle("What do you want to learn?", "Step ${draft.step + 1} of 4 · Your draft saves on this device.", back)
        LinearProgressIndicator(progress = { (draft.step + 1) / 4f }, modifier = Modifier.fillMaxWidth(), strokeCap = androidx.compose.ui.graphics.StrokeCap.Round)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { listOf("The skill", "Context", "Your level", "Delivery").forEachIndexed { index, label -> Pill(label, if (index == draft.step) "success" else "neutral") } }
        when (draft.step) {
            0 -> {
                Text("Start with the stuck moment.", style = MaterialTheme.typography.headlineSmall)
                OutlinedTextField(value = draft.title, onValueChange = { value -> vm.update { it.copy(title = value) } }, label = { Text("Give your request a clear title") }, placeholder = { Text("Merge two CSVs without losing the headers") }, isError = validation.containsKey("title"), supportingText = { Text(validation["title"] ?: "${draft.title.length}/140 characters") }, modifier = Modifier.fillMaxWidth(), minLines = 2, keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next))
                RequestRules.nudge(draft.title)?.let { InfoBox(it, true) }
                OutlinedTextField(value = draft.goal, onValueChange = { value -> vm.update { it.copy(goal = value) } }, label = { Text("What do you want to be able to do?") }, placeholder = { Text("Describe the outcome, the tool you use, and where you get stuck.") }, isError = validation.containsKey("goal"), supportingText = { Text(validation["goal"] ?: "${draft.goal.length}/1200 characters · a sentence or two is perfect") }, modifier = Modifier.fillMaxWidth(), minLines = 4)
                Text("A little inspiration", style = MaterialTheme.typography.titleSmall)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp)) { listOf("Clean a messy spreadsheet", "Publish my first website", "Make a social post in Canva").forEach { example -> AssistChip(onClick = { vm.update { d -> d.copy(title = example) } }, label = { Text(example) }) } }
                if (matches.lessons.isNotEmpty() || matches.requests.isNotEmpty()) {
                    SectionTitle("Before you ask — these may help")
                    (matches.lessons.map { it.title to it.slug } + matches.requests.map { it.title to it.slug }).take(4).forEach { (title, slug) -> OutlinedCard(onClick = { onRequest(slug) }) { Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) { Text(title, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f)); Icon(Icons.Outlined.ChevronRight, null) } } }
                }
            }
            1 -> {
                Text("Help us meet you where you are.", style = MaterialTheme.typography.headlineSmall)
                OutlinedTextField(value = draft.tried, onValueChange = { value -> vm.update { it.copy(tried = value) } }, label = { Text("What have you tried? (optional)") }, minLines = 3, modifier = Modifier.fillMaxWidth(), supportingText = { Text(validation["tried"] ?: "${draft.tried.length}/800 characters") }, isError = validation.containsKey("tried"))
                OutlinedTextField(value = draft.contextLink, onValueChange = { value -> vm.update { it.copy(contextLink = value) } }, label = { Text("A helpful link (optional)") }, placeholder = { Text("https://…") }, singleLine = true, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri), supportingText = { Text(validation["contextLink"] ?: "Only share a link you're comfortable showing the creator.") }, isError = validation.containsKey("contextLink"))
                OutlinedTextField(value = draft.deadline, onValueChange = { value -> vm.update { it.copy(deadline = value) } }, label = { Text("A deadline or time zone (optional)") }, placeholder = { Text("Before Friday, or next week is fine") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                HorizontalDivider()
                SectionTitle("Your files, if they help")
                Text("Screenshots, spreadsheets, PDFs and text files. Up to five files, 10 MB each. Private requests and their files are visible only to you and the creator.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                draft.attachments.forEach { file -> Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.small) { Row(Modifier.padding(start = 14.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Outlined.AttachFile, null, Modifier.size(20.dp)); Spacer(Modifier.width(8.dp)); Column(Modifier.weight(1f)) { Text(file.filename, style = MaterialTheme.typography.labelLarge, maxLines = 1); Text(fileSize(file.size), style = MaterialTheme.typography.bodySmall) }; IconButton(onClick = { vm.removeUpload(file) }, enabled = !uploading) { Icon(Icons.Outlined.Close, "Remove ${file.filename}") } } } }
                OutlinedButton(onClick = { if (!signedIn) onLogin() else picker.launch(arrayOf("image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel")) }, enabled = !uploading && draft.attachments.size < 5, modifier = Modifier.fillMaxWidth().heightIn(min = 50.dp)) { Icon(Icons.Outlined.UploadFile, null, Modifier.size(20.dp)); Spacer(Modifier.width(8.dp)); Text(if (uploading) "Uploading securely…" else if (signedIn) "Choose a file" else "Sign in to attach files") }
            }
            2 -> {
                Text("Make it fit your starting point.", style = MaterialTheme.typography.headlineSmall)
                Text("Closest topic", style = MaterialTheme.typography.titleMedium)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { bootstrap.categories.forEach { category -> FilterChip(selected = draft.category == category, onClick = { vm.update { it.copy(category = category) } }, label = { Text(category) }, leadingIcon = { Text(categoryGlyph(category)) }) } }
                if (validation.containsKey("category")) Text(validation["category"]!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                Text("How familiar does this feel?", style = MaterialTheme.typography.titleMedium)
                bootstrap.levels.forEach { (key, meta) -> SelectCard(meta.label, meta.hint, draft.level == key) { vm.update { it.copy(level = key) } } }
            }
            else -> {
                Text("Choose your kind of lesson.", style = MaterialTheme.typography.headlineSmall)
                bootstrap.tiers.forEach { (key, tier) -> SelectCard("${tier.label} · ${tier.price}", tier.detail, draft.tier == key, icon = if (key == "private") Icons.Outlined.Lock else if (key == "priority") Icons.Outlined.Bolt else Icons.Outlined.Groups) { vm.update { it.copy(tier = key) } } }
                if (draft.tier != "community") InfoBox("No charge yet. The creator sends a scope and exact price. You accept the quote, then decide whether to pay. ${if (bootstrap.pricing.mode == "mock") "This server is in test mode." else ""}", true)
                Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.medium) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("One last look", style = MaterialTheme.typography.titleMedium)
                    Text(draft.title, style = MaterialTheme.typography.titleSmall)
                    Text(draft.goal, style = MaterialTheme.typography.bodyMedium)
                    Text("${draft.category} · ${levelLabelSafe(draft.level)} · ${draft.attachments.size} attachments", style = MaterialTheme.typography.bodySmall)
                    Text(if (draft.tier == "private") "Private — never added to the public library." else "Public — reusable by the community once filmed.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                } }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { Checkbox(checked = agreed, onCheckedChange = { agreed = it }); Text("I understand this is a lesson request, not a guaranteed delivery date. Paid scope and price are agreed separately.", style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f)) }
            }
        }
        if (error != null) ErrorState(error!!)
        if (draft.step < 3) Button(onClick = { validation = RequestRules.errors(draft, draft.step); if (validation.isEmpty()) vm.update { it.copy(step = it.step + 1) } }, enabled = !uploading && !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Text("Continue"); Spacer(Modifier.width(8.dp)); Icon(Icons.AutoMirrored.Outlined.ArrowForward, null, Modifier.size(19.dp)) }
        else ActionButton(if (signedIn) "Send my request" else "Sign in to send", busy, agreed && !uploading) { if (signedIn) vm.submit(onCreated) else onLogin() }
        Text("You can leave and come back. Your draft stays on this device.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
private fun levelLabelSafe(value: String) = app.iwannalearn.android.ui.levelLabel(value)

@Composable private fun SelectCard(title: String, detail: String, selected: Boolean, icon: androidx.compose.ui.graphics.vector.ImageVector? = null, onClick: () -> Unit) {
    OutlinedCard(onClick = onClick, shape = MaterialTheme.shapes.medium, colors = CardDefaults.outlinedCardColors(containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface), border = androidx.compose.foundation.BorderStroke(if (selected) 2.dp else 1.dp, if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant)) {
        Row(Modifier.padding(17.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (icon != null) Icon(icon, null, Modifier.size(23.dp), tint = MaterialTheme.colorScheme.primary)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) { Text(title, style = MaterialTheme.typography.titleSmall); Text(detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            RadioButton(selected = selected, onClick = onClick)
        }
    }
}
