// What one gallery section shows (AI-195): a token category or a component's cells, each with its
// generated items in generated order. Pure data, so the tests check it without rendering.
package import DesignTokens

/// The kind of a gallery section and the items it renders.
nonisolated package enum GallerySectionKind: Equatable, Sendable {
  case colours([AppColorRole])
  case typography([AppTextStyle])
  case spacing([AppScaleStep])
  case radius([AppScaleStep])
  case buttons([ButtonGalleryEntry])

  /// The text shown for each item, in order: role ids, style and step names, button test ids.
  package var itemLabels: [String] {
    switch self {
    case .colours(let roles): roles.map(\.rawValue)
    case .typography(let styles): styles.map(\.name)
    case .spacing(let steps), .radius(let steps): steps.map(\.name)
    case .buttons(let entries): entries.map(\.testId)
    }
  }
}
