// App entry point. Keep this target thin: build the services once, show the first screen.
// Logic belongs in Packages/Core (no UI) or Packages/Features (screens + view models).
import AppServices
import DesignSystem
import HomeFeature
import SwiftUI

// Dev-only code (AI-195; capture brief §11, Q-F): imported and used under DEBUG (the Dev configuration)
// only. The design-system catalog and the capture harness are linked only by Config/Dev.xcconfig, so
// Preview and Prod hold neither. The capture camera itself opens only from the Dev build's "Add item".
#if DEBUG
  import CaptureDebug
  import CaptureFeature
  import DesignSystemCatalog
#endif

@main
struct AIStylistApp: App {
  @State private var services = CompositionRoot.makeServices()
  #if DEBUG
    @State private var showsDesignSystemGallery = false
    @State private var captureHarness: CaptureDebugHarness
    @State private var showsCapture: Bool

    init() {
      // Launch arguments: captureFrameSet=<set id>, captureScreenReader=1, captureSweep=1,
      // captureFramesDir=<path> (apps/ios/README.md "Capture test harness").
      let harness = CaptureDebugHarness(options: CaptureDebugOptions.parse(ProcessInfo.processInfo.arguments))
      _captureHarness = State(initialValue: harness)
      _showsCapture = State(initialValue: harness.opensCaptureAtLaunch)
    }
  #endif

  var body: some Scene {
    WindowGroup {
      // The one place the theme is applied: fonts registered, tokens picked from the system appearance.
      home
        .appTheme()
    }
  }

  #if DEBUG
    /// Home with the Dev build's "Design system gallery" and "Add item" buttons, each presenting full
    /// screen.
    private var home: some View {
      HomeScreen(
        services: services,
        onOpenDesignSystemGallery: { showsDesignSystemGallery = true },
        onOpenCapture: { showsCapture = true }
      )
      .fullScreenCover(isPresented: $showsDesignSystemGallery) {
        DesignSystemGalleryScreen(onClose: { showsDesignSystemGallery = false })
          .appTheme()
      }
      .fullScreenCover(isPresented: $showsCapture) {
        CaptureFlowView(
          dependencies: CompositionRoot.makeCaptureDependencies(harness: captureHarness),
          onClose: { showsCapture = false }
        )
        .overlay(alignment: .topLeading) {
          CaptureDebugPanel(harness: captureHarness)
        }
        .appTheme()
      }
    }
  #else
    private var home: some View {
      HomeScreen(services: services)
    }
  #endif
}
