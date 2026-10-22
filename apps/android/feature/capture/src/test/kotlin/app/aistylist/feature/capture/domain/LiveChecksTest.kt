package app.aistylist.feature.capture.domain

import app.aistylist.contracts.kernel.CaptureBodyPart
import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureLockReason
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureRules
import app.aistylist.contracts.kernel.CaptureShapeFamily
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LiveChecksTest {
    private val band = CaptureRules.EDGE_BAND_SHARE

    /** Evaluates [observation] after an identical previous frame, so "steady" can pass. */
    private fun afterStill(
        observation: CaptureObservation,
        context: CameraContext = TOP_FLAT,
        wasTiltHintOn: Boolean = false,
    ): CheckReport = evaluateLiveChecks(observation, observation, context, wasTiltHintOn)

    // Item found

    @Test
    fun `no item locks with no-item and skips the item checks`() {
        val report = afterStill(frame(box = null))

        assertEquals(CaptureHint.NO_ITEM, report.blockingHint)
        assertEquals(CaptureLockReason.NO_ITEM, report.lockReason)
        assertEquals(CheckOutcome.FAILED, report.outcomes[CaptureCheck.ITEM_FOUND])
        listOf(CaptureCheck.CUT_OFF, CaptureCheck.BODY_PARTS, CaptureCheck.SIZE, CaptureCheck.STEADY).forEach {
            assertEquals(it.name, CheckOutcome.SKIPPED, report.outcomes[it])
        }
    }

    @Test
    fun `a good still frame passes every check`() {
        val report = afterStill(frame(device = STILL_PHONE))

        assertTrue(report.passes)
        assertNull(report.blockingHint)
        assertNull(report.advisoryHint)
        CaptureCheck.entries.filter { it != CaptureCheck.BODY_PARTS }.forEach {
            assertEquals(it.name, CheckOutcome.PASSED, report.outcomes[it])
        }
    }

    @Test
    fun `several items never lock, and the largest box is judged (C15)`() {
        val small = squareBox(areaShare = 0.01, centerX = 0.15, centerY = 0.15)
        val twoItems = frame().copy(itemBoxes = listOf(small, GOOD_BOX))

        val report = afterStill(twoItems)

        assertTrue(report.passes)
        assertEquals(GOOD_BOX, report.itemBox)
    }

    // Partly covered (C32): another box overlaps the item box

    /** A [side] x [side] box whose [share] of its width lies inside [GOOD_BOX]'s right edge. */
    private fun otherBox(
        share: Double,
        side: Double = 0.2,
    ): NormalizedRect {
        val left = GOOD_BOX.right - side * share
        return NormalizedRect(left, 0.4, left + side, 0.4 + side)
    }

    private fun coveredBy(
        other: NormalizedRect,
        context: CameraContext = TOP_FLAT,
    ): CheckReport = afterStill(frame().copy(itemBoxes = listOf(GOOD_BOX, other)), context)

    @Test
    fun `another object inside the item box locks with covered (C32)`() {
        val report = coveredBy(squareBox(areaShare = 0.04))

        assertEquals(CaptureHint.COVERED, report.blockingHint)
        assertEquals(CaptureLockReason.COVERED, report.lockReason)
        assertEquals(CheckOutcome.FAILED, report.outcomes[CaptureCheck.COVERED])
        assertEquals(GOOD_BOX, report.itemBox)
    }

    @Test
    fun `an overlap just above the limit locks and at the limit passes`() {
        val limit = CaptureRules.Covered.ABOVE_OVERLAP_SHARE

        assertEquals(CaptureHint.COVERED, coveredBy(otherBox(limit + SHARE_STEP)).blockingHint)
        assertTrue(coveredBy(otherBox(limit)).passes)
    }

    @Test
    fun `an object below the minimum box area never covers and at the minimum it does`() {
        val minimum = CaptureRules.Covered.MIN_OTHER_BOX_AREA_SHARE

        assertTrue(coveredBy(squareBox(areaShare = minimum * 0.9)).passes)
        assertEquals(CaptureHint.COVERED, coveredBy(squareBox(areaShare = minimum)).blockingHint)
    }

    @Test
    fun `hanger mode checks covered and worn mode never does`() {
        val inside = squareBox(areaShare = 0.04)

        assertEquals(
            CaptureHint.COVERED,
            coveredBy(inside, CameraContext(CaptureShapeFamily.TOP, CaptureMode.HANGER)).blockingHint,
        )
        val worn = coveredBy(inside, CameraContext(CaptureShapeFamily.GENERIC, CaptureMode.WORN))
        assertTrue(worn.passes)
        assertEquals(CheckOutcome.SKIPPED, worn.outcomes[CaptureCheck.COVERED])
    }

    @Test
    fun `covered ranks after cut off and before too small`() {
        val cutAndSmall = NormalizedRect(0.0, 0.4, 0.1, 0.5)
        val inside = NormalizedRect(0.0, 0.42, 0.08, 0.5)
        val small = squareBox(areaShare = 0.01)
        val insideSmall = squareBox(areaShare = 0.006)

        assertEquals(
            CaptureHint.CUT_OFF_LEFT,
            afterStill(frame().copy(itemBoxes = listOf(cutAndSmall, inside))).blockingHint,
        )
        assertEquals(
            CaptureHint.COVERED,
            afterStill(frame().copy(itemBoxes = listOf(small, insideSmall))).blockingHint,
        )
    }

    @Test
    fun `an import is not checked for covered`() {
        val covered = frame().copy(itemBoxes = listOf(GOOD_BOX, squareBox(areaShare = 0.04)))

        assertEquals(emptyList<CaptureHint>(), evaluateImportChecks(covered))
    }

    @Test
    fun `the overlap is a share of the smaller box whichever box asks`() {
        val big = NormalizedRect(0.0, 0.0, 0.5, 0.5)
        val half = NormalizedRect(0.4, 0.1, 0.6, 0.2)

        assertEquals(0.5, big.overlapShareOfSmaller(half), 1e-9)
        assertEquals(0.5, half.overlapShareOfSmaller(big), 1e-9)
        assertEquals(0.0, big.overlapShareOfSmaller(NormalizedRect(0.6, 0.0, 0.7, 0.1)), 0.0)
        assertEquals(0.0, big.overlapShareOfSmaller(NormalizedRect(0.1, 0.1, 0.1, 0.1)), 0.0)
    }

    // Cut off (Android: any box edge inside the edge band)

    @Test
    fun `an edge just inside the band locks with that edge's hint`() {
        val inside = band - SHARE_STEP
        val cases =
            mapOf(
                GOOD_BOX.copy(top = inside) to CaptureHint.CUT_OFF_TOP,
                GOOD_BOX.copy(bottom = 1.0 - inside) to CaptureHint.CUT_OFF_BOTTOM,
                GOOD_BOX.copy(left = inside) to CaptureHint.CUT_OFF_LEFT,
                GOOD_BOX.copy(right = 1.0 - inside) to CaptureHint.CUT_OFF_RIGHT,
            )

        cases.forEach { (box, hint) ->
            val report = afterStill(frame(box = box))
            assertEquals(hint, report.blockingHint)
            assertEquals(CaptureLockReason.CUT_OFF, report.lockReason)
        }
    }

    @Test
    fun `an edge just outside the band passes`() {
        val outside = band + SHARE_STEP
        val box = NormalizedRect(left = outside, top = outside, right = 1.0 - outside, bottom = 1.0 - outside)

        assertEquals(CheckOutcome.PASSED, afterStill(frame(box = box)).outcomes[CaptureCheck.CUT_OFF])
    }

    @Test
    fun `two or more touched edges say cut-off-multiple (C11)`() {
        val coat = NormalizedRect(left = 0.0, top = 0.0, right = 1.0, bottom = 0.7)

        assertEquals(CaptureHint.CUT_OFF_MULTIPLE, afterStill(frame(box = coat)).blockingHint)
    }

    @Test
    fun `hanger mode still locks on top contact on Android (C2, C6)`() {
        val hook = GOOD_BOX.copy(top = 0.0)

        val report = afterStill(frame(box = hook), CameraContext(CaptureShapeFamily.TOP, CaptureMode.HANGER))

        assertEquals(CaptureHint.CUT_OFF_TOP, report.blockingHint)
    }

    @Test
    fun `worn mode turns the edge rule off (C3)`() {
        val mirror = NormalizedRect(left = 0.0, top = 0.0, right = 1.0, bottom = 1.0)

        val worn = afterStill(frame(box = mirror, pose = fullBody()), TOP_WORN)
        val flat = afterStill(frame(box = mirror), TOP_FLAT)

        assertTrue(worn.passes)
        assertEquals(CheckOutcome.SKIPPED, worn.outcomes[CaptureCheck.CUT_OFF])
        assertEquals(CaptureHint.CUT_OFF_MULTIPLE, flat.blockingHint)
    }

    // Too small

    @Test
    fun `every family locks just below its minimum and passes just above (C5, C17)`() {
        CaptureShapeFamily.entries.forEach { family ->
            val context = CameraContext(family, CaptureMode.FLAT)
            val below = afterStill(frame(box = squareBox(family.minAreaShare - SHARE_STEP)), context)
            val above = afterStill(frame(box = squareBox(family.minAreaShare + SHARE_STEP)), context)

            assertEquals(family.value, CaptureHint.TOO_SMALL, below.blockingHint)
            assertEquals(family.value, CheckOutcome.PASSED, above.outcomes[CaptureCheck.SIZE])
        }
    }

    @Test
    fun `worn mode uses the worn minimum for every family`() {
        val minimum = CaptureRules.Worn.MIN_AREA_SHARE
        CaptureShapeFamily.entries.forEach { family ->
            val context = CameraContext(family, CaptureMode.WORN)
            val below = afterStill(frame(box = squareBox(minimum - SHARE_STEP), pose = fullBody()), context)
            val above = afterStill(frame(box = squareBox(minimum + SHARE_STEP), pose = fullBody()), context)

            assertEquals(family.value, CheckOutcome.FAILED, below.outcomes[CaptureCheck.SIZE])
            assertEquals(family.value, CheckOutcome.PASSED, above.outcomes[CaptureCheck.SIZE])
        }
    }

    // Steady

    @Test
    fun `the first frame with an item is never steady`() {
        val report = evaluateLiveChecks(frame(), previous = null, context = TOP_FLAT)

        assertEquals(CaptureHint.NOT_STEADY, report.blockingHint)
    }

    @Test
    fun `a frame after a no-item frame is not steady`() {
        val report = evaluateLiveChecks(frame(), previous = frame(box = null), context = TOP_FLAT)

        assertEquals(CaptureHint.NOT_STEADY, report.blockingHint)
    }

    @Test
    fun `a centre shift just within the limit is steady and just over it is not`() {
        val limit = CaptureRules.Steady.MAX_CENTRE_SHIFT
        listOf(true, false).forEach { horizontal ->
            val within = shifted(limit - SHARE_STEP, horizontal)
            val over = shifted(limit + SHARE_STEP, horizontal)

            assertEquals(CheckOutcome.PASSED, steadyOutcome(within))
            assertEquals(CheckOutcome.FAILED, steadyOutcome(over))
        }
    }

    @Test
    fun `an area change just within the limit is steady and just over it is not`() {
        val limit = CaptureRules.Steady.MAX_AREA_CHANGE_SHARE
        val previousArea = GOOD_BOX.areaShare

        val within = squareBox(previousArea * (1 + limit - SHARE_STEP))
        val over = squareBox(previousArea * (1 + limit + SHARE_STEP))

        assertEquals(CheckOutcome.PASSED, steadyOutcome(within))
        assertEquals(CheckOutcome.FAILED, steadyOutcome(over))
    }

    @Test
    fun `sharpness just below the minimum is not steady and just above is`() {
        val minimum = CaptureRules.Steady.MIN_SHARPNESS

        assertEquals(
            CheckOutcome.FAILED,
            afterStill(frame(sharpness = minimum - VALUE_STEP)).outcomes[CaptureCheck.STEADY],
        )
        assertEquals(
            CheckOutcome.PASSED,
            afterStill(frame(sharpness = minimum + VALUE_STEP)).outcomes[CaptureCheck.STEADY],
        )
    }

    @Test
    fun `phone motion just over the Android limit is not steady and just under is`() {
        val limit = CaptureRules.Android.MAX_LINEAR_ACCELERATION_MPS2

        val calm = afterStill(frame(device = STILL_PHONE.copy(linearAccelerationMps2 = limit - VALUE_STEP)))
        val shaky = afterStill(frame(device = STILL_PHONE.copy(linearAccelerationMps2 = limit + VALUE_STEP)))

        assertEquals(CheckOutcome.PASSED, calm.outcomes[CaptureCheck.STEADY])
        assertEquals(CaptureHint.NOT_STEADY, shaky.blockingHint)
    }

    @Test
    fun `without phone sensors only the box and sharpness decide steadiness`() {
        assertEquals(CheckOutcome.PASSED, afterStill(frame(device = null)).outcomes[CaptureCheck.STEADY])
    }

    // Light: hints only, never a lock

    @Test
    fun `mean luma just below the dark limit hints too-dark and never locks (C13)`() {
        val limit = CaptureRules.Light.TOO_DARK_BELOW_MEAN_LUMA

        val dark = afterStill(frame(light = GOOD_LIGHT.copy(meanLuma = limit - VALUE_STEP)))
        val fine = afterStill(frame(light = GOOD_LIGHT.copy(meanLuma = limit + VALUE_STEP)))

        assertTrue(dark.passes)
        assertEquals(CaptureHint.TOO_DARK, dark.advisoryHint)
        assertNull(fine.advisoryHint)
    }

    @Test
    fun `mean luma or clipped share just over the bright limits hints too-bright and never locks`() {
        val luma = CaptureRules.Light.TOO_BRIGHT_ABOVE_MEAN_LUMA
        val clipped = CaptureRules.Light.TOO_BRIGHT_ABOVE_CLIPPED_SHARE

        val byLuma = afterStill(frame(light = LightSample(meanLuma = luma + VALUE_STEP, clippedShare = 0.0)))
        val byClipped = afterStill(frame(light = GOOD_LIGHT.copy(clippedShare = clipped + SHARE_STEP)))
        val underLuma = afterStill(frame(light = LightSample(meanLuma = luma - VALUE_STEP, clippedShare = 0.0)))
        val underClipped = afterStill(frame(light = GOOD_LIGHT.copy(clippedShare = clipped - SHARE_STEP)))

        assertTrue(byLuma.passes && byClipped.passes)
        assertEquals(CaptureHint.TOO_BRIGHT, byLuma.advisoryHint)
        assertEquals(CaptureHint.TOO_BRIGHT, byClipped.advisoryHint)
        assertNull(underLuma.advisoryHint)
        assertNull(underClipped.advisoryHint)
    }

    @Test
    fun `a frame too dark to find the item locks as no-item, not as dark`() {
        val report = afterStill(frame(box = null, light = GOOD_LIGHT.copy(meanLuma = 10.0)))

        assertEquals(CaptureHint.NO_ITEM, report.blockingHint)
        assertEquals(CaptureHint.TOO_DARK, report.advisoryHint)
    }

    // Tilt: flat mode, phones only, hysteresis

    @Test
    fun `tilt turns on just above the hint angle and stays off just below it`() {
        val on = CaptureRules.Tilt.HINT_ABOVE_DEGREES

        val tilted = afterStill(frame(device = STILL_PHONE.copy(tiltDegrees = on + VALUE_STEP)))
        val level = afterStill(frame(device = STILL_PHONE.copy(tiltDegrees = on - VALUE_STEP)))

        assertTrue(tilted.passes)
        assertEquals(CaptureHint.TILT, tilted.advisoryHint)
        assertTrue(tilted.isTiltHintOn)
        assertFalse(level.isTiltHintOn)
    }

    @Test
    fun `once on, tilt clears only below the clear angle`() {
        val clear = CaptureRules.Tilt.CLEAR_BELOW_DEGREES

        val stillTilted =
            afterStill(frame(device = STILL_PHONE.copy(tiltDegrees = clear + VALUE_STEP)), wasTiltHintOn = true)
        val cleared =
            afterStill(frame(device = STILL_PHONE.copy(tiltDegrees = clear - VALUE_STEP)), wasTiltHintOn = true)

        assertTrue(stillTilted.isTiltHintOn)
        assertEquals(CaptureHint.TILT, stillTilted.advisoryHint)
        assertFalse(cleared.isTiltHintOn)
    }

    @Test
    fun `tilt is checked only in flat mode and only with phone sensors`() {
        val tilted = STILL_PHONE.copy(tiltDegrees = 80.0)
        val hanger = afterStill(frame(device = tilted), CameraContext(CaptureShapeFamily.TOP, CaptureMode.HANGER))
        val noSensors = afterStill(frame(device = null))

        assertEquals(CheckOutcome.SKIPPED, hanger.outcomes[CaptureCheck.TILT])
        assertEquals(CheckOutcome.SKIPPED, noSensors.outcomes[CaptureCheck.TILT])
    }

    // Priority (brief §6)

    @Test
    fun `blocking hints follow the priority order`() {
        val cutAndSmall = squareBox(0.01, centerX = 0.0)
        val small = squareBox(0.01)

        assertEquals(CaptureHint.CUT_OFF_LEFT, afterStill(frame(box = cutAndSmall)).blockingHint)
        assertEquals(CaptureHint.TOO_SMALL, evaluateLiveChecks(frame(box = small), null, TOP_FLAT).blockingHint)
    }

    @Test
    fun `advisory hints follow the priority order dark, bright, tilt`() {
        val dark = LightSample(meanLuma = 10.0, clippedShare = 0.9)
        val bright = LightSample(meanLuma = 128.0, clippedShare = 0.9)
        val tilted = STILL_PHONE.copy(tiltDegrees = 80.0)

        assertEquals(CaptureHint.TOO_DARK, afterStill(frame(light = dark, device = tilted)).advisoryHint)
        assertEquals(CaptureHint.TOO_BRIGHT, afterStill(frame(light = bright, device = tilted)).advisoryHint)
    }

    // Worn body check (Q-A b)

    @Test
    fun `every worn family with a body rule passes with the whole body in frame`() {
        wornFamilies().forEach { family ->
            val report = afterStill(frame(pose = fullBody()), CameraContext(family, CaptureMode.WORN))
            assertEquals(family.value, CheckOutcome.PASSED, report.outcomes[CaptureCheck.BODY_PARTS])
        }
    }

    @Test
    fun `a missing required part locks with the family's body hint (C3)`() {
        wornFamilies().forEach { family ->
            family.wornRequiredParts.forEach { part ->
                val report =
                    afterStill(frame(pose = fullBody().withPart(part, null)), CameraContext(family, CaptureMode.WORN))

                assertEquals("${family.value} $part", family.wornHint, report.blockingHint)
                assertEquals(CaptureLockReason.BODY_PARTS_MISSING, report.lockReason)
            }
        }
    }

    @Test
    fun `a part not required by the family is not checked`() {
        val noAnkles = fullBody().withPart(CaptureBodyPart.LEFT_ANKLE, null).withPart(CaptureBodyPart.RIGHT_ANKLE, null)

        assertTrue(afterStill(frame(pose = noAnkles), TOP_WORN).passes)
    }

    @Test
    fun `in-frame likelihood just below the Android minimum counts as missing`() {
        val minimum = CaptureRules.Android.MIN_KEYPOINT_IN_FRAME_LIKELIHOOD
        val position = NormalizedPoint(0.4, 0.5)
        val faint = fullBody().withPart(CaptureBodyPart.LEFT_HIP, PoseLandmark(position, minimum - SHARE_STEP))
        val clear = fullBody().withPart(CaptureBodyPart.LEFT_HIP, PoseLandmark(position, minimum + SHARE_STEP))

        assertEquals(CaptureHint.BODY_SHOULDERS_HIPS, afterStill(frame(pose = faint), TOP_WORN).blockingHint)
        assertTrue(afterStill(frame(pose = clear), TOP_WORN).passes)
    }

    @Test
    fun `a keypoint just inside the edge band counts as missing`() {
        val low = CaptureRules.Worn.KEYPOINT_MIN_COORDINATE
        val high = CaptureRules.Worn.KEYPOINT_MAX_COORDINATE
        val missing =
            listOf(
                NormalizedPoint(low - SHARE_STEP, 0.5),
                NormalizedPoint(high + SHARE_STEP, 0.5),
                NormalizedPoint(0.5, low - SHARE_STEP),
                NormalizedPoint(0.5, high + SHARE_STEP),
            )
        val present =
            listOf(
                NormalizedPoint(low + SHARE_STEP, high - SHARE_STEP),
                NormalizedPoint(
                    high - SHARE_STEP,
                    low + SHARE_STEP,
                ),
            )

        missing.forEach { point ->
            val pose = fullBody().withPart(CaptureBodyPart.RIGHT_SHOULDER, PoseLandmark(point, 0.9))
            assertEquals(
                point.toString(),
                CaptureHint.BODY_SHOULDERS_HIPS,
                afterStill(frame(pose = pose), TOP_WORN).blockingHint,
            )
        }
        present.forEach { point ->
            val pose = fullBody().withPart(CaptureBodyPart.RIGHT_SHOULDER, PoseLandmark(point, 0.9))
            assertTrue(point.toString(), afterStill(frame(pose = pose), TOP_WORN).passes)
        }
    }

    @Test
    fun `no person found means every part is missing`() {
        val report = afterStill(frame(pose = PoseSample(emptyMap())), TOP_WORN)

        assertEquals(CaptureHint.BODY_SHOULDERS_HIPS, report.blockingHint)
    }

    @Test
    fun `generic worn has no body check and never a body hint`() {
        val context = CameraContext(CaptureShapeFamily.GENERIC, CaptureMode.WORN)

        val report = afterStill(frame(pose = PoseSample(emptyMap())), context)

        assertTrue(report.passes)
        assertEquals(CheckOutcome.SKIPPED, report.outcomes[CaptureCheck.BODY_PARTS])
        assertFalse(report.isPoseFallback)
    }

    @Test
    fun `an empty frame in worn mode reports no-item, not a body hint`() {
        assertEquals(
            CaptureHint.NO_ITEM,
            afterStill(frame(box = null, pose = PoseSample(emptyMap())), TOP_WORN).blockingHint,
        )
    }

    @Test
    fun `pose model unavailable, no lock, the body hint stays as a tip, fallback flagged`() {
        val report = afterStill(frame(pose = null), TOP_WORN)

        assertTrue(report.passes)
        assertEquals(CaptureHint.BODY_SHOULDERS_HIPS, report.advisoryHint)
        assertTrue(report.isPoseFallback)
    }

    @Test
    fun `the body check never runs outside worn mode`() {
        val report = afterStill(frame(pose = PoseSample(emptyMap())), TOP_FLAT)

        assertEquals(CheckOutcome.SKIPPED, report.outcomes[CaptureCheck.BODY_PARTS])
        assertFalse(report.isPoseFallback)
    }

    // Library import (Q17)

    @Test
    fun `an import returns every failing check as a tip in priority order`() {
        val coat = NormalizedRect(left = 0.0, top = 0.3, right = 0.1, bottom = 0.4)
        val dark = frame(box = coat, light = GOOD_LIGHT.copy(meanLuma = 10.0))

        assertEquals(
            listOf(CaptureHint.CUT_OFF_LEFT, CaptureHint.TOO_SMALL, CaptureHint.TOO_DARK),
            evaluateImportChecks(dark),
        )
    }

    @Test
    fun `an import without an item tips no-item and the light`() {
        val bright = frame(box = null, light = LightSample(meanLuma = 250.0, clippedShare = 0.0))

        assertEquals(listOf(CaptureHint.NO_ITEM, CaptureHint.TOO_BRIGHT), evaluateImportChecks(bright))
    }

    @Test
    fun `an import never checks steadiness, tilt or the body`() {
        val blurredTilted = frame(sharpness = 0.0, device = STILL_PHONE.copy(tiltDegrees = 80.0))

        assertEquals(emptyList<CaptureHint>(), evaluateImportChecks(blurredTilted))
    }

    @Test
    fun `an import uses the family minimum`() {
        val ring = frame(box = squareBox(CaptureShapeFamily.SMALL_ITEM.minAreaShare + SHARE_STEP))

        assertEquals(emptyList<CaptureHint>(), evaluateImportChecks(ring, CaptureShapeFamily.SMALL_ITEM))
        assertEquals(listOf(CaptureHint.TOO_SMALL), evaluateImportChecks(ring))
    }

    private fun wornFamilies(): List<CaptureShapeFamily> =
        CaptureShapeFamily.entries.filter { CaptureMode.WORN in it.modes && it.wornRequiredParts.isNotEmpty() }

    private fun shifted(
        shift: Double,
        horizontal: Boolean,
    ): NormalizedRect =
        if (horizontal) {
            GOOD_BOX.copy(left = GOOD_BOX.left + shift, right = GOOD_BOX.right + shift)
        } else {
            GOOD_BOX.copy(top = GOOD_BOX.top + shift, bottom = GOOD_BOX.bottom + shift)
        }

    private fun steadyOutcome(box: NormalizedRect): CheckOutcome? =
        evaluateLiveChecks(frame(box = box), previous = frame(box = GOOD_BOX), context = TOP_FLAT)
            .outcomes[CaptureCheck.STEADY]
}
