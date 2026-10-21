// WCAG 2.x contrast between two resolved colours. AppChipFace uses it to decide whether a runtime swatch
// needs its edge (chip.yaml swatch part; DESIGN.md "Colour swatch chip"). Pure, so the tests check it
// without rendering. `nonisolated`: maths over Sendable values.
package import SwiftUI

/// The WCAG 2.x relative luminance and contrast ratio of resolved colours.
nonisolated package enum AppColorContrast {
  /// WCAG 2.x weights of the linear sRGB red, green and blue channels in the relative luminance.
  private static let redWeight = 0.2126
  private static let greenWeight = 0.7152
  private static let blueWeight = 0.0722
  /// WCAG 2.x flare term added to both luminances in the ratio.
  private static let flare = 0.05

  /// The relative luminance of `color`: 0 for black, 1 for white.
  package static func luminance(_ color: Color.Resolved) -> Double {
    redWeight * Double(color.linearRed) + greenWeight * Double(color.linearGreen)
      + blueWeight * Double(color.linearBlue)
  }

  /// The contrast ratio of the two colours, from 1 (equal) to 21 (black on white), in either order.
  package static func ratio(_ first: Color.Resolved, _ second: Color.Resolved) -> Double {
    let firstLuminance = luminance(first)
    let secondLuminance = luminance(second)
    return (max(firstLuminance, secondLuminance) + flare) / (min(firstLuminance, secondLuminance) + flare)
  }
}
