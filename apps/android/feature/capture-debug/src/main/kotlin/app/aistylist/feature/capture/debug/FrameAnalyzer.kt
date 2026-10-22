package app.aistylist.feature.capture.debug

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import app.aistylist.contracts.kernel.CaptureBodyPart
import app.aistylist.contracts.kernel.CaptureRules
import app.aistylist.feature.capture.analysis.LumaPlane
import app.aistylist.feature.capture.analysis.clamped
import app.aistylist.feature.capture.camera.LiteRtGarmentSegmenter
import app.aistylist.feature.capture.camera.MlKitItemDetector
import app.aistylist.feature.capture.camera.MlKitPoseDetector
import app.aistylist.feature.capture.camera.lumaPlane
import app.aistylist.feature.capture.domain.CaptureObservation
import app.aistylist.feature.capture.domain.DeviceSample
import app.aistylist.feature.capture.domain.LabelImage
import app.aistylist.feature.capture.domain.LightSample
import app.aistylist.feature.capture.domain.MaskAnalysis
import app.aistylist.feature.capture.domain.MaskObservation
import app.aistylist.feature.capture.domain.NormalizedPoint
import app.aistylist.feature.capture.domain.NormalizedRect
import app.aistylist.feature.capture.domain.PoseLandmark
import app.aistylist.feature.capture.domain.PoseSample
import app.aistylist.feature.capture.domain.traceOutline
import com.google.mlkit.vision.common.InputImage
import org.json.JSONObject
import java.io.Closeable
import kotlin.math.roundToInt

/** A frame's offset this playback frame: the jitter, as a share of the frame (capture brief §11). */
data class FrameOffset(
    val dx: Double,
    val dy: Double,
) {
    companion object {
        val NONE: FrameOffset = FrameOffset(0.0, 0.0)
    }
}

/**
 * Measures test frames the way the camera measures its own (the same `LumaPlane` light and sharpness
 * code). The item comes from a garment mask ([masks]: the stored Vision mask, or the real LiteRT
 * segmenter on the frame PNG), or with [MaskSource.NONE] from boxes (ML Kit on the frame or the
 * stored `frame.box.json`, the camera's fallback path). Worn-mode keypoints come from the live pose
 * model or the keypoint file. A jittered frame is the stored frame moved by the offset: its mask,
 * boxes and keypoints move with it, and sharpness is measured on the part of the item still inside
 * the frame. Each playback frame gets a fresh mask (the rules' sweep numbers stay comparable); the
 * session moves the outline at the live mask cadence. Decoded frames, masks and detector results are
 * cached per image. Not thread-safe; blocking (decode, ML Kit, LiteRT): call it off the main thread.
 */
class FrameAnalyzer(
    private val index: FrameIndex,
    val boxes: BoxSource,
    val pose: PoseSource,
    val masks: MaskSource = MaskSource.NONE,
    private val covered: CoveredSource = CoveredSource.COMPONENTS,
    private val segmenter: Lazy<LiteRtGarmentSegmenter?> = lazy { null },
    /** One line per image the live segmenter ran on: latency, IoU against the stored mask, crop pass. */
    private val onLiveMask: (JSONObject) -> Unit = {},
) : Closeable {
    /** The most recent images only: a sweep visits each set's frames in turn, and masks are large. */
    private val measured =
        object : LinkedHashMap<String, MeasuredFrame>(CACHED_FRAMES, LOAD_FACTOR, true) {
            override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, MeasuredFrame>): Boolean =
                size > CACHED_FRAMES
        }

    /** Images the live segmenter has logged, so a re-measured image adds no second line. */
    private val logged = HashSet<String>()
    private val itemDetector by lazy { MlKitItemDetector(streamMode = false) }
    private val poseDetector by lazy { MlKitPoseDetector() }

    /** The decoded frame of [segment]. */
    fun bitmap(segment: FrameSegment): Bitmap = frame(segment).bitmap

    /** The jitter offset of playback frame [frameNumber] of [segment]; the index's offsets loop with it. */
    fun offset(
        segment: FrameSegment,
        frameNumber: Int,
    ): FrameOffset =
        if (segment.offsets.isEmpty()) FrameOffset.NONE else segment.offsets[frameNumber % segment.offsets.size]

    /** The observation of [segment] moved by [offset], stamped [timestampMs]; pose only when [withPose]. */
    fun observe(
        segment: FrameSegment,
        offset: FrameOffset,
        timestampMs: Long,
        withPose: Boolean,
    ): CaptureObservation {
        val frame = frame(segment)
        val mask = frame.mask?.let { maskAt(segment, frame, it, offset, timestampMs) }
        val visible =
            if (mask != null) {
                emptyList()
            } else {
                frame.boxes
                    .map { it.moved(offset).clamped() }
                    .filter { it.areaShare > 0.0 }
            }
        val item = if (mask != null) mask.foundItem?.box else visible.maxByOrNull { it.areaShare }
        val sharpness = item?.let { frame.small.sharpness(it.moved(FrameOffset(-offset.dx, -offset.dy))) } ?: 0.0
        return CaptureObservation(
            timestampMs = timestampMs,
            mask = mask,
            itemBoxes = visible,
            sharpness = sharpness,
            light = frame.light,
            // A stored tilt stands in for the phone's sensors; zero linear acceleration keeps the
            // device-motion part of the steady check passing, as on a still phone.
            device = segment.tiltDegrees?.let { DeviceSample(linearAccelerationMps2 = 0.0, tiltDegrees = it) },
            pose = if (withPose && item != null) pose(segment, frame, offset) else null,
        )
    }

    /**
     * The stored mask's outline for [segment] moved by [offset]: the reference the results log
     * scores the drawn outline against; null without a stored item.
     */
    fun storedOutline(
        segment: FrameSegment,
        offset: FrameOffset,
    ): List<NormalizedPoint>? {
        val frame = frame(segment)
        val reference =
            frame.storedOutline
                ?: storedLabels(segment, frame.bitmap)?.let(::largestOutline).also { frame.storedOutline = it }
        return reference?.map { NormalizedPoint(it.x + offset.dx, it.y + offset.dy) }
    }

    private fun maskAt(
        segment: FrameSegment,
        frame: MeasuredFrame,
        analysis: MaskAnalysis,
        offset: FrameOffset,
        timestampMs: Long,
    ): MaskObservation {
        val dx = (offset.dx * frame.bitmap.width).roundToInt()
        val dy = (offset.dy * frame.bitmap.height).roundToInt()
        val observed = analysis.at(timestampMs, dx, dy)
        if (covered != CoveredSource.OBJECT_BOXES || masks != MaskSource.LIVE) return observed
        // C32 measurement: ML Kit's boxes stand in for the other objects, minus the item's own box.
        val objects =
            (
                frame.objectBoxes ?: liveBoxes(segment).orEmpty().also {
                    frame.objectBoxes = it
                }
            ).map { it.moved(offset).clamped() }
        val itemBox = observed.item?.box ?: return observed.copy(otherBoxes = objects)
        val own = objects.maxByOrNull { it.intersectionOverUnion(itemBox) }
        return observed.copy(otherBoxes = objects - listOfNotNull(own).toSet())
    }

    /** The mask of [segment] as the selected source sees it; null on the box path. */
    private fun maskAnalysis(
        segment: FrameSegment,
        bitmap: Bitmap,
    ): MaskAnalysis? =
        when (masks) {
            MaskSource.NONE -> null
            MaskSource.STORED -> MaskAnalysis(storedLabels(segment, bitmap) ?: emptyLabels(bitmap))
            MaskSource.LIVE -> liveAnalysis(segment, bitmap)
        }

    /**
     * The live segmenter on [bitmap], measured as the camera measures its masks; null when it cannot
     * load. Logs, once per image, the model time, the mask measure and outline time, and the IoU
     * against the stored mask.
     */
    private fun liveAnalysis(
        segment: FrameSegment,
        bitmap: Bitmap,
    ): MaskAnalysis? {
        val model = segmenter.value ?: return null
        val result = model.segment(bitmap)
        val started = System.nanoTime()
        val analysis = MaskAnalysis(result.labels).also { it.at(0) }
        val measureMs = (System.nanoTime() - started) / NANOS_PER_MS
        if (segment.frame in logged) return analysis
        logged += segment.frame
        val stored = storedLabels(segment, bitmap)
        val line =
            JSONObject()
                .put("frame", segment.frame)
                .put("inferenceMs", result.inferenceMs)
                .put("measureMs", measureMs)
                .put("refined", result.isRefined)
                .put("iou", stored?.let { foregroundIou(result.labels, it) } ?: JSONObject.NULL)
        if (result.isRefined && stored != null) {
            // The small-item crop pass, measured: the IoU the first pass alone would have had.
            line.put("iouFirstPassOnly", foregroundIou(model.segment(bitmap, refinesSmallItems = false).labels, stored))
        }
        onLiveMask(line)
        return analysis
    }

    /** The generator's labels: `frame.instances.png` (several instances), else `frame.mask.png` as one. */
    private fun storedLabels(
        segment: FrameSegment,
        bitmap: Bitmap,
    ): LabelImage? {
        val instances = segment.instances
        if (instances != null) return readLabels(instances) { it }
        val mask = segment.mask ?: return null
        return readLabels(mask) {
            if (it >
                0
            ) {
                1
            } else {
                0
            }
        }.takeIf { it.width == bitmap.width && it.height == bitmap.height }
    }

    private fun readLabels(
        path: String,
        label: (Int) -> Int,
    ): LabelImage {
        val image = requireNotNull(BitmapFactory.decodeFile(index.file(path).path)) { "cannot decode $path" }
        val pixels = IntArray(image.width * image.height)
        image.getPixels(pixels, 0, image.width, 0, 0, image.width, image.height)
        return LabelImage(
            image.width,
            image.height,
            ByteArray(pixels.size) { label(pixels[it] and GREY_MASK).toByte() },
        )
    }

    override fun close() {
        if (segmenter.isInitialized()) segmenter.value?.close()
        if (boxes == BoxSource.LIVE || covered == CoveredSource.OBJECT_BOXES) itemDetector.close()
        if (pose == PoseSource.LIVE) poseDetector.close()
    }

    /** ML Kit's boxes on [segment]'s frame; null when the detector failed. For the probe. */
    fun liveBoxes(segment: FrameSegment): List<NormalizedRect>? =
        itemDetector.detect(InputImage.fromBitmap(frame(segment).bitmap, 0))

    /** The live pose model on [segment]'s frame; null when it failed. For the probe. */
    fun livePose(segment: FrameSegment): PoseSample? =
        poseDetector.detect(InputImage.fromBitmap(frame(segment).bitmap, 0))

    /** The generator's stored boxes for [segment], largest first. */
    fun storedBoxes(segment: FrameSegment): List<NormalizedRect> {
        val json = JSONObject(index.file(segment.box).readText())
        val objects = json.getJSONArray("objects")
        return (0 until objects.length()).map { i ->
            val box = objects.getJSONObject(i).getJSONObject("box")
            val x = box.getDouble("x")
            val y = box.getDouble("y")
            NormalizedRect(x, y, x + box.getDouble("width"), y + box.getDouble("height"))
        }
    }

    private fun pose(
        segment: FrameSegment,
        frame: MeasuredFrame,
        offset: FrameOffset,
    ): PoseSample? {
        val base =
            if (pose == PoseSource.LIVE) {
                frame.livePose ?: livePose(segment).also { frame.livePose = it }
            } else {
                frame.keypoints ?: keypoints(segment).also { frame.keypoints = it }
            } ?: return null
        return PoseSample(
            base.landmarks.mapValues { (_, landmark) ->
                landmark.copy(
                    position =
                        NormalizedPoint(
                            landmark.position.x + offset.dx,
                            landmark.position.y + offset.dy,
                        ),
                )
            },
        )
    }

    /** The keypoint file as pose landmarks: a present part is certain, a missing one has likelihood 0. */
    private fun keypoints(segment: FrameSegment): PoseSample? {
        val path = segment.keypoints ?: return null
        val parts = JSONObject(index.file(path).readText()).getJSONObject("parts")
        val landmarks =
            parts.keys().asSequence().mapNotNull { name ->
                val part = CaptureBodyPart.fromValue(name) ?: return@mapNotNull null
                val point = parts.getJSONObject(name)
                part to
                    PoseLandmark(
                        position = NormalizedPoint(point.getDouble("x"), point.getDouble("y")),
                        inFrameLikelihood = if (point.getBoolean("present")) 1.0 else 0.0,
                    )
            }
        return PoseSample(landmarks.toMap())
    }

    private fun frame(segment: FrameSegment): MeasuredFrame =
        measured.getOrPut(segment.frame) {
            val bitmap =
                requireNotNull(
                    BitmapFactory.decodeFile(index.file(segment.frame).path),
                ) { "cannot decode ${segment.frame}" }
            val plane = bitmap.lumaPlane()
            val mask = maskAnalysis(segment, bitmap)
            MeasuredFrame(
                bitmap = bitmap,
                light = plane.light(),
                small = plane.scaledToLongSide(CaptureRules.Steady.SHARPNESS_LONG_SIDE_PX),
                boxes =
                    when {
                        mask != null -> emptyList()
                        boxes == BoxSource.LIVE -> liveBoxesOf(bitmap)
                        else -> storedBoxes(segment)
                    },
                mask = mask,
            )
        }

    private fun liveBoxesOf(bitmap: Bitmap): List<NormalizedRect> =
        itemDetector.detect(InputImage.fromBitmap(bitmap, 0)).orEmpty()

    private class MeasuredFrame(
        val bitmap: Bitmap,
        val light: LightSample,
        val small: LumaPlane,
        val boxes: List<NormalizedRect>,
        val mask: MaskAnalysis?,
    ) {
        var keypoints: PoseSample? = null
        var livePose: PoseSample? = null
        var storedOutline: List<NormalizedPoint>? = null
        var objectBoxes: List<NormalizedRect>? = null
    }

    private companion object {
        const val GREY_MASK = 0xFF
        const val CACHED_FRAMES = 24
        const val LOAD_FACTOR = 0.75f
        const val NANOS_PER_MS = 1_000_000L
    }
}

private fun emptyLabels(bitmap: Bitmap): LabelImage =
    LabelImage(
        bitmap.width,
        bitmap.height,
        ByteArray(bitmap.width * bitmap.height),
    )

/** The outline of the largest instance of [labels]; null when it is empty. */
private fun largestOutline(labels: LabelImage): List<NormalizedPoint>? {
    val item = labels.instances().firstOrNull() ?: return null
    val mask =
        BooleanArray(labels.width * labels.height) { labels.isLabel(it % labels.width, it / labels.width, item.label) }
    return traceOutline(labels.width, labels.height, mask)?.points
}

/** Pixel IoU of the foregrounds (any label) of two same-size label images. */
private fun foregroundIou(
    a: LabelImage,
    b: LabelImage,
): Double {
    var intersection = 0
    var union = 0
    for (y in 0 until a.height) {
        for (x in 0 until a.width) {
            val inA = a.labelAt(x, y) != 0
            val inB = b.labelAt(x, y) != 0
            if (inA && inB) intersection++
            if (inA || inB) union++
        }
    }
    return if (union == 0) 1.0 else intersection.toDouble() / union
}

/** [this] box moved by [offset] (not clipped). */
fun NormalizedRect.moved(offset: FrameOffset): NormalizedRect =
    NormalizedRect(left + offset.dx, top + offset.dy, right + offset.dx, bottom + offset.dy)
