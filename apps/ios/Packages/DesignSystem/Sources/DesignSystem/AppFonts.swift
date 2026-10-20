// The bundled fonts (Resources/Fonts, OFL 1.1; see apps/ios/README.md "Fonts") and the adapter from
// a generated type style (AppTextStyle) to a SwiftUI Font. There is no system font fallback.
import CoreText
import DesignTokens
import Foundation
import OSLog
import SwiftUI

/// Registers the bundled font files with CoreText, once per process. `.appTheme()` calls it.
public enum AppFonts {
  /// The bundled font files (`.ttf`). Their family names, "Figtree" and "Young Serif", equal
  /// `AppTextStyle.fontFamily`.
  private static let fileNames = ["Figtree-Variable", "YoungSerif-Regular"]

  /// The files that failed to register; empty when every file registered. Computed once, on first use.
  public static let failedFiles: [String] = fileNames.filter { !register(fileName: $0) }

  private static let logger = Logger(subsystem: "app.aistylist.designsystem", category: "fonts")

  /// Registers every bundled font on the first call; later calls do nothing.
  public static func registerOnce() {
    _ = failedFiles
  }

  /// Registers one file for this process. A file another caller already registered counts as success.
  /// A failure logs only the file name.
  private static func register(fileName: String) -> Bool {
    guard let url = Bundle.module.url(forResource: fileName, withExtension: "ttf") else {
      logger.error("Font file not in the bundle: \(fileName, privacy: .public)")
      return false
    }
    var error: Unmanaged<CFError>?
    if CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) {
      return true
    }
    if let error, CFErrorGetCode(error.takeRetainedValue()) == CTFontManagerError.alreadyRegistered.rawValue {
      return true
    }
    logger.error("Font registration failed: \(fileName, privacy: .public)")
    return false
  }
}

// `nonisolated`: pure value mappings, called by the nonisolated AppTheme (AppTheme.swift).
extension Font {
  /// The bundled font of `style`, scaled with Dynamic Type relative to `style.dynamicType`, at the
  /// style's weight (set explicitly: Figtree's default instance is Light 300).
  nonisolated static func app(_ style: AppTextStyle) -> Font {
    .custom(style.fontFamily, size: style.fontSize, relativeTo: textStyle(style.dynamicType))
      .weight(weight(style.fontWeight))
  }

  /// The Dynamic Type style named in DESIGN.md (`dynamicType`, the iOS text style without its dot).
  nonisolated private static func textStyle(_ name: String) -> Font.TextStyle {
    switch name {
    case "largeTitle": .largeTitle
    case "title": .title
    case "title2": .title2
    case "title3": .title3
    case "headline": .headline
    case "callout": .callout
    case "subheadline": .subheadline
    case "footnote": .footnote
    case "caption": .caption
    case "caption2": .caption2
    default: .body
    }
  }

  /// The SwiftUI weight of a CSS-style numeric weight (100 to 900).
  nonisolated private static func weight(_ value: Int) -> Font.Weight {
    switch value {
    case ..<150: .ultraLight
    case ..<250: .thin
    case ..<350: .light
    case ..<450: .regular
    case ..<550: .medium
    case ..<650: .semibold
    case ..<750: .bold
    case ..<850: .heavy
    default: .black
    }
  }
}
