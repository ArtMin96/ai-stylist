// App entry point. Keep this target thin: build the services once, show the first screen.
// Logic belongs in Packages/Core (no UI) or Packages/Features (screens + view models).
import AppServices
import DesignSystem
import HomeFeature
import SwiftUI

@main
struct AIStylistApp: App {
  @State private var services = CompositionRoot.makeServices()

  var body: some Scene {
    WindowGroup {
      // The one place the theme is applied: fonts registered, tokens picked from the system appearance.
      HomeScreen(services: services)
        .appTheme()
    }
  }
}
