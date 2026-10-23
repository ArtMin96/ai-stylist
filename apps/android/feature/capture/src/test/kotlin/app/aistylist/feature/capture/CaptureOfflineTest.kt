package app.aistylist.feature.capture

import app.aistylist.contracts.kernel.CaptureShapeFamily
import app.aistylist.feature.capture.domain.CaptureClock
import app.aistylist.feature.capture.domain.CaptureScreen
import app.aistylist.feature.capture.domain.PhotoRef
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import java.io.IOException
import java.net.Proxy
import java.net.ProxySelector
import java.net.SocketAddress
import java.net.URI
import java.net.URL
import java.util.concurrent.CopyOnWriteArrayList

/**
 * C22 (capture brief §12): the capture code makes no network call. The whole flow runs on its ports
 * (observation source, opt-in store, clock) while the default proxy selector, which OkHttp and
 * HttpURLConnection ask before every connection, records each address and refuses it, so nothing
 * leaves the machine.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class CaptureOfflineTest {
    private val dispatcher = StandardTestDispatcher()
    private val recorder = RecordingProxySelector()
    private var previous: ProxySelector? = null

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        previous = ProxySelector.getDefault()
        ProxySelector.setDefault(recorder)
    }

    @After
    fun tearDown() {
        ProxySelector.setDefault(previous)
        Dispatchers.resetMain()
    }

    private fun TestScope.clock() = CaptureClock { testScheduler.currentTime }

    @Test
    fun `the recorder sees a connection when one is made (control)`() {
        runCatching { URL("http://capture-offline.invalid/probe").openConnection().connect() }

        assertEquals(listOf("http://capture-offline.invalid/probe"), recorder.seen.map(URI::toString))
    }

    @Test
    fun `a single capture with its back photo, a batch and an import make no connection`() =
        runTest(dispatcher) {
            val viewModel = CaptureViewModel(FakeObservationSource(clock()), FakeWornOptInStore(), clock())

            viewModel.onFamilyPicked(CaptureShapeFamily.TOP)
            advanceTimeBy(CAPTURE_MS)
            runCurrent()
            assertEquals(CaptureScreen.Review, viewModel.uiState.value.flow.screen)
            viewModel.onSecondPhotoAnswered(wantsSecond = true)
            viewModel.onTakeSecondPhoto()
            advanceTimeBy(CAPTURE_MS)
            runCurrent()

            viewModel.onBatchPicked()
            advanceTimeBy(CAPTURE_MS)
            runCurrent()
            viewModel.onBatchDone()

            viewModel.onImportRequested()
            viewModel.onImportPicked(PhotoRef("import"))
            runCurrent()
            viewModel.onClose()
            runCurrent()

            assertEquals(emptyList<URI>(), recorder.seen.toList())
        }

    private class RecordingProxySelector : ProxySelector() {
        val seen = CopyOnWriteArrayList<URI>()

        override fun select(uri: URI): List<Proxy> {
            seen += uri
            throw IOException("offline test: no network ($uri)")
        }

        override fun connectFailed(
            uri: URI?,
            sa: SocketAddress?,
            ioe: IOException?,
        ) = Unit
    }

    private companion object {
        /** Time for a steady item to unlock and auto-capture on the fake source. */
        const val CAPTURE_MS = 3_000L
    }
}
