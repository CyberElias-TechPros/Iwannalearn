package app.iwannalearn.android.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import app.iwannalearn.android.BuildConfig
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

private val Context.dataStore by preferencesDataStore(name = "iwl-preferences")
@Serializable data class UploadedFile(val id: String, val filename: String, val size: Long)
@Serializable data class RequestDraft(
    val clientRequestId: String = java.util.UUID.randomUUID().toString(),
    val ownerId: String = "", val step: Int = 0, val title: String = "", val goal: String = "",
    val tried: String = "", val contextLink: String = "", val deadline: String = "",
    val category: String = "", val level: String = "new", val tier: String = "community",
    val attachments: List<UploadedFile> = emptyList(),
)

class Preferences(private val context: Context) {
    private val json = Json { ignoreUnknownKeys = true }
    private val serverKey = stringPreferencesKey("server")
    private val draftKey = stringPreferencesKey("request-draft")
    private val pushKey = stringPreferencesKey("push-enabled")
    private val seenKey = stringSetPreferencesKey("seen-notifications")
    val serverUrl = context.dataStore.data.map { it[serverKey] ?: BuildConfig.API_BASE_URL }
    val draft = context.dataStore.data.map { raw -> raw[draftKey]?.let { runCatching { json.decodeFromString<RequestDraft>(it) }.getOrNull() } }
    val alertsEnabled = context.dataStore.data.map { it[pushKey] == "true" }

    suspend fun setServer(url: String) { context.dataStore.edit { it[serverKey] = url } }
    suspend fun saveDraft(draft: RequestDraft?) {
        context.dataStore.edit { if (draft == null) it.remove(draftKey) else it[draftKey] = json.encodeToString(RequestDraft.serializer(), draft) }
    }
    suspend fun setAlerts(enabled: Boolean) { context.dataStore.edit { it[pushKey] = enabled.toString() } }
    suspend fun alertsOn(): Boolean = alertsEnabled.first()
    /** Baseline is per-account; first sync never turns old history into a notification storm. */
    suspend fun newNotificationIds(userId: String, ids: List<String>): List<String> {
        val key = stringSetPreferencesKey("seen-$userId")
        var fresh = emptyList<String>()
        context.dataStore.edit { prefs ->
            val previous = prefs[key]
            if (previous != null) fresh = ids.filterNot { it in previous }
            prefs[key] = (previous.orEmpty().toList() + ids).takeLast(500).toSet()
        }
        return fresh
    }
    suspend fun clearAccountKeys() {
        context.dataStore.edit { prefs ->
            prefs.asMap().keys.filter { it.name.startsWith("seen-") }.toList().forEach { prefs.remove(it) }
            prefs.remove(pushKey)
        }
    }
}
