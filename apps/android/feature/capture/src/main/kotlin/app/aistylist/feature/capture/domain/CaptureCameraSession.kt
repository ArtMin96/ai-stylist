package app.aistylist.feature.capture.domain

import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureLockReason
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureRules

/** Monotonic milliseconds. The observation source stamps frames with the same clock. */
fun interface CaptureClock {
    fun nowMs(): Long
}

/** The lock machine's state, flattened for the UI and the debug lock-state label. */
enum class LockPhase { IDLE, WARMING_UP, LOCKED, UNLOCKED, CAPTURING, COOLDOWN }

/** The shutter control's state; its test ID follows it (`cap-shutter-<state>`). */
enum class ShutterState { LOCKED, UNLOCKED, CAPTURING }

/** Everything the camera screen renders for one step (capture brief §4 outputs). */
data class CameraSnapshot(
    /** The step; its [CameraContext.guideTestTag] names the guide outline. */
    val context: CameraContext,
    val phase: LockPhase,
    /** 0–1; non-zero only while unlocked. */
    val ringProgress: Double,
    val hint: CaptureHint?,
    val lockReason: CaptureLockReason?,
    val isAnywayVisible: Boolean,
    /** The reason line, live from the current lock reason; null while hidden or unlocked. */
    val anywayReason: AnywayReason?,
    /**
     * The live outline of the item (64 points, normalised, clockwise), drawn over the preview while
     * the camera judges frames; null before an item is found, after it is lost, and while capturing
     * or cooling down.
     */
    val outline: LiveOutline? = null,
) {
    val shutter: ShutterState
        get() =
            when (phase) {
                LockPhase.UNLOCKED -> ShutterState.UNLOCKED
                LockPhase.CAPTURING -> ShutterState.CAPTURING
                else -> ShutterState.LOCKED
            }

    /** Volume keys act as the shutter only now; otherwise they keep their system behaviour (C26). */
    val isHardwareShutterEnabled: Boolean get() = phase == LockPhase.UNLOCKED || isAnywayVisible
}

/**
 * One camera step: the live checks, the lock machine, the anyway timer, the hint presenter and the
 * speech gate, driven by the observation source and the user, timed by the injected [clock]. Not
 * thread-safe: call it from one thread (the ViewModel's). Every input returns the one-shot effects
 * it produced.
 */
class CaptureCameraSession(
    context: CameraContext,
    private val clock: CaptureClock,
    isScreenReaderOn: Boolean = false,
    isSpeechOn: Boolean = false,
) {
    var context: CameraContext = context
        private set

    private var lock: LockState = LockState.Idle
    private var timer = AnywayTimer()
    private var hints = HintPresenter()
    private var hintBeforeCapture: CaptureHint? = null
    private var speech = SpeechGate()
    private var screenReaderOn = isScreenReaderOn
    private var speechOn = isSpeechOn
    private var latest: CaptureObservation? = null
    private var previous: CaptureObservation? = null
    private var lastReport: CheckReport? = null
    private var lastEvaluationAtMs: Long? = null
    private var outline = OutlineTracker()
    private var lastOutlineMaskMs: Long? = null

    val snapshot: CameraSnapshot
        get() =
            CameraSnapshot(
                context = context,
                phase = lock.phase,
                ringProgress = (lock as? LockState.Unlocked)?.ringProgress ?: 0.0,
                hint = hints.shown,
                lockReason = lockHint?.lockReason,
                isAnywayVisible = isAnywayVisible,
                anywayReason = if (isAnywayVisible) anywayReasonFor(lockHint, context) else null,
                outline = outline.live.takeIf { lock.showsOutline },
            )

    private val isAnywayVisible: Boolean get() = timer.isShown && lock.acceptsAnyway

    private val lockHint: CaptureHint? get() = (lock as? LockState.Locked)?.hint

    /** The camera (or test-frame source) delivers frames: warming up, guide, anyway timer from now. */
    fun cameraReady(): List<CaptureEffect> =
        step { now ->
            startCamera(now)
            emptyList()
        }

    /** A new detector result. Evaluated at most once per evaluation interval; newer results replace it. */
    fun submit(observation: CaptureObservation): List<CaptureEffect> =
        step { now ->
            latest = observation
            // While capturing or cooling down no outline shows, and none is kept for the next item.
            if (lock.showsOutline) observation.mask?.let(::trackOutline) else outline = OutlineTracker()
            evaluateIfDue(now)
        }

    /** The ViewModel's clock tick: due evaluations, the anyway delay, the guide time and waiting speech. */
    fun tick(): List<CaptureEffect> = step { now -> evaluateIfDue(now) }

    /** The on-screen shutter. */
    fun shutterTapped(): List<CaptureEffect> = shutter(CaptureTrigger.MANUAL)

    /** A volume key (only while [CameraSnapshot.isHardwareShutterEnabled]). */
    fun hardwareShutter(): List<CaptureEffect> = shutter(CaptureTrigger.HARDWARE)

    fun anywayTapped(): List<CaptureEffect> = step { applyStep(lock.onAnyway(isAnywayVisible, lastReport?.itemBox)) }

    /** The photo was saved. Single: the step ends. Batch: cooldown; anyway stays hidden until it ends. */
    fun captureFinished(): List<CaptureEffect> =
        step {
            lock = lock.onCaptureFinished(context.kind)
            timer = AnywayTimer()
            // The captured item's outline is done: the next item starts a new one.
            outline = OutlineTracker()
            emptyList()
        }

    /** The camera could not take the photo: locked again on the last hint. */
    fun captureFailed(): List<CaptureEffect> =
        step { now ->
            lock = lock.onCaptureFailed(lastReport?.blockingHint)
            hintBeforeCapture?.let { hints = hints.showNow(it, now) }
            emptyList()
        }

    /** Camera and analysis stop; nothing is kept half-way. */
    fun backgrounded() {
        lock = LockState.Idle
        timer = AnywayTimer()
        hints = HintPresenter()
        speech = speech.cleared()
        latest = null
        outline = OutlineTracker()
        lastOutlineMaskMs = null
    }

    /** Back from the background: like camera ready (warming up, guide, counters and anyway timer restart). */
    fun foregrounded(): List<CaptureEffect> =
        step { now ->
            startCamera(now)
            emptyList()
        }

    /** A screen reader shows "Take photo anyway" at once (and so makes the shutter usable) and turns speech on. */
    fun screenReaderChanged(isOn: Boolean): List<CaptureEffect> =
        step {
            screenReaderOn = isOn
            emptyList()
        }

    /** The speaker button (`cap-camera-speech`, Q-B). */
    fun speechToggled(isOn: Boolean): List<CaptureEffect> =
        step {
            speechOn = isOn
            emptyList()
        }

    /** Counters reset to locked; the anyway timer keeps running and the guide is not shown again (§4, §5). */
    fun modeChanged(mode: CaptureMode): List<CaptureEffect> =
        step {
            context = context.copy(mode = mode)
            lock = lock.onModeChanged()
            emptyList()
        }

    /** Batch "Next item". */
    fun nextItemTapped(): List<CaptureEffect> =
        step {
            lock = lock.onNextItem()
            emptyList()
        }

    private fun shutter(trigger: CaptureTrigger): List<CaptureEffect> =
        step { applyStep(lock.onShutter(trigger, isAnywayVisible, lastReport?.itemBox)) }

    /** Runs one input at the clock's time, then settles the anyway timer, the hint and speech. */
    private inline fun step(input: (Long) -> List<CaptureEffect>): List<CaptureEffect> {
        val now = clock.nowMs()
        val lockBefore = lock
        val shownBefore = hints.shown
        val effects = input(now)
        if (lockBefore is LockState.Cooldown && lock is LockState.Locked) restartAnyway(now)
        if (lock is LockState.Capturing && lockBefore !is LockState.Capturing) {
            // The input may already show "capturing" (auto-capture runs inside an evaluation).
            hintBeforeCapture = shownBefore
            hints = hints.showNow(CaptureHint.CAPTURING, now)
        }
        if (lock != LockState.Idle) hints = hints.onTick(now, hasEvaluated = lastEvaluationAtMs != null)
        timer = timer.update(now, isForced = screenReaderOn || lastReport?.isPoseFallback == true)
        return effects + speak(shownBefore, now)
    }

    /** The outline follows each new mask once; a reused mask changes nothing (brief §17 step 10). */
    private fun trackOutline(mask: MaskObservation) {
        if (mask.timestampMs == lastOutlineMaskMs) return
        lastOutlineMaskMs = mask.timestampMs
        outline = outline.update(mask.outlineCandidates)
    }

    private fun startCamera(nowMs: Long) {
        lock = LockState.WarmingUp
        restartAnyway(nowMs)
        hints = HintPresenter.start(nowMs)
        hintBeforeCapture = null
        latest = null
        previous = null
        lastReport = null
        lastEvaluationAtMs = null
        outline = OutlineTracker()
        lastOutlineMaskMs = null
    }

    private fun restartAnyway(nowMs: Long) {
        timer = timer.restart(nowMs)
    }

    private fun applyStep(step: LockStep): List<CaptureEffect> {
        lock = step.state
        return step.effects
    }

    private fun evaluateIfDue(nowMs: Long): List<CaptureEffect> {
        val observation = latest ?: return emptyList()
        if (lock == LockState.Idle || lock is LockState.Capturing) return emptyList()
        val last = lastEvaluationAtMs
        if (last != null && nowMs - last < CaptureRules.Evaluation.INTERVAL_MS) return emptyList()

        val report =
            evaluateLiveChecks(
                observation,
                previous,
                context,
                wasTiltHintOn = lastReport?.isTiltHintOn ?: false,
                previousMotion = lastReport?.maskMotion,
            )
        latest = null
        previous = observation
        lastReport = report
        lastEvaluationAtMs = nowMs
        val wasUnlocked = lock is LockState.Unlocked
        val effects = applyStep(lock.onEvaluation(report, nowMs, observation.mask?.timestampMs))
        hints =
            if (!wasUnlocked && lock is LockState.Unlocked) {
                // The unlock ends the guide at once (brief §5); an advisory tip may show while the ring
                // fills (§6), so it wins over "ready" (C13).
                hints.showNow(report.advisoryHint ?: CaptureHint.READY, nowMs)
            } else {
                hints.onEvaluation(hintCandidate(report), isUnlocked = lock is LockState.Unlocked, nowMs = nowMs)
            }
        return effects
    }

    /** The hint this state and frame propose; null keeps the shown one. Unlocked: an advisory tip before "ready". */
    private fun hintCandidate(report: CheckReport): CaptureHint? =
        when (lock) {
            LockState.Idle -> null
            LockState.WarmingUp -> CaptureHint.WARMING_UP
            is LockState.Locked -> report.blockingHint ?: report.advisoryHint
            is LockState.Unlocked -> report.blockingHint ?: report.advisoryHint ?: CaptureHint.READY
            is LockState.Capturing -> CaptureHint.CAPTURING
            is LockState.Cooldown -> CaptureHint.NEXT_ITEM
        }

    /** Speech on hint change only, with a screen reader or the speaker toggle on (Q-B). */
    private fun speak(
        shownBefore: CaptureHint?,
        nowMs: Long,
    ): List<CaptureEffect> {
        if (!screenReaderOn && !speechOn) {
            speech = speech.cleared()
            return emptyList()
        }
        val shown = hints.shown
        if (shown != null && shown != shownBefore) {
            speech = speech.onHintShown(SpeechKey(shown, guide = context.takeIf { shown == CaptureHint.GUIDE }))
        }
        val release = speech.release(nowMs)
        speech = release.gate
        return listOfNotNull(release.spoken?.let { CaptureEffect.Speak(it.hint) })
    }
}

/** The outline shows while frames are judged: not while capturing, cooling down or idle. */
private val LockState.showsOutline: Boolean
    get() = this is LockState.WarmingUp || this is LockState.Locked || this is LockState.Unlocked

private val LockState.phase: LockPhase
    get() =
        when (this) {
            LockState.Idle -> LockPhase.IDLE
            LockState.WarmingUp -> LockPhase.WARMING_UP
            is LockState.Locked -> LockPhase.LOCKED
            is LockState.Unlocked -> LockPhase.UNLOCKED
            is LockState.Capturing -> LockPhase.CAPTURING
            is LockState.Cooldown -> LockPhase.COOLDOWN
        }
