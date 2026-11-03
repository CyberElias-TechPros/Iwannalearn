package app.iwannalearn.android.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import app.iwannalearn.android.network.SessionResponse
import app.iwannalearn.android.network.User
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.Json
import java.time.Instant

data class Session(val token: String, val expiresAt: String, val user: User)

/** The bearer token is encrypted with an Android Keystore master key. It is never
 * placed in a URL, clipboard, notification, log, WebView, or exported backup. */
class SessionStore(context: Context) {
    private val json = Json { ignoreUnknownKeys = true }
    private val prefs by lazy {
        val key = MasterKey.Builder(context, MasterKey.DEFAULT_MASTER_KEY_ALIAS)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
        EncryptedSharedPreferences.create(context, "iwl-secure-session", key,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM)
    }
    private val _session: MutableStateFlow<Session?> by lazy { MutableStateFlow(read()) }
    val session = _session.asStateFlow()
    val token: String? get() = _session.value?.token
    val user: User? get() = _session.value?.user

    private fun read(): Session? = runCatching {
        val raw = prefs.getString("session", null) ?: return null
        val saved = json.decodeFromString<SessionResponse>(raw)
        if (Instant.parse(saved.expiresAt).isBefore(Instant.now())) { prefs.edit().remove("session").apply(); null }
        else Session(saved.token, saved.expiresAt, saved.user)
    }.getOrNull()

    fun save(response: SessionResponse) {
        prefs.edit().putString("session", json.encodeToString(SessionResponse.serializer(), response)).apply()
        _session.value = Session(response.token, response.expiresAt, response.user)
    }
    fun updateUser(user: User) {
        val current = _session.value ?: return
        save(SessionResponse(current.token, current.expiresAt, user))
    }
    fun clear() {
        // Called during initialization too, before a session exists.
        runCatching { prefs.edit().remove("session").apply() }
        _session.value = null
    }
}
