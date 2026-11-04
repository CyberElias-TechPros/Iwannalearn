package app.iwannalearn.android.notifications

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.*
import app.iwannalearn.android.MainActivity
import app.iwannalearn.android.R
import app.iwannalearn.android.appContainer
import kotlinx.coroutines.CancellationException
import java.io.IOException
import java.util.concurrent.TimeUnit

object NotificationScheduler {
    private const val NAME = "iwl-lesson-updates"
    fun enable(context: Context) {
        val request = PeriodicWorkRequestBuilder<NotificationWorker>(1, TimeUnit.HOURS)
            .setInitialDelay(15, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).setRequiresBatteryNotLow(true).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
    }
    fun disable(context: Context) { WorkManager.getInstance(context).cancelUniqueWork(NAME) }
}

/** Durable server notifications, surfaced by Android when WorkManager is allowed
 * to run. This is background polling, not a claim of instant FCM delivery. */
class NotificationWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val c = applicationContext.appContainer
        val user = c.sessions.user ?: return Result.success()
        if (!c.preferences.alertsOn() || Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return Result.success()
        return try {
            val response = c.repository.notifications()
            val fresh = c.preferences.newNotificationIds(user.id, response.notifications.map { it.id })
            val manager = NotificationManagerCompat.from(applicationContext)
            response.notifications.filter { it.id in fresh && it.readAt == null }.take(5).forEach { item ->
                val intent = Intent(applicationContext, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("notification_href", item.href)
                val pending = PendingIntent.getActivity(applicationContext, item.id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                val notification = NotificationCompat.Builder(applicationContext, "lesson-updates")
                    .setSmallIcon(R.drawable.ic_notification).setContentTitle(item.title).setContentText(item.body)
                    .setStyle(NotificationCompat.BigTextStyle().bigText(item.body)).setContentIntent(pending)
                    .setAutoCancel(true).setCategory(NotificationCompat.CATEGORY_STATUS).setGroup("iwl-updates").build()
                try { manager.notify(item.id.hashCode(), notification) } catch (_: SecurityException) { return Result.success() }
            }
            Result.success()
        } catch (e: CancellationException) { throw e }
        catch (e: IOException) { if (runAttemptCount < 3) Result.retry() else Result.failure() }
        catch (_: Exception) { Result.success() }
    }
}
