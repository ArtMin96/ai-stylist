// The harness results log (capture brief §11 "Results log"): one JSON line per played segment in
// `Documents/capture-results.jsonl` of the app's data container. The recipes pull it with
// `xcrun simctl get_app_container booted app.aistylist.mobile.dev data` and compare it with each
// segment's expected-result file. A sweep also writes `Documents/capture-results.done` when it ends.
// Only rule outcomes and live-outline scores are logged: no pixel, mask, box, outline point or photo data.
#if os(iOS)
  import Foundation

  /// One segment's outcome. Times are milliseconds from the segment's first frame.
  nonisolated public struct CaptureSegmentResult: Encodable, Sendable {
    public struct Event: Encodable, Equatable, Sendable {
      public let tMs: Int
      /// `idle`, `warming-up`, `locked:<reason>`, `unlocked`, `capturing` or `cooldown`.
      public let shutter: String
      /// The hint label's test ID, or nil before the camera is ready.
      public let hint: String?
      public let anyway: Bool
    }

    public struct Capture: Encodable, Sendable {
      public let tMs: Int
      /// `auto`, `manual`, `anyway` or `hardware`.
      public let trigger: String
    }

    public let setId: String
    public let segment: Int
    public let family: String
    public let mode: String
    public let kind: String
    public let variant: String?
    /// The segment's expected-result file, relative to the frames folder.
    public let expected: String?
    public let sweep: Bool
    public var events: [Event] = []
    public var firstUnlockMs: Int?
    public var anywayMs: Int?
    /// The "Take photo anyway" reason line while the button showed, last one seen: `surface-tip`,
    /// `try-hanger-mode`, or the blocking hint's test ID.
    public var anywayReason: String?
    public var finalHint: String?
    public var captures: [Capture] = []
    public var durationMs = 0
    // Live outline (capture brief "Live outline"); each drawn outline counts once per mask update.
    /// When the live outline first showed in the segment; nil when it never did.
    public var outlineFirstMs: Int?
    /// The live outline showed when the segment ended.
    public var outlinePresentAtEnd = false
    /// Drawn outlines seen (one per mask update while an item is outlined).
    public var outlineUpdates = 0
    /// Of those, the ones that replaced the drawn outline at once (new item or a large change).
    public var outlineSnaps = 0
    /// IoU of each drawn outline with the stored item mask it was traced from (the best-matching
    /// instance), median and minimum; the drawn outline is smoothed, so it lags a moving item.
    public var outlineIouMedian: Double?
    public var outlineIouMin: Double?
    /// Centroid-aligned IoU of each drawn outline with the one before it, rasterised at the frame's
    /// pixels as the stored-frame test measures it (shape stability), median and minimum.
    public var outlineStabilityMedian: Double?
    public var outlineStabilityMin: Double?
  }

  /// Appends results to the log file.
  final class CaptureResultsLog {
    let url: URL
    let doneURL: URL
    private let encoder: JSONEncoder = {
      let encoder = JSONEncoder()
      encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
      return encoder
    }()

    /// - Parameter startsFresh: the launch asked for a harness run, so earlier results are removed.
    init(startsFresh: Bool) throws {
      let documents = try FileManager.default.url(
        for: .documentDirectory,
        in: .userDomainMask,
        appropriateFor: nil,
        create: true
      )
      url = documents.appending(path: "capture-results.jsonl")
      doneURL = documents.appending(path: "capture-results.done")
      guard startsFresh else { return }
      for file in [url, doneURL] where FileManager.default.fileExists(atPath: file.path(percentEncoded: false)) {
        try FileManager.default.removeItem(at: file)
      }
    }

    func append(_ result: CaptureSegmentResult) throws {
      var line = try encoder.encode(result)
      line.append(0x0A)
      guard FileManager.default.fileExists(atPath: url.path(percentEncoded: false)) else {
        try line.write(to: url)
        return
      }
      let handle = try FileHandle(forWritingTo: url)
      defer { try? handle.close() }  // Closing after a finished write; nothing to recover from.
      try handle.seekToEnd()
      try handle.write(contentsOf: line)
    }

    /// Marks a finished sweep, so a recipe knows the log is complete.
    func markSweepFinished(cases: Int) throws {
      try encoder.encode(["cases": cases]).write(to: doneURL)
    }
  }
#endif
