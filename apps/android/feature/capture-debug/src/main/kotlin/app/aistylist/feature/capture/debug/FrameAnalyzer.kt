package app.aistylist.feature.capture.debug

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import app.aistylist.contracts.kernel.CaptureBodyPart
import app.aistylist.contracts.kernel.CaptureRules
import app.aistylist.feature.capture.analysis.LumaPlane
import app.aistylist.feature.capture.analysis.clamped
import app.aistylist.feature.capture.camera.MlKitItemDetector
import app.aistylist.feature.capture.camera.MlKitPoseDetector
import app.aistylist.feature.capture.camera.lumaPlane
import app.aistylist.feature.capture.domain.CaptureObservation
import app.aistylist.feature.capture.domain.LightSample
import app.aistylist.feature.capture.domain.NormalizedPoint
import app.aistylist.feature.capture.domain.NormalizedRect
import app.aistylist.feature.capture.domain.PoseLandmark
import app.aistylist.feature.capture.domain.PoseSample
import com.google.mlkit.vision.common.InputImage
import org.json.JSONObject
import java.io.Closeable
import java.util.Random

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
 * code), with boxes from ML Kit on the frame or from the stored `frame.box.json`, and worn-mode
 * keypoints from the live pose model or the keypoint file. A jittered frame is the stored frame
 * moved by the offset: its boxes and keypoints move with it, and sharpness is measured on the part
 * of the item still inside the frame. Decoded frames and detector results are cached per image.
 * Not thread-safe; blocking (decode, ML Kit): call it off the main thread.
 */
class FrameAnalyzer(
    private val index: FrameIndex,
    val boxes: BoxSource,
    val pose: PoseSource,
) : Closeable {
    private val measured = HashMap<String, MeasuredFrame>()
    private val itemDetector by lazy { MlKitItemDetector(streamMode = false) }
    private val poseDetector by lazy { MlKitPoseDetector() }

    /** The decoded frame of [segment]. */
    fun bitmap(segment: FrameSegment): Bitmap = frame(segment).bitmap

    /** The jitter offset of playback frame [frameNumber] of [segment], repeatable from its seed. */
    fun offset(
        segment: FrameSegment,
        frameNumber: Int,
    ): FrameOffset {
        if (segment.jitter <= 0.0) return FrameOffset.NONE
        val random = Random(segment.jitterSeed * SEED_STRIDE + frameNumber)
        return FrameOffset(
            dx = (random.nextDouble() * 2 - 1) * segment.jitter,
            dy = (random.nextDouble() * 2 - 1) * segment.jitter,
        )
    }

    /** The observation of [segment] moved by [offset], stamped [timestampMs]; pose only when [withPose]. */
    fun observe(
        segment: FrameSegment,
        offset: FrameOffset,
        timestampMs: Long,
        withPose: Boolean,
    ): CaptureObservation {
        val frame = frame(segment)
        val visible =
            frame.boxes
                .map { it.moved(offset).clamped() }
                .filter { it.areaShare > 0.0 }
        val item = visible.maxByOrNull { it.areaShare }
        val sharpness = item?.let { frame.small.sharpness(it.moved(FrameOffset(-offset.dx, -offset.dy))) } ?: 0.0
        return CaptureObservation(
            timestampMs = timestampMs,
            itemBoxes = visible,
            sharpness = sharpness,
            light = frame.light,
            device = null,
            pose = if (withPose && visible.isNotEmpty()) pose(segment, frame, offset) else null,
        )
    }

    override fun close() {
        if (boxes == BoxSource.LIVE) itemDetector.close()
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
            MeasuredFrame(
                bitmap = bitmap,
                light = plane.light(),
                small = plane.scaledToLongSide(CaptureRules.Steady.SHARPNESS_LONG_SIDE_PX),
                boxes = if (boxes == BoxSource.LIVE) liveBoxesOf(bitmap) else storedBoxes(segment),
            )
        }

    private fun liveBoxesOf(bitmap: Bitmap): List<NormalizedRect> =
        itemDetector.detect(InputImage.fromBitmap(bitmap, 0)).orEmpty()

    private class MeasuredFrame(
        val bitmap: Bitmap,
        val light: LightSample,
        val small: LumaPlane,
        val boxes: List<NormalizedRect>,
        var keypoints: PoseSample? = null,
        var livePose: PoseSample? = null,
    )

    private companion object {
        /** Spreads frame numbers apart in the seed space so neighbouring frames are unrelated. */
        const val SEED_STRIDE = 1_000_003L
    }
}

/** [this] box moved by [offset] (not clipped). */
fun NormalizedRect.moved(offset: FrameOffset): NormalizedRect =
    NormalizedRect(left + offset.dx, top + offset.dy, right + offset.dx, bottom + offset.dy)
