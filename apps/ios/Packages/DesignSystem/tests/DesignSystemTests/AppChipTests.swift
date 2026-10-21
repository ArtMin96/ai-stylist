// AppChip behaviour without rendering (contract .impeccable/components/chip.yaml): the G2 state rule, the
// "not allowed → nothing" rule, the activation gate, the copy from the String Catalog and the swatch edge
// contrast rule.
import DesignSystem
import DesignTokens
import SwiftUI
import Testing

private let specs: [ChipSpec] = [.light, .dark, .brand, .hcLight, .hcDark]

private let flags = [false, true]

/// Every (selected, expanded, enabled) toggle input.
private let toggles: [(selected: Bool, expanded: Bool, enabled: Bool)] = flags.flatMap { selected in
  flags.flatMap { expanded in flags.map { (selected, expanded, $0) } }
}

/// Every (pressed, focused) interaction the platform reports.
private let interactions: [(pressed: Bool, focused: Bool)] = flags.flatMap { pressed in flags.map { (pressed, $0) } }

/// Whether the contract allows `state` at `variant` × `size`: the gallery includes every allowed combination.
private func listed(_ variant: ChipVariant, _ size: ChipSize, _ state: ChipState?) -> Bool {
  guard let state else {
    return false
  }
  return ComponentGallery.chip.contains { $0.variant == variant && $0.size == size && $0.state == state }
}

@Test("the displayed state follows G2: disabled, pressed, focused, none, prefixed with the toggle that is on")
func chipStatePrecedence() {
  func state(_ selected: Bool, _ expanded: Bool, _ enabled: Bool, _ pressed: Bool, _ focused: Bool) -> ChipState? {
    AppChipRules.displayedState(
      selected: selected,
      expanded: expanded,
      enabled: enabled,
      pressed: pressed,
      focused: focused
    )
  }
  #expect(state(false, false, true, false, false) == .enabled)
  #expect(state(false, false, true, true, true) == .pressed)
  #expect(state(false, false, true, false, true) == .focused)
  #expect(state(false, false, false, true, true) == .disabled)
  #expect(state(true, false, true, false, false) == .selected)
  #expect(state(true, false, true, true, false) == .selectedPressed)
  #expect(state(true, false, true, false, true) == .selectedFocused)
  #expect(state(true, false, false, true, true) == .selectedDisabled)
  #expect(state(false, true, true, false, false) == .expanded)
  #expect(state(false, true, true, true, true) == .expandedPressed)
  #expect(state(false, true, true, false, true) == .expandedFocused)
  // No such state in the contract: the chip renders nothing.
  #expect(state(false, true, false, false, false) == nil)
  #expect(state(true, true, true, false, false) == nil)
}

@Test("a chip renders exactly when its resting state is allowed, over every variant, size and toggle, in every context")
func restingStateDecidesRendering() {
  for spec in specs {
    for variant in ChipVariant.allCases {
      for size in ChipSize.allCases {
        for toggle in toggles {
          let resting = AppChipRules.restingState(
            selected: toggle.selected,
            expanded: toggle.expanded,
            enabled: toggle.enabled
          )
          let allowed = AppChipRules.isAllowed(
            variant,
            size,
            selected: toggle.selected,
            expanded: toggle.expanded,
            enabled: toggle.enabled,
            in: spec
          )
          #expect(allowed == listed(variant, size, resting), "\(variant) \(size) \(toggle)")
        }
      }
    }
  }
}

@Test("every interaction of an allowed chip has a look, and a chip that is not allowed has none")
func everyInteractionResolves() {
  for spec in specs {
    for variant in ChipVariant.allCases {
      for size in ChipSize.allCases {
        for toggle in toggles {
          let allowed = AppChipRules.isAllowed(
            variant,
            size,
            selected: toggle.selected,
            expanded: toggle.expanded,
            enabled: toggle.enabled,
            in: spec
          )
          for interaction in interactions {
            let look = AppChipRules.appearance(
              in: spec,
              variant: variant,
              size: size,
              selected: toggle.selected,
              expanded: toggle.expanded,
              enabled: toggle.enabled,
              pressed: interaction.pressed,
              focused: interaction.focused
            )
            #expect((look != nil) == allowed, "\(variant) \(size) \(toggle) \(interaction)")
          }
        }
      }
    }
  }
}

@Test("a toggle, a disabled state or a size the variant does not take renders nothing")
func notAllowedExamples() {
  let spec = ChipSpec.light
  #expect(!AppChipRules.isAllowed(.weather, .small, selected: true, expanded: false, enabled: true, in: spec))
  #expect(!AppChipRules.isAllowed(.reason, .compact, selected: false, expanded: false, enabled: false, in: spec))
  #expect(!AppChipRules.isAllowed(.choice, .medium, selected: false, expanded: false, enabled: true, in: spec))
  #expect(!AppChipRules.isAllowed(.filterMenu, .medium, selected: false, expanded: false, enabled: false, in: spec))
  #expect(AppChipRules.isAllowed(.filter, .medium, selected: true, expanded: false, enabled: false, in: spec))
  #expect(AppChipRules.isAllowed(.reason, .compact, selected: false, expanded: true, enabled: true, in: spec))
}

@Test("an activation runs the action once only when enabled", arguments: [(true, 1), (false, 0)])
func chipActivationGate(enabled: Bool, expectedCalls: Int) {
  var calls = 0
  AppChipRules.activate(enabled: enabled) { calls += 1 }
  #expect(calls == expectedCalls)
}

@Test("the detail separator is exactly U+00B7 then a space, read by its generated key")
func detailSeparator() throws {
  #expect(ChipPart.detail.separatorKey == "ds_chip_detail_separator")
  let separator = try #require(AppChipRules.separator(for: .detail))
  #expect(separator == "\u{00B7} ")
  #expect(separator.count == 2)
  #expect(separator.last == " ")
  #expect(AppChipRules.separator(for: .prefix) == nil)
  #expect(AppChipRules.separator(for: .swatch) == nil)
}

@Test("a disclosure chip announces Expanded and Collapsed, byte for byte as on Android")
func disclosureStateText() {
  #expect(AppChipRules.disclosureStateText(expanded: true) == "Expanded")
  #expect(AppChipRules.disclosureStateText(expanded: false) == "Collapsed")
}

@Test("the contrast ratio is 1 for equal colours and 21 for black on white, in either order")
func contrastRatio() {
  let environment = EnvironmentValues()
  let black = Color.black.resolve(in: environment)
  let white = Color.white.resolve(in: environment)
  #expect(abs(AppColorContrast.ratio(black, black) - 1) < 1e-9)
  #expect(abs(AppColorContrast.ratio(black, white) - 21) < 1e-6)
  #expect(AppColorContrast.ratio(black, white) == AppColorContrast.ratio(white, black))
}

@Test("camera-ink on the light surface draws no swatch edge; a near-white swatch on it does")
func swatchEdge() throws {
  let look = try #require(ChipSpec.light.appearance(variant: .swatch, size: .large, state: .enabled))
  let fillRole = try #require(look.backgroundColor)
  let minContrast = try #require(look.swatchEdgeMinContrast)
  #expect(fillRole == .surface)
  let environment = EnvironmentValues()
  let fill = AppTheme.light.color(fillRole).resolve(in: environment)
  let ink = AppTheme.light.color(ComponentGallery.chipSwatch).resolve(in: environment)
  let nearWhite = AppTheme.light.color(.cameraPaper).resolve(in: environment)
  #expect(!AppChipFace.showsSwatchEdge(ink, on: fill, minContrast: minContrast))
  #expect(AppChipFace.showsSwatchEdge(nearWhite, on: fill, minContrast: minContrast))
}
