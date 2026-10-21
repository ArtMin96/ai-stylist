// The pure rules of AppChip from its contract (.impeccable/components/chip.yaml): which state shows (G2),
// whether the chip renders at all, which look it resolves to, when an activation runs the action, and its
// copy. No SwiftUI, so the tests check them without rendering. Public, as AppButtonRules. `nonisolated`:
// pure functions over Sendable token values.
public import DesignTokens

/// The state, look, activation and copy rules of `AppChip`.
nonisolated public enum AppChipRules {
  /// The interaction the platform reports, first match wins: disabled, pressed, focused, none.
  private enum Interaction {
    case none
    case pressed
    case focused
    case disabled
  }

  /// The state shown (contract G2), first match wins: disabled when not `enabled`, else pressed, else
  /// focused, else none; prefixed with `selected-` while `selected`, `expanded-` while `expanded`. None with
  /// a toggle is the toggle; none with no toggle is `enabled`. Nil when the contract has no such state:
  /// both toggles on, or expanded and disabled.
  public static func displayedState(
    selected: Bool,
    expanded: Bool,
    enabled: Bool,
    pressed: Bool,
    focused: Bool
  ) -> ChipState? {
    let interaction: Interaction =
      if !enabled {
        .disabled
      } else if pressed {
        .pressed
      } else if focused {
        .focused
      } else {
        .none
      }
    switch (selected, expanded, interaction) {
    case (true, true, _): return nil
    case (false, false, .none): return .enabled
    case (false, false, .pressed): return .pressed
    case (false, false, .focused): return .focused
    case (false, false, .disabled): return .disabled
    case (true, false, .none): return .selected
    case (true, false, .pressed): return .selectedPressed
    case (true, false, .focused): return .selectedFocused
    case (true, false, .disabled): return .selectedDisabled
    case (false, true, .none): return .expanded
    case (false, true, .pressed): return .expandedPressed
    case (false, true, .focused): return .expandedFocused
    case (false, true, .disabled): return nil
    }
  }

  /// The state shown with no interaction: the one that decides whether the chip renders.
  public static func restingState(selected: Bool, expanded: Bool, enabled: Bool) -> ChipState? {
    displayedState(selected: selected, expanded: expanded, enabled: enabled, pressed: false, focused: false)
  }

  /// The look for the inputs, read through `lookup` (the look of one state at the chip's variant × size): the
  /// displayed state's look, else the resting look when that pressed or focused state has none (settled rule,
  /// 2026-10-21); nil when the resting state has no look, so the chip renders nothing.
  public static func look<Look>(
    selected: Bool,
    expanded: Bool,
    enabled: Bool,
    pressed: Bool,
    focused: Bool,
    lookup: (ChipState) -> Look?
  ) -> Look? {
    guard
      let resting = restingState(selected: selected, expanded: expanded, enabled: enabled),
      let restingLook = lookup(resting)
    else {
      return nil
    }
    let shown = displayedState(
      selected: selected,
      expanded: expanded,
      enabled: enabled,
      pressed: pressed,
      focused: focused
    )
    return shown.flatMap(lookup) ?? restingLook
  }

  /// Whether the chip renders: its resting state has a look at `variant` × `size`. A size the variant does
  /// not take, or a toggle or `enabled: false` it does not take, renders nothing (the AppButton rule).
  public static func isAllowed(
    _ variant: ChipVariant,
    _ size: ChipSize,
    selected: Bool,
    expanded: Bool,
    enabled: Bool,
    in spec: ChipSpec
  ) -> Bool {
    appearance(
      in: spec,
      variant: variant,
      size: size,
      selected: selected,
      expanded: expanded,
      enabled: enabled,
      pressed: false,
      focused: false
    ) != nil
  }

  /// The look to draw for the inputs from `spec` (`look(selected:expanded:enabled:pressed:focused:lookup:)`);
  /// nil when the chip is not allowed, so it renders nothing.
  public static func appearance(
    in spec: ChipSpec,
    variant: ChipVariant,
    size: ChipSize,
    selected: Bool,
    expanded: Bool,
    enabled: Bool,
    pressed: Bool,
    focused: Bool
  ) -> ChipAppearance? {
    look(selected: selected, expanded: expanded, enabled: enabled, pressed: pressed, focused: focused) {
      spec.appearance(variant: variant, size: size, state: $0)
    }
  }

  /// Handles one activation (tap, keyboard, assistive): runs `action` only when enabled. `AppChip`'s only
  /// activation path.
  public static func activate(enabled: Bool, action: () -> Void) {
    guard enabled else {
      return
    }
    action()
  }

  /// The copy drawn before `part`'s text, from the String Catalog key `part.separatorKey`; nil when the part
  /// has none.
  public static func separator(for part: ChipPart) -> String? {
    part.separatorKey.map(AppStrings.localized)
  }

  /// The value a disclosure chip announces (parity: Android `stateDescription`), from the String Catalog
  /// keys `ds_chip_state_expanded` and `ds_chip_state_collapsed`.
  public static func disclosureStateText(expanded: Bool) -> String {
    AppStrings.localized(expanded ? "ds_chip_state_expanded" : "ds_chip_state_collapsed")
  }
}
