package app.aistylist.feature.capture.ui

import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureShapeFamily
import app.aistylist.feature.capture.domain.CameraContext
import app.aistylist.feature.capture.domain.CaptureSide

// Guide outlines and the two proposed glyphs, as SVG path data copied from the canvas (CapCamera
// on boards SC17–SC19, C11 proposed parts). Guide paths are in the 350 × 506 preview viewport
// (CaptureProposedTokens.GUIDE_VIEWPORT_*); the glyphs on the 24 icon grid.

private fun hook(y: Int): String = "M175 $y L175 ${y - 12} A9 9 0 1 1 184 ${y - 21}"

private const val BODY_OUTLINE =
    "M199 100A24 24 0 1 1 151 100A24 24 0 1 1 199 100Z M162 124 L162 134 L118 148 Q102 154 100 172 " +
        "L90 330 L110 332 L120 196 L118 380 L232 380 L230 196 L240 332 L260 330 L250 172 Q248 154 232 148 " +
        "L188 134 L188 124 M140 380 L142 402 M210 380 L208 402"

private const val SHOES_PAIR =
    "M70 250 L70 186 Q70 172 84 172 L116 172 Q128 204 166 208 L226 218 Q276 226 278 248 L278 250 " +
        "Q278 262 266 262 L82 262 Q70 262 70 250 Z M70 370 L70 306 Q70 292 84 292 L116 292 Q128 324 166 328 " +
        "L226 338 Q276 346 278 368 L278 370 Q278 382 266 382 L82 382 Q70 382 70 370 Z"

private val GUIDES: Map<String, String> =
    mapOf(
        "top-flat" to "M140 92 Q175 110 210 92 L286 124 L268 190 L238 180 L238 380 L112 380 L112 180 L82 190 L64 124 Z",
        "top-hanger" to
            hook(84) +
            " M118 104 L175 84 L232 104 M140 100 Q175 118 210 100 L256 118 L262 220 L238 222 L236 186 " +
            "L236 392 L114 392 L114 186 L112 222 L88 220 L94 118 Z",
        "top-worn" to
            "M203 112A28 28 0 1 1 147 112A28 28 0 1 1 203 112Z M160 140 L160 152 L112 166 Q96 172 94 190 " +
            "L86 320 L106 322 L116 210 L118 400 M232 400 L234 210 L244 322 L264 320 L256 190 Q254 172 238 166 " +
            "L190 152 L190 140 M168 400 L175 336 L182 400",
        "long-bottom-flat" to "M112 76 L238 76 L258 404 L196 404 L175 170 L154 404 L92 404 Z",
        "long-bottom-hanger" to
            hook(84) + " M120 96 L175 84 L230 96 M120 96 L230 96 L248 404 L192 404 L175 190 L158 404 L102 404 Z",
        "long-bottom-worn" to
            "M122 78 L228 78 L236 150 L230 384 L246 400 L194 400 L192 384 L180 170 L170 170 L158 384 " +
            "L156 400 L104 400 L120 384 L114 150 Z",
        "short-bottom-flat" to "M96 120 L254 120 L276 330 L190 330 L175 220 L160 330 L74 330 Z",
        "short-bottom-hanger" to
            hook(118) + " M108 130 L175 118 L242 130 M108 130 L242 130 L262 330 L190 330 L175 230 L160 330 L88 330 Z",
        "short-bottom-worn" to
            "M110 90 L240 90 L252 200 L246 390 L196 390 L184 230 L166 230 L154 390 L104 390 L98 200 Z",
        "one-piece-flat" to
            "M140 74 L152 70 Q175 92 198 70 L210 74 L214 150 Q224 176 236 196 L282 404 L68 404 L114 196 " +
            "Q126 176 136 150 Z",
        "one-piece-hanger" to
            hook(82) +
            " M120 102 L175 82 L230 102 M140 96 Q175 116 210 96 L222 106 L220 170 Q230 190 240 206 " +
            "L280 404 L70 404 L110 206 Q120 190 130 170 L128 106 Z",
        "one-piece-worn" to
            "M150 74 A26 26 0 0 1 200 74 M160 92 L160 100 L114 114 Q98 120 96 138 L88 300 L108 302 " +
            "L118 170 L110 330 L240 330 L232 170 L242 302 L262 300 L254 138 Q252 120 236 114 L190 100 " +
            "L190 92 M140 330 L142 402 M210 330 L208 402",
        "outerwear-flat" to
            "M144 72 L175 100 L206 72 L262 92 L300 300 L268 308 L246 178 L250 404 L100 404 L104 178 " +
            "L82 308 L50 300 L88 92 Z",
        "outerwear-hanger" to
            hook(80) +
            " M112 102 L175 80 L238 102 M146 96 L175 120 L204 96 L250 110 L270 330 L244 334 L236 200 " +
            "L240 404 L110 404 L114 200 L106 334 L80 330 L100 110 Z",
        "outerwear-worn" to BODY_OUTLINE,
        "shoes-flat" to
            "M60 300 L60 214 Q60 196 78 196 L118 196 Q132 236 176 240 L236 252 Q290 262 292 290 L292 300 " +
            "Q292 312 280 312 L72 312 Q60 312 60 300 Z",
        "bag-flat" to "M86 210 L264 210 L276 390 L74 390 Z M126 210 Q126 110 175 110 Q224 110 224 210",
        "bag-hanger" to hook(92) + " M175 92 L120 200 M175 92 L230 200 M100 200 L250 200 L262 380 L88 380 Z",
        "small-item-flat" to
            "M115 135 L235 135 Q255 135 255 155 L255 315 Q255 335 235 335 L115 335 Q95 335 95 315 L95 155 " +
            "Q95 135 115 135 Z",
        "generic-flat" to
            "M50 68 L300 68 Q318 68 318 86 L318 384 Q318 402 300 402 L50 402 Q32 402 32 384 L32 86 Q32 68 50 68 Z",
        "generic-hanger" to
            hook(96) +
            " M50 96 L300 96 Q318 96 318 114 L318 384 Q318 402 300 402 L50 402 Q32 402 32 384 L32 114 " +
            "Q32 96 50 96 Z",
        "generic-worn" to BODY_OUTLINE,
    )

/** The guide outline of this step: the pair outline on the shoes' pair step, else family × mode. */
internal val CameraContext.guidePath: String
    get() =
        if (side == CaptureSide.PAIR) {
            SHOES_PAIR
        } else {
            GUIDES["${family.value}-${mode.value}"] ?: GUIDES.getValue("generic-flat")
        }

/** The family's flat outline, used as the picker tile art (C10 has no native art yet). */
internal val CaptureShapeFamily.tileArtPath: String
    get() = GUIDES["$value-${CaptureMode.FLAT.value}"] ?: GUIDES.getValue("generic-flat")

/** Proposed C02 glyphs on the C11 board (24 grid): the speaker button's two states. */
internal const val SPEAKER_GLYPH: String =
    "M4.5 9.5H8l4.5-4v13L8 14.5H4.5zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"
internal const val SPEAKER_OFF_GLYPH: String =
    "M4.5 9.5H8l4.5-4v13L8 14.5H4.5zM16.5 9.5l5 5M21.5 9.5l-5 5"
