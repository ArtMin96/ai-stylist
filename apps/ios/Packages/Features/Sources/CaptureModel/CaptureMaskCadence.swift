// When the live camera runs the Vision foreground mask (capture brief §3): newest frame only, at most every
// `CaptureRules.Mask.intervalMs`, and every `CaptureRules.Mask.hotIntervalMs` while the phone is hot, so a
// hot phone does less work per second (Android: `MaskCadence`, thermal status moderate or worse; iOS:
// `ProcessInfo.ThermalState.serious` or worse). The analysis queue runs one request at a time, so "one in
// flight" holds without a flag here. Pure, so it is tested on Linux.
import AIStylistKernel

/// The mask cadence rule.
nonisolated public enum CaptureMaskCadence {
  /// The interval between two masks.
  public static func intervalMs(isHot: Bool) -> Int {
    isHot ? CaptureRules.Mask.hotIntervalMs : CaptureRules.Mask.intervalMs
  }

  /// True when a frame at `nowMs` should run the mask: the first frame, or the interval has passed since
  /// the last mask at `lastMaskMs`.
  public static func isDue(nowMs: Int, lastMaskMs: Int?, isHot: Bool) -> Bool {
    guard let lastMaskMs else { return true }
    return nowMs - lastMaskMs >= intervalMs(isHot: isHot)
  }
}
