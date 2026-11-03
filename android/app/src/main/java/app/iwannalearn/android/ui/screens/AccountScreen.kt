package app.iwannalearn.android.ui.screens

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import app.iwannalearn.android.network.User
import app.iwannalearn.android.ui.AccountViewModel
import app.iwannalearn.android.ui.SupportViewModel
import app.iwannalearn.android.ui.components.*

@Composable fun AccountScreen(user: User?, onLogin: () -> Unit, onLogout: () -> Unit, onServer: () -> Unit, onAdmin: () -> Unit, onSupport: () -> Unit, onLegal: (String) -> Unit, vm: AccountViewModel = viewModel()) {
    val busy by vm.busy.collectAsStateWithLifecycle(); val error by vm.error.collectAsStateWithLifecycle(); val alerts by vm.alerts.collectAsStateWithLifecycle()
    var name by rememberSaveable(user?.id) { mutableStateOf(user?.name.orEmpty()) }; var phone by rememberSaveable(user?.id) { mutableStateOf(user?.phone.orEmpty()) }
    var emailOn by rememberSaveable(user?.id) { mutableStateOf(user?.notifyEmail ?: true) }; var smsOn by rememberSaveable(user?.id) { mutableStateOf(user?.notifySms ?: false) }; var digestOn by rememberSaveable(user?.id) { mutableStateOf(user?.digest ?: true) }
    var deleting by rememberSaveable { mutableStateOf(false) }; var confirmation by rememberSaveable { mutableStateOf("") }; var permissionMessage by remember { mutableStateOf<String?>(null) }
    val exporter = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri -> uri?.let(vm::export) }
    val permissions = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted -> if (granted) vm.setAlerts(true) else permissionMessage = "Notifications are off. You can enable them in Android settings; the Alerts tab still works." }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        ScreenTitle(if (user == null) "Your space" else "Hello, ${user.name?.substringBefore(' ') ?: "learner"}.", if (user == null) "A few details, and the right notifications." else user.email)
        if (error != null) ErrorState(error!!)
        if (user == null) { EmptyState("Keep your learning in one place.", "Sign in for your profile, private lessons and notification preferences.", "Sign in", onLogin); return@Column }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = androidx.compose.foundation.shape.CircleShape) { Text((user.name ?: user.email).take(1).uppercase(), style = MaterialTheme.typography.headlineMedium, modifier = Modifier.padding(20.dp), color = MaterialTheme.colorScheme.primary) }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) { Text(user.name ?: "Learner", style = MaterialTheme.typography.titleLarge); Pill(if (user.role == "creator") "Creator" else "Learner", "success") }
        }
        if (user.emailBounced) InfoBox("Your email address is bouncing. Alerts still work. Correct the address with support to restore email.", true)
        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("What should we call you?") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Phone for optional SMS") }, placeholder = { Text("+234 801 234 5678") }, singleLine = true, modifier = Modifier.fillMaxWidth(), supportingText = { Text("SMS delivery requires a provider on the server; saving a number doesn't enable it by itself.") })
        Text("How you hear from us", style = MaterialTheme.typography.titleMedium)
        PreferenceToggle("Email updates", "Lesson news. Sign-in links and receipts still send.", emailOn, { emailOn = it }, Icons.Outlined.Email)
        PreferenceToggle("SMS / WhatsApp", "Only important updates, when the server has a provider.", smsOn, { smsOn = it }, Icons.Outlined.Sms)
        PreferenceToggle("Occasional digest", "A short round-up of new lessons.", digestOn, { digestOn = it }, Icons.Outlined.Newspaper)
        PreferenceToggle("Android background alerts", "Optional checks about once an hour. Android chooses the exact time; not instant push.", alerts, { enabled -> if (!enabled) vm.setAlerts(false) else if (Build.VERSION.SDK_INT >= 33) permissions.launch(Manifest.permission.POST_NOTIFICATIONS) else vm.setAlerts(true) }, Icons.Outlined.NotificationsActive)
        permissionMessage?.let { InfoBox(it, true) }
        ActionButton("Save preferences", busy) { vm.save(user.copy(name = name.trim(), phone = phone.trim(), notifyEmail = emailOn, notifySms = smsOn, digest = digestOn)) }
        HorizontalDivider()
        if (user.role == "creator") AccountLink("Creator studio", "Queue, quotes, delivery, payments and insights", Icons.Outlined.DashboardCustomize, onAdmin)
        AccountLink("Get help", "Send a message to the person behind the lessons", Icons.Outlined.SupportAgent, onSupport)
        AccountLink("Server connection", "Change the backend this native app connects to", Icons.Outlined.Dns, onServer)
        AccountLink("Export my data", "Save your account, requests and receipts as JSON", Icons.Outlined.Download, { exporter.launch("iwannalearn-export.json") })
        AccountLink("Privacy", "What is collected and what stays private", Icons.Outlined.PrivacyTip) { onLegal("privacy") }
        AccountLink("Terms & refunds", "Scope, revisions, refunds and payment terms", Icons.Outlined.Description) { onLegal("terms") }
        AccountLink("What we don't cover", "A short, honest list of boundaries", Icons.Outlined.Block) { onLegal("not-covered") }
        OutlinedButton(onClick = onLogout, enabled = !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 50.dp)) { Icon(Icons.Outlined.Logout, null, Modifier.size(19.dp)); Spacer(Modifier.width(8.dp)); Text("Sign out") }
        TextButton(onClick = { deleting = true }, colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error), modifier = Modifier.fillMaxWidth()) { Text("Delete my account and private data") }
        Text("iwannalearn for Android · 1.0.0\nNative interface. No WebView.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if (deleting) AlertDialog(onDismissRequest = { deleting = false }, title = { Text("Delete your account?") }, text = { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { Text("Private requests and account data are removed. Public lessons stay, detached from your identity. This cannot be undone."); OutlinedTextField(value = confirmation, onValueChange = { confirmation = it }, label = { Text("Type DELETE to confirm") }, singleLine = true) } }, confirmButton = { TextButton(enabled = confirmation == "DELETE" && !busy, onClick = { vm.delete { deleting = false } }, colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)) { Text("Delete account") } }, dismissButton = { TextButton(onClick = { deleting = false }) { Text("Cancel") } })
}
@Composable private fun PreferenceToggle(title: String, detail: String, checked: Boolean, onChange: (Boolean) -> Unit, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Row(Modifier.fillMaxWidth().heightIn(min = 60.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(icon, null, Modifier.size(22.dp), tint = MaterialTheme.colorScheme.primary)
        Column(Modifier.weight(1f)) { Text(title, style = MaterialTheme.typography.titleSmall); Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        Switch(checked = checked, onCheckedChange = onChange)
    }
}
@Composable private fun AccountLink(title: String, detail: String, icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    Surface(onClick = onClick, color = MaterialTheme.colorScheme.surface, shape = MaterialTheme.shapes.medium) { Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) { Icon(icon, null, Modifier.size(23.dp), tint = MaterialTheme.colorScheme.primary); Column(Modifier.weight(1f)) { Text(title, style = MaterialTheme.typography.titleSmall); Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }; Icon(Icons.Outlined.ChevronRight, null, Modifier.size(20.dp)) } }
}

@Composable fun SupportScreen(defaultEmail: String, onBack: () -> Unit, vm: SupportViewModel = viewModel()) {
    var email by rememberSaveable { mutableStateOf(defaultEmail) }; var subject by rememberSaveable { mutableStateOf("") }; var message by rememberSaveable { mutableStateOf("") }
    val busy by vm.busy.collectAsStateWithLifecycle(); val error by vm.error.collectAsStateWithLifecycle()
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        ScreenTitle("A real person will read this.", "Tell us what's getting in the way. Give us a working day to reply.", onBack)
        OutlinedTextField(email, { email = it }, label = { Text("Your email") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(subject, { subject = it }, label = { Text("Subject") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(message, { message = it }, label = { Text("What can we help with?") }, minLines = 5, modifier = Modifier.fillMaxWidth(), supportingText = { Text("${message.length}/2000 characters") })
        if (error != null) ErrorState(error!!)
        ActionButton("Send message", busy, email.contains("@") && subject.trim().length >= 3 && message.trim().length >= 10) { vm.send(email.trim(), subject.trim(), message.trim(), onBack) }
    }
}

@Composable fun LegalScreen(document: app.iwannalearn.android.network.LegalDoc?, onBack: () -> Unit) {
    if (document == null) { Box(Modifier.fillMaxSize().padding(20.dp)) { EmptyState("Policy unavailable", "Connect to the server to load its current terms.", "Go back", onBack) }; return }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
        ScreenTitle(document.title, document.lede, onBack)
        InfoBox("Pre-launch draft. These terms must be reviewed before real payments are enabled.", true)
        document.sections.forEach { section -> Column(verticalArrangement = Arrangement.spacedBy(9.dp)) { Text(section.heading, style = MaterialTheme.typography.titleLarge); section.body.forEach { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) } } }
    }
}
