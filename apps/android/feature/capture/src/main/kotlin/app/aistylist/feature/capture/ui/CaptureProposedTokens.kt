package app.aistylist.feature.capture.ui

import androidx.compose.ui.unit.dp

/**
 * The capture camera parts that DESIGN.md has no token for yet, measured from the canvas (boards
 * SC16–SC20 and C11, version 76). They are the "Proposed values" of the surface brief
 * `.impeccable/surfaces/sc16-capture-camera.md`; once the owner approves them they move to DESIGN.md
 * and the generated tokens, and this object goes. Every other value on these screens is a token.
 */
internal object CaptureProposedTokens {
    // capture-guide: camera-paper stroke over a camera-ink halo; locked dashed 6 on / 6 off.
    val guideStroke = 2.dp
    val guideHalo = 4.dp
    val guideDash = 6.dp

    /**
     * Proposed by the live-outline lane, not on the canvas yet: the family guide drawn faint, so the
     * item's live outline (full strength, same stroke) reads as the primary shape. Awaiting the
     * ui-designer and owner, like the rest of this object.
     */
    const val GUIDE_FAINT_ALPHA: Float = 0.5f

    /** The canvas the guide paths are drawn in (the 350 × 506 preview of SC04). */
    const val GUIDE_VIEWPORT_WIDTH: Float = 350f
    const val GUIDE_VIEWPORT_HEIGHT: Float = 506f

    // capture-shutter: ring stroke 4 on a centre line of radius 36; disc 60, 52 while capturing.
    val shutterSize = 76.dp
    val shutterRing = 4.dp
    val shutterDisc = 60.dp
    val shutterDiscCapturing = 52.dp

    // capture-step-pill.
    val stepPillHeight = 32.dp
    val stepPillPaddingHorizontal = 14.dp
    val stepPillTop = 18.dp

    // capture-hint-card (padding 10 14, inset 16 and bottom 18).
    val hintCardPaddingVertical = 10.dp
    val hintCardPaddingHorizontal = 14.dp
    val hintCardGap = 10.dp
    val hintCardBottom = 18.dp

    // Camera chrome (SC04): padding 18 20 30, column gap 14, top bar and anyway slot.
    val chromePaddingTop = 18.dp
    val chromePaddingBottom = 30.dp
    val chromeGap = 14.dp
    val topBarHeight = 44.dp
    val anywaySlotHeight = 70.dp
    val modeSlotHeight = 44.dp
    val modeTrackPadding = 4.dp
    val modeSegmentGap = 2.dp
    val bottomRowHeight = 76.dp

    // camera-icon-button: the 52 circle on camera-track (import).
    val cameraIconButton = 52.dp

    // camera-button-tonal: Compact 44 on camera-track (anyway, next item).
    val cameraButtonHeight = 44.dp

    // camera-upload-badge (batch count chip): 36 with a 1.5 ring.
    val countChipHeight = 36.dp
    val countChipRing = 1.5.dp
    val countChipPaddingHorizontal = 14.dp

    // C09 sheet as SC16/SC18 draw it: handle 36 × 4, padding 10 20 34.
    val sheetHandleWidth = 36.dp
    val sheetHandleHeight = 4.dp
    val sheetPaddingTop = 10.dp
    val sheetPaddingBottom = 34.dp

    // Picker tiles (C08 item tile 110, art 64), row gap 12, column gap 10; modal header 56.
    val pickerTileArt = 64.dp
    val pickerColumnGap = 10.dp
    val modalHeaderHeight = 56.dp

    /** C07 plain list row (underwear sub-pick). */
    val listRowHeight = 52.dp

    /** C06 toggle row (the camera menu's worn-photos row). */
    val toggleRowHeight = 64.dp

    /** Tile art stroke: the icon stroke, until C10 garment art exists natively. */
    val artStroke = 1.7.dp

    // Review photo heights (SC19): single 350, front and back 220.
    val reviewPhotoHeight = 350.dp
    val reviewPairPhotoHeight = 220.dp
    val importPhotoHeight = 280.dp

    // C04 state template illustration slot (permission, no camera).
    val stateSlotWidth = 96.dp
    val stateSlotHeight = 64.dp

    /** Divider ring in S2 on the preview and hint card (SC04). */
    val darkEdge = 1.dp
}
