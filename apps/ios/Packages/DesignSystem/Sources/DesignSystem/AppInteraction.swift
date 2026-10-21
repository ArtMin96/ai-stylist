// What every tappable base component shares (AppButton C01, AppChip C03): the minimum touch target around its
// face and the press transition. One copy, so the two components never drift apart. Each passes its own
// generated minimum (`ButtonAccessibility.minTouchTarget`, `ChipAccessibility.minTouchTarget`).
import DesignTokens
import SwiftUI

/// The press motion of the tappable base components.
enum AppInteraction {
  /// `AppMotion.Press.duration` is in milliseconds.
  private static let millisecondsPerSecond = 1000.0

  /// The pressed transition: `AppMotion.Press` duration and easing (a cubic Bézier); none under Reduce Motion.
  static func pressAnimation(reduceMotion: Bool) -> Animation? {
    guard !reduceMotion else {
      return nil
    }
    let seconds = AppMotion.Press.duration / millisecondsPerSecond
    let curve = AppMotion.Press.easing
    guard curve.count == 4 else {
      return .linear(duration: seconds)
    }
    return .timingCurve(curve[0], curve[1], curve[2], curve[3], duration: seconds)
  }
}

/// A face inside its touch target: at least `minTouchTarget` square and hit-testable over the whole target, so a
/// wrapping row of them sits that far apart; a change of `look` animates with the press motion.
private struct AppTouchTarget<Look: Equatable>: ViewModifier {
  let minTouchTarget: Double
  let look: Look

  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  func body(content: Content) -> some View {
    content
      .frame(minWidth: minTouchTarget, minHeight: minTouchTarget)
      .contentShape(.rect)
      .animation(AppInteraction.pressAnimation(reduceMotion: reduceMotion), value: look)
  }
}

extension View {
  /// Puts a tappable face drawn in `look` inside its `minTouchTarget` (points, from the component's generated
  /// `Accessibility.minTouchTarget`) with the press transition (`AppTouchTarget`).
  func appTouchTarget(_ minTouchTarget: Double, animating look: some Equatable) -> some View {
    modifier(AppTouchTarget(minTouchTarget: minTouchTarget, look: look))
  }
}
