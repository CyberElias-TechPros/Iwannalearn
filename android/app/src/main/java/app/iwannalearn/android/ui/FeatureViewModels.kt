package app.iwannalearn.android.ui

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.iwannalearn.android.appContainer
import app.iwannalearn.android.data.*
import app.iwannalearn.android.network.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

suspend fun attempt(error: MutableStateFlow<String?>, block: suspend () -> Unit) {
    error.value = null
    try { block() } catch (e: CancellationException) { throw e } catch (e: Exception) { error.value = e.message ?: "Something went wrong. Try again." }
}

data class ExploreState(val tab: String = "lessons", val query: String = "", val category: String = "", val level: String = "", val sort: String = "newest", val page: Int = 1, val pageSize: Int = 12, val total: Int = 0, val lessons: List<LessonItem> = emptyList(), val requests: List<RequestItem> = emptyList(), val loading: Boolean = false, val more: Boolean = false, val error: String? = null)
class ExploreViewModel(app: Application) : AndroidViewModel(app) {
    private val c = app.appContainer
    private val _state = MutableStateFlow(ExploreState()); val state = _state.asStateFlow()
    val cachedLessons = c.repository.cachedLessons(); val cachedRequests = c.repository.cachedRequests()
    private var job: Job? = null; private var debounce: Job? = null
    fun start(query: String = "", category: String = "", tab: String = "lessons") { _state.update { it.copy(query = query, category = category, tab = tab) }; load() }
    fun tab(value: String) { _state.update { it.copy(tab = value) }; load() }
    fun query(value: String) { _state.update { it.copy(query = value) }; debounce?.cancel(); debounce = viewModelScope.launch { delay(350); load() } }
    fun filter(category: String? = null, level: String? = null, sort: String? = null) { _state.update { it.copy(category = category ?: it.category, level = level ?: it.level, sort = sort ?: it.sort) }; load() }
    fun load(more: Boolean = false) {
        job?.cancel()
        job = viewModelScope.launch {
            val s = state.value; val page = if (more) s.page + 1 else 1
            _state.update { it.copy(loading = !more, more = more, error = null) }
            try {
                val result = c.repository.explore(s.tab, s.query, s.category, s.level, page, s.sort)
                _state.update { it.copy(loading = false, more = false, page = page, total = result.total, lessons = if (more) it.lessons + result.lessons else result.lessons, requests = if (more) it.requests + result.requests else result.requests) }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { _state.update { it.copy(loading = false, more = false, error = e.message) } }
        }
    }
    fun vote(item: RequestItem) = viewModelScope.launch {
        attempt(_stateError) { c.repository.vote(item.id); load() }
    }
    private val _stateError = MutableStateFlow<String?>(null)
    init { viewModelScope.launch { _stateError.filterNotNull().collect { message -> _state.update { it.copy(error = message) } } } }
}

data class HomeState(val lessons: List<LessonItem> = emptyList(), val requests: List<RequestItem> = emptyList(), val loading: Boolean = false, val error: String? = null)
class HomeViewModel(app: Application) : AndroidViewModel(app) {
    private val c = app.appContainer
    private val _state = MutableStateFlow(HomeState()); val state = _state.asStateFlow()
    init { load() }
    fun load() = viewModelScope.launch {
        _state.update { it.copy(loading = true, error = null) }
        try {
            val lessons = c.repository.explore("lessons")
            val requests = c.repository.explore("requests", sort = "popular")
            _state.update { it.copy(lessons = lessons.lessons.take(6), requests = requests.requests.take(3), loading = false) }
        } catch (e: CancellationException) { throw e }
        catch (e: Exception) { _state.update { it.copy(loading = false, error = e.message) } }
    }
}

class DashboardViewModel(app: Application) : AndroidViewModel(app) {
    private val c = app.appContainer
    private val _data = MutableStateFlow(Dashboard()); val data = _data.asStateFlow()
    private val _loading = MutableStateFlow(false); val loading = _loading.asStateFlow()
    val error = MutableStateFlow<String?>(null)
    fun load() = viewModelScope.launch { _loading.value = true; attempt(error) { _data.value = c.repository.dashboard() }; _loading.value = false }
}
class NotificationsViewModel(app: Application) : AndroidViewModel(app) {
    private val c = app.appContainer
    private val _data = MutableStateFlow(Notifications()); val data = _data.asStateFlow()
    private val _loading = MutableStateFlow(false); val loading = _loading.asStateFlow()
    val error = MutableStateFlow<String?>(null); private val _busy = MutableStateFlow(false); val busy = _busy.asStateFlow()
    fun load() = viewModelScope.launch { _loading.value = true; attempt(error) { _data.value = c.repository.notifications() }; _loading.value = false }
    fun read(id: String? = null) = viewModelScope.launch { _busy.value = true; attempt(error) { c.repository.readNotifications(id); _data.value = c.repository.notifications() }; _busy.value = false }
}
class LessonViewModel(app: Application) : AndroidViewModel(app) {
    private val c = app.appContainer
    val cached = c.repository.cachedLessons()
    private val _data = MutableStateFlow<LessonItem?>(null); val data = _data.asStateFlow()
    val error = MutableStateFlow<String?>(null); private val _loading = MutableStateFlow(false); val loading = _loading.asStateFlow()
    fun load(slug: String) = viewModelScope.launch { _loading.value = true; attempt(error) { _data.value = c.repository.lesson(slug) }; _loading.value = false }
}

class RequestViewModel(app: Application) : AndroidViewModel(app) {
    private val c = app.appContainer
    private val _data = MutableStateFlow<RequestDetail?>(null); val data = _data.asStateFlow()
    val error = MutableStateFlow<String?>(null); private val _loading = MutableStateFlow(false); val loading = _loading.asStateFlow()
    private val _busy = MutableStateFlow(false); val busy = _busy.asStateFlow()
    private val _checkout = MutableStateFlow<Checkout?>(null); val checkout = _checkout.asStateFlow()
    private var slug = ""
    fun load(value: String) { slug = value; viewModelScope.launch { _loading.value = true; attempt(error) { _data.value = c.repository.requestDetail(slug) }; _loading.value = false } }
    fun act(action: String, payload: JsonElement = JsonObject(emptyMap()), message: String = "Saved.") = viewModelScope.launch {
        val id = data.value?.request?.id ?: return@launch
        _busy.value = true
        attempt(error) { c.repository.action(id, action, payload); _data.value = c.repository.requestDetail(slug); c.messages.tryEmit(message) }
        _busy.value = false
    }
    fun vote() = viewModelScope.launch {
        val id = data.value?.request?.id ?: return@launch
        _busy.value = true; attempt(error) { c.repository.vote(id); _data.value = c.repository.requestDetail(slug) }; _busy.value = false
    }
    fun openAttachment(attachment: Attachment, open: (java.io.File, String) -> Unit) = viewModelScope.launch {
        _busy.value = true; attempt(error) { val file = c.api.attachment(attachment.id, attachment.filename); open(file, attachment.mime) }; _busy.value = false
    }
    fun startCheckout() = viewModelScope.launch {
        val id = data.value?.request?.id ?: return@launch
        _busy.value = true; attempt(error) { _checkout.value = c.repository.checkout(id) }; _busy.value = false
    }
    fun confirmTest(reference: String, done: () -> Unit) = viewModelScope.launch {
        val id = data.value?.request?.id ?: return@launch
        _busy.value = true
        attempt(error) { c.repository.action(id, "confirm-test-payment", JsonObject(mapOf("reference" to kotlinx.serialization.json.JsonPrimitive(reference)))); _data.value = c.repository.requestDetail(slug); c.messages.tryEmit("Test payment confirmed. No real money moved."); done() }
        _busy.value = false
    }
}

class CreateRequestViewModel(app: Application) : AndroidViewModel(app) {
    private val c = app.appContainer
    private val _draft = MutableStateFlow(RequestDraft()); val draft = _draft.asStateFlow()
    val error = MutableStateFlow<String?>(null); private val _busy = MutableStateFlow(false); val busy = _busy.asStateFlow()
    private val _uploading = MutableStateFlow(false); val uploading = _uploading.asStateFlow()
    private val _matches = MutableStateFlow(SearchResults()); val matches = _matches.asStateFlow()
    private var saveJob: Job? = null; private var searchJob: Job? = null; private var initialized = false
    init { viewModelScope.launch {
        val saved = c.preferences.draft.first(); val owner = c.sessions.user?.id.orEmpty()
        _draft.value = saved?.takeIf { it.ownerId == owner || it.ownerId.isEmpty() }?.copy(ownerId = owner) ?: RequestDraft(ownerId = owner)
        initialized = true
    } }
    fun update(change: (RequestDraft) -> RequestDraft) {
        _draft.update(change); error.value = null
        if (initialized) { saveJob?.cancel(); saveJob = viewModelScope.launch { delay(180); c.preferences.saveDraft(_draft.value) } }
    }
    fun findMatches() {
        val q = draft.value.title.trim(); searchJob?.cancel()
        if (q.length < 5) { _matches.value = SearchResults(); return }
        searchJob = viewModelScope.launch { delay(450); runCatching { c.repository.search(q) }.onSuccess { _matches.value = it } }
    }
    fun upload(uri: Uri) = viewModelScope.launch {
        if (draft.value.attachments.size >= 5) { error.value = "You can attach up to five files."; return@launch }
        _uploading.value = true
        attempt(error) { val result = c.repository.api.upload(uri, 10_485_760); update { it.copy(attachments = it.attachments + UploadedFile(result.id, result.filename, result.size)) } }
        _uploading.value = false
    }
    fun removeUpload(file: UploadedFile) = viewModelScope.launch {
        _uploading.value = true
        attempt(error) { c.repository.api.request("api/uploads/${file.id}", ApiResult.serializer(), "DELETE", raw = true); update { it.copy(attachments = it.attachments.filterNot { a -> a.id == file.id }) } }
        _uploading.value = false
    }
    fun submit(done: (String) -> Unit) = viewModelScope.launch {
        val errors = RequestRules.errors(draft.value)
        if (errors.isNotEmpty()) { error.value = errors.values.first(); return@launch }
        _busy.value = true
        attempt(error) {
            saveJob?.cancel(); c.preferences.saveDraft(draft.value)
            val result = c.repository.create(draft.value.copy(ownerId = c.sessions.user?.id.orEmpty()))
            c.preferences.saveDraft(null); _draft.value = RequestDraft(ownerId = c.sessions.user?.id.orEmpty()); _matches.value = SearchResults()
            c.messages.tryEmit("Request sent. We'll keep you in the loop."); done(result.slug)
        }
        _busy.value = false
    }
    override fun onCleared() { val value = draft.value; if (initialized) c.scope.launch { c.preferences.saveDraft(value) } }
}

class AccountViewModel(app: Application) : AndroidViewModel(app) {
    private val c = app.appContainer
    val error = MutableStateFlow<String?>(null); private val _busy = MutableStateFlow(false); val busy = _busy.asStateFlow()
    val alerts = c.preferences.alertsEnabled.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)
    fun save(user: User) = viewModelScope.launch { _busy.value = true; attempt(error) { c.repository.saveProfile(user); c.messages.tryEmit("Preferences saved.") }; _busy.value = false }
    fun export(uri: Uri) = viewModelScope.launch { _busy.value = true; attempt(error) { c.repository.api.exportTo(uri); c.messages.tryEmit("Your data export was saved.") }; _busy.value = false }
    fun delete(done: () -> Unit) = viewModelScope.launch { _busy.value = true; attempt(error) { c.repository.deleteAccount(); c.sessions.clear(); c.cache.cacheDao().clear(); c.api.clearPrivateFiles(); c.preferences.saveDraft(null); c.preferences.clearAccountKeys(); app.iwannalearn.android.notifications.NotificationScheduler.disable(getApplication()); done() }; _busy.value = false }
    fun setAlerts(enabled: Boolean) = viewModelScope.launch {
        c.preferences.setAlerts(enabled)
        if (enabled) app.iwannalearn.android.notifications.NotificationScheduler.enable(getApplication()) else app.iwannalearn.android.notifications.NotificationScheduler.disable(getApplication())
    }
}
class SupportViewModel(app: Application) : AndroidViewModel(app) {
    private val c = app.appContainer
    val error = MutableStateFlow<String?>(null); private val _busy = MutableStateFlow(false); val busy = _busy.asStateFlow()
    fun send(email: String, subject: String, message: String, done: () -> Unit) = viewModelScope.launch {
        _busy.value = true; attempt(error) { val result = c.repository.support(email, subject, message); c.messages.tryEmit(result.message ?: "Message sent."); done() }; _busy.value = false
    }
}
class PlayerViewModel(app: Application) : AndroidViewModel(app) {
    private val c = app.appContainer
    private val _data = MutableStateFlow<Playback?>(null); val data = _data.asStateFlow()
    val error = MutableStateFlow<String?>(null); private val _loading = MutableStateFlow(false); val loading = _loading.asStateFlow()
    fun load(id: String) = viewModelScope.launch { _loading.value = true; attempt(error) { _data.value = c.repository.playback(id) }; _loading.value = false }
    fun played(id: String) = viewModelScope.launch { c.repository.track("lesson_played", id) }
}
class AdminViewModel(app: Application) : AndroidViewModel(app) {
    private val c = app.appContainer
    private val _data = MutableStateFlow<AdminSnapshot?>(null); val data = _data.asStateFlow()
    val error = MutableStateFlow<String?>(null); private val _loading = MutableStateFlow(false); val loading = _loading.asStateFlow()
    private val _busy = MutableStateFlow(false); val busy = _busy.asStateFlow()
    fun load() = viewModelScope.launch { _loading.value = true; attempt(error) { _data.value = c.repository.admin() }; _loading.value = false }
    fun act(path: String, payload: JsonElement = JsonObject(emptyMap())) = viewModelScope.launch {
        _busy.value = true; attempt(error) { val result = c.repository.adminAction(path, payload); _data.value = c.repository.admin(); c.messages.tryEmit(result.message ?: "Saved.") }; _busy.value = false
    }
    fun settings(value: AdminSettings) = viewModelScope.launch { _busy.value = true; attempt(error) { c.repository.saveSettings(value); _data.value = c.repository.admin(); c.messages.tryEmit("Studio settings saved.") }; _busy.value = false }
}
