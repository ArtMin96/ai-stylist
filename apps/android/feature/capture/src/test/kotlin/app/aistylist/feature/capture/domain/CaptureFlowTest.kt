package app.aistylist.feature.capture.domain

import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureShapeFamily
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CaptureFlowTest {
    private val front = PhotoRef("synthetic-front")
    private val back = PhotoRef("synthetic-back")

    private fun CaptureFlowState.camera(): CameraContext = (screen as CaptureScreen.Camera).context

    @Test
    fun `the picker opens first`() {
        assertEquals(CaptureScreen.Picker, CaptureFlowState().screen)
    }

    @Test
    fun `a family tile opens the front step of a single capture in flat mode`() {
        CaptureShapeFamily.entries.forEach { family ->
            val camera = CaptureFlowState().pickFamily(family).camera()

            assertEquals(CameraContext(family, CaptureMode.FLAT, CaptureSide.FRONT, CaptureFlowKind.SINGLE), camera)
        }
    }

    @Test
    fun `C17 not sure uses the generic family`() {
        assertEquals(CaptureShapeFamily.GENERIC, CaptureFlowState().pickNotSure().camera().family)
    }

    @Test
    fun `the mode switch offers the family's modes and ignores the rest`() {
        val shoes = CaptureFlowState().pickFamily(CaptureShapeFamily.SHOES)
        val top = CaptureFlowState().pickFamily(CaptureShapeFamily.TOP)

        assertEquals(listOf(CaptureMode.FLAT), shoes.offeredModes)
        assertEquals(shoes, shoes.changeMode(CaptureMode.WORN))
        assertEquals(CaptureMode.WORN, top.changeMode(CaptureMode.WORN).camera().mode)
    }

    // Underwear and swimwear (C19)

    @Test
    fun `C19 the opt-in sheet shows the first time only`() {
        assertEquals(CaptureScreen.WornOptInSheet, CaptureFlowState().pickUnderwear(WornOptIn.NOT_ASKED).screen)
        assertEquals(CaptureScreen.UnderwearPicker, CaptureFlowState().pickUnderwear(WornOptIn.FLAT_ONLY).screen)
        assertEquals(CaptureScreen.UnderwearPicker, CaptureFlowState().pickUnderwear(WornOptIn.WORN_ALLOWED).screen)
    }

    @Test
    fun `C19 worn mode is absent for underwear until allowed`() {
        val flatOnly =
            CaptureFlowState()
                .pickUnderwear(WornOptIn.NOT_ASKED)
                .answerWornOptIn(allowWorn = false)
                .pickUnderwearItem(UnderwearPick.BRA_OR_TOP)
        val allowed =
            CaptureFlowState()
                .pickUnderwear(WornOptIn.NOT_ASKED)
                .answerWornOptIn(allowWorn = true)
                .pickUnderwearItem(UnderwearPick.BRA_OR_TOP)

        assertEquals(WornOptIn.FLAT_ONLY, flatOnly.wornOptIn)
        assertEquals(listOf(CaptureMode.FLAT, CaptureMode.HANGER), flatOnly.offeredModes)
        assertEquals(flatOnly, flatOnly.changeMode(CaptureMode.WORN))
        assertTrue(CaptureMode.WORN in allowed.offeredModes)
    }

    @Test
    fun `the opt-in is off by default`() {
        assertFalse(WornOptIn.NOT_ASKED.allowsWorn)
        assertFalse(CaptureFlowState().wornOptIn.allowsWorn)
    }

    @Test
    fun `C19 the camera-menu toggle changes it and leaves worn mode when turned off`() {
        val wearing =
            CaptureFlowState()
                .pickUnderwear(WornOptIn.WORN_ALLOWED)
                .pickUnderwearItem(UnderwearPick.SWIMSUIT_OR_BODYSUIT)
                .changeMode(CaptureMode.WORN)

        val off = wearing.setUnderwearWornAllowed(allowed = false)

        assertEquals(CaptureMode.WORN, wearing.camera().mode)
        assertEquals(WornOptIn.FLAT_ONLY, off.wornOptIn)
        assertEquals(CaptureMode.FLAT, off.camera().mode)
        assertTrue(CaptureMode.WORN in off.setUnderwearWornAllowed(allowed = true).offeredModes)
    }

    @Test
    fun `each underwear pick uses its family's rules`() {
        val expected =
            mapOf(
                UnderwearPick.BRA_OR_TOP to CaptureShapeFamily.TOP,
                UnderwearPick.BRIEFS_OR_BOTTOMS to CaptureShapeFamily.SHORT_BOTTOM,
                UnderwearPick.SWIMSUIT_OR_BODYSUIT to CaptureShapeFamily.ONE_PIECE,
                UnderwearPick.TIGHTS to CaptureShapeFamily.LONG_BOTTOM,
                UnderwearPick.SOCKS to CaptureShapeFamily.SMALL_ITEM,
            )

        expected.forEach { (pick, family) ->
            val flow = CaptureFlowState().pickUnderwear(WornOptIn.WORN_ALLOWED).pickUnderwearItem(pick)
            assertEquals(pick.name, family, flow.camera().family)
            assertTrue(flow.selection.isUnderwear)
            assertEquals(pick, flow.selection.underwearPick)
        }
    }

    // Back photo (Q5) and the shoe pair (Q-D)

    @Test
    fun `C7 the front photo goes to review, where the back question defaults to same`() {
        val review = CaptureFlowState().pickFamily(CaptureShapeFamily.TOP).photoCaptured(front)

        assertEquals(CaptureScreen.Review, review.screen)
        assertEquals(ReviewPhotos(front = front), review.review)
        assertEquals(SecondPhotoQuestion.BACK, review.secondQuestion)
        assertFalse(review.review.wantsSecond)
        assertEquals(review, review.takeSecondPhoto())
    }

    @Test
    fun `C7 different opens the back step, and its photo joins the front`() {
        val backStep =
            CaptureFlowState()
                .pickFamily(CaptureShapeFamily.TOP)
                .photoCaptured(front)
                .answerSecondQuestion(wantsSecond = true)
                .takeSecondPhoto()

        assertEquals(CaptureSide.BACK, backStep.camera().side)
        val review = backStep.photoCaptured(back)
        assertEquals(ReviewPhotos(front = front, second = back, wantsSecond = true), review.review)
    }

    @Test
    fun `C7 skip on the back step returns to review`() {
        val backStep =
            CaptureFlowState()
                .pickFamily(CaptureShapeFamily.TOP)
                .photoCaptured(front)
                .answerSecondQuestion(wantsSecond = true)
                .takeSecondPhoto()

        val skipped = backStep.skipSecondPhoto()

        assertEquals(CaptureScreen.Review, skipped.screen)
        assertEquals(ReviewPhotos(front = front, wantsSecond = true), skipped.review)
    }

    @Test
    fun `skip does nothing on the front step`() {
        val frontStep = CaptureFlowState().pickFamily(CaptureShapeFamily.TOP)

        assertEquals(frontStep, frontStep.skipSecondPhoto())
    }

    @Test
    fun `retake replaces the front and keeps the back`() {
        val retaken =
            CaptureFlowState()
                .pickFamily(CaptureShapeFamily.TOP)
                .photoCaptured(front)
                .answerSecondQuestion(wantsSecond = true)
                .takeSecondPhoto()
                .photoCaptured(back)
                .retake()

        assertEquals(CaptureSide.FRONT, retaken.camera().side)
        val newFront = PhotoRef("synthetic-front-2")
        assertEquals(
            ReviewPhotos(front = newFront, second = back, wantsSecond = true),
            retaken.photoCaptured(newFront).review,
        )
    }

    @Test
    fun `answering same drops a back photo already taken`() {
        val same =
            CaptureFlowState()
                .pickFamily(CaptureShapeFamily.TOP)
                .photoCaptured(front)
                .answerSecondQuestion(wantsSecond = true)
                .takeSecondPhoto()
                .photoCaptured(back)
                .answerSecondQuestion(wantsSecond = false)

        assertEquals(ReviewPhotos(front = front), same.review)
    }

    @Test
    fun `C4 shoes ask for the pair through the same step`() {
        val review = CaptureFlowState().pickFamily(CaptureShapeFamily.SHOES).photoCaptured(front)

        val pairStep = review.answerSecondQuestion(wantsSecond = true).takeSecondPhoto()

        assertEquals(SecondPhotoQuestion.PAIR, review.secondQuestion)
        assertEquals(CaptureSide.PAIR, pairStep.camera().side)
    }

    // Batch (Q16, Q-C)

    @Test
    fun `C20 batch skips the picker and the back question, counts photos, and ends in the summary`() {
        var flow = CaptureFlowState().startBatch()
        assertEquals(
            CameraContext(CaptureShapeFamily.GENERIC, CaptureMode.FLAT, CaptureSide.FRONT, CaptureFlowKind.BATCH),
            flow.camera(),
        )

        repeat(10) { index -> flow = flow.photoCaptured(PhotoRef("synthetic-$index")) }

        assertEquals(10, flow.batchPhotos.size)
        assertTrue(flow.screen is CaptureScreen.Camera)
        assertEquals(CaptureScreen.BatchSummary, flow.finishBatch().screen)
    }

    @Test
    fun `finishing a batch does nothing outside batch`() {
        val single = CaptureFlowState().pickFamily(CaptureShapeFamily.TOP)

        assertEquals(single, single.finishBatch())
    }

    // Library import (Q17)

    @Test
    fun `C21 an import with tips shows them, and keep anyway goes to review`() {
        val tips = listOf(CaptureHint.NO_ITEM, CaptureHint.TOO_DARK)

        val tipsScreen = CaptureFlowState().openImport().importPicked(front, tips)

        assertEquals(CaptureScreen.ImportTips(front, tips, returnTo = CaptureScreen.Picker), tipsScreen.screen)
        val kept = tipsScreen.keepImportAnyway()
        assertEquals(CaptureScreen.Review, kept.screen)
        assertEquals(front, kept.review.front)
    }

    @Test
    fun `C21 choose another reopens the system picker`() {
        val again =
            CaptureFlowState()
                .openImport()
                .importPicked(
                    front,
                    listOf(CaptureHint.TOO_SMALL),
                ).chooseAnotherImport()

        assertEquals(CaptureScreen.ImportPicking(returnTo = CaptureScreen.Picker), again.screen)
    }

    @Test
    fun `a clean import goes straight to review`() {
        val review = CaptureFlowState().openImport().importPicked(front, emptyList())

        assertEquals(CaptureScreen.Review, review.screen)
        assertEquals(front, review.review.front)
    }

    @Test
    fun `an import is checked against the camera's family, else generic`() {
        val fromCamera = CaptureFlowState().pickFamily(CaptureShapeFamily.SMALL_ITEM).openImport()
        val fromPicker = CaptureFlowState().openImport()
        val tips = fromCamera.importPicked(front, listOf(CaptureHint.TOO_DARK))

        assertEquals(CaptureShapeFamily.SMALL_ITEM, fromCamera.importFamily)
        assertEquals(CaptureShapeFamily.SMALL_ITEM, tips.importFamily)
        assertEquals(CaptureShapeFamily.GENERIC, fromPicker.importFamily)
    }

    @Test
    fun `cancelling the system picker returns where it came from`() {
        val camera = CaptureFlowState().pickFamily(CaptureShapeFamily.BAG)

        assertEquals(camera, camera.openImport().cancelImport())
    }

    // Permission and no camera (C23)

    @Test
    fun `C23 a denied permission shows the permission screen, from which import works`() {
        val camera = CaptureFlowState().pickFamily(CaptureShapeFamily.TOP)
        val denied = camera.cameraUnavailable(CameraUnavailableReason.PERMISSION_DENIED)
        val permissionScreen = CaptureScreen.PermissionDenied(returnTo = camera.screen as CaptureScreen.Camera)

        assertEquals(permissionScreen, denied.screen)
        assertEquals(CaptureScreen.ImportPicking(returnTo = permissionScreen), denied.openImport().screen)
    }

    @Test
    fun `C23 access granted on the permission screen returns to the same camera step`() {
        val camera = CaptureFlowState().pickFamily(CaptureShapeFamily.TOP)
        val denied = camera.cameraUnavailable(CameraUnavailableReason.PERMISSION_DENIED)

        assertEquals(camera.screen, denied.permissionGranted().screen)
        assertEquals(camera, camera.permissionGranted())
    }

    @Test
    fun `no camera shows the no-camera screen`() {
        val none = CaptureFlowState().startBatch().cameraUnavailable(CameraUnavailableReason.NO_CAMERA)

        assertEquals(CaptureScreen.NoCamera, none.screen)
    }

    @Test
    fun `closing drops every photo`() {
        val closed = CaptureFlowState().pickFamily(CaptureShapeFamily.TOP).photoCaptured(front).close()

        assertEquals(CaptureScreen.Closed, closed.screen)
        assertEquals(ReviewPhotos(), closed.review)
    }

    @Test
    fun `dismissing the opt-in sheet or the sub-pick returns to the picker and keeps the opt-in unasked`() {
        val sheet = CaptureFlowState().pickUnderwear(WornOptIn.NOT_ASKED)

        val dismissed = sheet.dismissUnderwear()

        assertEquals(CaptureScreen.Picker, dismissed.screen)
        assertEquals(WornOptIn.NOT_ASKED, dismissed.wornOptIn)
        assertEquals(
            CaptureScreen.Picker,
            CaptureFlowState().pickUnderwear(WornOptIn.FLAT_ONLY).dismissUnderwear().screen,
        )
        assertEquals(
            CaptureScreen.Camera(TOP_FLAT),
            CaptureFlowState().pickFamily(CaptureShapeFamily.TOP).dismissUnderwear().screen,
        )
    }
}
