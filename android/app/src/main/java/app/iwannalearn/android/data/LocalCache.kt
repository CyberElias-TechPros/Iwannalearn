package app.iwannalearn.android.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

/** Public metadata only. Private requests, attachments, tokens and video bytes
 * are deliberately not stored in the offline library. */
@Entity(tableName = "public_cache")
data class CacheEntry(@PrimaryKey val key: String, val kind: String, val payload: String, val cachedAt: Long)
@Dao interface CacheDao {
    @Query("SELECT * FROM public_cache WHERE kind = :kind ORDER BY cachedAt DESC") fun observe(kind: String): Flow<List<CacheEntry>>
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun putAll(entries: List<CacheEntry>)
    @Query("DELETE FROM public_cache") suspend fun clear()
}
@Database(entities = [CacheEntry::class], version = 1, exportSchema = true)
abstract class LocalCache : RoomDatabase() { abstract fun cacheDao(): CacheDao }
fun createLocalCache(context: Context): LocalCache = Room.databaseBuilder(context, LocalCache::class.java, "iwl-public-cache.db").build()
