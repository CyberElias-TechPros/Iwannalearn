package app.iwannalearn.android

import app.iwannalearn.android.data.RequestDraft
import app.iwannalearn.android.data.RequestRules
import org.junit.Assert.*
import org.junit.Test

class RequestRulesTest {
    @Test fun `a specific goal passes intake`() {
        val draft = RequestDraft(title = "Merge two CSVs without losing headers", goal = "Show me how to merge two exports in pandas and keep the column names.", category = "Data & Python", level = "some", tier = "community")
        assertTrue(RequestRules.errors(draft).isEmpty())
    }
    @Test fun `vague requests get a useful nudge`() {
        assertNotNull(RequestRules.nudge("Python"))
        assertTrue(RequestRules.errors(RequestDraft(title = "Python", goal = "help"), 0).containsKey("title"))
        assertNull(RequestRules.nudge("Merge two CSVs without losing headers"))
    }
    @Test fun `later steps do not block the first step`() {
        val draft = RequestDraft(title = "Merge two CSVs without losing headers", goal = "Show me how to merge two exports in pandas and keep the column names.")
        assertTrue(RequestRules.errors(draft, 0).isEmpty())
        assertTrue(RequestRules.errors(draft, 2).containsKey("category"))
    }
    @Test fun `unsafe or incomplete context links fail`() {
        val draft = RequestDraft(contextLink = "javascript:alert(1)")
        assertTrue(RequestRules.errors(draft, 1).containsKey("contextLink"))
    }
}
