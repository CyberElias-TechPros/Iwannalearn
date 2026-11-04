package app.iwannalearn.android.data

/** Mirrors the server's friendly feedback, but the server remains authoritative. */
object RequestRules {
    fun errors(draft: RequestDraft, step: Int = 3): Map<String, String> = buildMap {
        if (step >= 0) {
            if (draft.title.trim().length < 12) put("title", "Use a specific title, at least 12 characters.")
            if (draft.title.trim().length > 140) put("title", "Keep the title under 140 characters.")
            if (draft.goal.trim().length < 30) put("goal", "Tell us what you want to be able to do — at least 30 characters.")
            if (draft.goal.trim().length > 1200) put("goal", "Keep your goal under 1200 characters.")
        }
        if (step >= 1) {
            if (draft.tried.length > 800) put("tried", "Keep this under 800 characters.")
            if (draft.contextLink.isNotBlank() && !Regex("^https?://\\S+$").matches(draft.contextLink.trim())) put("contextLink", "Paste a full link starting with https://")
            if (draft.contextLink.length > 500) put("contextLink", "Keep the link under 500 characters.")
            if (draft.deadline.length > 80) put("deadline", "Keep this under 80 characters.")
        }
        if (step >= 2) {
            if (draft.category.isBlank()) put("category", "Choose the closest topic.")
            if (draft.level !in listOf("new", "some", "confident")) put("level", "Choose your current level.")
        }
        if (step >= 3 && draft.tier !in listOf("community", "priority", "private")) put("tier", "Choose how you'd like your lesson delivered.")
    }
    fun nudge(title: String): String? = if (title.trim().length in 1..11 || title.trim().lowercase() in setOf("python", "excel", "canva", "sql", "marketing", "ai")) "Try describing the stuck moment, not just the tool. “Merge two CSVs without losing headers” is a great start." else null
}
