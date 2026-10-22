// C22 (capture brief §12): the capture code makes no network call. The whole flow runs on its ports
// (clock, opt-in store, observations, photo IDs) while a URL protocol records every request any
// URLSession in this process starts, and fails it locally, so nothing leaves the machine.
import AIStylistKernel
import CaptureModel
import Foundation
import Synchronization
import Testing

#if canImport(FoundationNetworking)
  import FoundationNetworking
#endif

/// Records each request and fails it at once with "not connected".
nonisolated final class RequestRecorder: URLProtocol {
  static let seen = Mutex<[String]>([])

  override class func canInit(with request: URLRequest) -> Bool {
    seen.withLock { $0.append(request.url?.absoluteString ?? "(no URL)") }
    return true
  }

  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

  override func startLoading() {
    client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
  }

  override func stopLoading() {}
}

@Suite("Capture flow: offline (C22)", .serialized)
struct CaptureOfflineTests {
  private func recording(_ body: () async throws -> Void) async rethrows -> [String] {
    URLProtocol.registerClass(RequestRecorder.self)
    defer { URLProtocol.unregisterClass(RequestRecorder.self) }
    RequestRecorder.seen.withLock { $0 = [] }
    try await body()
    return RequestRecorder.seen.withLock { $0 }
  }

  @Test("the recorder sees a request when one is made (control)")
  func recorderSeesRequests() async throws {
    let url = try #require(URL(string: "https://capture-offline.invalid/probe"))
    let seen = await recording {
      _ = try? await URLSession.shared.data(from: url)
    }
    #expect(seen == [url.absoluteString])
  }

  @Test("a single capture with its back photo, a batch and an import make no URL request")
  func wholeFlowIsOffline() async {
    let seen = await recording {
      let clock = FakeClock()
      let model = CaptureModel(clock: clock, optInStore: FakeOptInStore(nil))
      model.chooseFamily(.top)
      captureSteadily(model, clock, photo: CapturePhotoID("front"))
      model.answerSecondPhoto(wanted: true)
      model.takeSecondPhoto()
      captureSteadily(model, clock, photo: CapturePhotoID("back"))
      model.done()

      model.startBatch()
      captureSteadily(model, clock, photo: CapturePhotoID("batch-1"))
      model.batchDone()

      model.startImport()
      model.importPicked(CapturePhotoID("import"), observation: frame())
      model.done()
    }
    #expect(seen.isEmpty)
  }

  /// Camera ready, steady frames until the auto-capture, then the photo.
  private func captureSteadily(_ model: CaptureModel, _ clock: FakeClock, photo: CapturePhotoID) {
    _ = model.cameraReady()
    for _ in 0..<100 {
      let effects = model.submit(frame())
      clock.advance(byMs: stepMs)
      if effects.contains(.requestCapture(.auto)) { break }
    }
    _ = model.captureFinished(photo)
  }
}
