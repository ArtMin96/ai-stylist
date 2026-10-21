package app.aistylist.feature.capture.debug

import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureRules
import org.json.JSONArray
import org.json.JSONObject

/** What the probe found (harness step 6.5): which box and keypoint sources the harness uses. */
data class ProbeResult(
    val boxes: BoxSource,
    val pose: PoseSource,
    val report: JSONObject,
)

/**
 * Checks that ML Kit object detection and pose detection run on this device on the test frames
 * (harness step 6.5) and writes what they found to `capture-probe.json`. Both run on the arm64
 * emulator (2026-10-22), yet object detection finds no item once a frame cuts the item off (373 of
 * 607 segments as expected, against 553 with stored boxes) and the pose model misreads the drawn
 * figures (13 worn mismatches, none with keypoint files). The expected files are the generator's
 * geometry, so AUTO plays the stored boxes and keypoint files, and the live models stay one extra
 * away (`captureBoxes=live`, `capturePose=live`).
 */
object DetectorProbe {
    private const val SAMPLES = 5

    fun run(
        index: FrameIndex,
        args: CaptureHarnessArgs,
    ): ProbeResult {
        val probing = FrameAnalyzer(index, BoxSource.STORED, PoseSource.KEYPOINTS)
        val report = JSONObject()
        val boxes = probeBoxes(index, probing, report)
        val pose = probePose(index, probing, report)
        report.put("objectDetectionRuns", boxes == BoxSource.LIVE).put("poseDetectionRuns", pose == PoseSource.LIVE)
        val chosenBoxes = if (args.boxes == BoxSource.AUTO) BoxSource.STORED else args.boxes
        val chosenPose = if (args.pose == PoseSource.AUTO) PoseSource.KEYPOINTS else args.pose
        report.put("boxesUsed", chosenBoxes.id).put("poseUsed", chosenPose.id)
        return ProbeResult(chosenBoxes, chosenPose, report)
    }

    private fun probeBoxes(
        index: FrameIndex,
        analyzer: FrameAnalyzer,
        report: JSONObject,
    ): BoxSource {
        val samples =
            index.sets
                .filter { it.variant == "good" && it.mode == CaptureMode.FLAT }
                .map { it.segments.first() }
                .filter { analyzer.storedBoxes(it).isNotEmpty() }
                .take(SAMPLES)
        val found = JSONArray()
        val hits =
            samples.count { segment ->
                val live = analyzer.liveBoxes(segment)
                found.put(JSONObject().put("frame", segment.frame).put("boxes", live?.size ?: JSONObject.NULL))
                !live.isNullOrEmpty()
            }
        report.put("objectDetection", JSONObject().put("sampled", samples.size).put("found", hits).put("frames", found))
        return if (samples.isNotEmpty() && hits == samples.size) BoxSource.LIVE else BoxSource.STORED
    }

    private fun probePose(
        index: FrameIndex,
        analyzer: FrameAnalyzer,
        report: JSONObject,
    ): PoseSource {
        val samples =
            index.sets
                .filter {
                    it.mode == CaptureMode.WORN && it.variant == "whole" &&
                        it.family.wornRequiredParts.isNotEmpty()
                }.take(SAMPLES)
        val found = JSONArray()
        val hits =
            samples.count { set ->
                val pose = analyzer.livePose(set.segments.first())
                val seen =
                    pose
                        ?.landmarks
                        ?.filterValues {
                            it.inFrameLikelihood >=
                                CaptureRules.Android.MIN_KEYPOINT_IN_FRAME_LIKELIHOOD
                        }?.keys
                        .orEmpty()
                found.put(JSONObject().put("set", set.id).put("parts", seen.size))
                seen.containsAll(set.family.wornRequiredParts)
            }
        report.put("poseDetection", JSONObject().put("sampled", samples.size).put("found", hits).put("sets", found))
        return if (samples.isNotEmpty() && hits == samples.size) PoseSource.LIVE else PoseSource.KEYPOINTS
    }
}
