package app.aistylist.feature.capture

import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureShapeFamily
import app.aistylist.feature.capture.domain.CameraFeedEvent
import app.aistylist.feature.capture.domain.CameraSnapshot
import app.aistylist.feature.capture.domain.CameraUnavailableReason
import app.aistylist.feature.capture.domain.CaptureClock
import app.aistylist.feature.capture.domain.CaptureEffect
import app.aistylist.feature.capture.domain.CaptureFlowState
import app.aistylist.feature.capture.domain.CaptureScreen
import app.aistylist.feature.capture.domain.HapticKind
import app.aistylist.feature.capture.domain.LockPhase
import app.aistylist.feature.capture.domain.PhotoRef
import app.aistylist.feature.capture.domain.PhotoResult
import app.aistylist.feature.capture.domain.UnderwearPick
import app.aistylist.feature.capture.domain.WornOptIn
import app.cash.turbine.test
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CaptureViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setMainDispatcher() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun resetMainDispatcher() {
        Dispatchers.resetMain()
    }

    private fun TestScope.clock() = CaptureClock { testScheduler.currentTime }

    private val CaptureViewModel.flow: CaptureFlowState get() = uiState.value.flow
    private val CaptureViewModel.screen: CaptureScreen get() = flow.screen
    private val CaptureViewModel.camera: CameraSnapshot? get() = uiState.value.camera
    private val CaptureViewModel.phase: LockPhase? get() = camera?.phase

    /** Closes the flow so the camera ticker stops before the test ends. */
    private fun TestScope.close(viewModel: CaptureViewModel) {
        viewModel.onClose()
        runCurrent()
    }

    @Test
    fun `a picked family opens the camera, auto-captures a steady item and shows it on review (C1)`() =
        runTest(dispatcher) {
            val source = FakeObservationSource(clock())
            val viewModel = CaptureViewModel(source, FakeWornOptInStore(), clock())

            viewModel.onFamilyPicked(CaptureShapeFamily.TOP)
            runCurrent()
            assertEquals(LockPhase.WARMING_UP, viewModel.phase)
            assertEquals(1, source.openFeeds)

            advanceTimeBy(3_000)
            runCurrent()

            val state = viewModel.uiState.value
            assertEquals(CaptureScreen.Review, state.flow.screen)
            assertEquals(PhotoRef("synthetic-photo"), state.flow.review.front)
            assertNull(state.camera)
            assertEquals(0, source.openFeeds)
            assertEquals(1, source.photosTaken)
        }

    @Test
    fun `haptics leave through effects, capture requests do not`() =
        runTest(dispatcher) {
            val viewModel = CaptureViewModel(FakeObservationSource(clock()), FakeWornOptInStore(), clock())

            viewModel.effects.test {
                viewModel.onFamilyPicked(CaptureShapeFamily.TOP)

                assertEquals(CaptureEffect.Haptic(HapticKind.UNLOCK), awaitItem())
                assertEquals(CaptureEffect.Haptic(HapticKind.CAPTURE), awaitItem())
                cancelAndIgnoreRemainingEvents()
            }
        }

    @Test
    fun `with a screen reader the guide is spoken at camera ready (C25)`() =
        runTest(dispatcher) {
            val viewModel = CaptureViewModel(FakeObservationSource(clock()), FakeWornOptInStore(), clock())
            viewModel.onScreenReaderChanged(isOn = true)

            viewModel.effects.test {
                viewModel.onFamilyPicked(CaptureShapeFamily.TOP)

                assertEquals(CaptureEffect.Speak(CaptureHint.GUIDE), awaitItem())
                cancelAndIgnoreRemainingEvents()
            }
            assertTrue(viewModel.camera?.isAnywayVisible == true)
            close(viewModel)
        }

    @Test
    fun `a failed photo locks again and stays on the camera`() =
        runTest(dispatcher) {
            val source = FakeObservationSource(clock()).apply { photo = PhotoResult.Failed }
            val viewModel = CaptureViewModel(source, FakeWornOptInStore(), clock())

            viewModel.onFamilyPicked(CaptureShapeFamily.TOP)
            advanceTimeBy(1_450)
            runCurrent()

            assertEquals(1, source.photosTaken)
            assertTrue(viewModel.screen is CaptureScreen.Camera)
            assertEquals(LockPhase.LOCKED, viewModel.phase)
            close(viewModel)
        }

    @Test
    fun `C19 the underwear tile asks once, stores the answer on the device, then offers worn`() =
        runTest(dispatcher) {
            val store = FakeWornOptInStore()
            val viewModel = CaptureViewModel(FakeObservationSource(clock()), store, clock())

            viewModel.onUnderwearPicked()
            runCurrent()
            assertEquals(CaptureScreen.WornOptInSheet, viewModel.screen)

            viewModel.onWornOptInAnswered(allowWorn = true)
            runCurrent()
            assertEquals(WornOptIn.WORN_ALLOWED, store.stored)
            assertEquals(CaptureScreen.UnderwearPicker, viewModel.screen)

            viewModel.onUnderwearItemPicked(UnderwearPick.BRA_OR_TOP)
            assertTrue(CaptureMode.WORN in viewModel.flow.offeredModes)
            close(viewModel)
        }

    @Test
    fun `C19 a stored answer skips the sheet, and the toggle saves the change`() =
        runTest(dispatcher) {
            val store = FakeWornOptInStore(WornOptIn.FLAT_ONLY)
            val viewModel = CaptureViewModel(FakeObservationSource(clock()), store, clock())

            viewModel.onUnderwearPicked()
            runCurrent()
            assertEquals(CaptureScreen.UnderwearPicker, viewModel.screen)
            viewModel.onUnderwearItemPicked(UnderwearPick.TIGHTS)
            assertFalse(CaptureMode.WORN in viewModel.flow.offeredModes)

            viewModel.onUnderwearWornToggled(allowed = true)
            runCurrent()

            assertEquals(WornOptIn.WORN_ALLOWED, store.stored)
            assertTrue(CaptureMode.WORN in viewModel.flow.offeredModes)
            close(viewModel)
        }

    @Test
    fun `worn mode turns pose detection on without restarting the camera`() =
        runTest(dispatcher) {
            val source = FakeObservationSource(clock())
            val viewModel = CaptureViewModel(source, FakeWornOptInStore(), clock())
            viewModel.onFamilyPicked(CaptureShapeFamily.TOP)
            runCurrent()
            assertEquals(false, source.poseDetection?.value)

            viewModel.onModeSelected(CaptureMode.WORN)
            runCurrent()

            assertEquals(true, source.poseDetection?.value)
            assertEquals(1, source.feedsStarted)
            assertEquals(CaptureMode.WORN, viewModel.camera?.context?.mode)
            close(viewModel)
        }

    @Test
    fun `C24 background stops the camera and foreground restarts it warming up`() =
        runTest(dispatcher) {
            val source = FakeObservationSource(clock())
            val viewModel = CaptureViewModel(source, FakeWornOptInStore(), clock())
            viewModel.onFamilyPicked(CaptureShapeFamily.TOP)
            advanceTimeBy(250)
            runCurrent()

            viewModel.onBackgrounded()
            runCurrent()
            assertEquals(LockPhase.IDLE, viewModel.phase)
            assertEquals(0, source.openFeeds)
            advanceTimeBy(5_000)
            runCurrent()
            assertEquals(0, source.photosTaken)

            viewModel.onForegrounded()
            runCurrent()

            assertEquals(LockPhase.WARMING_UP, viewModel.phase)
            assertEquals(1, source.openFeeds)
            assertEquals(2, source.feedsStarted)
            close(viewModel)
        }

    @Test
    fun `C23 a denied camera permission shows the permission screen`() =
        runTest(dispatcher) {
            val source =
                FakeObservationSource(clock()).apply {
                    script = { emit(CameraFeedEvent.Unavailable(CameraUnavailableReason.PERMISSION_DENIED)) }
                }
            val viewModel = CaptureViewModel(source, FakeWornOptInStore(), clock())

            viewModel.onFamilyPicked(CaptureShapeFamily.TOP)
            runCurrent()

            assertEquals(CaptureScreen.PermissionDenied, viewModel.screen)
            assertNull(viewModel.camera)
            assertEquals(0, source.openFeeds)
        }

    @Test
    fun `C26 volume keys stay with the system while locked and act as the shutter when anyway shows`() =
        runTest(dispatcher) {
            val source =
                FakeObservationSource(clock()).apply {
                    script = {
                        emit(CameraFeedEvent.Ready)
                        while (true) {
                            delay(100)
                            emit(CameraFeedEvent.Frame(syntheticFrame(testScheduler.currentTime, box = null)))
                        }
                    }
                }
            val viewModel = CaptureViewModel(source, FakeWornOptInStore(), clock())
            viewModel.onFamilyPicked(CaptureShapeFamily.TOP)
            advanceTimeBy(500)
            runCurrent()

            assertFalse(viewModel.onHardwareShutter())
            viewModel.onScreenReaderChanged(isOn = true)
            assertTrue(viewModel.onHardwareShutter())
            runCurrent()

            assertEquals(1, source.photosTaken)
            assertEquals(CaptureScreen.Review, viewModel.screen)
        }

    @Test
    fun `C21 an import with failing checks shows tips, keep anyway goes to review`() =
        runTest(dispatcher) {
            val source =
                FakeObservationSource(clock()).apply {
                    still =
                        syntheticFrame(timestampMs = 0, box = null, meanLuma = 10.0)
                }
            val viewModel = CaptureViewModel(source, FakeWornOptInStore(), clock())
            val photo = PhotoRef("synthetic-import")

            viewModel.onImportRequested()
            viewModel.onImportPicked(photo)
            runCurrent()

            assertEquals(
                CaptureScreen.ImportTips(
                    photo,
                    listOf(CaptureHint.NO_ITEM, CaptureHint.TOO_DARK),
                    CaptureScreen.Picker,
                ),
                viewModel.screen,
            )
            viewModel.onKeepImportAnyway()
            assertEquals(CaptureScreen.Review, viewModel.screen)
        }

    @Test
    fun `an unreadable import is never refused`() =
        runTest(dispatcher) {
            val viewModel = CaptureViewModel(FakeObservationSource(clock()), FakeWornOptInStore(), clock())
            val photo = PhotoRef("synthetic-import")

            viewModel.onImportRequested()
            viewModel.onImportPicked(photo)
            runCurrent()

            assertEquals(CaptureScreen.Review, viewModel.screen)
            assertEquals(photo, viewModel.flow.review.front)
        }

    @Test
    fun `C20 batch counts each capture and stays on the camera`() =
        runTest(dispatcher) {
            val source = FakeObservationSource(clock())
            val viewModel = CaptureViewModel(source, FakeWornOptInStore(), clock())

            viewModel.onBatchPicked()
            advanceTimeBy(1_500)
            runCurrent()

            assertEquals(1, viewModel.flow.batchPhotos.size)
            assertEquals(LockPhase.COOLDOWN, viewModel.phase)
            viewModel.onBatchDone()
            runCurrent()
            assertEquals(CaptureScreen.BatchSummary, viewModel.screen)
            assertEquals(0, source.openFeeds)
        }

    @Test
    fun `opening the flow again starts fresh at the picker after it closed`() =
        runTest(dispatcher) {
            val viewModel = CaptureViewModel(FakeObservationSource(clock()), FakeWornOptInStore(), clock())
            viewModel.onFamilyPicked(CaptureShapeFamily.TOP)
            runCurrent()
            close(viewModel)
            assertEquals(CaptureScreen.Closed, viewModel.screen)

            viewModel.onOpened()

            assertEquals(CaptureScreen.Picker, viewModel.screen)
            assertNull(viewModel.camera)
        }
}
