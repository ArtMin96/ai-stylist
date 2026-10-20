// AppButton behaviour without rendering: allowed pairs, state precedence, the activation gate and
// the gallery test IDs (contract .impeccable/components/button.yaml).
import DesignSystem
import DesignTokens
import Testing

private let specs: [ButtonSpec] = [.light, .dark, .hcLight, .hcDark]

private let flags = [false, true]

/// Every (loading, enabled, pressed, focused) input.
private let interactions: [(loading: Bool, enabled: Bool, pressed: Bool, focused: Bool)] = flags.flatMap { loading in
  flags.flatMap { enabled in flags.flatMap { pressed in flags.map { (loading, enabled, pressed, $0) } } }
}

@Test("a variant and size pair resolves a look exactly when the gallery lists it, in every context")
func allowedPairsMatchTheGallery() {
  for spec in specs {
    for variant in ButtonVariant.allCases {
      for size in ButtonSize.allCases {
        let listed = ComponentGallery.button.contains { $0.variant == variant && $0.size == size }
        #expect(AppButtonRules.isAllowed(variant, size, in: spec) == listed, "\(variant) \(size)")
        for input in interactions {
          let look = AppButtonRules.appearance(
            in: spec,
            variant: variant,
            size: size,
            loading: input.loading,
            enabled: input.enabled,
            pressed: input.pressed,
            focused: input.focused
          )
          #expect((look != nil) == listed, "\(variant) \(size) \(input)")
        }
      }
    }
  }
}

@Test("the displayed state follows the contract order: loading, disabled, pressed, focused, enabled")
func statePrecedence() {
  #expect(AppButtonRules.displayedState(loading: true, enabled: false, pressed: true, focused: true) == .loading)
  #expect(AppButtonRules.displayedState(loading: false, enabled: false, pressed: true, focused: true) == .disabled)
  #expect(AppButtonRules.displayedState(loading: false, enabled: true, pressed: true, focused: true) == .pressed)
  #expect(AppButtonRules.displayedState(loading: false, enabled: true, pressed: false, focused: true) == .focused)
  #expect(AppButtonRules.displayedState(loading: false, enabled: true, pressed: false, focused: false) == .enabled)
}

@Test("only the focused look carries a focus ring, and loading keeps the enabled colours")
func focusRingAndLoadingLook() throws {
  for entry in ComponentGallery.button {
    let look = try #require(ButtonSpec.light.appearance(variant: entry.variant, size: entry.size, state: entry.state))
    #expect((look.focusRing != nil) == (entry.state == .focused), "\(entry.testId)")
    if entry.state == .loading {
      let enabled = try #require(ButtonSpec.light.appearance(variant: entry.variant, size: entry.size, state: .enabled))
      #expect(look.backgroundColor == enabled.backgroundColor, "\(entry.testId)")
      #expect(look.textColor == enabled.textColor, "\(entry.testId)")
    }
  }
}

@Test(
  "an activation runs the action only when enabled and not loading",
  arguments: [(true, false, 1), (false, false, 0), (true, true, 0), (false, true, 0)]
)
func activationGate(enabled: Bool, loading: Bool, expectedCalls: Int) {
  var calls = 0
  AppButtonRules.activate(loading: loading, enabled: enabled) { calls += 1 }
  #expect(calls == expectedCalls)
}

@Test("the state text announced while loading is Loading, byte for byte as on Android")
func loadingStateText() {
  #expect(AppButtonRules.loadingStateText == "Loading")
}

@Test("the gallery lists 100 cells with unique ids of the form ds-button-<variant>-<size>-<state>")
func galleryTestIds() {
  #expect(ComponentGallery.button.count == 100)
  #expect(Set(ComponentGallery.button.map(\.testId)).count == ComponentGallery.button.count)
  for entry in ComponentGallery.button {
    #expect(entry.testId == "ds-button-\(entry.variant.rawValue)-\(entry.size.rawValue)-\(entry.state.rawValue)")
  }
}
