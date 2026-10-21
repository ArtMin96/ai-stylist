// Runs one camera screen against the model (capture brief §4, §5): starts the camera, feeds each
// observation and a clock tick to `CaptureModel`, and performs the effects it returns (photo request,
// speech or announcement, haptic). Plumbing only: every decision is the model's. Everything runs inside the
// camera view's `.task`, so leaving the screen or going to the background cancels it and stops the camera.
#if os(iOS)
  import AIStylistKernel
  import AVFoundation
  import CaptureModel
  import Observation
  import SwiftUI
  import UIKit

  /// The photos of the open flow, in memory only; dropped when the flow closes (v1 saves nothing).
  @Observable
  final class CapturePhotoStore {
    private(set) var images: [CapturePhotoID: UIImage] = [:]
    @ObservationIgnored private var nextNumber = 0

    func add(_ image: UIImage) -> CapturePhotoID {
      nextNumber += 1
      let id = CapturePhotoID("photo-\(nextNumber)")
      images[id] = image
      return id
    }

    func removeAll() {
      images = [:]
    }
  }

  /// Speech, announcements and haptics (capture brief §6, §8, Q-B).
  final class CaptureEffectPerformer {
    private let synthesizer = AVSpeechSynthesizer()

    /// With a screen reader on, the line is a VoiceOver announcement; otherwise (the speaker button) the
    /// synthesizer reads it.
    func speak(_ text: String, screenReaderOn: Bool) {
      if screenReaderOn {
        AccessibilityNotification.Announcement(text).post()
      } else {
        synthesizer.speak(AVSpeechUtterance(string: text))
      }
    }

    func haptic(_ kind: CaptureHaptic) {
      switch kind {
      case .unlock: UINotificationFeedbackGenerator().notificationOccurred(.success)
      case .capture: UIImpactFeedbackGenerator(style: .medium).impactOccurred()
      }
    }

    func stopSpeaking() {
      synthesizer.stopSpeaking(at: .immediate)
    }
  }

  /// The camera screen's runner.
  final class CaptureCameraController {
    let model: CaptureModel
    let camera: any CaptureCamera
    let photos: CapturePhotoStore
    private let harness: (any CaptureHarness)?
    private let performer = CaptureEffectPerformer()
    private var requestSink: AsyncStream<CaptureTrigger>.Continuation?
    /// Numbers each run. A camera screen replaced by another (a new camera opening) is cancelled while the
    /// new one starts; only the latest run may stop the shared camera.
    private var runNumber = 0

    init(model: CaptureModel, camera: any CaptureCamera, photos: CapturePhotoStore, harness: (any CaptureHarness)?) {
      self.model = model
      self.camera = camera
      self.photos = photos
      self.harness = harness
    }

    /// One camera run, until the calling task is cancelled. `onStart` gets the camera's availability as soon
    /// as it is known (the permission and no-camera screens).
    func run(setup: CaptureCameraSetup, isFirstRun: Bool, onStart: (CaptureCameraAvailability) -> Void) async {
      runNumber += 1
      let run = runNumber
      let availability = await camera.start(for: setup)
      guard !Task.isCancelled else {
        stopCamera(ifLatest: run)
        return
      }
      onStart(availability)
      guard availability == .ready else {
        stopCamera(ifLatest: run)
        return
      }
      // A camera screen's first run is camera-ready; later runs return from the background.
      perform(isFirstRun ? model.cameraReady() : model.foregrounded())
      let (requests, sink) = AsyncStream.makeStream(of: CaptureTrigger.self)
      requestSink = sink
      await withDiscardingTaskGroup { group in
        group.addTask { await self.feedObservations() }
        group.addTask { await self.tickUntilCancelled() }
        group.addTask { await self.takePhotos(requests) }
      }
      if run == runNumber {
        requestSink = nil
      }
      stopCamera(ifLatest: run)
      performer.stopSpeaking()
    }

    private func stopCamera(ifLatest run: Int) {
      guard run == runNumber else { return }
      camera.stop()
    }

    /// The app went to the background: the camera stops (the run's task is cancelled by the view).
    func backgrounded() {
      model.backgrounded()
      harness?.cameraChanged(model.camera)
    }

    // MARK: - User inputs

    func shutterTapped() { perform(model.shutterTapped()) }
    func hardwareShutter() { perform(model.hardwareShutter()) }
    func anywayTapped() { perform(model.anywayTapped()) }
    func nextItemTapped() { perform(model.nextItemTapped()) }

    /// The mode switch; the camera view passes the new mode on to the camera.
    func selectMode(_ mode: CaptureMode) {
      model.selectMode(mode)
      harness?.cameraChanged(model.camera)
    }

    func screenReaderChanged(_ isOn: Bool) {
      perform(model.screenReaderChanged(isOn))
    }

    // MARK: - Loops

    private func feedObservations() async {
      for await observation in camera.observations() {
        perform(model.submit(observation))
      }
    }

    private func tickUntilCancelled() async {
      while !Task.isCancelled {
        do {
          try await Task.sleep(for: .milliseconds(CaptureRules.Evaluation.intervalMs))
        } catch {
          return  // Cancelled: the screen closed or went to the background.
        }
        perform(model.tick())
      }
    }

    private func takePhotos(_ requests: AsyncStream<CaptureTrigger>) async {
      for await trigger in requests {
        await capture(trigger)
      }
    }

    /// Takes the requested photo. A sweep records it and the camera carries on (brief §11). A failed
    /// photo maps to `captureFailed` (locked again); cancellation is not a failure the user sees.
    private func capture(_ trigger: CaptureTrigger) async {
      if harness?.recordsCapture(trigger) == true {
        perform(model.captureFailed())
        return
      }
      do {
        let image = try await camera.takePhoto()
        perform(model.captureFinished(photos.add(image)))
      } catch {
        guard !Task.isCancelled else { return }
        perform(model.captureFailed())
      }
    }

    // MARK: - Effects

    private func perform(_ effects: [CaptureEffect]) {
      for effect in effects {
        switch effect {
        case .requestCapture(let trigger):
          if let requestSink {
            requestSink.yield(trigger)
          } else {
            perform(model.captureFailed())
          }
        case .speak(let utterance):
          let text = CaptureText.spoken(utterance)
          performer.speak(text, screenReaderOn: model.isScreenReaderOn)
          harness?.spoke(text)
        case .haptic(let kind):
          performer.haptic(kind)
        }
      }
      harness?.cameraChanged(model.camera)
    }
  }
#endif
