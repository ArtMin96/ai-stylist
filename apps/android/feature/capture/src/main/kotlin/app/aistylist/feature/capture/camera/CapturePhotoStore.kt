package app.aistylist.feature.capture.camera

import android.content.Context
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import androidx.core.graphics.scale
import androidx.core.net.toUri
import app.aistylist.feature.capture.domain.PhotoRef
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.max

/**
 * The flow's photos, in memory only: v1 writes nothing to disk, the photo library or the network
 * (capture brief §0), and [clear] drops every photo when the flow closes. Camera photos are stored
 * here directly; an imported photo is a `content:` URI, decoded on first use.
 */
class CapturePhotoStore(
    private val context: Context,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
) {
    private val photos = ConcurrentHashMap<String, Bitmap>()
    private val counter = AtomicInteger()

    /** Keeps [bitmap] (scaled down to the review size) and returns its reference. */
    fun put(bitmap: Bitmap): PhotoRef {
        val ref = PhotoRef("$MEMORY_SCHEME${counter.incrementAndGet()}")
        photos[ref.value] = bitmap.scaledToLongSide(MAX_LONG_SIDE_PX)
        return ref
    }

    /** The photo for [ref]: kept in memory, or an imported URI decoded now; null when it cannot be read. */
    suspend fun load(ref: PhotoRef): Bitmap? {
        photos[ref.value]?.let { return it }
        if (ref.value.startsWith(MEMORY_SCHEME)) return null
        return withContext(ioDispatcher) {
            decode(ref.value.toUri())?.also { photos[ref.value] = it }
        }
    }

    /** Drops every photo (the flow closed). */
    fun clear() {
        photos.clear()
    }

    private fun decode(uri: Uri): Bitmap? =
        try {
            val source = ImageDecoder.createSource(context.contentResolver, uri)
            ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
                decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
                val longSide = max(info.size.width, info.size.height)
                if (longSide > MAX_LONG_SIDE_PX) {
                    val scale = MAX_LONG_SIDE_PX.toFloat() / longSide
                    decoder.setTargetSize((info.size.width * scale).toInt(), (info.size.height * scale).toInt())
                }
            }
        } catch (ignored: IOException) {
            // An unreadable import is never refused: it reaches review without checks (brief Q17).
            null
        }

    private companion object {
        const val MEMORY_SCHEME = "capture-memory:"

        /** Large enough for the review screen; the photo is never saved in v1. */
        const val MAX_LONG_SIDE_PX = 1600
    }
}

/** [this] bitmap scaled so its long side is at most [longSide]. */
fun Bitmap.scaledToLongSide(longSide: Int): Bitmap {
    val current = max(width, height)
    if (current <= longSide) return this
    val scale = longSide.toFloat() / current
    return scale((width * scale).toInt(), (height * scale).toInt())
}
