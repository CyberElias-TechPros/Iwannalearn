package app.iwannalearn.android.ui

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.iwannalearn.android.BuildConfig
import app.iwannalearn.android.appContainer
import app.iwannalearn.android.data.ServerAddress
import app.iwannalearn.android.network.Bootstrap
import app.iwannalearn.android.notifications.NotificationScheduler
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class AppState(val ready: Boolean = false, val loading: Boolean = false, val bootstrap: Bootstrap? = null, val error: String? = null, val server: String = "", val busy: Boolean = false, val loginMessage: String? = null, val demoToken: String? = null, val pendingToken: String? = null, val unread: Int = 0)
class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val c = application.appContainer
    private val _state = MutableStateFlow(AppState())
    val state = _state.asStateFlow()
    val session = c.sessions.session
    init {
        viewModelScope.launch {
            val url = c.preferences.serverUrl.first(); c.server.value = url
            _state.update { it.copy(ready = true, server = url) }
            refreshBootstrap()
        }
        viewModelScope.launch { session.map { it?.token }.distinctUntilChanged().collect { if (it != null) runCatching { c.repository.me() } } }
    }
    fun refreshBootstrap() {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                if (c.server.value.isBlank()) { _state.update { it.copy(loading = false, bootstrap = null) }; return@launch }
                val result = c.repository.bootstrap()
                if (result.apiVersion != 1) throw IllegalStateException("This server uses a newer API. Update the Android app.")
                _state.update { it.copy(bootstrap = result, loading = false, error = null) }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { _state.update { it.copy(loading = false, error = e.message ?: "Couldn't connect.") } }
        }
    }
    fun connect(address: String) {
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null) }
            try {
                val normalized = ServerAddress.normalize(address, BuildConfig.ALLOW_HTTP_DEV)
                if (normalized != c.server.value) { c.sessions.clear(); c.cache.cacheDao().clear(); c.api.clearPrivateFiles(); NotificationScheduler.disable(getApplication()) }
                c.server.value = normalized; c.preferences.setServer(normalized)
                _state.update { it.copy(server = normalized, busy = false, loginMessage = null, demoToken = null, pendingToken = null) }
                refreshBootstrap()
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { _state.update { it.copy(busy = false, error = e.message) } }
        }
    }
    fun login(email: String, name: String) = viewModelScope.launch {
        _state.update { it.copy(busy = true, error = null, loginMessage = null) }
        try { val result = c.repository.login(email, name); _state.update { it.copy(busy = false, loginMessage = result.message, demoToken = result.demoToken) } }
        catch (e: CancellationException) { throw e }
        catch (e: Exception) { _state.update { it.copy(busy = false, error = e.message) } }
    }
    fun demo(creator: Boolean) = authenticate { c.repository.demo(creator) }
    fun receiveLink(uri: Uri?) {
        if (uri == null) return
        val token = if (uri.scheme == "iwannalearn" && uri.host == "auth") uri.getQueryParameter("token") else if (uri.scheme == "https" && uri.path == "/auth/android") uri.getQueryParameter("token") else null
        if (token?.matches(Regex("^[a-f0-9]{32}$")) == true) _state.update { it.copy(pendingToken = token, error = null) }
    }
    fun confirmLink() { val token = state.value.pendingToken ?: return; authenticate { c.repository.exchange(token); _state.update { it.copy(pendingToken = null) } } }
    fun openDemoLink() { val token = state.value.demoToken ?: return; authenticate { c.repository.exchange(token) } }
    fun cancelLink() { _state.update { it.copy(pendingToken = null) } }
    private fun authenticate(block: suspend () -> Unit) = viewModelScope.launch {
        _state.update { it.copy(busy = true, error = null) }
        try { block(); _state.update { it.copy(busy = false, loginMessage = null, demoToken = null) }; c.messages.tryEmit("You're signed in. Let's learn something useful.") }
        catch (e: CancellationException) { throw e }
        catch (e: Exception) { _state.update { it.copy(busy = false, error = e.message) } }
    }
    fun signOut() = viewModelScope.launch {
        _state.update { it.copy(busy = true) }
        c.repository.logout(); NotificationScheduler.disable(getApplication())
        _state.update { it.copy(busy = false, pendingToken = null, demoToken = null, loginMessage = null) }
        c.messages.tryEmit("Signed out. Your private files were cleared from this device.")
    }
    fun refreshUnread() = viewModelScope.launch {
        if (c.sessions.token == null) { _state.update { it.copy(unread = 0) }; return@launch }
        runCatching { c.repository.notifications() }.onSuccess { result -> _state.update { it.copy(unread = result.unread) } }
    }
    fun clearError() { _state.update { it.copy(error = null) } }
}
