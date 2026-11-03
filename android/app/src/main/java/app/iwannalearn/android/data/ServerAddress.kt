package app.iwannalearn.android.data

import java.net.URI

object ServerAddress {
    /** Credentials, query strings and fragments never belong in a server setting.
     * Release builds require TLS; HTTP is a development-only emulator/LAN convenience. */
    fun normalize(input: String, allowHttp: Boolean = false): String {
        val trimmed = input.trim().trimEnd('/')
        require(trimmed.isNotBlank()) { "Enter your server address." }
        val uri = runCatching { URI(trimmed) }.getOrElse { throw IllegalArgumentException("Enter a complete server address.") }
        require(uri.scheme == "https" || allowHttp && uri.scheme == "http") { if (allowHttp) "Use an https:// or http:// address." else "Release builds require an https:// server." }
        require(!uri.host.isNullOrBlank() && uri.userInfo == null && uri.query == null && uri.fragment == null) { "Use a server address without a username, password, query or fragment." }
        require(uri.port == -1 || uri.port in 1..65535) { "That port is not valid." }
        return trimmed
    }
}
