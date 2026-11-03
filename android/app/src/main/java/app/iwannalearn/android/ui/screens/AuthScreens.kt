package app.iwannalearn.android.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.iwannalearn.android.BuildConfig
import app.iwannalearn.android.network.Bootstrap
import app.iwannalearn.android.ui.AppViewModel
import app.iwannalearn.android.ui.components.*

@Composable fun LoginScreen(bootstrap: Bootstrap?, vm: AppViewModel, server: String, signedIn: Boolean, onAuthenticated: () -> Unit, onServer: () -> Unit, onBack: () -> Unit) {
    val state by vm.state.collectAsStateWithLifecycle()
    var email by rememberSaveable { mutableStateOf("") }; var name by rememberSaveable { mutableStateOf("") }
    LaunchedEffect(signedIn) { if (signedIn) onAuthenticated() }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        ScreenTitle("A little progress starts here.", "No password to remember. We'll send a single-use sign-in link.", onBack)
        Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = MaterialTheme.shapes.large) { Row(Modifier.padding(18.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Outlined.Shield, null, Modifier.size(30.dp)); Column { Text("Your requests stay yours.", style = MaterialTheme.typography.titleMedium); Text("Private files, quotes and lessons are tied to your account.", style = MaterialTheme.typography.bodyMedium) } } }
        if (state.pendingToken != null) {
            InfoBox("Your email link is ready. Confirm below to finish signing in on this device.")
            ActionButton("Finish signing in", state.busy, onClick = vm::confirmLink)
            TextButton(onClick = vm::cancelLink, modifier = Modifier.fillMaxWidth()) { Text("Use a different link") }
        }
        OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email address") }, leadingIcon = { Icon(Icons.Outlined.Email, null) }, singleLine = true, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next))
        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Your name (optional)") }, singleLine = true, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done))
        if (state.error != null) ErrorState(state.error!!)
        ActionButton("Email me a sign-in link", state.busy, email.contains("@") && server.isNotBlank()) { vm.login(email.trim(), name.trim()) }
        if (state.loginMessage != null) {
            InfoBox(state.loginMessage!!)
            if (state.demoToken != null) OutlinedButton(onClick = vm::openDemoLink, enabled = !state.busy, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Icon(Icons.Outlined.MarkEmailRead, null, Modifier.size(19.dp)); Spacer(Modifier.width(8.dp)); Text("Open demo email link") }
        }
        if (bootstrap?.demoMode == true) {
            HorizontalDivider(); Text("TRY THE DEMO", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { OutlinedButton(onClick = { vm.demo(false) }, enabled = !state.busy, modifier = Modifier.weight(1f).heightIn(min = 50.dp)) { Text("As a learner") }; OutlinedButton(onClick = { vm.demo(true) }, enabled = !state.busy, modifier = Modifier.weight(1f).heightIn(min = 50.dp)) { Text("As the creator") } }
            Text("Demo accounts use seeded data. Test checkout never moves real money.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        TextButton(onClick = onServer, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Outlined.Dns, null, Modifier.size(17.dp)); Spacer(Modifier.width(7.dp)); Text("Server: ${server.ifBlank { "not connected" }}", maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis) }
    }
}

@Composable fun ServerScreen(vm: AppViewModel, onConnected: () -> Unit, onBack: (() -> Unit)? = null) {
    val state by vm.state.collectAsStateWithLifecycle()
    var submitted by remember { mutableStateOf(false) }
    var address by rememberSaveable(state.server) { mutableStateOf(state.server) }
    LaunchedEffect(state.bootstrap, state.server) { if (submitted && state.bootstrap != null && state.server == address.trim().trimEnd('/') && !state.loading && !state.busy) onConnected() }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
        Surface(color = MaterialTheme.colorScheme.primary, shape = MaterialTheme.shapes.large) { Icon(Icons.Outlined.AutoStories, null, Modifier.padding(18.dp).size(36.dp), tint = MaterialTheme.colorScheme.onPrimary) }
        ScreenTitle("Connect your learning space.", "This is a native Android app. Connect it to the iwannalearn server that holds your account and lessons.", onBack)
        OutlinedTextField(value = address, onValueChange = { address = it }, label = { Text("Server address") }, placeholder = { Text("https://learn.yourdomain.com") }, singleLine = true, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Done), supportingText = { Text(if (BuildConfig.ALLOW_HTTP_DEV) "Emulator: http://10.0.2.2:3000. A phone needs your computer's LAN address or an HTTPS deployment." else "A production HTTPS address is required.") })
        if (state.error != null) ErrorState(state.error!!)
        ActionButton("Connect securely", state.busy || state.loading, address.isNotBlank()) { vm.connect(address) }
        if (state.bootstrap != null) TextButton(onClick = onConnected, modifier = Modifier.fillMaxWidth()) { Text("Continue with this server") }
        InfoBox("Changing servers signs you out and clears private cached files. Server secrets, payment keys and database credentials never go inside the APK.")
        Text("Your operator must deploy the included backend with a persistent database and HTTPS. The app does not pretend to sync when that server is unreachable.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
