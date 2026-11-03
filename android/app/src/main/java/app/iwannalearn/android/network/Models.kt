package app.iwannalearn.android.network

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable data class User(
    val id: String, val email: String, val name: String? = null, val role: String = "learner",
    val phone: String? = null, val notifyEmail: Boolean = true, val notifySms: Boolean = false,
    val digest: Boolean = true, val emailBounced: Boolean = false,
)
@Serializable data class LevelMeta(val label: String, val hint: String)
@Serializable data class TierMeta(val label: String, val price: String, val tagline: String, val detail: String)
@Serializable data class Topic(val slug: String, val category: String, val title: String, val blurb: String, val lessons: Int = 0, val open: Int = 0)
@Serializable data class Counts(val lessons: Int = 0, val requests: Int = 0)
@Serializable data class PriceTier(val key: String, val amountKobo: Long, val label: String, val blurb: String)
@Serializable data class Pricing(val mode: String = "off", val enabled: Boolean = false, val refundWindowDays: Int = 7, val tiers: List<PriceTier> = emptyList())
@Serializable data class UploadPolicy(val maxBytes: Long = 10_485_760, val maxFiles: Int = 5, val accept: String = "")
@Serializable data class LegalDoc(val title: String, val lede: String, val sections: List<LegalSection> = emptyList())
@Serializable data class LegalSection(val heading: String, val body: List<String> = emptyList())
@Serializable data class Bootstrap(
    val apiVersion: Int = 1, val appName: String = "iwannalearn", val demoMode: Boolean = false,
    val categories: List<String> = emptyList(), val levels: Map<String, LevelMeta> = emptyMap(),
    val tiers: Map<String, TierMeta> = emptyMap(), val topics: List<Topic> = emptyList(),
    val stats: Counts = Counts(), val pricing: Pricing = Pricing(), val upload: UploadPolicy = UploadPolicy(),
    val supportEmail: String = "", val legal: Map<String, LegalDoc> = emptyMap(),
)
@Serializable data class RequestItem(
    val id: String, val ref: String, val slug: String, val title: String, val goal: String,
    val tried: String? = null, val contextLink: String? = null, val deadline: String? = null,
    val declineReason: String? = null, val category: String, val level: String,
    val status: String, val tier: String, val visibility: String, val paymentStatus: String = "none",
    val revisionState: String = "none, ", val priceKobo: Long? = null, val upvoteCount: Int = 0,
    val createdAt: String, val fulfilledAt: String? = null, val deliveryConfirmedAt: String? = null,
    val ownerName: String? = null, val ownerEmail: String? = null,
    val hasLesson: Boolean = false, val lessonTitle: String? = null, val videoId: String? = null,
    val videoLength: String? = null, val viewerUpvoted: Boolean = false, val replyCount: Int = 0,
    val isOwner: Boolean = false, val moderationFlag: Boolean = false, val moderationNote: String? = null,
    val priorityFlag: Int = 0, val ageDays: Int = 0, val internalNoteCount: Int = 0,
)
@Serializable data class Resource(val label: String, val url: String)
@Serializable data class LessonItem(
    val requestId: String, val slug: String, val title: String, val goal: String, val category: String,
    val level: String, val videoId: String? = null, val videoProvider: String? = null,
    val videoTitle: String? = null, val videoLength: String? = null, val cameraMessage: String = "",
    val resources: List<Resource> = emptyList(), val fulfilledAt: String? = null,
    val upvoteCount: Int = 0, val ownerName: String? = null,
)
@Serializable data class LessonResponse(val lesson: LessonItem)
@Serializable data class ExplorePage(
    val tab: String, val page: Int = 1, val pageSize: Int = 24, val total: Int = 0,
    val lessons: List<LessonItem> = emptyList(), val requests: List<RequestItem> = emptyList(),
)
@Serializable data class Reply(
    val id: String, val message: String, val videoTitle: String? = null, val videoLength: String? = null,
    val videoProvider: String? = null, val videoUrl: String? = null, val authorName: String? = null,
    val createdAt: String, val resources: List<Resource> = emptyList(),
)
@Serializable data class RequestEvent(val id: String, val kind: String, val toStatus: String? = null, val createdAt: String)
@Serializable data class Feedback(val helpful: Int = 0, val comment: String? = null)
@Serializable data class Quote(
    val id: String, val request_id: String, val amount_kobo: Long, val currency: String = "NGN",
    val scope: String, val deliverables: String? = null, val turnaround_days: Int? = null,
    val revisions: Int = 1, val status: String, val proposed_at: String,
    val accepted_at: String? = null, val declined_at: String? = null, val decline_note: String? = null,
    val taxKobo: Long = 0, val title: String = "",
)
@Serializable data class Payment(
    val id: String? = null, val reference: String, val provider: String = "mock", val kind: String = "private",
    val amountKobo: Long, val taxKobo: Long = 0, val currency: String = "NGN", val status: String,
    val paidAt: String? = null, val refundedAt: String? = null, val createdAt: String? = null,
    val title: String = "", val slug: String = "", val ref: String = "", val learner: String? = null, val email: String? = null,
)
@Serializable data class RefundClaim(
    val id: String, val request_id: String, val reason: String, val status: String,
    val resolution: String? = null, val created_at: String, val resolved_at: String? = null,
)
@Serializable data class Attachment(val id: String, val filename: String, val mime: String, val size: Long, val kind: String, val note: String? = null, val createdAt: String)
@Serializable data class InternalNote(val id: String, val message: String, val createdAt: String, val authorName: String? = null)
@Serializable data class RequestDetail(
    val request: RequestItem, val canPlay: Boolean = false, val replies: List<Reply> = emptyList(),
    val events: List<RequestEvent> = emptyList(), val feedback: Feedback? = null, val quote: Quote? = null,
    val payment: Payment? = null, val refund: RefundClaim? = null,
    val attachments: List<Attachment> = emptyList(), val internalNotes: List<InternalNote> = emptyList(),
    val related: List<RequestItem> = emptyList(),
)
@Serializable data class Entitlement(val requestId: String, val accessType: String, val grantedAt: String, val title: String, val slug: String, val status: String)
@Serializable data class Dashboard(val requests: List<RequestItem> = emptyList(), val backed: List<RequestItem> = emptyList(), val entitlements: List<Entitlement> = emptyList(), val unread: Int = 0)
@Serializable data class NotificationItem(val id: String, val title: String, val body: String, val href: String? = null, val readAt: String? = null, val createdAt: String, val kind: String)
@Serializable data class Notifications(val notifications: List<NotificationItem> = emptyList(), val unread: Int = 0)
@Serializable data class UserResponse(val user: User)
@Serializable data class SessionResponse(val token: String, val expiresAt: String, val user: User)
@Serializable data class LoginResponse(val email: String, val message: String, val demoToken: String? = null)
@Serializable data class CreatedRequest(val id: String, val slug: String)
@Serializable data class CreateResponse(val request: CreatedRequest)
@Serializable data class UploadResult(val id: String, val filename: String, val size: Long)
@Serializable data class Playback(val kind: String, val title: String, val url: String, val videoId: String? = null, val expiresAt: Long = 0, val private: Boolean = false)
@Serializable data class Checkout(val reference: String, val mode: String, val amountKobo: Long, val taxKobo: Long, val title: String, val url: String? = null)
@Serializable data class ApiResult(val ok: Boolean = true, val message: String? = null)
@Serializable data class SearchHit(val slug: String, val title: String, val category: String)
@Serializable data class SearchResults(val lessons: List<SearchHit> = emptyList(), val requests: List<SearchHit> = emptyList())

@Serializable data class AdminStats(
    val inQueue: Int = 0, val needsDecision: Int = 0, val waiting: Int = 0, val filming: Int = 0,
    val flagged: Int = 0, val delivered: Int = 0, val deliveredThisWeek: Int = 0, val privateOpen: Int = 0,
    val newThisWeek: Int = 0, val revenueKobo: Long = 0, val paidCount: Int = 0,
    val awaitingQuotes: Int = 0, val bouncedEmails: Int = 0, val openSupport: Int = 0, val capacity: Int = 4,
)
@Serializable data class LibraryItem(val requestId: String, val replyId: String, val slug: String, val title: String, val category: String, val visibility: String, val videoUrl: String? = null, val videoId: String? = null, val videoTitle: String, val videoLength: String? = null, val message: String, val reuseCount: Int = 0)
@Serializable data class OutboxItem(val id: String, val toEmail: String, val subject: String, val body: String, val status: String, val createdAt: String, val slug: String? = null, val ref: String? = null, val logStatus: String? = null, val attempts: Int = 0, val lastError: String? = null)
@Serializable data class SupportItem(val id: String, val email: String, val subject: String, val body: String, val status: String, val createdAt: String)
@Serializable data class Funnel(val searches: Int = 0, val zeroResultSearches: Int = 0, val requestsStarted: Int = 0, val requestsSubmitted: Int = 0, val lessonsWatched: Int = 0, val lessonsDelivered: Int = 0, val votesCast: Int = 0, val feedbackGiven: Int = 0, val signIns: Int = 0)
@Serializable data class DailyCount(val day: String, val requests: Int, val lessons: Int)
@Serializable data class SearchTerm(val term: String, val count: Int, val missed: Int = 0)
@Serializable data class Analytics(val funnel: Funnel = Funnel(), val daily: List<DailyCount> = emptyList(), val topSearches: List<SearchTerm> = emptyList(), val gaps: List<SearchTerm> = emptyList(), val medianDaysToDelivery: Double? = null, val returningUsers: Int = 0, val activeUsers: Int = 0, val helpfulness: Int? = null)
@Serializable data class RecentFeedback(val helpful: Int, val comment: String? = null, val createdAt: String, val title: String, val slug: String, val learner: String? = null)
@Serializable data class PaymentSummary(val paid: Int = 0, val refunded: Int = 0, val revenueKobo: Long = 0, val taxKobo: Long = 0, val count: Int = 0)
@Serializable data class AdminSettings(val capacity: Int = 4, val vatRate: Double = 7.5, val refundWindow: Int = 7, val supportEmail: String = "", val digestDay: String = "monday", val paymentsMode: String = "off")
@Serializable data class AdminSnapshot(
    val stats: AdminStats = AdminStats(), val queue: List<RequestItem> = emptyList(),
    val payments: List<Payment> = emptyList(), val paymentSummary: PaymentSummary = PaymentSummary(),
    val refunds: List<RefundClaim> = emptyList(), val quotes: List<Quote> = emptyList(),
    val library: List<LibraryItem> = emptyList(), val outbox: List<OutboxItem> = emptyList(),
    val support: List<SupportItem> = emptyList(), val analytics: Analytics = Analytics(),
    val feedback: List<RecentFeedback> = emptyList(), val settings: AdminSettings = AdminSettings(),
)
