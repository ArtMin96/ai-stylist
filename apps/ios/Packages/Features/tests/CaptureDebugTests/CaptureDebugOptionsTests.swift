// The harness launch arguments the Maestro flows and capture recipes pass (capture brief §11).
import CaptureDebug
import Foundation
import Testing

@Suite("Capture harness launch arguments")
struct CaptureDebugOptionsTests {
  @Test("no harness argument: nothing is on")
  func none() {
    let options = CaptureDebugOptions.parse(["/app/AIStylist", "-AppleLanguages", "(en)"])
    #expect(options == CaptureDebugOptions())
    #expect(!options.isActive)
  }

  @Test("the simctl and Maestro form: -key value pairs")
  func dashPairs() {
    let options = CaptureDebugOptions.parse([
      "/app/AIStylist", "-captureFrameSet", "top-flat-01-good", "-captureScreenReader", "1", "-captureSweep",
      "true", "-captureRecordOnly", "1", "-captureMaskCadenceMs", "250", "-captureFramesDir", "/tmp/frames",
    ])
    #expect(options.frameSetID == "top-flat-01-good")
    #expect(options.forcesScreenReader)
    #expect(options.sweep)
    #expect(options.recordsCaptures)
    #expect(options.maskCadenceMs == 250)
    #expect(options.resolvedFramesDirectory.path(percentEncoded: false) == "/tmp/frames")
  }

  @Test("the brief's form: key=value")
  func keyValue() {
    let options = CaptureDebugOptions.parse(["/app/AIStylist", "captureFrameSet=bag-flat-empty", "captureSweep=1"])
    #expect(options.frameSetID == "bag-flat-empty")
    #expect(options.sweep)
    #expect(!options.forcesScreenReader)
  }

  @Test("flags other than 1 or true stay off")
  func flagsOff() {
    let options = CaptureDebugOptions.parse(["/app/AIStylist", "-captureSweep", "0", "captureScreenReader=no"])
    #expect(!options.sweep)
    #expect(!options.forcesScreenReader)
  }

  @Test("the hold switches keep warming up and capturing on screen for the screenshot flow")
  func holds() {
    let options = CaptureDebugOptions.parse([
      "/app/AIStylist", "-captureHoldFirstFrameMs", "6000", "captureHoldCaptureMs=5000",
    ])
    #expect(options.holdFirstFrameMs == 6000)
    #expect(options.holdCaptureMs == 5000)
    let off = CaptureDebugOptions.parse(["/app/AIStylist", "-captureHoldFirstFrameMs", "0", "captureHoldCaptureMs=x"])
    #expect(off.holdFirstFrameMs == nil)
    #expect(off.holdCaptureMs == nil)
  }

  @Test("the default frames folder is the repo's artifacts/capture-camera/frames")
  func defaultFramesDirectory() {
    let path = CaptureDebugOptions.defaultFramesDirectory.path(percentEncoded: false)
    #expect(path.hasSuffix("/artifacts/capture-camera/frames/"))
    #expect(!path.contains("/apps/ios/"))
  }
}
