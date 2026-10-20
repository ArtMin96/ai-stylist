// App entry point. Keep this target thin: build the services once, show the first screen.
// Logic belongs in Packages/Core (no UI) or Packages/Features (screens + view models).
import AppServices
import DesignSystem
import HomeFeature
import SwiftUI

// The dev-only catalog (AI-195): imported and used under DEBUG (the Dev configuration) only, and
// linked only by Config/Dev.xcconfig, so Preview and Prod hold no catalog code.
#if DEBUG
  import DesignSystemCatalog
#endif

@main
struct AIStylistApp: App {
  @State private var services = CompositionRoot.makeServices()
  #if DEBUG
    @State private var showsDesignSystemGallery = false
  #endif

  var body: some Scene {
    WindowGroup {
      // The one place the theme is applied: fonts registered, tokens picked from the system appearance.
      home
        .appTheme()
    }
  }

  #if DEBUG
    /// Home with the "Design system gallery" debug button, presenting the gallery full screen.
    private var home: some View {
      HomeScreen(services: services, onOpenDesignSystemGallery: { showsDesignSystemGallery = true })
        .fullScreenCover(isPresented: $showsDesignSystemGallery) {
          DesignSystemGalleryScreen(onClose: { showsDesignSystemGallery = false })
            .appTheme()
        }
    }
  #else
    private var home: some View {
      HomeScreen(services: services)
    }
  #endif
}
