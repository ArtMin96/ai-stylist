// App entry point. Keep this target thin: build the services once, show the first screen.
// Logic belongs in Packages/Core (no UI) or Packages/Features (screens + view models).
import AppServices
import HomeFeature
import SwiftUI

@main
struct AIStylistApp: App {
  @State private var services = CompositionRoot.makeServices()

  var body: some Scene {
    WindowGroup {
      HomeScreen(services: services)
    }
  }
}
