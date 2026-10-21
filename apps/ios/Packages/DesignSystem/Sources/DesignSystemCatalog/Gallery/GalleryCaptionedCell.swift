// The frame of a C03 gallery cell: the component above its test ID as a caption, so a reviewer reads each
// cell's id beside it. One copy for the chip, tag, badge and reason-row cells.
import DesignSystem
import DesignTokens
import SwiftUI

/// `content` above `caption`, set in the caption style in the secondary text colour.
struct GalleryCaptionedCell<Content: View>: View {
  let caption: String
  @ViewBuilder let content: Content

  @Environment(\.appTheme) private var theme

  var body: some View {
    VStack(alignment: .leading, spacing: theme.spacing.space4) {
      content
      Text(caption)
        .font(theme.font(theme.typography.caption))
        .foregroundStyle(theme.color(.textSecondary))
    }
  }
}
