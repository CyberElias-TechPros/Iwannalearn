package app.iwannalearn.android.network

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okio.BufferedSink
import okio.source
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiException(val status: Int, override val message: String, val fields: Map<String, String> = emptyMap()) : Exception(message)
@Serializable private data class ErrorBody(val error: String? = null, val fieldErrors: Map<String, String> = emptyMap())

class ApiClient(
    private val context: Context,
    val baseUrl: () -> String,
    private val token: () -> String?,
) {
    val json = Json { ignoreUnknownKeys = true; encodeDefaults = true; explicitNulls = false }
    val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS).readTimeout(60, TimeUnit.SECONDS).writeTimeout(60, TimeUnit.SECONDS)
        .followRedirects(false).followSslRedirects(false).build()
    var onUnauthorized: (() -> Unit)? = null

    fun matchesServer(url: String): Boolean = runCatching {
        val a = url.toHttpUrl(); val b = baseUrl().toHttpUrl()
        a.scheme == b.scheme && a.host == b.host && a.port == b.port
    }.getOrDefault(false)

    private fun builder(path: String, raw: Boolean): Request.Builder {
        val base = baseUrl().trimEnd('/')
        require(base.isNotBlank()) { "Connect to your server first." }
        val url = if (raw) "$base/${path.trimStart('/')}" else "$base/api/mobile/v1/${path.trimStart('/')}"
        return Request.Builder().url(url).header("Accept", "application/json").header("X-IWL-Client", "android/1")
            .apply { token()?.let { header("Authorization", "Bearer $it") } }
    }

    suspend fun <T> request(path: String, serializer: DeserializationStrategy<T>, method: String = "GET", payload: JsonElement? = null, raw: Boolean = false): T {
        val request = builder(path, raw).method(method, payload?.let { json.encodeToString(JsonElement.serializer(), it).toRequestBody("application/json; charset=utf-8".toMediaType()) }
            ?: if (method in listOf("POST", "PATCH", "DELETE")) "{}".toRequestBody("application/json".toMediaType()) else null).build()
        return execute(request, serializer) { if (!path.startsWith("auth/")) onUnauthorized?.invoke() }
    }

    private suspend fun <T> execute(request: Request, serializer: DeserializationStrategy<T>, unauthorized: () -> Unit): T = withContext(Dispatchers.IO) {
        try {
            http.newCall(request).execute().use { response ->
                val text = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    if (response.code == 401) unauthorized()
                    val failure = runCatching { json.decodeFromString<ErrorBody>(text) }.getOrNull()
                    throw ApiException(response.code, failure?.error ?: when (response.code) {
                        404 -> "That item is no longer available."
                        502, 503 -> "The server is unavailable. Please try again shortly."
                        else -> "The server couldn't complete that action (${response.code})."
                    }, failure?.fieldErrors.orEmpty())
                }
                try { json.decodeFromString(serializer, text) }
                catch (e: Exception) { throw IOException("The server returned an unexpected response. Check that its Android API is up to date.", e) }
            }
        } catch (e: ApiException) { throw e }
        catch (e: IOException) { throw IOException("Can't reach the server. Check your connection and server address; saved drafts stay on this device.", e) }
    }

    suspend fun upload(uri: Uri, maxBytes: Long): UploadResult = withContext(Dispatchers.IO) {
        val resolver = context.contentResolver
        var name = "attachment"; var size = 0L
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                if (nameIndex >= 0 && !cursor.isNull(nameIndex)) name = cursor.getString(nameIndex)
                if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) size = cursor.getLong(sizeIndex)
            }
        }
        require(size <= maxBytes) { "That file is larger than the ${maxBytes / 1_048_576} MB limit." }
        val mime = resolver.getType(uri) ?: "application/octet-stream"
        val fileBody = object : RequestBody() {
            override fun contentType() = mime.toMediaTypeOrNull()
            override fun contentLength() = if (size > 0) size else -1L
            override fun writeTo(sink: BufferedSink) {
                val input = resolver.openInputStream(uri) ?: throw IOException("The selected file couldn't be opened.")
                input.source().use { source ->
                    var total = 0L
                    val buffer = okio.Buffer()
                    while (true) {
                        val count = source.read(buffer, 65_536)
                        if (count == -1L) break
                        total += count
                        require(total <= maxBytes) { "That file exceeds the upload limit." }
                        sink.write(buffer, count)
                    }
                }
            }
        }
        val multipart = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart("kind", "brief").addFormDataPart("file", name, fileBody).build()
        val request = builder("api/uploads", true).post(multipart).build()
        execute(request, UploadResult.serializer()) { onUnauthorized?.invoke() }
    }

    suspend fun exportTo(uri: Uri): Unit = withContext(Dispatchers.IO) {
        val request = builder("export", false).get().build()
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Couldn't export your data (${response.code}).")
            val output = context.contentResolver.openOutputStream(uri, "wt") ?: throw IOException("Couldn't open the export destination.")
            output.use { response.body?.byteStream()?.copyTo(it) ?: throw IOException("The export was empty.") }
        }
    }

    suspend fun attachment(id: String, filename: String): File = withContext(Dispatchers.IO) {
        val request = builder("api/uploads/$id", true).get().build()
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("This attachment isn't available to your account.")
            val dir = File(context.cacheDir, "attachments").apply { mkdirs() }
            val safe = filename.replace(Regex("[^A-Za-z0-9._-]"), "_").takeLast(100)
            val file = File(dir, "$id-$safe")
            file.outputStream().use { output -> response.body?.byteStream()?.use { it.copyTo(output, 65_536) } ?: throw IOException("Empty attachment.") }
            file
        }
    }
    fun clearPrivateFiles() { File(context.cacheDir, "attachments").deleteRecursively() }
}
