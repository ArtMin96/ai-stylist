// The mask cadence (capture brief §3): a new Vision mask at most every `mask.intervalMs`, and every
// `mask.hotIntervalMs` while the phone is hot, as Android's `MaskCadence` does.
import AIStylistKernel
import CaptureModel
import Testing

@Suite("Capture mask cadence")
struct CaptureMaskCadenceTests {
  @Test("the first frame always runs the mask")
  func firstFrame() {
    #expect(CaptureMaskCadence.isDue(nowMs: 0, lastMaskMs: nil, isHot: false))
    #expect(CaptureMaskCadence.isDue(nowMs: 0, lastMaskMs: nil, isHot: true))
  }

  @Test("a cool phone runs the mask every mask interval")
  func cool() {
    let interval = CaptureRules.Mask.intervalMs
    #expect(!CaptureMaskCadence.isDue(nowMs: interval - 1, lastMaskMs: 0, isHot: false))
    #expect(CaptureMaskCadence.isDue(nowMs: interval, lastMaskMs: 0, isHot: false))
  }

  @Test("a hot phone waits the hot interval")
  func hot() {
    let interval = CaptureRules.Mask.hotIntervalMs
    #expect(interval > CaptureRules.Mask.intervalMs)
    #expect(!CaptureMaskCadence.isDue(nowMs: CaptureRules.Mask.intervalMs, lastMaskMs: 0, isHot: true))
    #expect(!CaptureMaskCadence.isDue(nowMs: interval - 1, lastMaskMs: 0, isHot: true))
    #expect(CaptureMaskCadence.isDue(nowMs: interval, lastMaskMs: 0, isHot: true))
  }
}
