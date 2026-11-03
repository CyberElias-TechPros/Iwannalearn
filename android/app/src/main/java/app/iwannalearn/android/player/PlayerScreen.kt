@file:androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)

package app.iwannalearn.android.player

import android.view.WindowManager
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import app.iwannalearn.android.appContainer
import app.iwannalearn.android.network.Playback
import app.iwannalearn.android.ui.PlayerViewModel
import app.iwannalearn.android.ui.components.*
import app.iwannalearn.android.ui.findActivity
import app.iwannalearn.android.ui.openYouTube

@Composable fun PlayerScreen(requestId: String, onBack: () -> Unit, onSupport: () -> Unit, vm: PlayerViewModel = viewModel()) {
    val playback by vm.data.collectAsStateWithLifecycle(); val loading by vm.loading.collectAsStateWithLifecycle(); val error by vm.error.collectAsStateWithLifecycle()
    val context = LocalContext.current
    LaunchedEffect(requestId) { vm.load(requestId) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        ScreenTitle(playback?.title ?: "Your lesson", if (playback?.private == true) "Private · account-bound access" else "One useful thing, at your pace.", onBack)
        if (loading) LoadingState("Checking your access…")
        if (error != null) { ErrorState(error!!, { vm.load(requestId) }); OutlinedButton(onClick = onSupport, modifier = Modifier.fillMaxWidth()) { Text("Contact support") } }
        playback?.let { media ->
            if (media.kind == "youtube") {
                Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = MaterialTheme.shapes.large) { Column(Modifier.fillMaxWidth().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) { Icon(Icons.Outlined.PlayCircle, null, Modifier.size(66.dp), tint = MaterialTheme.colorScheme.primary); Text("Ready when you are.", style = MaterialTheme.typography.headlineSmall); Text("This public lesson is hosted on YouTube. It opens outside this app, never in an embedded WebView.", style = MaterialTheme.typography.bodyMedium); ActionButton("Open in YouTube") { runCatching { context.openYouTube(media.videoId!!) }.onFailure { vm.error.value = it.message } } } }
            } else {
                NativeVideo(media) { vm.error.value = it }
                LaunchedEffect(media.url) { vm.played(requestId) }
                InfoBox(if (media.private) "Private playback checks your entitlement on the server. No video is saved for offline use, and screenshots are blocked while this screen is open." else "Native playback with streaming and seeking. This lesson isn't downloaded to your device.")
                TextButton(onClick = { vm.load(requestId) }, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Outlined.Refresh, null, Modifier.size(18.dp)); Spacer(Modifier.width(7.dp)); Text("Refresh playback access") }
            }
        }
    }
}

@Composable private fun NativeVideo(media: Playback, onError: (String) -> Unit) {
    val context = LocalContext.current
    val c = context.appContainer
    val activity = context.findActivity()
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    if (media.private) DisposableEffect(activity) {
        activity?.window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        onDispose { activity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_SECURE) }
    }
    val player = remember(media.url) {
        val source = DefaultHttpDataSource.Factory().setConnectTimeoutMs(15_000).setReadTimeoutMs(30_000).setAllowCrossProtocolRedirects(false)
            .apply { if (c.api.matchesServer(media.url)) c.sessions.token?.let { setDefaultRequestProperties(mapOf("Authorization" to "Bearer $it")) } }
        ExoPlayer.Builder(context).setMediaSourceFactory(DefaultMediaSourceFactory(source)).build().apply {
            setMediaItem(MediaItem.Builder().setUri(media.url).setMediaId(media.title).build())
            playWhenReady = true
            prepare()
        }
    }
    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onPlayerError(error: PlaybackException) { onError("Playback couldn't continue. Check your connection, then refresh access. If the video host is unavailable, contact support.") }
        }
        player.addListener(listener)
        onDispose { player.removeListener(listener); player.release() }
    }
    DisposableEffect(player, lifecycle) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_PAUSE || event == Lifecycle.Event.ON_STOP) player.pause() }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }
    AndroidView(factory = { ctx -> PlayerView(ctx).apply { useController = true; setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING); keepScreenOn = true; this.player = player } }, update = { it.player = player }, modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(Color.Black))
}
