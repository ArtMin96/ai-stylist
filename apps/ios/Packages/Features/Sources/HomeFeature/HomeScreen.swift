// Placeholder home screen. Strings and accessibility identifiers are part of the cross-platform
// contract: the shared Maestro flow (e2e/smoke.yaml) asserts "AI Stylist" and
// "Share anonymous usage data"; `api-version` / `api-error` match the Android testTags.
public import AppServices
import HomeModel
public import SwiftUI

public struct HomeScreen: View {
  @State private var model: HomeModel

  public init(services: AppServices) {
    _model = State(initialValue: HomeModel(services: services))
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("AI Stylist")
        .font(.largeTitle.bold())
        .accessibilityAddTraits(.isHeader)
      Text("API: \(model.apiBaseURLText)")
        .font(.footnote)
        .foregroundStyle(.secondary)

      versionCard

      HStack {
        Text("Share anonymous usage data")
        Spacer()
        Toggle(
          "Share anonymous usage data",
          isOn: Binding(get: { model.hasConsent }, set: { model.setConsent($0) })
        )
        .labelsHidden()
        .accessibilityIdentifier("consent-toggle")
      }
      .frame(minHeight: 44)
      Text("Off by default. Nothing is sent until you opt in.")
        .font(.footnote)
        .foregroundStyle(.secondary)
    }
    .padding(24)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .task { await model.onAppear() }
  }

  private var versionCard: some View {
    VStack(alignment: .leading, spacing: 12) {
      switch model.versionState {
      case .loading:
        Text("Checking API version…")
      case .loaded(let text):
        Text(text)
          .accessibilityIdentifier("api-version")
      case .failed(let text):
        Text(text)
          .accessibilityIdentifier("api-error")
        Button("Retry") {
          Task { await model.retry() }
        }
        .frame(minHeight: 44)
        .accessibilityIdentifier("retry-button")
      }
    }
    .padding(16)
    .frame(maxWidth: .infinity, alignment: .leading)
    .overlay(RoundedRectangle(cornerRadius: 12).stroke(.separator))
    .accessibilityElement(children: .contain)
  }
}
