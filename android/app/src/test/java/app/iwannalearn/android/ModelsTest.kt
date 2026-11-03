package app.iwannalearn.android

import app.iwannalearn.android.network.*
import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test

class ModelsTest {
    private val json = Json { ignoreUnknownKeys = true }
    @Test fun `bootstrap tolerates additive server fields`() {
        val result = json.decodeFromString<Bootstrap>("""{"apiVersion":1,"demoMode":true,"categories":["Spreadsheets"],"futureField":42,"pricing":{"mode":"mock","enabled":true,"tiers":[]}}""")
        assertEquals(1, result.apiVersion)
        assertTrue(result.demoMode)
        assertEquals("mock", result.pricing.mode)
    }
    @Test fun `money stays in integer kobo`() {
        val checkout = json.decodeFromString<Checkout>("""{"reference":"IWL-1","mode":"mock","amountKobo":2500000,"taxKobo":174419,"title":"Private lesson"}""")
        assertEquals(2_500_000L, checkout.amountKobo)
        assertNull(checkout.url)
    }
    @Test fun `private request models never need an upstream video URL`() {
        val item = json.decodeFromString<RequestItem>("""{"id":"req_1","ref":"REQ-1","slug":"private-work","title":"A private lesson","goal":"Learn this","category":"Other","level":"new","status":"fulfilled","tier":"private","visibility":"private","createdAt":"2026-01-01T00:00:00Z"}""")
        assertNull(item.videoId)
        assertEquals("private", item.visibility)
    }
}
