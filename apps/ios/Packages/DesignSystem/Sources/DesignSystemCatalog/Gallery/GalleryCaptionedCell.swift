// The frame of a component gallery cell: the component above an id as a caption, so a reviewer reads each cell's
// id beside it. One copy for the button, icon, chip, tag, badge and reason-row cells and the icon steps preview.
import DesignSystem
import DesignTokens
import SwiftUI

/// `content` above `caption`, set in the caption style in the secondary text colour.
struct GalleryCaptionedCell<Content: View>: View {
  let caption: String
  /// Leading for the component cells; centred under a glyph.
  var alignment: HorizontalAlignment = .leading
  @ViewBuilder let content: Content

  @Environment(\.appTheme) private var theme

  var body: some View {
    VStack(alignment: alignment, spacing: theme.spacing.space4) {
      content
      AppComponentText(text: caption, style: theme.typography.caption, color: .textSecondary)
    }
  }
}
