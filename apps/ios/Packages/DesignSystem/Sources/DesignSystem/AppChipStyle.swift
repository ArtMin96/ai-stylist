// The ButtonStyle behind AppChip: reads the interaction (pressed, focused) from SwiftUI, picks the chip's look
// (`AppChip.appearance(in:pressed:focused:)`, which follows the chip's own `enabled`) and draws its face inside the
// generated touch target.
import DesignTokens
import SwiftUI

/// Draws an `AppChip` in the look of its displayed state.
struct AppChipStyle: ButtonStyle {
  let chip: AppChip

  func makeBody(configuration: Configuration) -> some View {
    AppChipStyleBody(chip: chip, isPressed: configuration.isPressed)
  }
}

/// The style's view, so it can read the environment. It never reads `\.isEnabled`: the look follows the chip's
/// `enabled` only (settled rule, 2026-10-21).
private struct AppChipStyleBody: View {
  let chip: AppChip
  let isPressed: Bool

  @Environment(\.appTheme) private var theme
  @Environment(\.isFocused) private var isFocused

  var body: some View {
    if let appearance = chip.appearance(in: theme.chips, pressed: isPressed, focused: isFocused) {
      chip.face(appearance)
        .appTouchTarget(ChipAccessibility.minTouchTarget, animating: appearance)
    }
  }
}
