package app.iwannalearn.android

import app.iwannalearn.android.data.ServerAddress
import org.junit.Assert.*
import org.junit.Test

class ServerAddressTest {
    @Test fun `production requires TLS`() {
        assertEquals("https://learn.example.com", ServerAddress.normalize(" https://learn.example.com/ "))
        assertThrows(IllegalArgumentException::class.java) { ServerAddress.normalize("http://learn.example.com") }
    }
    @Test fun `development supports the emulator host`() {
        assertEquals("http://10.0.2.2:3000", ServerAddress.normalize("http://10.0.2.2:3000/", true))
    }
    @Test fun `credentials queries and fragments are refused`() {
        listOf("https://user:pass@example.com", "https://example.com?token=secret", "https://example.com#fragment", "ftp://example.com", "not-a-url").forEach {
            assertThrows(it, IllegalArgumentException::class.java) { ServerAddress.normalize(it, true) }
        }
    }
}
