// The Dev build's capture harness switches (capture brief §11), read from the launch arguments. Both forms
// work: `-captureFrameSet top-flat-01-good` (what `xcrun simctl launch` and Maestro `launchApp: arguments`
// pass) and `captureFrameSet=top-flat-01-good` (the brief's spelling). Flags take `1` or `true`.
// Foundation only, so CaptureDebugTests run under `swift test` on macOS too.
public import Foundation

/// What the launch asked the harness to do.
nonisolated public struct CaptureDebugOptions: Equatable, Sendable {
  /// `captureFrameSet=<set id>`: play this frame set instead of the camera.
  public var frameSetID: String?
  /// `captureScreenReader=1`: manual shutter and "Take photo anyway" from the start; spoken hints also go
  /// to the visible debug log.
  public var forcesScreenReader: Bool
  /// `captureSweep=1`: open the camera at launch, play every frame set (or only `frameSetID`) on a virtual
  /// clock, and write `capture-results.jsonl`.
  public var sweep: Bool
  /// `captureFramesDir=<absolute path>`: the frames folder; the Simulator reads the Mac's file system.
  /// Nil uses `defaultFramesDirectory`.
  public var framesDirectory: URL?

  /// `<repo>/artifacts/capture-camera/frames` of the checkout this Dev build was compiled from (each worktree
  /// builds its own frames with `just capture-frames`). Found from this file's compile-time path,
  /// `<repo>/apps/ios/Packages/Features/Sources/CaptureDebug/<file>`.
  public static let defaultFramesDirectory: URL = {
    var repo = URL(filePath: #filePath)
    for _ in 0..<7 {
      repo.deleteLastPathComponent()
    }
    return repo.appending(path: "artifacts/capture-camera/frames", directoryHint: .isDirectory)
  }()

  /// The frames folder to read.
  public var resolvedFramesDirectory: URL { framesDirectory ?? Self.defaultFramesDirectory }

  public init(
    frameSetID: String? = nil,
    forcesScreenReader: Bool = false,
    sweep: Bool = false,
    framesDirectory: URL? = nil
  ) {
    self.frameSetID = frameSetID
    self.forcesScreenReader = forcesScreenReader
    self.sweep = sweep
    self.framesDirectory = framesDirectory
  }

  /// True when the launch asked for any harness behaviour.
  public var isActive: Bool { frameSetID != nil || forcesScreenReader || sweep }

  /// Reads the switches from `arguments` (the process's launch arguments, first one the executable).
  public static func parse(_ arguments: [String]) -> CaptureDebugOptions {
    let values = Self.values(in: arguments)
    return CaptureDebugOptions(
      frameSetID: values["captureFrameSet"].flatMap { $0.isEmpty ? nil : $0 },
      forcesScreenReader: isOn(values["captureScreenReader"]),
      sweep: isOn(values["captureSweep"]),
      framesDirectory: values["captureFramesDir"].flatMap { $0.isEmpty ? nil : URL(filePath: $0) }
    )
  }

  private static func isOn(_ value: String?) -> Bool {
    value == "1" || value?.lowercased() == "true"
  }

  /// `key=value` arguments, and `-key value` pairs.
  private static func values(in arguments: [String]) -> [String: String] {
    var values: [String: String] = [:]
    var index = arguments.startIndex
    while index < arguments.endIndex {
      let argument = arguments[index]
      if argument.hasPrefix("-"), index + 1 < arguments.endIndex {
        values[String(argument.dropFirst())] = arguments[index + 1]
        index += 2
        continue
      }
      if let separator = argument.firstIndex(of: "=") {
        values[String(argument[..<separator])] = String(argument[argument.index(after: separator)...])
      }
      index += 1
    }
    return values
  }
}
