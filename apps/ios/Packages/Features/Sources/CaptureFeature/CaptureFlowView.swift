// The guided capture flow (capture brief §2, §7; surface brief sc16): picker, underwear opt-in and
// sub-pick, camera, library import, review with the back or pair step, batch summary. It renders
// `CaptureModel.screen`; the model decides every step. The photos live in memory and are dropped when the
// flow closes.
#if os(iOS)
  public import CaptureModel
  import DesignSystem
  import PhotosUI
  public import SwiftUI
  import UIKit

  /// What the capture flow needs from the app.
  public struct CaptureFlowDependencies {
    /// Keeps the underwear opt-in answer on the device only.
    public let optInStore: any UnderwearOptInStore
    /// The Dev build's harness; nil in Preview and Prod.
    public let harness: (any CaptureHarness)?

    public init(optInStore: any UnderwearOptInStore, harness: (any CaptureHarness)? = nil) {
      self.optInStore = optInStore
      self.harness = harness
    }
  }

  /// The capture flow, shown full screen. `onClose` runs when the flow ends (close or done).
  public struct CaptureFlowView: View {
    @State private var model: CaptureModel
    @State private var controller: CaptureCameraController
    @Environment(\.appTheme) private var theme
    @Environment(\.accessibilityVoiceOverEnabled) private var isVoiceOverOn
    private let harness: (any CaptureHarness)?
    private let onClose: () -> Void

    public init(dependencies: CaptureFlowDependencies, onClose: @escaping () -> Void) {
      let harness = dependencies.harness
      let model = CaptureModel(
        clock: harness?.clock ?? ContinuousCaptureClock(),
        optInStore: dependencies.optInStore,
        screenReaderOn: UIAccessibility.isVoiceOverRunning || harness?.forcesScreenReader == true
      )
      _model = State(initialValue: model)
      _controller = State(
        initialValue: CaptureCameraController(
          model: model,
          camera: harness?.makeCamera() ?? LiveCaptureCamera(),
          photos: CapturePhotoStore(),
          harness: harness
        )
      )
      self.harness = harness
      self.onClose = onClose
    }

    public var body: some View {
      content
        .onAppear { harness?.attach(to: model) }
        .onChange(of: isVoiceOverOn) { _, isOn in
          controller.screenReaderChanged(isOn || harness?.forcesScreenReader == true)
        }
        .onChange(of: model.screen) { _, screen in
          guard screen == .closed else { return }
          controller.photos.removeAll()
          onClose()
        }
        .sheet(isPresented: optInIsPresented) {
          CaptureOptInSheet(model: model)
        }
    }

    @ViewBuilder private var content: some View {
      switch model.screen {
      case .picker, .underwearOptIn, .closed:
        CapturePickerView(model: model)
      case .underwearPicker:
        CaptureUnderwearPickerView(model: model)
      case .camera(let setup):
        CaptureCameraView(controller: controller, setup: setup)
          .id(model.cameraOpenCount)
      case .importPicker:
        CaptureImportPickerView(model: model, photos: controller.photos)
      case .importTips(let tips):
        CaptureImportTipsView(model: model, tips: tips, photos: controller.photos)
      case .review(let review):
        CaptureReviewView(model: model, review: review, photos: controller.photos)
      case .batchSummary(let photoIDs):
        CaptureBatchSummaryView(model: model, photoIDs: photoIDs, photos: controller.photos)
      }
    }

    /// The opt-in sheet shows on the picker the first time the underwear tile is tapped.
    private var optInIsPresented: Binding<Bool> {
      Binding(
        get: { model.screen == .underwearOptIn },
        set: { isPresented in
          if !isPresented, model.screen == .underwearOptIn {
            model.dismissUnderwearOptIn()
          }
        }
      )
    }
  }
#endif
