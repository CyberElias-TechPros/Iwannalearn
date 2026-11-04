package app.iwannalearn.android.ui

import java.net.URLEncoder
import java.net.URLDecoder

object Routes {
    const val HOME = "home"
    const val EXPLORE = "explore?q={query}&category={category}&tab={tab}"
    const val LEARN = "learn"
    const val ALERTS = "alerts"
    const val ACCOUNT = "account"
    fun explore(query: String = "", category: String = "", tab: String = "lessons") = "explore?q=${encode(query)}&category=${encode(category)}&tab=${encode(tab)}"
    fun create(tier: String = "") = if (tier.isBlank()) "create" else "create?tier=${encode(tier)}"
    fun request(slug: String) = "request/${encode(slug)}"
    fun lesson(slug: String) = "lesson/${encode(slug)}"
    fun player(id: String) = "player/${encode(id)}"
    fun checkout(slug: String) = "checkout/${encode(slug)}"
    fun login(next: String = LEARN) = "login?next=${encode(next)}"
    fun legal(key: String) = "legal/${encode(key)}"
    fun encode(value: String): String = URLEncoder.encode(value, "UTF-8").replace("+", "%20")
    fun decode(value: String): String = URLDecoder.decode(value, "UTF-8")
    /** Only in-app destinations are accepted from email/server notification links. */
    fun fromHref(href: String?): String? {
        if (href == null || !href.startsWith("/") || href.startsWith("//")) return null
        val path = href.substringBefore('?').trim('/')
        val parts = path.split('/')
        return when {
            path == "dashboard" -> LEARN
            path == "admin" || path.startsWith("admin/") -> "admin"
            parts.size == 2 && parts[0] == "requests" && parts[1].matches(Regex("[a-z0-9-]+")) -> request(parts[1])
            parts.size == 2 && parts[0] == "tutorials" && parts[1].matches(Regex("[a-z0-9-]+")) -> lesson(parts[1])
            else -> null
        }
    }
}
