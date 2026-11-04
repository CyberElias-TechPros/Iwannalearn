package app.iwannalearn.android

import app.iwannalearn.android.ui.Routes
import org.junit.Assert.*
import org.junit.Test

class RoutesTest {
    @Test fun `notification links stay inside the native app`() {
        assertEquals("request/learn-sql", Routes.fromHref("/requests/learn-sql?new=1"))
        assertEquals("lesson/learn-sql", Routes.fromHref("/tutorials/learn-sql"))
        assertEquals("admin", Routes.fromHref("/admin?focus=req_1"))
        assertEquals("learn", Routes.fromHref("/dashboard"))
    }
    @Test fun `external and traversal links are rejected`() {
        listOf(null, "https://evil.example", "//evil.example", "/checkout/secret", "/account", "/requests/../admin").forEach { assertNull(Routes.fromHref(it)) }
    }
    @Test fun `search text survives route encoding`() {
        val route = Routes.explore("CSV & headers / pandas", "Data & Python", "lessons")
        assertTrue(route.contains("CSV%20%26%20headers"))
        assertEquals("CSV & headers / pandas", Routes.decode(route.substringAfter("q=").substringBefore('&')))
    }
}
