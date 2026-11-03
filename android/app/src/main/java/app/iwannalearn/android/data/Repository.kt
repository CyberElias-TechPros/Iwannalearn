package app.iwannalearn.android.data

import app.iwannalearn.android.network.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

class Repository(val api: ApiClient, val preferences: Preferences, val sessions: SessionStore, val cache: LocalCache) {
    suspend fun bootstrap() = api.request("bootstrap", Bootstrap.serializer())
    suspend fun login(email: String, name: String) = api.request("auth/login", LoginResponse.serializer(), "POST", JsonObject(mapOf("email" to JsonPrimitive(email), "name" to JsonPrimitive(name))))
    suspend fun exchange(token: String) = api.request("auth/exchange", SessionResponse.serializer(), "POST", JsonObject(mapOf("token" to JsonPrimitive(token)))).also { sessions.save(it) }
    suspend fun demo(creator: Boolean) = api.request("auth/demo", SessionResponse.serializer(), "POST", JsonObject(mapOf("role" to JsonPrimitive(if (creator) "creator" else "learner")))).also { sessions.save(it) }
    suspend fun me() = api.request("me", UserResponse.serializer()).user.also(sessions::updateUser)
    suspend fun saveProfile(user: User) = api.request("me", UserResponse.serializer(), "PATCH", api.json.encodeToJsonElement(User.serializer(), user)).user.also(sessions::updateUser)
    suspend fun deleteAccount() = api.request("me", ApiResult.serializer(), "DELETE")
    suspend fun logout() {
        runCatching { api.request("auth/logout", ApiResult.serializer(), "POST") }
        sessions.clear(); api.clearPrivateFiles(); cache.cacheDao().clear(); preferences.clearAccountKeys()
    }
    suspend fun explore(tab: String, query: String = "", category: String = "", level: String = "", page: Int = 1, sort: String = "newest"): ExplorePage {
        val q = query.encodeUrl()
        val result = api.request("explore?tab=$tab&q=$q&category=${category.encodeUrl()}&level=$level&page=$page&sort=$sort", ExplorePage.serializer())
        val now = System.currentTimeMillis()
        val entries = result.lessons.map { CacheEntry("lesson:${it.slug}", "lesson", api.json.encodeToString(LessonItem.serializer(), it), now) } +
            result.requests.map { CacheEntry("request:${it.slug}", "request", api.json.encodeToString(RequestItem.serializer(), it), now) }
        cache.cacheDao().putAll(entries)
        return result
    }
    fun cachedLessons() = cache.cacheDao().observe("lesson").map { entries -> entries.mapNotNull { runCatching { api.json.decodeFromString<LessonItem>(it.payload) }.getOrNull() } }
    fun cachedRequests() = cache.cacheDao().observe("request").map { entries -> entries.mapNotNull { runCatching { api.json.decodeFromString<RequestItem>(it.payload) }.getOrNull() } }
    suspend fun search(query: String) = api.request("search?q=${query.encodeUrl()}", SearchResults.serializer())
    suspend fun lesson(slug: String) = api.request("lessons/${slug.encodeUrl()}", LessonResponse.serializer()).lesson
    suspend fun requestDetail(slug: String) = api.request("requests/${slug.encodeUrl()}", RequestDetail.serializer())
    suspend fun dashboard() = api.request("dashboard", Dashboard.serializer())
    suspend fun notifications() = api.request("notifications", Notifications.serializer())
    suspend fun readNotifications(id: String? = null) = api.request("notifications/read", ApiResult.serializer(), "POST", JsonObject(mapOfNotNull(id?.let { "id" to JsonPrimitive(it) })))
    suspend fun create(draft: RequestDraft) = api.request("requests", CreateResponse.serializer(), "POST", api.json.encodeToJsonElement(RequestDraft.serializer(), draft)).request
    suspend fun action(id: String, action: String, payload: JsonElement = JsonObject(emptyMap())) = api.request("requests/$id/$action", ApiResult.serializer(), "POST", payload)
    suspend fun vote(id: String) = api.request("requests/$id/vote", ApiResult.serializer(), "POST")
    suspend fun checkout(id: String) = api.request("requests/$id/checkout", Checkout.serializer(), "POST")
    suspend fun playback(id: String) = api.request("requests/$id/playback", Playback.serializer())
    suspend fun track(name: String, requestId: String? = null) = runCatching { api.request("analytics", ApiResult.serializer(), "POST", JsonObject(mapOfNotNull("name" to JsonPrimitive(name), requestId?.let { "requestId" to JsonPrimitive(it) }))) }
    suspend fun support(email: String, subject: String, message: String) = api.request("support", ApiResult.serializer(), "POST", JsonObject(mapOf("email" to JsonPrimitive(email), "subject" to JsonPrimitive(subject), "body" to JsonPrimitive(message))))
    suspend fun admin() = api.request("admin", AdminSnapshot.serializer())
    suspend fun adminAction(path: String, payload: JsonElement = JsonObject(emptyMap())) = api.request("admin/$path", ApiResult.serializer(), "POST", payload)
    suspend fun saveSettings(settings: AdminSettings) = adminAction("settings", api.json.encodeToJsonElement(AdminSettings.serializer(), settings))
}
fun String.encodeUrl(): String = java.net.URLEncoder.encode(this, "UTF-8").replace("+", "%20")
