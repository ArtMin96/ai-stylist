// Placeholder home screen. Strings and accessibility identifiers are part of the cross-platform
// contract: the shared Maestro flow (e2e/smoke.yaml) asserts "AI Stylist" and
// "Share anonymous usage data"; `api-version` / `api-error` match the Android testTags, and so do the
// debug-only `debug_consent_toggle` / `debug_force_crash` (P02-T09).
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

      if model.showsDebugTools {
        debugTools
      }
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

  /// Debug builds only (`model.showsDebugTools`): the analytics consent switch and the forced crash
  /// that proves crash capture + symbolication. Strings and ids match Android.
  private var debugTools: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Text("Analytics consent (debug)")
        Spacer()
        Toggle(
          "Analytics consent (debug)",
          isOn: Binding(get: { model.hasConsent }, set: { model.setConsent($0) })
        )
        .labelsHidden()
        .accessibilityIdentifier("debug_consent_toggle")
      }
      .frame(minHeight: 44)
      Button("Force test crash", role: .destructive) {
        model.forceTestCrash()
      }
      .frame(minHeight: 44)
      .accessibilityIdentifier("debug_force_crash")
    }
  }
}
