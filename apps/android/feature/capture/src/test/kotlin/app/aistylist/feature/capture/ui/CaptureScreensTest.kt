package app.aistylist.feature.capture.ui

import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureLockReason
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureShapeFamily
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.feature.capture.domain.AnywayReason
import app.aistylist.feature.capture.domain.CameraContext
import app.aistylist.feature.capture.domain.CameraSnapshot
import app.aistylist.feature.capture.domain.CaptureFlowKind
import app.aistylist.feature.capture.domain.CaptureScreen
import app.aistylist.feature.capture.domain.CaptureSide
import app.aistylist.feature.capture.domain.LockPhase
import app.aistylist.feature.capture.domain.PhotoRef
import app.aistylist.feature.capture.domain.ReviewPhotos
import app.aistylist.feature.capture.domain.SecondPhotoQuestion
import app.aistylist.feature.capture.domain.UnderwearPick
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** The capture screens render the brief's test IDs, copy and accessibility names (Robolectric). */
@RunWith(RobolectricTestRunner::class)
// The canvas phone (390 x 844), so the screens lay out as drawn.
@Config(sdk = [37], qualifiers = "w390dp-h844dp")
class CaptureScreensTest {
    @get:Rule
    val compose = createComposeRule()

    private val calls = mutableListOf<String>()

    private val cameraActions =
        object : CameraActions {
            override fun onClose() {
                calls += "close"
            }

            override fun onSpeechToggled(isOn: Boolean) {
                calls += "speech:$isOn"
            }

            override fun onTorchToggled(isOn: Boolean) {
                calls += "torch:$isOn"
            }

            override fun onWornAllowed(isAllowed: Boolean) {
                calls += "worn:$isAllowed"
            }

            override fun onModeSelected(mode: CaptureMode) {
                calls += "mode:${mode.value}"
            }

            override fun onImport() {
                calls += "import"
            }

            override fun onShutter() {
                calls += "shutter"
            }

            override fun onAnyway() {
                calls += "anyway"
            }

            override fun onNextItem() {
                calls += "next"
            }

            override fun onSkip() {
                calls += "skip"
            }

            override fun onBatchDone() {
                calls += "batch-done"
            }
        }

    private fun snapshot(
        context: CameraContext,
        phase: LockPhase = LockPhase.LOCKED,
        hint: CaptureHint? = CaptureHint.NO_ITEM,
        isAnywayVisible: Boolean = false,
        anywayReason: AnywayReason? = null,
        ringProgress: Double = 0.0,
    ) = CameraSnapshot(
        context = context,
        phase = phase,
        ringProgress = ringProgress,
        hint = hint,
        lockReason = hint?.lockReason,
        isAnywayVisible = isAnywayVisible,
        anywayReason = anywayReason,
    )

    private fun showCamera(
        context: CameraContext,
        snapshot: CameraSnapshot?,
        isUnderwear: Boolean = false,
        batchCount: Int = 0,
    ) {
        compose.setContent {
            AppTheme {
                CameraScreen(
                    model =
                        CameraScreenModel(
                            context = context,
                            snapshot = snapshot,
                            offeredModes = context.family.modes,
                            isUnderwear = isUnderwear,
                            isWornAllowed = false,
                            batchCount = batchCount,
                            isSpeechOn = false,
                            hasTorch = false,
                            isTorchOn = false,
                        ),
                    actions = cameraActions,
                    preview = { _: Modifier -> },
                )
            }
        }
    }

    @Test
    fun `a locked camera names its hint, its guide and why the shutter is unavailable`() {
        val topFlat = CameraContext(CaptureShapeFamily.TOP, CaptureMode.FLAT)
        showCamera(topFlat, snapshot(topFlat))

        compose.onNodeWithTag(CaptureTestTags.SCREEN_CAMERA).assertIsDisplayed()
        compose.onNodeWithTag("cap-guide-top-flat").assertIsDisplayed()
        compose.onNodeWithTag("cap-hint-no-item").assertIsDisplayed()
        compose.onNodeWithText("Point the camera at the item").assertIsDisplayed()
        compose
            .onNodeWithTag("cap-shutter-locked")
            .assertContentDescriptionEquals("Take photo, unavailable: Point the camera at the item")
        compose.onNodeWithTag(CaptureTestTags.ANYWAY_BUTTON).assertDoesNotExist()
        compose.onNodeWithTag(CaptureTestTags.mode(CaptureMode.FLAT)).assertIsSelected()
        compose.onNodeWithTag(CaptureTestTags.mode(CaptureMode.WORN)).performClick()
        compose.onNodeWithTag(CaptureTestTags.CAMERA_SPEECH).assertContentDescriptionEquals("Spoken hints, off")

        assertEquals(listOf("mode:worn"), calls)
    }

    @Test
    fun `after the delay the anyway button shows its reason (C11)`() {
        val coatFlat = CameraContext(CaptureShapeFamily.OUTERWEAR, CaptureMode.FLAT)
        showCamera(
            coatFlat,
            snapshot(
                coatFlat,
                hint = CaptureHint.CUT_OFF_MULTIPLE,
                isAnywayVisible = true,
                anywayReason = AnywayReason.TryHangerMode,
            ),
        )

        compose.onNodeWithTag(CaptureTestTags.ANYWAY_REASON).assertIsDisplayed()
        compose.onNodeWithText("Too big to fit? Try hanger mode.").assertIsDisplayed()
        compose.onNodeWithTag(CaptureTestTags.ANYWAY_BUTTON).performClick()

        assertEquals(listOf("anyway"), calls)
    }

    @Test
    fun `an unlocked shutter shows the ring's value and takes the photo`() {
        val topFlat = CameraContext(CaptureShapeFamily.TOP, CaptureMode.FLAT)
        showCamera(topFlat, snapshot(topFlat, phase = LockPhase.UNLOCKED, hint = CaptureHint.READY, ringProgress = 0.6))

        compose.onNodeWithTag("cap-hint-ready").assertIsDisplayed()
        compose
            .onNodeWithTag(
                CaptureTestTags.RING,
            ).assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.ProgressBarRangeInfo))
        compose.onNodeWithTag("cap-shutter-unlocked").assertContentDescriptionEquals("Take photo").performClick()

        assertEquals(listOf("shutter"), calls)
    }

    @Test
    fun `the back step shows its pill and skip, shoes show only one mode`() {
        val shoesPair = CameraContext(CaptureShapeFamily.SHOES, CaptureMode.FLAT, CaptureSide.PAIR)
        showCamera(shoesPair, snapshot(shoesPair, hint = CaptureHint.GUIDE))

        compose.onNodeWithTag(CaptureTestTags.STEP_PAIR).assertIsDisplayed()
        compose.onNodeWithTag("cap-guide-shoes-flat-pair").assertIsDisplayed()
        compose.onNodeWithText("Both shoes, side by side").assertIsDisplayed()
        compose.onNodeWithTag(CaptureTestTags.mode(CaptureMode.FLAT)).assertDoesNotExist()
        compose.onNodeWithTag(CaptureTestTags.CAMERA_SKIP_BACK).performClick()

        assertEquals(listOf("skip"), calls)
    }

    @Test
    fun `batch shows the count, next item in cooldown and done (C20)`() {
        val batch = CameraContext(CaptureShapeFamily.GENERIC, CaptureMode.FLAT, kind = CaptureFlowKind.BATCH)
        showCamera(batch, snapshot(batch, phase = LockPhase.COOLDOWN, hint = CaptureHint.NEXT_ITEM), batchCount = 3)

        compose.onNodeWithText("3 items").assertIsDisplayed()
        compose.onNodeWithTag(CaptureTestTags.BATCH_COUNT).assertIsDisplayed()
        compose.onNodeWithTag(CaptureTestTags.BATCH_NEXT).performClick()
        compose.onNodeWithTag(CaptureTestTags.BATCH_DONE).performClick()

        assertEquals(listOf("next", "batch-done"), calls)
    }

    @Test
    fun `the underwear camera has the menu with the worn toggle (C19)`() {
        val bra = CameraContext(CaptureShapeFamily.TOP, CaptureMode.FLAT)
        showCamera(bra, snapshot(bra, hint = CaptureHint.GUIDE), isUnderwear = true)

        compose.onNodeWithTag(CaptureTestTags.CAMERA_MENU).performClick()
        compose.onNodeWithText("Underwear and swimwear only. Saved on this phone.").assertIsDisplayed()
        compose.onNodeWithTag(CaptureTestTags.CAMERA_UNDERWEAR_WORN_TOGGLE).performClick()

        assertEquals(listOf("worn:true"), calls)
    }

    @Test
    fun `the help sheet explains the flat-lay technique`() {
        val topFlat = CameraContext(CaptureShapeFamily.TOP, CaptureMode.FLAT)
        showCamera(topFlat, snapshot(topFlat))

        compose.onNodeWithTag(CaptureTestTags.CAMERA_HELP).performClick()

        compose.onNodeWithTag(CaptureTestTags.HELP_SHEET).assertIsDisplayed()
        compose
            .onNodeWithText(
                "Lay the item flat. Hold the phone flat on top of it, screen up. Lift it slowly and follow the spoken hints.",
            ).assertIsDisplayed()
    }

    @Test
    fun `the picker offers every family, not sure, batch and import, and the opt-in sheet`() {
        val picked = mutableListOf<String>()
        val actions =
            object : PickerActions {
                override fun onFamily(family: CaptureShapeFamily) {
                    picked += family.value
                }

                override fun onUnderwear() {
                    picked += "underwear"
                }

                override fun onNotSure() {
                    picked += "not-sure"
                }

                override fun onBatch() {
                    picked += "batch"
                }

                override fun onImport() {
                    picked += "import"
                }

                override fun onClose() {
                    picked += "close"
                }

                override fun onOptIn(allowWorn: Boolean) {
                    picked += "optin:$allowWorn"
                }

                override fun onUnderwearPick(pick: UnderwearPick) {
                    picked += pick.name
                }

                override fun onDismissSheet() {
                    picked += "dismiss"
                }
            }
        compose.setContent { AppTheme { PickerScreen(CaptureScreen.WornOptInSheet, actions) } }

        compose.onNodeWithText("What are you adding?").assertIsDisplayed()
        compose
            .onNodeWithTag(
                "cap-picker-family-top",
            ).assertContentDescriptionEquals("Top, T-shirts, shirts, knitwear, hoodies")
        compose.onNodeWithTag(CaptureTestTags.OPTIN_SHEET).assertIsDisplayed()
        compose.onNodeWithText("Photos of underwear and swimwear").assertIsDisplayed()
        compose.onNodeWithTag(CaptureTestTags.OPTIN_ALLOW_WORN).performClick()

        assertEquals(listOf("optin:true"), picked)
    }

    @Test
    fun `review asks the back question and turns Done into Take back photo`() {
        var wantsSecond = false
        val answers = mutableListOf<String>()
        compose.setContent {
            AppTheme {
                ReviewScreen(
                    review = ReviewPhotos(front = PhotoRef("synthetic"), wantsSecond = wantsSecond),
                    question = SecondPhotoQuestion.BACK,
                    loader = { null },
                    actions =
                        ReviewActions(
                            onClose = {},
                            onAnswer = { answers += "answer:$it" },
                            onTakeSecond = { answers += "take" },
                            onDone = { answers += "done" },
                            onRetake = { answers += "retake" },
                        ),
                )
            }
        }

        compose.onNodeWithText("Is the back different?").assertIsDisplayed()
        compose.onNodeWithTag(CaptureTestTags.REVIEW_BACK_DIFFERENT).performClick()
        compose.onNodeWithTag(CaptureTestTags.REVIEW_DONE).performClick()

        assertEquals(listOf("answer:true", "done"), answers)
    }

    @Test
    fun `the permission screen offers settings and import (C23)`() {
        val taps = mutableListOf<String>()
        compose.setContent {
            AppTheme {
                PermissionScreen(
                    onOpenSettings = { taps += "settings" },
                    onImport = { taps += "import" },
                    onClose = {},
                )
            }
        }

        compose.onNodeWithText("Camera access is off").assertIsDisplayed()
        compose
            .onNodeWithText(
                "The camera is needed to photograph your clothes. Photos stay on your phone until you save an item.",
            ).assertIsDisplayed()
        compose.onNodeWithTag(CaptureTestTags.PERMISSION_SETTINGS).performClick()
        compose.onNodeWithTag(CaptureTestTags.PERMISSION_IMPORT).performClick()

        assertEquals(listOf("settings", "import"), taps)
    }

    @Test
    fun `import tips list every failing check with keep anyway (C21)`() {
        compose.setContent {
            AppTheme {
                ImportTipsScreen(
                    photo = PhotoRef("synthetic"),
                    tips = listOf(CaptureHint.CUT_OFF_TOP, CaptureHint.TOO_DARK),
                    context = CameraContext(CaptureShapeFamily.GENERIC, CaptureMode.FLAT),
                    loader = { null },
                    onKeepAnyway = {},
                    onChooseAnother = {},
                    onClose = {},
                )
            }
        }

        compose.onNodeWithTag("cap-import-tip-cut-off-top").assertIsDisplayed()
        compose.onNodeWithTag("cap-import-tip-too-dark").assertIsDisplayed()
        compose.onNodeWithTag(CaptureTestTags.IMPORT_KEEP_ANYWAY).assertIsDisplayed()
        compose.onNodeWithText("This photo may be hard to use").assertIsDisplayed()
        assertEquals(CaptureLockReason.CUT_OFF, CaptureHint.CUT_OFF_TOP.lockReason)
    }
}
