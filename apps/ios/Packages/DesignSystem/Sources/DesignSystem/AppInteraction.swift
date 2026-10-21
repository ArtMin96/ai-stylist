// What every tappable base component shares (AppButton C01, AppChip C03): the minimum touch target and the
// press transition. One copy, so the two components never drift apart.
import DesignTokens
import SwiftUI

/// The touch target and press motion of the tappable base components.
enum AppInteraction {
  /// The minimum touch target on iOS, in points, for every size (the contracts'
  /// `accessibility.minTouchTarget.ios`; DESIGN.md Layout "Touch targets"). No token carries it yet.
  static let minTouchTarget: CGFloat = 44

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
