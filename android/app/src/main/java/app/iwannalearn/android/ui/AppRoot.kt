package app.iwannalearn.android.ui

import android.content.Intent
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.*
import androidx.navigation.navArgument
import app.iwannalearn.android.network.Bootstrap
import app.iwannalearn.android.appContainer
import app.iwannalearn.android.player.PlayerScreen
import app.iwannalearn.android.ui.screens.*
import kotlinx.coroutines.flow.MutableStateFlow

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun AppRoot(intents: MutableStateFlow<Intent?>, vm: AppViewModel = viewModel()) {
    val state by vm.state.collectAsStateWithLifecycle(); val session by vm.session.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route
    val snackbar = remember { SnackbarHostState() }
    val c = context.appContainer
    fun go(route: String) { nav.navigate(route) { launchSingleTop = true } }
    fun root(route: String) { nav.navigate(route) { popUpTo(nav.graph.findStartDestination().id) { saveState = true }; launchSingleTop = true; restoreState = true } }
    fun login(next: String = Routes.LEARN) = go(Routes.login(next))
    LaunchedEffect(Unit) { c.messages.collect { snackbar.showSnackbar(it) } }
    LaunchedEffect(state.pendingToken) { if (state.pendingToken != null) go(Routes.login()) }
    val intent by intents.collectAsStateWithLifecycle()
    LaunchedEffect(intent) {
        intent?.let { value ->
            vm.receiveLink(value.data)
            value.getStringExtra("notification_href")?.let { href -> Routes.fromHref(href)?.let { go(it) }; value.removeExtra("notification_href") }
        }
    }
    LaunchedEffect(currentRoute, session?.token) { if (session != null) vm.refreshUnread() }
    if (!state.ready) { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }; return }
    if (state.server.isBlank()) { ServerScreen(vm, onConnected = { go(Routes.HOME) }); return }
    val roots = setOf(Routes.HOME, Routes.EXPLORE, Routes.LEARN, Routes.ALERTS, Routes.ACCOUNT)
    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = { TopAppBar(title = { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) { Icon(Icons.AutoMirrored.Outlined.MenuBook, null, Modifier.size(25.dp), tint = MaterialTheme.colorScheme.primary); Text("iwannalearn", style = MaterialTheme.typography.headlineSmall) } }, actions = { IconButton(onClick = { go("how") }) { Icon(Icons.Outlined.HelpOutline, "How it works") }; IconButton(onClick = { go("server") }) { Icon(Icons.Outlined.CloudQueue, "Server connection", tint = if (state.bootstrap == null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary) } }, colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)) },
        bottomBar = { if (currentRoute in roots) NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
            listOf(Triple(Routes.HOME, "Home", Icons.Outlined.Home), Triple(Routes.EXPLORE, "Explore", Icons.Outlined.TravelExplore), Triple(Routes.LEARN, "My learning", Icons.Outlined.AutoStories), Triple(Routes.ALERTS, "Alerts", Icons.Outlined.Notifications), Triple(Routes.ACCOUNT, "Account", Icons.Outlined.PersonOutline)).forEach { (route, label, icon) -> NavigationBarItem(selected = currentRoute == route, onClick = { root(route) }, icon = { if (route == Routes.ALERTS && state.unread > 0) BadgedBox(badge = { Badge { Text(state.unread.coerceAtMost(99).toString()) } }) { Icon(icon, label) } else Icon(icon, label) }, label = { Text(label, style = MaterialTheme.typography.labelSmall) }) }
        } },
        contentWindowInsets = WindowInsets.safeDrawing,
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            if (state.bootstrap == null) Surface(color = MaterialTheme.colorScheme.secondaryContainer) { Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) { Text(if (state.loading) "Connecting to your learning space…" else "Server unavailable. Saved public lessons are still in Explore.", style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f)); TextButton(onClick = { if (state.loading) Unit else vm.refreshBootstrap() }) { Text("Retry") } } }
            val bootstrap = state.bootstrap ?: Bootstrap()
            NavHost(navController = nav, startDestination = Routes.HOME, modifier = Modifier.weight(1f)) {
                composable(Routes.HOME) { HomeScreen(bootstrap, session != null, onCreate = { go(Routes.create()) }, onExplore = { q, c, t -> go(Routes.explore(q, c, t)) }, onLesson = { go(Routes.lesson(it)) }, onRequest = { go(Routes.request(it)) }, onHow = { go("how") }, onPricing = { go("pricing") }) }
                composable(Routes.EXPLORE, arguments = listOf(navArgument("query") { defaultValue = "" }, navArgument("category") { defaultValue = "" }, navArgument("tab") { defaultValue = "lessons" })) { entry -> ExploreScreen(bootstrap, entry.arguments?.getString("query").orEmpty(), entry.arguments?.getString("category").orEmpty(), entry.arguments?.getString("tab") ?: "lessons", onLesson = { go(Routes.lesson(it)) }, onRequest = { go(Routes.request(it)) }, onCreate = { query -> go(if (query.length >= 12) Routes.create() else Routes.explore(query, "", "requests")) }) }
                composable(Routes.LEARN) { DashboardScreen(session != null, onLogin = { login() }, onCreate = { go(Routes.create()) }, onRequest = { go(Routes.request(it)) }) }
                composable(Routes.ALERTS) { NotificationsScreen(session != null, onLogin = { login() }, onOpen = { href -> Routes.fromHref(href)?.let { go(it) } }) }
                composable(Routes.ACCOUNT) { AccountScreen(session?.user, onLogin = { login(Routes.ACCOUNT) }, onLogout = vm::signOut, onServer = { go("server") }, onAdmin = { go("admin") }, onSupport = { go("support") }, onLegal = { go(Routes.legal(it)) }) }
                composable("create?tier={tier}", arguments = listOf(navArgument("tier") { defaultValue = "" })) { entry -> CreateRequestScreen(bootstrap, session != null, entry.arguments?.getString("tier").orEmpty(), onBack = { nav.popBackStack() }, onLogin = { login(Routes.create()) }, onCreated = { slug -> nav.navigate(Routes.request(slug)) { popUpTo(Routes.HOME) } }, onRequest = { go(Routes.request(it)) }) }
                composable("request/{slug}") { entry -> val slug = entry.arguments?.getString("slug").orEmpty(); RequestScreen(slug, session != null, bootstrap, onBack = { nav.popBackStack() }, onLogin = { login(Routes.request(slug)) }, onRequest = { go(Routes.request(it)) }, onCheckout = { go(Routes.checkout(it)) }, onPlay = { go(Routes.player(it)) }, onLesson = { go(Routes.lesson(it)) }) }
                composable("lesson/{slug}") { entry -> LessonScreen(entry.arguments?.getString("slug").orEmpty(), onBack = { nav.popBackStack() }, onPlay = { go(Routes.player(it)) }, onRequest = { go(Routes.request(it)) }) }
                composable("player/{id}") { entry -> PlayerScreen(entry.arguments?.getString("id").orEmpty(), onBack = { nav.popBackStack() }, onSupport = { go("support") }) }
                composable("checkout/{slug}") { entry -> CheckoutScreen(entry.arguments?.getString("slug").orEmpty(), bootstrap, onBack = { nav.popBackStack() }, onPaid = { nav.popBackStack() }, onTerms = { go(Routes.legal("terms")) }) }
                composable("login?next={next}", arguments = listOf(navArgument("next") { defaultValue = Routes.LEARN })) { entry -> LoginScreen(bootstrap, vm, state.server, session != null, onAuthenticated = { val next = entry.arguments?.getString("next") ?: Routes.LEARN; nav.navigate(next) { popUpTo(Routes.HOME); launchSingleTop = true } }, onServer = { go("server") }, onBack = { nav.popBackStack() }) }
                composable("server") { ServerScreen(vm, onConnected = { nav.popBackStack() }, onBack = { nav.popBackStack() }) }
                composable("admin") { AdminScreen(session?.user?.role == "creator", onBack = { nav.popBackStack() }, onRequest = { go(Routes.request(it)) }, onExplore = { go(Routes.explore(it, "", "requests")) }) }
                composable("support") { SupportScreen(session?.user?.email.orEmpty(), onBack = { nav.popBackStack() }) }
                composable("legal/{key}") { entry -> LegalScreen(bootstrap.legal[entry.arguments?.getString("key")], onBack = { nav.popBackStack() }) }
                composable("how") { HowItWorksScreen(onCreate = { go(Routes.create()) }, onBack = { nav.popBackStack() }) }
                composable("pricing") { PricingScreen(bootstrap, onCreate = { go(Routes.create(it)) }, onBack = { nav.popBackStack() }) }
            }
        }
    }
}
