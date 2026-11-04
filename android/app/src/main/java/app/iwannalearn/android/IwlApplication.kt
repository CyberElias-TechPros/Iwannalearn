package app.iwannalearn.android

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import app.iwannalearn.android.data.*
import app.iwannalearn.android.network.ApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch

class IwlApplication : Application() {
    lateinit var container: AppContainer private set
    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        val channel = NotificationChannel("lesson-updates", "Lesson updates", NotificationManager.IMPORTANCE_DEFAULT)
        channel.description = "Request progress and lessons ready to watch"
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        container.api.clearPrivateFiles()
    }
}

class AppContainer(val context: Context) {
    val messages = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    val preferences = Preferences(context)
    val sessions = SessionStore(context)
    val cache = createLocalCache(context)
    val server = MutableStateFlow(BuildConfig.API_BASE_URL)
    val api = ApiClient(context, { server.value }, { sessions.token })
    val repository = Repository(api, preferences, sessions, cache)
    init {
        scope.launch {
            preferences.serverUrl.collect { server.value = it }
        }
        api.onUnauthorized = {
            scope.launch {
                sessions.clear(); api.clearPrivateFiles(); cache.cacheDao().clear()
            }
        }
    }
}
val Context.appContainer: AppContainer get() = (applicationContext as IwlApplication).container
