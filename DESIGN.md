---
name: Garderi
description: A calm, honest personal stylist that dresses you from the closet you already own.
colors:
  # Core scheme tokens. -light = S1 Garden Light, -dark = S2 Garden Dark, -brand = S3 Viridian,
  # -hc-light / -hc-dark = S7 High Contrast (see ## Colors). Every -light token (colour, elevation,
  # component) has a -dark twin and the reverse, except those on the "Unpaired by design" line
  # (## Colors > Named Rules).
  background-light: '#F2EFE8'
  background-dark: '#0F1F1B'
  surface-light: '#FFFDF8'
  surface-dark: '#172B26'
  surface-2-light: '#E9E5DA'
  surface-2-dark: '#1F3831'
  text-light: '#1B1B19'
  text-dark: '#F2EFE8'
  text-secondary-light: '#5E5B53'
  text-secondary-dark: '#ABBDB4'
  divider-light: '#D9D4C7'
  divider-dark: '#2C4740'
  outline-light: '#8C877B'
  outline-dark: '#5E7D72'
  primary-light: '#2E7D63'
  primary-dark: '#EBCB8B'
  primary-pressed-light: '#246A54'
  primary-pressed-dark: '#C8B079'
  on-primary-light: '#FFFFFF'
  on-primary-dark: '#1B1B19'
  primary-text-light: '#1F5A47'
  primary-text-dark: '#EBCB8B'
  link-pressed-light: '#10312A'
  link-pressed-dark: '#F2EFE8'
  accent-light: '#EBCB8B'
  accent-dark: '#7DB8A0'
  on-accent-light: '#1B1B19'
  on-accent-dark: '#0F1F1B'
  focus-light: '#1F7A72'
  focus-dark: '#EBCB8B'
  on-error-light: '#FFFFFF'
  on-error-dark: '#0F1F1B'
  active-pill-light: 'rgba(46,125,99,0.14)'
  active-pill-dark: 'rgba(235,203,139,0.16)'
  # Inverse: snackbar and "AI-generated preview" badge (ink with paper text in light, paper with ink in dark).
  # inverse-primary = the snackbar's Undo action (C04): the accent yellow in light, #1F5A47 in dark.
  inverse-surface-light: '#1B1B19'
  inverse-surface-dark: '#F2EFE8'
  on-inverse-light: '#F2EFE8'
  on-inverse-dark: '#1B1B19'
  inverse-primary-light: '#EBCB8B'
  inverse-primary-dark: '#1F5A47'
  # Pressed overlays, laid over a component's own fill (overlayColor): light ink #1B1B19 at 12 % / 18 %,
  # dark background #0F1F1B at 16 %.
  pressed-overlay-light: 'rgba(27,27,25,0.12)'
  pressed-overlay-dark: 'rgba(15,31,27,0.16)'
  pressed-overlay-strong-light: 'rgba(27,27,25,0.18)'
  pressed-overlay-strong-dark: 'rgba(15,31,27,0.16)'
  scrim: 'rgba(27,27,25,0.45)'
  # Capture camera: a dark ground, the same in both themes (C05).
  camera-ground: '#1B1B19'
  camera-track: 'rgba(242,239,232,0.14)'
  camera-paper: '#F2EFE8'
  camera-ink: '#1B1B19'
  camera-yellow: '#EBCB8B'
  # S3 Viridian (brand scheme: Welcome and onboarding only). The roles S3 does not draw copy the S2
  # value: primary-pressed, link-pressed, on-accent, on-error, active-pill, inverse-*, pressed overlays.
  background-brand: '#2E7D63'
  surface-brand: '#1F5A47'
  surface-2-brand: '#18463A'
  text-brand: '#F7F5EF'
  text-secondary-brand: '#CFE3D9'
  divider-brand: '#3F8E73'
  outline-brand: '#ABD2C0'
  primary-brand: '#EBCB8B'
  primary-pressed-brand: '#C8B079'
  on-primary-brand: '#10312A'
  primary-text-brand: '#EBCB8B'
  link-pressed-brand: '#F2EFE8'
  accent-brand: '#F7F5EF'
  on-accent-brand: '#0F1F1B'
  focus-brand: '#EBCB8B'
  on-error-brand: '#0F1F1B'
  active-pill-brand: 'rgba(235,203,139,0.16)'
  inverse-surface-brand: '#F2EFE8'
  on-inverse-brand: '#1B1B19'
  inverse-primary-brand: '#1F5A47'
  pressed-overlay-brand: 'rgba(15,31,27,0.16)'
  pressed-overlay-strong-brand: 'rgba(15,31,27,0.16)'
  # S7 High Contrast, light. The roles S7 does not draw borrow the S1 value, except: divider = the
  # outline colour (S7 draws hairlines as 2 px outlines), on-accent #000000 (drawn), no active pill
  # (S7 marks the active tab with colour plus underline), link-pressed one step darker than #10312A.
  background-hc-light: '#FFFFFF'
  surface-hc-light: '#FFFFFF'
  surface-2-hc-light: '#F2EFE8'
  text-hc-light: '#000000'
  text-secondary-hc-light: '#2E2D29'
  divider-hc-light: '#000000'
  outline-hc-light: '#000000'
  primary-hc-light: '#10312A'
  primary-pressed-hc-light: '#246A54'
  on-primary-hc-light: '#FFFFFF'
  primary-text-hc-light: '#10312A'
  link-pressed-hc-light: '#000000'
  accent-hc-light: '#EBCB8B'
  on-accent-hc-light: '#000000'
  focus-hc-light: '#000000'
  on-error-hc-light: '#FFFFFF'
  active-pill-hc-light: 'rgba(0,0,0,0)'
  inverse-surface-hc-light: '#1B1B19'
  on-inverse-hc-light: '#F2EFE8'
  inverse-primary-hc-light: '#EBCB8B'
  pressed-overlay-hc-light: 'rgba(27,27,25,0.12)'
  pressed-overlay-strong-hc-light: 'rgba(27,27,25,0.18)'
  # S7 High Contrast, dark. The roles S7 does not draw borrow the S2 value, with the same exceptions:
  # divider = the outline colour, on-accent #000000 (drawn), no active pill.
  background-hc-dark: '#000000'
  surface-hc-dark: '#000000'
  surface-2-hc-dark: '#1B1B19'
  text-hc-dark: '#FFFFFF'
  text-secondary-hc-dark: '#E5E1D6'
  divider-hc-dark: '#FFFFFF'
  outline-hc-dark: '#FFFFFF'
  primary-hc-dark: '#EBCB8B'
  primary-pressed-hc-dark: '#C8B079'
  on-primary-hc-dark: '#000000'
  primary-text-hc-dark: '#EBCB8B'
  link-pressed-hc-dark: '#F2EFE8'
  accent-hc-dark: '#7DB8A0'
  on-accent-hc-dark: '#000000'
  focus-hc-dark: '#FFFFFF'
  on-error-hc-dark: '#0F1F1B'
  active-pill-hc-dark: 'rgba(0,0,0,0)'
  inverse-surface-hc-dark: '#F2EFE8'
  on-inverse-hc-dark: '#1B1B19'
  inverse-primary-hc-dark: '#1F5A47'
  pressed-overlay-hc-dark: 'rgba(15,31,27,0.16)'
  pressed-overlay-strong-hc-dark: 'rgba(15,31,27,0.16)'
  # Status: fg / bg per theme.
  success-fg-light: '#4F6B2A'
  success-bg-light: '#E6EDD9'
  success-fg-dark: '#A9C27A'
  success-bg-dark: '#1E2E18'
  warning-fg-light: '#8A5A12'
  warning-bg-light: '#F6EBCF'
  warning-fg-dark: '#E3B05A'
  warning-bg-dark: '#33280F'
  error-fg-light: '#B23A2E'
  error-bg-light: '#F7E3DE'
  error-fg-dark: '#F08C7E'
  error-bg-dark: '#3A1E1A'
  info-fg-light: '#2F5D9E'
  info-bg-light: '#E1E9F5'
  info-fg-dark: '#8FB0E6'
  info-bg-dark: '#1A2A40'
  # Condition chips (weather and occasion): fg / bg per theme; the snow chip has a ring in light only
  # (condition-snow-ring-light, unpaired by design).
  condition-sunny-fg-light: '#634724'
  condition-sunny-bg-light: '#F6EBCF'
  condition-sunny-fg-dark: '#EBCB8B'
  condition-sunny-bg-dark: '#3B3220'
  condition-rain-fg-light: '#1F5C57'
  condition-rain-bg-light: '#D6EEEB'
  condition-rain-fg-dark: '#7FD0C8'
  condition-rain-bg-dark: '#12343A'
  condition-cold-fg-light: '#17324D'
  condition-cold-bg-light: '#DCE6F0'
  condition-cold-fg-dark: '#A9C4E0'
  condition-cold-bg-dark: '#1A2A3C'
  condition-hot-fg-light: '#8A3A1E'
  condition-hot-bg-light: '#F6DCCD'
  condition-hot-fg-dark: '#F0A27E'
  condition-hot-bg-dark: '#3E2218'
  condition-windy-fg-light: '#3F5A3D'
  condition-windy-bg-light: '#E1E8DE'
  condition-windy-fg-dark: '#A9C27A'
  condition-windy-bg-dark: '#22301F'
  condition-snow-fg-light: '#3D4A57'
  condition-snow-bg-light: '#EEF1F4'
  condition-snow-ring-light: '#CBD3DB'
  condition-snow-fg-dark: '#DDE3EA'
  condition-snow-bg-dark: '#262B31'
  condition-evening-fg-light: '#EEF2F5'
  condition-evening-bg-light: '#17324D'
  condition-evening-fg-dark: '#C9D6E3'
  condition-evening-bg-dark: '#23324A'
typography:
  # R2 type styles (sizes in pt on iOS = sp on Android at 100%).
  # dynamicType = the SwiftUI Font.TextStyle the style grows with (no leading dot); m3Roles = the
  # Material 3 type roles it fills, each of the 15 roles in exactly one list (see ### Hierarchy).
  display:
    {
      fontFamily: 'Young Serif, serif',
      fontSize: '40px',
      fontWeight: 400,
      lineHeight: '46px',
      letterSpacing: '0em',
      dynamicType: largeTitle,
      m3Roles: [displayLarge, displayMedium, displaySmall],
    }
  title-1:
    {
      fontFamily: 'Young Serif, serif',
      fontSize: '32px',
      fontWeight: 400,
      lineHeight: '38px',
      letterSpacing: '0em',
      dynamicType: title,
      m3Roles: [headlineMedium],
    }
  title-2:
    {
      fontFamily: 'Young Serif, serif',
      fontSize: '26px',
      fontWeight: 400,
      lineHeight: '32px',
      letterSpacing: '0em',
      dynamicType: title2,
      m3Roles: [headlineSmall],
    }
  title-3:
    {
      fontFamily: 'Young Serif, serif',
      fontSize: '20px',
      fontWeight: 400,
      lineHeight: '26px',
      letterSpacing: '0em',
      dynamicType: title3,
      m3Roles: [titleLarge],
    }
  headline:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '17px',
      fontWeight: 600,
      lineHeight: '22px',
      letterSpacing: '0em',
      dynamicType: headline,
      m3Roles: [titleMedium],
    }
  body:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '17px',
      fontWeight: 400,
      lineHeight: '24px',
      letterSpacing: '0em',
      dynamicType: body,
      m3Roles: [bodyLarge],
    }
  callout:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '15px',
      fontWeight: 400,
      lineHeight: '21px',
      letterSpacing: '0em',
      dynamicType: callout,
      m3Roles: [bodyMedium],
    }
  subhead:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '15px',
      fontWeight: 600,
      lineHeight: '20px',
      letterSpacing: '0em',
      dynamicType: subheadline,
      m3Roles: [titleSmall],
    }
  footnote:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '13px',
      fontWeight: 400,
      lineHeight: '18px',
      letterSpacing: '0em',
      dynamicType: footnote,
      m3Roles: [bodySmall],
    }
  caption:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '12px',
      fontWeight: 500,
      lineHeight: '16px',
      letterSpacing: '0em',
      dynamicType: caption,
      m3Roles: [labelMedium],
    }
  overline:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '11px',
      fontWeight: 600,
      lineHeight: '14px',
      letterSpacing: '0.08em',
      textTransform: uppercase,
      dynamicType: caption2,
      m3Roles: [labelSmall],
    }
  button:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '17px',
      fontWeight: 600,
      lineHeight: '22px',
      letterSpacing: '0em',
      dynamicType: headline,
      m3Roles: [labelLarge],
    }
  # Component label styles (from the C01-C10 boards, not in the R2 table). Each takes the
  # dynamicType of the R2 style it scales with; only large-title-bar fills an M3 role.
  large-title-bar:
    {
      fontFamily: 'Young Serif, serif',
      fontSize: '34px',
      fontWeight: 400,
      lineHeight: '40px',
      letterSpacing: '0em',
      dynamicType: largeTitle,
      m3Roles: [headlineLarge],
    }
  label-md:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '14px',
      fontWeight: 600,
      lineHeight: '18px',
      letterSpacing: '0em',
      dynamicType: subheadline,
      m3Roles: [],
    }
  label-sm:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '13px',
      fontWeight: 600,
      lineHeight: '18px',
      letterSpacing: '0em',
      dynamicType: footnote,
      m3Roles: [],
    }
  # Second text runs inside a chip (C03, C05): the group and sort prefix ("Group:"), the filter
  # count ("· 12") and the override detail ("· your setting").
  label-md-normal:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '14px',
      fontWeight: 400,
      lineHeight: '18px',
      letterSpacing: '0em',
      dynamicType: subheadline,
      m3Roles: [],
    }
  label-md-medium:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '14px',
      fontWeight: 500,
      lineHeight: '18px',
      letterSpacing: '0em',
      dynamicType: subheadline,
      m3Roles: [],
    }
  label-sm-medium:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '13px',
      fontWeight: 500,
      lineHeight: '18px',
      letterSpacing: '0em',
      dynamicType: footnote,
      m3Roles: [],
    }
  subhead-medium:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '15px',
      fontWeight: 500,
      lineHeight: '20px',
      letterSpacing: '0em',
      dynamicType: subheadline,
      m3Roles: [],
    }
  label-action:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '15px',
      fontWeight: 700,
      lineHeight: '20px',
      letterSpacing: '0em',
      dynamicType: subheadline,
      m3Roles: [],
    }
  caption-strong:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '12px',
      fontWeight: 600,
      lineHeight: '16px',
      letterSpacing: '0em',
      dynamicType: caption,
      m3Roles: [],
    }
  badge:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '11px',
      fontWeight: 600,
      lineHeight: '14px',
      letterSpacing: '0em',
      dynamicType: caption2,
      m3Roles: [],
    }
  badge-count:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '11px',
      fontWeight: 700,
      lineHeight: '18px',
      letterSpacing: '0em',
      dynamicType: caption2,
      m3Roles: [],
    }
  # The filled destructive button's disabled label: the button style at 500, as drawn on C01.
  button-disabled:
    {
      fontFamily: 'Figtree, sans-serif',
      fontSize: '17px',
      fontWeight: 500,
      lineHeight: '22px',
      letterSpacing: '0em',
      dynamicType: headline,
      m3Roles: [],
    }
rounded:
  # R2 scale: 6, 8, 12, 16, 24, full; plus the component radii drawn on C01-C10.
  '2': '2px'
  '3': '3px'
  '4': '4px'
  '6': '6px'
  '8': '8px'
  '10': '10px'
  '12': '12px'
  '14': '14px'
  '16': '16px'
  '18': '18px'
  '20': '20px'
  '24': '24px'
  full: '999px'
spacing:
  '4': '4px'
  '8': '8px'
  '12': '12px'
  '16': '16px'
  '20': '20px'
  '24': '24px'
  '32': '32px'
  '40': '40px'
  '48': '48px'
  '64': '64px'
elevation:
  # ### Shadow Vocabulary and R2 Elevation: one drop shadow per entry (px). No entry = no shadow;
  # segment-thumb has no -dark entry because dark draws surface-2 + a 1 px outline instead (unpaired by design).
  # edge*: 1 px inset line in dark, top edge only on the sheet (inset 0 1px 0), all round on the dialog
  # and the coach mark.
  # ring*: solid ring outside the shape (Capture button: 0 0 0 4px in the surface colour).
  segment-thumb-light:
    { offsetX: '0px', offsetY: '1px', blur: '2px', spread: '0px', color: 'rgba(27,27,25,0.12)' }
  sheet-light:
    { offsetX: '0px', offsetY: '-8px', blur: '24px', spread: '0px', color: 'rgba(27,27,25,0.14)' }
  sheet-dark:
    {
      offsetX: '0px',
      offsetY: '-8px',
      blur: '24px',
      spread: '0px',
      color: 'rgba(27,27,25,0.14)',
      edgeColor: '{colors.divider-dark}',
      edgeWidth: '1px',
    }
  dialog-light:
    { offsetX: '0px', offsetY: '8px', blur: '24px', spread: '0px', color: 'rgba(27,27,25,0.14)' }
  dialog-dark:
    {
      offsetX: '0px',
      offsetY: '8px',
      blur: '24px',
      spread: '0px',
      color: 'rgba(27,27,25,0.14)',
      edgeColor: '{colors.divider-dark}',
      edgeWidth: '1px',
    }
  # Coach mark: the dialog shadow; its dark edge is outline-dark (#5E7D72), round the bubble and the arrow (C09).
  coach-mark-light:
    { offsetX: '0px', offsetY: '8px', blur: '24px', spread: '0px', color: 'rgba(27,27,25,0.14)' }
  coach-mark-dark:
    {
      offsetX: '0px',
      offsetY: '8px',
      blur: '24px',
      spread: '0px',
      color: 'rgba(27,27,25,0.14)',
      edgeColor: '{colors.outline-dark}',
      edgeWidth: '1px',
    }
  snackbar-light:
    { offsetX: '0px', offsetY: '8px', blur: '24px', spread: '0px', color: 'rgba(27,27,25,0.18)' }
  snackbar-dark:
    { offsetX: '0px', offsetY: '8px', blur: '24px', spread: '0px', color: 'rgba(0,0,0,0.4)' }
  capture-button-light:
    {
      offsetX: '0px',
      offsetY: '6px',
      blur: '14px',
      spread: '0px',
      color: 'rgba(27,27,25,0.18)',
      ringColor: '{colors.surface-light}',
      ringWidth: '4px',
    }
  capture-button-dark:
    {
      offsetX: '0px',
      offsetY: '6px',
      blur: '14px',
      spread: '0px',
      color: 'rgba(0,0,0,0.35)',
      ringColor: '{colors.surface-dark}',
      ringWidth: '4px',
    }
motion:
  # ### Motion and R2 Motion. sheet also times snackbars. On sheet and screen, `easing` is the opening
  # curve (screens in, sheets open); closing (screens out, sheets close) uses easing-exit.
  press: { duration: '150ms', easing: 'linear' }
  sheet: { duration: '250ms', easing: '{motion.easing-enter}' }
  screen: { duration: '350ms', easing: '{motion.easing-enter}' }
  easing-enter: 'cubic-bezier(0.2, 0, 0, 1)'
  easing-exit: 'cubic-bezier(0.4, 0, 1, 1)'
  # Reduced motion: a crossfade replaces all movement; no shimmer, progress static, no auto-rotate.
  reduced: { duration: '150ms', easing: 'linear' }
  snackbar-undo-min: '5000ms'
  toast: '3000ms'
components:
  # Focus ring on every focusable control: a 2 px line, 2 px gap, following the control's own corners
  # (the inline link, which has none, uses rounded.4). S7 High Contrast draws it 3 px, same 2 px gap.
  focus-ring-light: { width: '2px', offset: '2px', color: '{colors.focus-light}' }
  focus-ring-dark: { width: '2px', offset: '2px', color: '{colors.focus-dark}' }
  focus-ring-hc-light: { width: '3px', offset: '2px', color: '{colors.focus-hc-light}' }
  focus-ring-hc-dark: { width: '3px', offset: '2px', color: '{colors.focus-hc-dark}' }
  # C01 Buttons
  button-primary-light:
    {
      backgroundColor: '{colors.primary-light}',
      textColor: '{colors.on-primary-light}',
      typography: '{typography.button}',
      rounded: '{rounded.full}',
      height: '52px',
      padding: '0 {spacing.24}',
    }
  button-primary-pressed-light:
    { backgroundColor: '{colors.primary-pressed-light}', textColor: '{colors.on-primary-light}' }
  button-primary-disabled-light:
    { backgroundColor: '{colors.surface-2-light}', textColor: '{colors.text-secondary-light}' }
  button-primary-dark:
    {
      backgroundColor: '{colors.primary-dark}',
      textColor: '{colors.on-primary-dark}',
      typography: '{typography.button}',
      rounded: '{rounded.full}',
      height: '52px',
      padding: '0 {spacing.24}',
    }
  button-primary-pressed-dark:
    { backgroundColor: '{colors.primary-pressed-dark}', textColor: '{colors.on-primary-dark}' }
  button-primary-disabled-dark:
    { backgroundColor: '{colors.surface-2-dark}', textColor: '{colors.text-secondary-dark}' }
  # Shared size entries (height, padding and the leading-icon slot: iconSize, iconGap; Small and
  # Compact also set their 15/600 label). The icon slot is read from these entries for every variant
  # (DESIGN.md "Buttons"); otherwise a variant's own
  # base holds the size it is drawn at; these serve its other sizes.
  # Scale references (owner 2026-10-21): iconSize names an icon step, and a padding or gap part
  # equal to a spacing step names that step. Heights (52, 48, 44, 36) and off-scale parts (gap 6,
  # padding 10) stay literal.
  button-large:
    { height: '52px', padding: '0 {spacing.24}', iconSize: icon-md, iconGap: '{spacing.8}' }
  # Card: the one action inside a state template card, 48 high with the 17/600 label (C04 Try again,
  # SC10 Add your first piece, TR1 Try again). Drawn full width only; padding as Large.
  button-card:
    { height: '48px', padding: '0 {spacing.24}', iconSize: icon-md, iconGap: '{spacing.8}' }
  button-medium:
    { height: '44px', padding: '0 {spacing.20}', iconSize: icon-md, iconGap: '{spacing.8}' }
  # Compact: 44 high with the 15/600 label, for row, card and dialog actions (C07, C08, SC05,
  # SC09, SC10, SC12, SC15, TR1). Outlined pills 0 16 (Unfollow, Confirm); filled pills 0 20
  # (C08 Add items); text 0 12 (SC12 Edit, Clear). Leading icon md, gap 6 at this size: the
  # screens draw 18, which snaps to md, as Small (the same 15/20 label) already draws it, and 20
  # equals the label's line height.
  button-compact:
    {
      typography: '{typography.subhead}',
      height: '44px',
      padding: '0 {spacing.16}',
      iconSize: icon-md,
      iconGap: '6px',
    }
  button-compact-filled:
    { typography: '{typography.subhead}', height: '44px', padding: '0 {spacing.20}' }
  button-text-compact:
    { typography: '{typography.subhead}', height: '44px', padding: '0 {spacing.12}' }
  button-small:
    {
      typography: '{typography.subhead}',
      height: '36px',
      padding: '0 {spacing.16}',
      iconSize: icon-md,
      iconGap: '{spacing.8}',
    }
  # Stroke width of the outline ring on the secondary, primary outline and outlined destructive
  # buttons. Each entry names the ring colour in borderColor (outline-* on secondary, primary-* on
  # primary outline, error-fg-* on destructive, divider-* when disabled); the ring is drawn inside
  # the pill. spinnerColor = the loading
  # spinner when it is not the label colour.
  button-outline-ring: { width: '1.5px' }
  button-secondary-light:
    {
      textColor: '{colors.text-light}',
      borderColor: '{colors.outline-light}',
      typography: '{typography.button}',
      rounded: '{rounded.full}',
      height: '52px',
      padding: '0 {spacing.24}',
    }
  button-secondary-pressed-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      textColor: '{colors.text-light}',
      borderColor: '{colors.outline-light}',
    }
  button-secondary-disabled-light:
    { textColor: '{colors.text-secondary-light}', borderColor: '{colors.divider-light}' }
  button-secondary-loading-light:
    {
      textColor: '{colors.text-light}',
      borderColor: '{colors.outline-light}',
      spinnerColor: '{colors.primary-text-light}',
    }
  button-secondary-dark:
    {
      textColor: '{colors.text-dark}',
      borderColor: '{colors.outline-dark}',
      typography: '{typography.button}',
      rounded: '{rounded.full}',
      height: '52px',
      padding: '0 {spacing.24}',
    }
  button-secondary-pressed-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.text-dark}',
      borderColor: '{colors.outline-dark}',
    }
  button-secondary-disabled-dark:
    { textColor: '{colors.text-secondary-dark}', borderColor: '{colors.divider-dark}' }
  button-secondary-loading-dark:
    {
      textColor: '{colors.text-dark}',
      borderColor: '{colors.outline-dark}',
      spinnerColor: '{colors.primary-text-dark}',
    }
  button-text-light:
    {
      textColor: '{colors.primary-text-light}',
      typography: '{typography.button}',
      rounded: '{rounded.full}',
      height: '44px',
      padding: '0 {spacing.12}',
    }
  button-text-pressed-light:
    { backgroundColor: '{colors.surface-2-light}', textColor: '{colors.primary-text-light}' }
  button-text-disabled-light: { textColor: '{colors.text-secondary-light}' }
  button-text-dark:
    {
      textColor: '{colors.primary-text-dark}',
      typography: '{typography.button}',
      rounded: '{rounded.full}',
      height: '44px',
      padding: '0 {spacing.12}',
    }
  button-text-pressed-dark:
    { backgroundColor: '{colors.surface-2-dark}', textColor: '{colors.primary-text-dark}' }
  button-text-disabled-dark: { textColor: '{colors.text-secondary-dark}' }
  button-destructive-light:
    {
      textColor: '{colors.error-fg-light}',
      borderColor: '{colors.error-fg-light}',
      typography: '{typography.button}',
      rounded: '{rounded.full}',
      height: '44px',
      padding: '0 {spacing.20}',
    }
  button-destructive-pressed-light:
    {
      backgroundColor: '{colors.error-bg-light}',
      textColor: '{colors.error-fg-light}',
      borderColor: '{colors.error-fg-light}',
    }
  button-destructive-disabled-light:
    { textColor: '{colors.text-secondary-light}', borderColor: '{colors.divider-light}' }
  button-destructive-dark:
    {
      textColor: '{colors.error-fg-dark}',
      borderColor: '{colors.error-fg-dark}',
      typography: '{typography.button}',
      rounded: '{rounded.full}',
      height: '44px',
      padding: '0 {spacing.20}',
    }
  button-destructive-pressed-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.error-fg-dark}',
      borderColor: '{colors.error-fg-dark}',
    }
  button-destructive-disabled-dark:
    { textColor: '{colors.text-secondary-dark}', borderColor: '{colors.divider-dark}' }
  button-destructive-filled-light:
    {
      backgroundColor: '{colors.error-fg-light}',
      textColor: '{colors.on-error-light}',
      typography: '{typography.button}',
      rounded: '{rounded.full}',
      height: '52px',
      padding: '0 {spacing.24}',
    }
  button-destructive-filled-pressed-light:
    {
      backgroundColor: '{colors.error-fg-light}',
      textColor: '{colors.on-error-light}',
      overlayColor: '{colors.pressed-overlay-strong-light}',
    }
  button-destructive-filled-disabled-light:
    {
      backgroundColor: '{colors.error-bg-light}',
      textColor: '{colors.error-fg-light}',
      typography: '{typography.button-disabled}',
    }
  button-destructive-filled-dark:
    {
      backgroundColor: '{colors.error-fg-dark}',
      textColor: '{colors.on-error-dark}',
      typography: '{typography.button}',
      rounded: '{rounded.full}',
      height: '52px',
      padding: '0 {spacing.24}',
    }
  button-destructive-filled-pressed-dark:
    {
      backgroundColor: '{colors.error-fg-dark}',
      textColor: '{colors.on-error-dark}',
      overlayColor: '{colors.pressed-overlay-strong-dark}',
    }
  button-destructive-filled-disabled-dark:
    {
      backgroundColor: '{colors.error-bg-dark}',
      textColor: '{colors.error-fg-dark}',
      typography: '{typography.button-disabled}',
    }
  # Primary outline: primary ring + primary-text label, Compact only (P10, SC06, SC07, C07 Confirm;
  # SC12 Set my own; SC05 Retry). Pressed and disabled are derived from secondary (not drawn).
  button-primary-outline-light:
    {
      textColor: '{colors.primary-text-light}',
      borderColor: '{colors.primary-light}',
      typography: '{typography.subhead}',
      rounded: '{rounded.full}',
      height: '44px',
      padding: '0 {spacing.16}',
    }
  button-primary-outline-pressed-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      textColor: '{colors.primary-text-light}',
      borderColor: '{colors.primary-light}',
    }
  button-primary-outline-disabled-light:
    { textColor: '{colors.text-secondary-light}', borderColor: '{colors.divider-light}' }
  button-primary-outline-dark:
    {
      textColor: '{colors.primary-text-dark}',
      borderColor: '{colors.primary-dark}',
      typography: '{typography.subhead}',
      rounded: '{rounded.full}',
      height: '44px',
      padding: '0 {spacing.16}',
    }
  button-primary-outline-pressed-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.primary-text-dark}',
      borderColor: '{colors.primary-dark}',
    }
  button-primary-outline-disabled-dark:
    { textColor: '{colors.text-secondary-dark}', borderColor: '{colors.divider-dark}' }
  # Destructive text: error label, no fill or ring, trash icon md, Compact only (SC12 and C07
  # Delete). Pressed is derived from the outlined destructive, disabled from text (not drawn).
  button-destructive-text-light:
    {
      textColor: '{colors.error-fg-light}',
      typography: '{typography.subhead}',
      rounded: '{rounded.full}',
      height: '44px',
      padding: '0 10px',
    }
  button-destructive-text-pressed-light:
    { backgroundColor: '{colors.error-bg-light}', textColor: '{colors.error-fg-light}' }
  button-destructive-text-disabled-light: { textColor: '{colors.text-secondary-light}' }
  button-destructive-text-dark:
    {
      textColor: '{colors.error-fg-dark}',
      typography: '{typography.subhead}',
      rounded: '{rounded.full}',
      height: '44px',
      padding: '0 10px',
    }
  button-destructive-text-pressed-dark:
    { backgroundColor: '{colors.surface-2-dark}', textColor: '{colors.error-fg-dark}' }
  button-destructive-text-disabled-dark: { textColor: '{colors.text-secondary-dark}' }
  # Tonal: Linen (surface-2) fill + text label, for equal-weight consent pairs and quiet actions
  # (SE1 Use my selfie / Use a generic face at 52; C04 offline Try again at 48; TR1 and C09
  # Not now / Allow at Compact). Pressed is derived from the icon button (divider), disabled
  # from the disabled rule (surface-2 + text-secondary); neither is drawn.
  button-tonal-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      textColor: '{colors.text-light}',
      typography: '{typography.button}',
      rounded: '{rounded.full}',
      height: '52px',
      padding: '0 {spacing.20}',
    }
  button-tonal-pressed-light:
    { backgroundColor: '{colors.divider-light}', textColor: '{colors.text-light}' }
  button-tonal-disabled-light:
    { backgroundColor: '{colors.surface-2-light}', textColor: '{colors.text-secondary-light}' }
  button-tonal-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.text-dark}',
      typography: '{typography.button}',
      rounded: '{rounded.full}',
      height: '52px',
      padding: '0 {spacing.20}',
    }
  button-tonal-pressed-dark:
    { backgroundColor: '{colors.divider-dark}', textColor: '{colors.text-dark}' }
  button-tonal-disabled-dark:
    { backgroundColor: '{colors.surface-2-dark}', textColor: '{colors.text-secondary-dark}' }
  # Destructive tonal: error-bg fill + error label in light, surface-2 + error label in dark (C09
  # Reset, step 1 of 2 of a reset). Large, as the overlay rule lifts C09's 44 dialog actions to 52.
  # Pressed is derived from the filled destructive (strong overlay), disabled from the disabled
  # rule (surface-2 + text-secondary); neither is drawn.
  button-destructive-tonal-light:
    {
      backgroundColor: '{colors.error-bg-light}',
      textColor: '{colors.error-fg-light}',
      typography: '{typography.button}',
      rounded: '{rounded.full}',
      height: '52px',
      padding: '0 {spacing.24}',
    }
  button-destructive-tonal-pressed-light:
    {
      backgroundColor: '{colors.error-bg-light}',
      textColor: '{colors.error-fg-light}',
      overlayColor: '{colors.pressed-overlay-strong-light}',
    }
  button-destructive-tonal-disabled-light:
    { backgroundColor: '{colors.surface-2-light}', textColor: '{colors.text-secondary-light}' }
  button-destructive-tonal-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.error-fg-dark}',
      typography: '{typography.button}',
      rounded: '{rounded.full}',
      height: '52px',
      padding: '0 {spacing.24}',
    }
  button-destructive-tonal-pressed-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.error-fg-dark}',
      overlayColor: '{colors.pressed-overlay-strong-dark}',
    }
  button-destructive-tonal-disabled-dark:
    { backgroundColor: '{colors.surface-2-dark}', textColor: '{colors.text-secondary-dark}' }
  button-icon-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      textColor: '{colors.text-light}',
      rounded: '{rounded.full}',
      size: '44px',
    }
  button-icon-pressed-light:
    { backgroundColor: '{colors.divider-light}', textColor: '{colors.text-light}' }
  button-icon-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.text-dark}',
      rounded: '{rounded.full}',
      size: '44px',
    }
  button-icon-pressed-dark:
    { backgroundColor: '{colors.divider-dark}', textColor: '{colors.text-dark}' }
  button-action-selected-light:
    {
      backgroundColor: '{colors.active-pill-light}',
      textColor: '{colors.primary-text-light}',
      typography: '{typography.caption-strong}',
      height: '56px',
      width: '48px',
    }
  button-action-selected-dark:
    {
      backgroundColor: '{colors.active-pill-dark}',
      textColor: '{colors.primary-text-dark}',
      typography: '{typography.caption-strong}',
      height: '56px',
      width: '48px',
    }
  button-capture-light:
    {
      backgroundColor: '{colors.primary-light}',
      textColor: '{colors.on-primary-light}',
      rounded: '{rounded.full}',
      size: '56px',
    }
  button-capture-pressed-light:
    { backgroundColor: '{colors.primary-pressed-light}', textColor: '{colors.on-primary-light}' }
  button-capture-dark:
    {
      backgroundColor: '{colors.primary-dark}',
      textColor: '{colors.on-primary-dark}',
      rounded: '{rounded.full}',
      size: '56px',
    }
  button-capture-pressed-dark:
    { backgroundColor: '{colors.primary-pressed-dark}', textColor: '{colors.on-primary-dark}' }
  # C02 Icons: the icon scale, six named steps (owner 2026-10-21; glyphs:
  # .impeccable/components/icon.yaml). Every icon the screens draw snaps to the nearest step
  # (DESIGN.md "Icons (C02)" lists where each use lands). strokeWidth is in viewBox units (the 24
  # grid), so the drawn width is strokeWidth x size / 24; each is measured from the screens at that
  # step. The size is at the default text size: icons grow with the user's text size. No colour:
  # the host's foreground tints.
  icon-xs: { size: '12px', strokeWidth: 2.2 }
  icon-sm: { size: '16px', strokeWidth: 1.7 }
  icon-md: { size: '20px', strokeWidth: 1.7 }
  icon-lg: { size: '24px', strokeWidth: 1.7 }
  icon-xl: { size: '32px', strokeWidth: 1.7 }
  icon-hero: { size: '56px', strokeWidth: 1.7 }
  # C03 Chips and tags. The chip-* entries style AppChip (.impeccable/components/chip.yaml), the
  # tappable chips; the tags, pills and badges after them are not chips (R4: chips act, tags label,
  # badges flag).
  # Shared chip size entries: the heights 32 (compact), 34 (small), 36 (medium) and 40 (large) and
  # their icon slots: leading (iconSize, iconGap) and trailing (trailingIconSize, trailingIconGap;
  # proposed grammar G3 in .impeccable/components/README.md). The slot follows the size: sm beside
  # the 13/18 and 14/18 labels, md beside the 15/20 labels, the trailing chevron and pencil xs at 32
  # and 34 ("Icons (C02)"). A variant entry that names its own slot value wins (G6: the group and
  # sort chip's gap 6 at 36). medium also holds the 36 add chip's label, height and padding (SC06
  # Save filter). Gap 6 is off the spacing scale.
  chip-compact:
    { iconSize: icon-sm, iconGap: '6px', trailingIconSize: icon-xs, trailingIconGap: '6px' }
  chip-small:
    { iconSize: icon-sm, iconGap: '6px', trailingIconSize: icon-xs, trailingIconGap: '6px' }
  chip-medium:
    {
      typography: '{typography.label-md}',
      height: '36px',
      padding: '0 14px 0 10px',
      iconSize: icon-sm,
      iconGap: '{spacing.4}',
      trailingIconSize: icon-sm,
      trailingIconGap: '{spacing.4}',
    }
  chip-large: { iconSize: icon-md, iconGap: '6px' }
  # Stroke width of the ring drawn inside the outlined chips (choice, filter, filter menu, swatch,
  # group and sort, never-suggest, soft-dislike, add, the light snow condition chip). Each entry
  # names the ring colour in borderColor; a selected chip draws no ring, so its ring is written in
  # its fill colour. An entry's own borderWidth wins (G5): the never-suggest pressed ring is 2 px and
  # the override ring 1.5 px. iconColor and trailingIconColor tint an icon that is not the label
  # colour (reason, never-suggest, override). <part>Typography, <part>Color and <part>Gap style a
  # second text run (G12: prefix, detail); swatch* style the colour swatch (G12).
  chip-outline-ring: { width: '1px' }
  chip-weather-light:
    {
      backgroundColor: '{colors.accent-light}',
      textColor: '{colors.on-accent-light}',
      typography: '{typography.label-sm}',
      rounded: '{rounded.full}',
      height: '34px',
      padding: '0 14px 0 11px',
    }
  chip-weather-pressed-light:
    {
      backgroundColor: '{colors.accent-light}',
      textColor: '{colors.on-accent-light}',
      overlayColor: '{colors.pressed-overlay-light}',
    }
  chip-weather-dark:
    {
      backgroundColor: '{colors.accent-dark}',
      textColor: '{colors.on-accent-dark}',
      typography: '{typography.label-sm}',
      rounded: '{rounded.full}',
      height: '34px',
      padding: '0 14px 0 11px',
    }
  chip-weather-pressed-dark:
    {
      backgroundColor: '{colors.accent-dark}',
      textColor: '{colors.on-accent-dark}',
      overlayColor: '{colors.pressed-overlay-dark}',
    }
  chip-context-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      textColor: '{colors.text-light}',
      typography: '{typography.label-sm}',
      rounded: '{rounded.full}',
      height: '34px',
      padding: '0 14px 0 11px',
    }
  chip-context-pressed-light:
    { backgroundColor: '{colors.divider-light}', textColor: '{colors.text-light}' }
  chip-context-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.text-dark}',
      typography: '{typography.label-sm}',
      rounded: '{rounded.full}',
      height: '34px',
      padding: '0 14px 0 11px',
    }
  chip-context-pressed-dark:
    { backgroundColor: '{colors.divider-dark}', textColor: '{colors.text-dark}' }
  chip-reason-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      textColor: '{colors.text-light}',
      iconColor: '{colors.primary-text-light}',
      typography: '{typography.label-sm}',
      rounded: '{rounded.full}',
      height: '32px',
      padding: '0 {spacing.12} 0 10px',
    }
  chip-reason-pressed-light:
    { backgroundColor: '{colors.divider-light}', textColor: '{colors.text-light}' }
  # Expanded: the trailing chevron-up takes the end, so the end padding drops to 10.
  chip-reason-expanded-light:
    {
      backgroundColor: '{colors.primary-text-light}',
      textColor: '{colors.on-primary-light}',
      iconColor: '{colors.on-primary-light}',
      padding: '0 10px',
    }
  # Compound toggle states (G2): <toggle>-<interaction> applies after the toggle's own entry. A
  # pressed toggled chip keeps its fill under the pressed overlay, as the filled weather chip
  # presses; derived, not drawn.
  chip-reason-expanded-pressed-light: { overlayColor: '{colors.pressed-overlay-light}' }
  chip-reason-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.text-dark}',
      iconColor: '{colors.primary-text-dark}',
      typography: '{typography.label-sm}',
      rounded: '{rounded.full}',
      height: '32px',
      padding: '0 {spacing.12} 0 10px',
    }
  chip-reason-pressed-dark:
    { backgroundColor: '{colors.divider-dark}', textColor: '{colors.text-dark}' }
  chip-reason-expanded-dark:
    {
      backgroundColor: '{colors.primary-text-dark}',
      textColor: '{colors.on-primary-dark}',
      iconColor: '{colors.on-primary-dark}',
      padding: '0 10px',
    }
  chip-reason-expanded-pressed-dark: { overlayColor: '{colors.pressed-overlay-dark}' }
  # Choice and filter: selected adds the check at the start, so the start padding drops to 10.
  # Disabled is surface-2 in light and surface in dark, as C03 draws it. Selected + disabled is
  # derived (not drawn): the disabled colours, and the check stays.
  chip-choice-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      borderColor: '{colors.outline-light}',
      typography: '{typography.subhead-medium}',
      rounded: '{rounded.full}',
      height: '40px',
      padding: '0 14px',
    }
  chip-choice-pressed-light:
    { backgroundColor: '{colors.surface-2-light}', textColor: '{colors.text-light}' }
  chip-choice-disabled-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      textColor: '{colors.text-secondary-light}',
      borderColor: '{colors.divider-light}',
    }
  chip-choice-selected-light:
    {
      backgroundColor: '{colors.primary-text-light}',
      textColor: '{colors.on-primary-light}',
      borderColor: '{colors.primary-text-light}',
      typography: '{typography.subhead}',
      padding: '0 14px 0 10px',
    }
  chip-choice-selected-pressed-light: { overlayColor: '{colors.pressed-overlay-light}' }
  chip-choice-selected-disabled-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      textColor: '{colors.text-secondary-light}',
      borderColor: '{colors.divider-light}',
    }
  chip-choice-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      borderColor: '{colors.outline-dark}',
      typography: '{typography.subhead-medium}',
      rounded: '{rounded.full}',
      height: '40px',
      padding: '0 14px',
    }
  chip-choice-pressed-dark:
    { backgroundColor: '{colors.surface-2-dark}', textColor: '{colors.text-dark}' }
  chip-choice-disabled-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-secondary-dark}',
      borderColor: '{colors.divider-dark}',
    }
  chip-choice-selected-dark:
    {
      backgroundColor: '{colors.primary-text-dark}',
      textColor: '{colors.on-primary-dark}',
      borderColor: '{colors.primary-text-dark}',
      typography: '{typography.subhead}',
      padding: '0 14px 0 10px',
    }
  chip-choice-selected-pressed-dark: { overlayColor: '{colors.pressed-overlay-dark}' }
  chip-choice-selected-disabled-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-secondary-dark}',
      borderColor: '{colors.divider-dark}',
    }
  # Filter: the count is the detail part, "· 12" in 14/500 text-secondary, 4 after the label
  # (C03 "With count"). On the selected fill it takes the label colour (derived, not drawn).
  chip-filter-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      borderColor: '{colors.outline-light}',
      detailColor: '{colors.text-secondary-light}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 14px',
      detailTypography: '{typography.label-md-medium}',
      detailGap: '{spacing.4}',
    }
  chip-filter-pressed-light:
    { backgroundColor: '{colors.surface-2-light}', textColor: '{colors.text-light}' }
  chip-filter-disabled-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      textColor: '{colors.text-secondary-light}',
      borderColor: '{colors.divider-light}',
    }
  chip-filter-selected-light:
    {
      backgroundColor: '{colors.primary-text-light}',
      textColor: '{colors.on-primary-light}',
      borderColor: '{colors.primary-text-light}',
      detailColor: '{colors.on-primary-light}',
      padding: '0 14px 0 10px',
    }
  chip-filter-selected-pressed-light: { overlayColor: '{colors.pressed-overlay-light}' }
  chip-filter-selected-disabled-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      textColor: '{colors.text-secondary-light}',
      borderColor: '{colors.divider-light}',
      detailColor: '{colors.text-secondary-light}',
    }
  chip-filter-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      borderColor: '{colors.outline-dark}',
      detailColor: '{colors.text-secondary-dark}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 14px',
      detailTypography: '{typography.label-md-medium}',
      detailGap: '{spacing.4}',
    }
  chip-filter-pressed-dark:
    { backgroundColor: '{colors.surface-2-dark}', textColor: '{colors.text-dark}' }
  chip-filter-disabled-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-secondary-dark}',
      borderColor: '{colors.divider-dark}',
    }
  chip-filter-selected-dark:
    {
      backgroundColor: '{colors.primary-text-dark}',
      textColor: '{colors.on-primary-dark}',
      borderColor: '{colors.primary-text-dark}',
      detailColor: '{colors.on-primary-dark}',
      padding: '0 14px 0 10px',
    }
  chip-filter-selected-pressed-dark: { overlayColor: '{colors.pressed-overlay-dark}' }
  chip-filter-selected-disabled-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-secondary-dark}',
      borderColor: '{colors.divider-dark}',
      detailColor: '{colors.text-secondary-dark}',
    }
  # Filter menu: the filter chip that opens a list (C03 Dropdown; SC06 More, Brand, Tags; SC09
  # More), with a trailing chevron-down, so the end padding is 10; selected = a value is chosen
  # ("Season: Autumn"), check at the start and chevron at the end. Pressed is derived from the
  # filter chip (not drawn).
  chip-filter-menu-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      borderColor: '{colors.outline-light}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 10px 0 14px',
    }
  chip-filter-menu-pressed-light:
    { backgroundColor: '{colors.surface-2-light}', textColor: '{colors.text-light}' }
  chip-filter-menu-selected-light:
    {
      backgroundColor: '{colors.primary-text-light}',
      textColor: '{colors.on-primary-light}',
      borderColor: '{colors.primary-text-light}',
      padding: '0 10px',
    }
  chip-filter-menu-selected-pressed-light: { overlayColor: '{colors.pressed-overlay-light}' }
  chip-filter-menu-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      borderColor: '{colors.outline-dark}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 10px 0 14px',
    }
  chip-filter-menu-pressed-dark:
    { backgroundColor: '{colors.surface-2-dark}', textColor: '{colors.text-dark}' }
  chip-filter-menu-selected-dark:
    {
      backgroundColor: '{colors.primary-text-dark}',
      textColor: '{colors.on-primary-dark}',
      borderColor: '{colors.primary-text-dark}',
      padding: '0 10px',
    }
  chip-filter-menu-selected-pressed-dark: { overlayColor: '{colors.pressed-overlay-dark}' }
  # Swatch: the choice chip with a 16 colour swatch before the label (C03; SC06 Colour, P03). The
  # swatch colour is runtime closet data (the color prop), never a token. Default 0 14 0 12 with
  # gap 8 to the label; an inside 1 px edge in outline when the swatch's contrast with the chip fill
  # is below swatchEdgeMinContrast (C03 rings Ecru in light, Olive and Black in dark). Selected:
  # check, then the swatch ringed 1.5 in surface, gaps 6. Disabled: a 1 px divider ring 1.5 off the
  # swatch. Pressed is surface-2, as the choice chip.
  chip-swatch-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      borderColor: '{colors.outline-light}',
      swatchEdgeColor: '{colors.outline-light}',
      typography: '{typography.subhead-medium}',
      rounded: '{rounded.full}',
      height: '40px',
      padding: '0 14px 0 {spacing.12}',
      swatchSize: '16px',
      swatchGap: '{spacing.8}',
      swatchEdgeWidth: '1px',
      swatchEdgeMinContrast: 3,
    }
  chip-swatch-pressed-light:
    { backgroundColor: '{colors.surface-2-light}', textColor: '{colors.text-light}' }
  chip-swatch-disabled-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      textColor: '{colors.text-secondary-light}',
      borderColor: '{colors.divider-light}',
      swatchRingColor: '{colors.divider-light}',
      swatchRingWidth: '1px',
      swatchRingGap: '1.5px',
    }
  chip-swatch-selected-light:
    {
      backgroundColor: '{colors.primary-text-light}',
      textColor: '{colors.on-primary-light}',
      borderColor: '{colors.primary-text-light}',
      swatchRingColor: '{colors.surface-light}',
      typography: '{typography.subhead}',
      padding: '0 14px 0 10px',
      swatchGap: '6px',
      swatchRingWidth: '1.5px',
      swatchRingGap: '0px',
    }
  chip-swatch-selected-pressed-light: { overlayColor: '{colors.pressed-overlay-light}' }
  chip-swatch-selected-disabled-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      textColor: '{colors.text-secondary-light}',
      borderColor: '{colors.divider-light}',
      swatchRingColor: '{colors.divider-light}',
      swatchRingWidth: '1px',
      swatchRingGap: '1.5px',
    }
  chip-swatch-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      borderColor: '{colors.outline-dark}',
      swatchEdgeColor: '{colors.outline-dark}',
      typography: '{typography.subhead-medium}',
      rounded: '{rounded.full}',
      height: '40px',
      padding: '0 14px 0 {spacing.12}',
      swatchSize: '16px',
      swatchGap: '{spacing.8}',
      swatchEdgeWidth: '1px',
      swatchEdgeMinContrast: 3,
    }
  chip-swatch-pressed-dark:
    { backgroundColor: '{colors.surface-2-dark}', textColor: '{colors.text-dark}' }
  chip-swatch-disabled-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-secondary-dark}',
      borderColor: '{colors.divider-dark}',
      swatchRingColor: '{colors.divider-dark}',
      swatchRingWidth: '1px',
      swatchRingGap: '1.5px',
    }
  chip-swatch-selected-dark:
    {
      backgroundColor: '{colors.primary-text-dark}',
      textColor: '{colors.on-primary-dark}',
      borderColor: '{colors.primary-text-dark}',
      swatchRingColor: '{colors.surface-dark}',
      typography: '{typography.subhead}',
      padding: '0 14px 0 10px',
      swatchGap: '6px',
      swatchRingWidth: '1.5px',
      swatchRingGap: '0px',
    }
  chip-swatch-selected-pressed-dark: { overlayColor: '{colors.pressed-overlay-dark}' }
  chip-swatch-selected-disabled-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-secondary-dark}',
      borderColor: '{colors.divider-dark}',
      swatchRingColor: '{colors.divider-dark}',
      swatchRingWidth: '1px',
      swatchRingGap: '1.5px',
    }
  # Group and sort (C05 "Group and sort"; SC06, P09): the prefix part ("Group:", "Sort:") in
  # 14/400 text-secondary, the value as the label at 600, the group or sort icon and a trailing
  # chevron-down, gaps 6, 0 12 0 10, surface + divider ring. Pressed is surface-2 (derived from the
  # outlined chips; not drawn). Its gaps of 6 at 36 win over chip-medium's 4 (G6).
  chip-group-sort-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      borderColor: '{colors.divider-light}',
      prefixColor: '{colors.text-secondary-light}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 {spacing.12} 0 10px',
      iconGap: '6px',
      trailingIconGap: '6px',
      prefixTypography: '{typography.label-md-normal}',
      prefixGap: '6px',
    }
  chip-group-sort-pressed-light: { backgroundColor: '{colors.surface-2-light}' }
  chip-group-sort-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      borderColor: '{colors.divider-dark}',
      prefixColor: '{colors.text-secondary-dark}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 {spacing.12} 0 10px',
      iconGap: '6px',
      trailingIconGap: '6px',
      prefixTypography: '{typography.label-md-normal}',
      prefixGap: '6px',
    }
  chip-group-sort-pressed-dark: { backgroundColor: '{colors.surface-2-dark}' }
  # Override (C03): the user's own context setting beside the weather chip, surface + 1.5
  # primary-text ring, the caller's icon in primary-text, the detail part "· your setting" in
  # 13/500 primary-text and a trailing pencil xs in primary-text, 0 11. Pressed is surface-2
  # (derived from the outlined chips; not drawn).
  chip-override-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      borderColor: '{colors.primary-text-light}',
      iconColor: '{colors.primary-text-light}',
      trailingIconColor: '{colors.primary-text-light}',
      detailColor: '{colors.primary-text-light}',
      borderWidth: '1.5px',
      typography: '{typography.label-sm}',
      rounded: '{rounded.full}',
      height: '34px',
      padding: '0 11px',
      detailTypography: '{typography.label-sm-medium}',
      detailGap: '6px',
    }
  chip-override-pressed-light: { backgroundColor: '{colors.surface-2-light}' }
  chip-override-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      borderColor: '{colors.primary-text-dark}',
      iconColor: '{colors.primary-text-dark}',
      trailingIconColor: '{colors.primary-text-dark}',
      detailColor: '{colors.primary-text-dark}',
      borderWidth: '1.5px',
      typography: '{typography.label-sm}',
      rounded: '{rounded.full}',
      height: '34px',
      padding: '0 11px',
      detailTypography: '{typography.label-sm-medium}',
      detailGap: '6px',
    }
  chip-override-pressed-dark: { backgroundColor: '{colors.surface-2-dark}' }
  # Never-suggest: the slash icon in the error colour; pressed draws a 2 px ring (dark: divider
  # fill).
  chip-never-suggest-light:
    {
      backgroundColor: '{colors.error-bg-light}',
      textColor: '{colors.text-light}',
      borderColor: '{colors.error-fg-light}',
      iconColor: '{colors.error-fg-light}',
      typography: '{typography.subhead}',
      rounded: '{rounded.6}',
      height: '40px',
      padding: '0 14px 0 10px',
    }
  chip-never-suggest-pressed-light:
    { backgroundColor: '{colors.error-bg-light}', borderWidth: '2px' }
  chip-never-suggest-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.text-dark}',
      borderColor: '{colors.error-fg-dark}',
      iconColor: '{colors.error-fg-dark}',
      typography: '{typography.subhead}',
      rounded: '{rounded.6}',
      height: '40px',
      padding: '0 14px 0 10px',
    }
  chip-never-suggest-pressed-dark: { backgroundColor: '{colors.divider-dark}', borderWidth: '2px' }
  # Soft-dislike: pressed darkens the fill one step, rings it in outline and inks the label.
  chip-soft-dislike-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      textColor: '{colors.text-secondary-light}',
      borderColor: '{colors.divider-light}',
      typography: '{typography.subhead-medium}',
      rounded: '{rounded.full}',
      height: '40px',
      padding: '0 14px 0 10px',
    }
  chip-soft-dislike-pressed-light:
    {
      backgroundColor: '{colors.divider-light}',
      textColor: '{colors.text-light}',
      borderColor: '{colors.outline-light}',
    }
  chip-soft-dislike-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-secondary-dark}',
      borderColor: '{colors.divider-dark}',
      typography: '{typography.subhead-medium}',
      rounded: '{rounded.full}',
      height: '40px',
      padding: '0 14px 0 10px',
    }
  chip-soft-dislike-pressed-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.text-dark}',
      borderColor: '{colors.outline-dark}',
    }
  # Add chip: no fill, outline ring, primary-text label and the add icon, closing a row of chips
  # (C03; SC03, SC12, P03 at 40; SC06 Save filter at 36, chip-medium). Pill beside soft dislikes and
  # filters, radius 6 beside never-suggest chips. Pressed is derived from the outlined chips
  # (surface-2 fill); not drawn.
  chip-add-light:
    {
      textColor: '{colors.primary-text-light}',
      borderColor: '{colors.outline-light}',
      typography: '{typography.subhead}',
      rounded: '{rounded.full}',
      height: '40px',
      padding: '0 14px 0 10px',
    }
  chip-add-pressed-light:
    { backgroundColor: '{colors.surface-2-light}', textColor: '{colors.primary-text-light}' }
  chip-add-dark:
    {
      textColor: '{colors.primary-text-dark}',
      borderColor: '{colors.outline-dark}',
      typography: '{typography.subhead}',
      rounded: '{rounded.full}',
      height: '40px',
      padding: '0 14px 0 10px',
    }
  chip-add-pressed-dark:
    { backgroundColor: '{colors.surface-2-dark}', textColor: '{colors.primary-text-dark}' }
  chip-never-suggest-add-light:
    {
      textColor: '{colors.primary-text-light}',
      borderColor: '{colors.outline-light}',
      typography: '{typography.subhead}',
      rounded: '{rounded.6}',
      height: '40px',
      padding: '0 14px 0 10px',
    }
  chip-never-suggest-add-pressed-light:
    { backgroundColor: '{colors.surface-2-light}', textColor: '{colors.primary-text-light}' }
  chip-never-suggest-add-dark:
    {
      textColor: '{colors.primary-text-dark}',
      borderColor: '{colors.outline-dark}',
      typography: '{typography.subhead}',
      rounded: '{rounded.6}',
      height: '40px',
      padding: '0 14px 0 10px',
    }
  chip-never-suggest-add-pressed-dark:
    { backgroundColor: '{colors.surface-2-dark}', textColor: '{colors.primary-text-dark}' }
  # Condition chips (C03, drawn 2026-10-21, owner: "Add condition chips as well in the canvas"):
  # 36, 0 14 0 10, label-md, the condition glyph sm with gap 4 (chip-medium), fg / bg per theme.
  # Pressed lays pressed-overlay-* over the fill, as the weather chip presses. Snow draws a 1 px
  # condition-snow-ring-light ring in light only; its dark ring is the fill colour, so none shows.
  chip-condition-sunny-light:
    {
      backgroundColor: '{colors.condition-sunny-bg-light}',
      textColor: '{colors.condition-sunny-fg-light}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 14px 0 10px',
    }
  chip-condition-sunny-pressed-light: { overlayColor: '{colors.pressed-overlay-light}' }
  chip-condition-sunny-dark:
    {
      backgroundColor: '{colors.condition-sunny-bg-dark}',
      textColor: '{colors.condition-sunny-fg-dark}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 14px 0 10px',
    }
  chip-condition-sunny-pressed-dark: { overlayColor: '{colors.pressed-overlay-dark}' }
  chip-condition-rain-light:
    {
      backgroundColor: '{colors.condition-rain-bg-light}',
      textColor: '{colors.condition-rain-fg-light}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 14px 0 10px',
    }
  chip-condition-rain-pressed-light: { overlayColor: '{colors.pressed-overlay-light}' }
  chip-condition-rain-dark:
    {
      backgroundColor: '{colors.condition-rain-bg-dark}',
      textColor: '{colors.condition-rain-fg-dark}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 14px 0 10px',
    }
  chip-condition-rain-pressed-dark: { overlayColor: '{colors.pressed-overlay-dark}' }
  chip-condition-cold-light:
    {
      backgroundColor: '{colors.condition-cold-bg-light}',
      textColor: '{colors.condition-cold-fg-light}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 14px 0 10px',
    }
  chip-condition-cold-pressed-light: { overlayColor: '{colors.pressed-overlay-light}' }
  chip-condition-cold-dark:
    {
      backgroundColor: '{colors.condition-cold-bg-dark}',
      textColor: '{colors.condition-cold-fg-dark}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 14px 0 10px',
    }
  chip-condition-cold-pressed-dark: { overlayColor: '{colors.pressed-overlay-dark}' }
  chip-condition-hot-light:
    {
      backgroundColor: '{colors.condition-hot-bg-light}',
      textColor: '{colors.condition-hot-fg-light}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 14px 0 10px',
    }
  chip-condition-hot-pressed-light: { overlayColor: '{colors.pressed-overlay-light}' }
  chip-condition-hot-dark:
    {
      backgroundColor: '{colors.condition-hot-bg-dark}',
      textColor: '{colors.condition-hot-fg-dark}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 14px 0 10px',
    }
  chip-condition-hot-pressed-dark: { overlayColor: '{colors.pressed-overlay-dark}' }
  chip-condition-windy-light:
    {
      backgroundColor: '{colors.condition-windy-bg-light}',
      textColor: '{colors.condition-windy-fg-light}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 14px 0 10px',
    }
  chip-condition-windy-pressed-light: { overlayColor: '{colors.pressed-overlay-light}' }
  chip-condition-windy-dark:
    {
      backgroundColor: '{colors.condition-windy-bg-dark}',
      textColor: '{colors.condition-windy-fg-dark}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 14px 0 10px',
    }
  chip-condition-windy-pressed-dark: { overlayColor: '{colors.pressed-overlay-dark}' }
  chip-condition-snow-light:
    {
      backgroundColor: '{colors.condition-snow-bg-light}',
      textColor: '{colors.condition-snow-fg-light}',
      borderColor: '{colors.condition-snow-ring-light}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 14px 0 10px',
    }
  chip-condition-snow-pressed-light: { overlayColor: '{colors.pressed-overlay-light}' }
  chip-condition-snow-dark:
    {
      backgroundColor: '{colors.condition-snow-bg-dark}',
      textColor: '{colors.condition-snow-fg-dark}',
      borderColor: '{colors.condition-snow-bg-dark}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 14px 0 10px',
    }
  chip-condition-snow-pressed-dark: { overlayColor: '{colors.pressed-overlay-dark}' }
  chip-condition-evening-light:
    {
      backgroundColor: '{colors.condition-evening-bg-light}',
      textColor: '{colors.condition-evening-fg-light}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 14px 0 10px',
    }
  chip-condition-evening-pressed-light: { overlayColor: '{colors.pressed-overlay-light}' }
  chip-condition-evening-dark:
    {
      backgroundColor: '{colors.condition-evening-bg-dark}',
      textColor: '{colors.condition-evening-fg-dark}',
      typography: '{typography.label-md}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 14px 0 10px',
    }
  chip-condition-evening-pressed-dark: { overlayColor: '{colors.pressed-overlay-dark}' }
  # C03 tags (AppTag, .impeccable/components/tag.yaml): no tap and no pressed state (R4). 24 high,
  # 12/600, radius full; the leading icon xs with gap 4 (tag-regular). tag-plan is the plan tags'
  # shared size entry (label, height, padding). A ring is 1 px (tag-outline-ring), dashed where the
  # entry names borderDash (G13: the provisional tag). The new tag draws a 6 px dot in its label
  # colour (dot part, G12).
  tag-regular: { iconSize: icon-xs, iconGap: '{spacing.4}' }
  tag-outline-ring: { width: '1px' }
  tag-plan:
    {
      typography: '{typography.caption-strong}',
      rounded: '{rounded.full}',
      height: '24px',
      padding: '0 10px',
    }
  # Plan tags (C03; SC14, SC15): Free surface-2, Essentials info, Plus success, Pro primary. In dark,
  # Essentials and Plus are surface + a 1 px ring in the status fg; the light ring is the fill
  # colour, so none shows. The name carries the meaning, not the colour.
  tag-plan-free-light:
    { backgroundColor: '{colors.surface-2-light}', textColor: '{colors.text-light}' }
  tag-plan-free-dark:
    { backgroundColor: '{colors.surface-2-dark}', textColor: '{colors.text-dark}' }
  tag-plan-essentials-light:
    {
      backgroundColor: '{colors.info-bg-light}',
      textColor: '{colors.info-fg-light}',
      borderColor: '{colors.info-bg-light}',
    }
  tag-plan-essentials-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.info-fg-dark}',
      borderColor: '{colors.info-fg-dark}',
    }
  tag-plan-plus-light:
    {
      backgroundColor: '{colors.success-bg-light}',
      textColor: '{colors.success-fg-light}',
      borderColor: '{colors.success-bg-light}',
    }
  tag-plan-plus-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.success-fg-dark}',
      borderColor: '{colors.success-fg-dark}',
    }
  tag-plan-pro-light:
    { backgroundColor: '{colors.primary-light}', textColor: '{colors.on-primary-light}' }
  tag-plan-pro-dark:
    { backgroundColor: '{colors.primary-dark}', textColor: '{colors.on-primary-dark}' }
  # Status tags (C03; SC12 Later): 0 10 0 7 with the icon xs. Lock reads "Needs Plus"; Later is a
  # text-secondary ring; Provisional is warning with a dashed ring and stays until the user confirms;
  # New is info with the dot (dark: surface-2).
  tag-lock-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      textColor: '{colors.text-light}',
      typography: '{typography.caption-strong}',
      rounded: '{rounded.full}',
      height: '24px',
      padding: '0 10px 0 7px',
    }
  tag-lock-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.text-dark}',
      typography: '{typography.caption-strong}',
      rounded: '{rounded.full}',
      height: '24px',
      padding: '0 10px 0 7px',
    }
  tag-later-light:
    {
      textColor: '{colors.text-secondary-light}',
      borderColor: '{colors.text-secondary-light}',
      typography: '{typography.caption-strong}',
      rounded: '{rounded.full}',
      height: '24px',
      padding: '0 10px 0 7px',
    }
  tag-later-dark:
    {
      textColor: '{colors.text-secondary-dark}',
      borderColor: '{colors.text-secondary-dark}',
      typography: '{typography.caption-strong}',
      rounded: '{rounded.full}',
      height: '24px',
      padding: '0 10px 0 7px',
    }
  tag-provisional-light:
    {
      backgroundColor: '{colors.warning-bg-light}',
      textColor: '{colors.warning-fg-light}',
      borderColor: '{colors.warning-fg-light}',
      typography: '{typography.caption-strong}',
      rounded: '{rounded.full}',
      height: '24px',
      padding: '0 10px 0 7px',
      borderDash: '3px',
    }
  tag-provisional-dark:
    {
      backgroundColor: '{colors.warning-bg-dark}',
      textColor: '{colors.warning-fg-dark}',
      borderColor: '{colors.warning-fg-dark}',
      typography: '{typography.caption-strong}',
      rounded: '{rounded.full}',
      height: '24px',
      padding: '0 10px 0 7px',
      borderDash: '3px',
    }
  tag-new-light:
    {
      backgroundColor: '{colors.info-bg-light}',
      textColor: '{colors.info-fg-light}',
      typography: '{typography.caption-strong}',
      rounded: '{rounded.full}',
      height: '24px',
      padding: '0 10px 0 {spacing.8}',
      dotSize: '6px',
      dotGap: '5px',
    }
  tag-new-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.info-fg-dark}',
      typography: '{typography.caption-strong}',
      rounded: '{rounded.full}',
      height: '24px',
      padding: '0 10px 0 {spacing.8}',
      dotSize: '6px',
      dotGap: '5px',
    }
  # Availability tags (C07 item row; SC15 closet link): 0 8 with the icon xs. Available is success
  # with the check (dark: surface-2 + success fg, as C07 and SC15 draw it); unavailable is surface-2
  # / text-secondary with the caller's availability icon (laundry, packed, lent, repair).
  tag-available-light:
    {
      backgroundColor: '{colors.success-bg-light}',
      textColor: '{colors.success-fg-light}',
      typography: '{typography.caption-strong}',
      rounded: '{rounded.full}',
      height: '24px',
      padding: '0 {spacing.8}',
    }
  tag-available-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.success-fg-dark}',
      typography: '{typography.caption-strong}',
      rounded: '{rounded.full}',
      height: '24px',
      padding: '0 {spacing.8}',
    }
  tag-unavailable-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      textColor: '{colors.text-secondary-light}',
      typography: '{typography.caption-strong}',
      rounded: '{rounded.full}',
      height: '24px',
      padding: '0 {spacing.8}',
    }
  tag-unavailable-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.text-secondary-dark}',
      typography: '{typography.caption-strong}',
      rounded: '{rounded.full}',
      height: '24px',
      padding: '0 {spacing.8}',
    }
  # Kind tag (SC15 Discover card image): the content kind ("Trend", "Runway") in overline caps on
  # surface, 0 10, at the image's top-left.
  tag-kind-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      typography: '{typography.overline}',
      rounded: '{rounded.full}',
      height: '24px',
      padding: '0 10px',
    }
  tag-kind-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      typography: '{typography.overline}',
      rounded: '{rounded.full}',
      height: '24px',
      padding: '0 10px',
    }
  # Differs (C08 compare card): 18 high, 0 7, 11/600, accent / on-accent, beside a differing reason.
  tag-differs-light:
    {
      backgroundColor: '{colors.accent-light}',
      textColor: '{colors.on-accent-light}',
      typography: '{typography.badge}',
      rounded: '{rounded.full}',
      height: '18px',
      padding: '0 7px',
    }
  tag-differs-dark:
    {
      backgroundColor: '{colors.accent-dark}',
      textColor: '{colors.on-accent-dark}',
      typography: '{typography.badge}',
      rounded: '{rounded.full}',
      height: '18px',
      padding: '0 7px',
    }
  # C03 badges (AppBadge, .impeccable/components/badge.yaml): the count badge (dot 8, number 18)
  # sits on an icon or a tab with a 2 px ring outside it in the host's surface (outerRingWidth; the
  # colour is the hostSurface prop, G8, G12); the trial pill is 28 with a 1.5 ring
  # (badge-outline-ring) and the clock sm with gap 5 (badge-large).
  badge-large:
    {
      typography: '{typography.label-sm}',
      rounded: '{rounded.full}',
      height: '28px',
      padding: '0 {spacing.12} 0 9px',
      iconSize: icon-sm,
      iconGap: '5px',
    }
  badge-outline-ring: { width: '1.5px' }
  pill-trial-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      borderColor: '{colors.text-light}',
      typography: '{typography.label-sm}',
      rounded: '{rounded.full}',
      height: '28px',
      padding: '0 {spacing.12} 0 9px',
    }
  pill-trial-last-day-light:
    {
      backgroundColor: '{colors.warning-bg-light}',
      textColor: '{colors.warning-fg-light}',
      borderColor: '{colors.warning-fg-light}',
    }
  pill-trial-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      borderColor: '{colors.text-dark}',
      typography: '{typography.label-sm}',
      rounded: '{rounded.full}',
      height: '28px',
      padding: '0 {spacing.12} 0 9px',
    }
  pill-trial-last-day-dark:
    {
      backgroundColor: '{colors.warning-bg-dark}',
      textColor: '{colors.warning-fg-dark}',
      borderColor: '{colors.warning-fg-dark}',
    }
  badge-dot-light:
    {
      backgroundColor: '{colors.error-fg-light}',
      rounded: '{rounded.full}',
      size: '8px',
      outerRingWidth: '2px',
    }
  badge-dot-dark:
    {
      backgroundColor: '{colors.error-fg-dark}',
      rounded: '{rounded.full}',
      size: '8px',
      outerRingWidth: '2px',
    }
  badge-count-light:
    {
      backgroundColor: '{colors.error-fg-light}',
      textColor: '{colors.on-error-light}',
      typography: '{typography.badge-count}',
      rounded: '{rounded.full}',
      height: '18px',
      minWidth: '18px',
      padding: '0 5px',
      outerRingWidth: '2px',
    }
  badge-count-dark:
    {
      backgroundColor: '{colors.error-fg-dark}',
      textColor: '{colors.on-error-dark}',
      typography: '{typography.badge-count}',
      rounded: '{rounded.full}',
      height: '18px',
      minWidth: '18px',
      padding: '0 5px',
      outerRingWidth: '2px',
    }
  # Reason row (C03 "Expanded reason row"; SC08): the panel the expanded reason chip opens under
  # the chips. The sentence is the label (Callout); then the fact line (13/600) behind a 24 icon
  # disc in surface-2 with the icon sm in primary-text, gap 8; then the freshness line (Caption,
  # text-secondary). Padding 14 16, radius 16, surface + 1 px divider ring, lines 8 apart.
  reason-row-standard: { iconSize: icon-sm, iconGap: '{spacing.8}' }
  reason-row-outline-ring: { width: '1px' }
  reason-row-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      borderColor: '{colors.divider-light}',
      iconColor: '{colors.primary-text-light}',
      iconDiscColor: '{colors.surface-2-light}',
      factColor: '{colors.text-light}',
      freshnessColor: '{colors.text-secondary-light}',
      typography: '{typography.callout}',
      rounded: '{rounded.16}',
      padding: '14px {spacing.16}',
      lineGap: '{spacing.8}',
      iconDiscSize: '24px',
      factTypography: '{typography.label-sm}',
      freshnessTypography: '{typography.caption}',
    }
  reason-row-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      borderColor: '{colors.divider-dark}',
      iconColor: '{colors.primary-text-dark}',
      iconDiscColor: '{colors.surface-2-dark}',
      factColor: '{colors.text-dark}',
      freshnessColor: '{colors.text-secondary-dark}',
      typography: '{typography.callout}',
      rounded: '{rounded.16}',
      padding: '14px {spacing.16}',
      lineGap: '{spacing.8}',
      iconDiscSize: '24px',
      factTypography: '{typography.label-sm}',
      freshnessTypography: '{typography.caption}',
    }
  # C04 Status and feedback
  badge-tile-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      typography: '{typography.badge}',
      rounded: '{rounded.full}',
      height: '22px',
      padding: '0 {spacing.8} 0 6px',
    }
  badge-tile-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      typography: '{typography.badge}',
      rounded: '{rounded.full}',
      height: '22px',
      padding: '0 {spacing.8} 0 6px',
    }
  badge-provenance-light:
    {
      backgroundColor: '{colors.inverse-surface-light}',
      textColor: '{colors.on-inverse-light}',
      typography: '{typography.badge}',
      rounded: '{rounded.full}',
      height: '22px',
      padding: '0 {spacing.8} 0 6px',
    }
  badge-provenance-dark:
    {
      backgroundColor: '{colors.inverse-surface-dark}',
      textColor: '{colors.on-inverse-dark}',
      typography: '{typography.badge}',
      rounded: '{rounded.full}',
      height: '22px',
      padding: '0 {spacing.8} 0 6px',
    }
  label-confidence:
    { typography: '{typography.label-sm}', rounded: '{rounded.full}', height: '28px' }
  banner-info-light:
    {
      backgroundColor: '{colors.info-bg-light}',
      textColor: '{colors.text-light}',
      typography: '{typography.subhead}',
      rounded: '{rounded.16}',
      padding: '{spacing.12} {spacing.4} {spacing.12} 14px',
    }
  banner-success-light:
    {
      backgroundColor: '{colors.success-bg-light}',
      textColor: '{colors.text-light}',
      typography: '{typography.subhead}',
      rounded: '{rounded.16}',
      padding: '{spacing.12} {spacing.4} {spacing.12} 14px',
    }
  banner-warning-light:
    {
      backgroundColor: '{colors.warning-bg-light}',
      textColor: '{colors.text-light}',
      typography: '{typography.subhead}',
      rounded: '{rounded.16}',
      padding: '{spacing.12} {spacing.4} {spacing.12} 14px',
    }
  banner-error-light:
    {
      backgroundColor: '{colors.error-bg-light}',
      textColor: '{colors.text-light}',
      typography: '{typography.subhead}',
      rounded: '{rounded.16}',
      padding: '{spacing.12} {spacing.4} {spacing.12} 14px',
    }
  banner-offline-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      textColor: '{colors.text-light}',
      typography: '{typography.subhead}',
      rounded: '{rounded.16}',
      padding: '{spacing.12} {spacing.4} {spacing.12} 14px',
    }
  banner-stale-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      typography: '{typography.subhead}',
      rounded: '{rounded.16}',
      padding: '{spacing.12} {spacing.4} {spacing.12} 14px',
    }
  # Dark info, success, error and stale banners share one fill: surface-dark + divider ring (C04).
  # banner-dark is that shared fill (unpaired by design); each kind also has its own -dark twin.
  banner-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      typography: '{typography.subhead}',
      rounded: '{rounded.16}',
      padding: '{spacing.12} {spacing.4} {spacing.12} 14px',
    }
  banner-info-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      typography: '{typography.subhead}',
      rounded: '{rounded.16}',
      padding: '{spacing.12} {spacing.4} {spacing.12} 14px',
    }
  banner-success-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      typography: '{typography.subhead}',
      rounded: '{rounded.16}',
      padding: '{spacing.12} {spacing.4} {spacing.12} 14px',
    }
  banner-error-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      typography: '{typography.subhead}',
      rounded: '{rounded.16}',
      padding: '{spacing.12} {spacing.4} {spacing.12} 14px',
    }
  banner-stale-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      typography: '{typography.subhead}',
      rounded: '{rounded.16}',
      padding: '{spacing.12} {spacing.4} {spacing.12} 14px',
    }
  banner-warning-dark:
    {
      backgroundColor: '{colors.warning-bg-dark}',
      textColor: '{colors.text-dark}',
      typography: '{typography.subhead}',
      rounded: '{rounded.16}',
      padding: '{spacing.12} {spacing.4} {spacing.12} 14px',
    }
  banner-offline-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.text-dark}',
      typography: '{typography.subhead}',
      rounded: '{rounded.16}',
      padding: '{spacing.12} {spacing.4} {spacing.12} 14px',
    }
  snackbar-light:
    {
      backgroundColor: '{colors.inverse-surface-light}',
      textColor: '{colors.on-inverse-light}',
      typography: '{typography.subhead-medium}',
      rounded: '{rounded.16}',
      height: '56px',
      padding: '0 6px 0 {spacing.16}',
    }
  snackbar-dark:
    {
      backgroundColor: '{colors.inverse-surface-dark}',
      textColor: '{colors.on-inverse-dark}',
      typography: '{typography.subhead-medium}',
      rounded: '{rounded.16}',
      height: '56px',
      padding: '0 6px 0 {spacing.16}',
    }
  # Snackbar Undo action (text button inside the snackbar, C04), label in label-action (15/20 700).
  snackbar-action-light:
    {
      textColor: '{colors.inverse-primary-light}',
      typography: '{typography.label-action}',
      rounded: '{rounded.12}',
      height: '44px',
      padding: '0 14px',
    }
  snackbar-action-dark:
    {
      textColor: '{colors.inverse-primary-dark}',
      typography: '{typography.label-action}',
      rounded: '{rounded.12}',
      height: '44px',
      padding: '0 14px',
    }
  toast: { typography: '{typography.subhead-medium}', rounded: '{rounded.full}', height: '44px' }
  progress-track-light:
    { backgroundColor: '{colors.surface-2-light}', rounded: '{rounded.3}', height: '6px' }
  progress-fill-light:
    { backgroundColor: '{colors.primary-light}', rounded: '{rounded.3}', height: '6px' }
  progress-track-dark:
    { backgroundColor: '{colors.surface-2-dark}', rounded: '{rounded.3}', height: '6px' }
  progress-fill-dark:
    { backgroundColor: '{colors.primary-dark}', rounded: '{rounded.3}', height: '6px' }
  skeleton-block-light: { backgroundColor: '{colors.surface-2-light}' }
  skeleton-block-dark: { backgroundColor: '{colors.surface-2-dark}' }
  state-card:
    { typography: '{typography.callout}', rounded: '{rounded.24}', padding: '{spacing.20}' }
  # C05 Navigation
  tab-bar-light:
    {
      backgroundColor: '{colors.surface-light}',
      height: '78px',
      padding: '{spacing.8} {spacing.8} {spacing.20}',
    }
  tab-bar-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      height: '78px',
      padding: '{spacing.8} {spacing.8} {spacing.20}',
    }
  tab-item-active-light:
    {
      backgroundColor: '{colors.active-pill-light}',
      textColor: '{colors.primary-text-light}',
      typography: '{typography.caption-strong}',
      rounded: '{rounded.full}',
      height: '30px',
      width: '56px',
    }
  tab-item-active-dark:
    {
      backgroundColor: '{colors.active-pill-dark}',
      textColor: '{colors.primary-text-dark}',
      typography: '{typography.caption-strong}',
      rounded: '{rounded.full}',
      height: '30px',
      width: '56px',
    }
  tab-item-inactive-light:
    {
      textColor: '{colors.text-secondary-light}',
      typography: '{typography.caption}',
      width: '64px',
    }
  tab-item-inactive-dark:
    { textColor: '{colors.text-secondary-dark}', typography: '{typography.caption}', width: '64px' }
  badge-capture-queue-light:
    {
      backgroundColor: '{colors.accent-light}',
      textColor: '{colors.on-accent-light}',
      rounded: '{rounded.full}',
      height: '22px',
    }
  badge-capture-queue-dark:
    {
      backgroundColor: '{colors.accent-dark}',
      textColor: '{colors.on-accent-dark}',
      rounded: '{rounded.full}',
      height: '22px',
    }
  top-bar-large:
    { typography: '{typography.large-title-bar}', height: '72px', padding: '{spacing.8} 0 6px' }
  top-bar-compact-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      typography: '{typography.headline}',
      height: '52px',
    }
  top-bar-compact-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      typography: '{typography.headline}',
      height: '52px',
    }
  top-bar-standard: { typography: '{typography.headline}', height: '52px' }
  top-bar-modal: { typography: '{typography.headline}', height: '56px' }
  segmented-control-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      rounded: '{rounded.full}',
      height: '44px',
      padding: '{spacing.4}',
    }
  segmented-control-selected-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      typography: '{typography.subhead}',
      rounded: '{rounded.full}',
      height: '36px',
    }
  segmented-control-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      rounded: '{rounded.full}',
      height: '44px',
      padding: '{spacing.4}',
    }
  segmented-control-selected-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.text-dark}',
      typography: '{typography.subhead}',
      rounded: '{rounded.full}',
      height: '36px',
    }
  camera-mode-switch:
    {
      backgroundColor: '{colors.camera-track}',
      textColor: '{colors.camera-paper}',
      rounded: '{rounded.full}',
      height: '36px',
      padding: '0 18px',
    }
  camera-mode-selected-light:
    {
      backgroundColor: '{colors.camera-paper}',
      textColor: '{colors.camera-ink}',
      typography: '{typography.subhead}',
    }
  camera-mode-selected-dark:
    {
      backgroundColor: '{colors.camera-yellow}',
      textColor: '{colors.camera-ink}',
      typography: '{typography.subhead}',
    }
  # C06 Inputs and forms
  text-field-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      typography: '{typography.body}',
      rounded: '{rounded.12}',
      height: '48px',
      padding: '0 14px',
    }
  text-field-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      typography: '{typography.body}',
      rounded: '{rounded.12}',
      height: '48px',
      padding: '0 14px',
    }
  search-field-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      textColor: '{colors.text-light}',
      typography: '{typography.body}',
      rounded: '{rounded.full}',
      height: '48px',
    }
  search-field-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.text-dark}',
      typography: '{typography.body}',
      rounded: '{rounded.full}',
      height: '48px',
    }
  text-area:
    {
      typography: '{typography.body}',
      rounded: '{rounded.12}',
      padding: '{spacing.12} 14px',
      height: '84px',
    }
  switch-on-light:
    {
      backgroundColor: '{colors.primary-light}',
      rounded: '{rounded.full}',
      width: '51px',
      height: '31px',
    }
  switch-on-dark:
    {
      backgroundColor: '{colors.primary-dark}',
      rounded: '{rounded.full}',
      width: '51px',
      height: '31px',
    }
  checkbox: { rounded: '{rounded.6}', size: '24px' }
  stepper-button: { rounded: '{rounded.full}', size: '44px' }
  date-cell: { rounded: '{rounded.12}', width: '44px', height: '76px' }
  date-cell-selected-light:
    {
      backgroundColor: '{colors.primary-light}',
      textColor: '{colors.on-primary-light}',
      rounded: '{rounded.12}',
      width: '44px',
      height: '76px',
    }
  date-cell-selected-dark:
    {
      backgroundColor: '{colors.primary-dark}',
      textColor: '{colors.on-primary-dark}',
      rounded: '{rounded.12}',
      width: '44px',
      height: '76px',
    }
  # C07 Lists and rows
  list-group-light: { backgroundColor: '{colors.surface-light}', rounded: '{rounded.16}' }
  list-group-dark: { backgroundColor: '{colors.surface-dark}', rounded: '{rounded.16}' }
  row-settings: { typography: '{typography.body}', height: '52px' }
  row-toggle: { typography: '{typography.body}', height: '64px' }
  row-item: { typography: '{typography.subhead}', height: '72px' }
  consent-row-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      typography: '{typography.headline}',
      rounded: '{rounded.16}',
      padding: '14px {spacing.16}',
    }
  consent-row-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      typography: '{typography.headline}',
      rounded: '{rounded.16}',
      padding: '14px {spacing.16}',
    }
  # C08 Cards
  tile-item-light:
    { backgroundColor: '{colors.surface-2-light}', rounded: '{rounded.16}', size: '110px' }
  tile-item-dark:
    { backgroundColor: '{colors.surface-2-dark}', rounded: '{rounded.16}', size: '110px' }
  card-outfit-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      rounded: '{rounded.24}',
      padding: '14px',
      width: '350px',
    }
  card-outfit-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      rounded: '{rounded.24}',
      padding: '14px',
      width: '350px',
    }
  card-compare: { rounded: '{rounded.20}', padding: '{spacing.16}', width: '500px' }
  card-discover: { rounded: '{rounded.20}', width: '360px' }
  card-upgrade: { rounded: '{rounded.20}', padding: '18px' }
  card-tier: { rounded: '{rounded.18}', padding: '{spacing.16}', height: '84px' }
  card-account: { rounded: '{rounded.20}', padding: '18px' }
  # C09 Sheets, dialogs and overlays
  sheet-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      rounded: '{rounded.24}',
      padding: '10px {spacing.20} 34px',
    }
  sheet-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      rounded: '{rounded.24}',
      padding: '10px {spacing.20} 34px',
    }
  sheet-handle-light:
    {
      backgroundColor: '{colors.outline-light}',
      rounded: '{rounded.2}',
      width: '36px',
      height: '4px',
    }
  sheet-handle-dark:
    {
      backgroundColor: '{colors.outline-dark}',
      rounded: '{rounded.2}',
      width: '36px',
      height: '4px',
    }
  dialog-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      rounded: '{rounded.24}',
      padding: '{spacing.20}',
    }
  dialog-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      rounded: '{rounded.24}',
      padding: '{spacing.20}',
    }
  coach-mark-light:
    {
      backgroundColor: '{colors.surface-light}',
      textColor: '{colors.text-light}',
      rounded: '{rounded.16}',
      padding: '14px',
    }
  coach-mark-dark:
    {
      backgroundColor: '{colors.surface-dark}',
      textColor: '{colors.text-dark}',
      rounded: '{rounded.16}',
      padding: '14px',
    }
  # C10 Garment illustrations
  tile-garment-light:
    {
      backgroundColor: '{colors.surface-2-light}',
      textColor: '{colors.text-light}',
      typography: '{typography.caption}',
      rounded: '{rounded.16}',
      size: '92px',
    }
  tile-garment-dark:
    {
      backgroundColor: '{colors.surface-2-dark}',
      textColor: '{colors.text-dark}',
      typography: '{typography.caption}',
      rounded: '{rounded.16}',
      size: '92px',
    }
---

# Design System: Garderi

Token master (ADR, 2026-10-18). Native theme code is generated from this file; never edit tokens anywhere else.

Visual reference (the canvas wins over any screenshot; this file wins over any code):

- **Garderi App UI** canvas: https://claude.ai/artifact/3PfhQn2y9YKXtBz2fc1GeE (1 Overview, 2 Foundations, 3 Components C01–C10, 4 Wireframes, 5 Key screens, 6 All screens SC01–SC15, 7 Prototype P01–P18, 8 Avatar, selfie, try-on, 9 Design rules R1–R6). The frontmatter equals board **R2 Tokens** on page 9.
- **Garderi Colour Schemes** canvas: https://claude.ai/artifact/Db28dfjbyvJgksMQFrXhVA (logo, pigment ramps, schemes S1–S7 with contrast ratios).

## Overview

**Creative North Star: "The Morning Wardrobe"**

Garderi is a quiet room you walk into each morning: warm paper light, a garden-green accent, your own clothes laid out with a short, honest note on why. The interface stays calm and crafted so the user's real photos and the outfit collage carry the screen. It never sells, never flatters, never guesses out loud. Every suggestion shows its reasons, every generated image says it was generated, and every uncertain value says how uncertain it is, in words.

Product context (users, purpose, brand personality, anti-references) lives in `PRODUCT.md`, derived from `planning/SPINE.md`.

Density is low to medium: one clear decision per screen, generous 20 pt side margins, cards with a hairline edge instead of shadows. Young Serif gives titles a hand-set warmth; Figtree keeps every working label plain and legible. Light and dark are equal first-class themes, both drawn on every board.

The 2D outfit collage (real cutouts arranged by slot) is the hero outfit view and always works. Avatar, selfie and try-on screens exist on canvas page 8 but wait for the 3D go/no-go (selfie also waits for legal sign-off).

**Logo.** The chosen mark is **P2 Garden Viridian**: a Naples-yellow (#EBCB8B) Young Serif "g" on a viridian (#2E7D63) oil-dab painting, with the lowercase wordmark "garderi". Use the artwork from the Colour Schemes canvas as drawn; never redraw, recolour, outline or set the wordmark in another face, and never capitalise the wordmark. The Welcome screen uses brand scheme **S3 Viridian**; every other screen uses S1 or S2.

**Key Characteristics:**

- Warm paper neutrals with one viridian voice (S1) or one Naples-yellow voice (S2).
- Flat cards with 1 px divider rings; shadows only on things that float (sheets, dialogs, snackbars).
- Pill-shaped buttons and chips; square-cornered (6 px) chips only for hard exclusions.
- Icon + words for every state; colour never carries meaning alone.
- Honesty is visible: provenance badges, confidence words, source + freshness lines.

## Colors

A warm, low-chroma paper palette with a single garden-green accent in light and a single Naples-yellow accent in dark.

**Themes and modes.** The DESIGN.md format has no mode support, so every theme-dependent token carries a suffix: `-light` = **S1 Garden Light**, `-dark` = **S2 Garden Dark**. These are the two default themes; the app follows the phone's appearance setting (S1 in light, S2 in dark). Tokens without a suffix (`scrim` and the `camera-*` colours) are the same in both. Two more schemes use their own suffixes: `-brand` = **S3 Viridian** and `-hc-light` / `-hc-dark` = **S7 High Contrast**. The native generator emits one semantic name per pair (for example `surface-2-light` + `surface-2-dark` → `color.surface2`), matching the R2 token names `color.background`, `color.surface`, `color.surface2`, `color.text`, `color.textSecondary`, `color.divider`, `color.outline`, `color.primary`, `color.onPrimary`, `color.primaryText`, `color.accent`, `color.onAccent`, `color.focus` and `color.status.<name>.fg|bg`.

**Brand scheme.** **S3 Viridian** (`*-brand`) is used only on Welcome and onboarding: a viridian ground with paper text and a Naples-yellow primary. `text-secondary-brand` sits on `surface-brand` only, never on the viridian ground; `primary-text-brand` on `background-brand` is for text 24 pt and up only (3.2:1). S3 shares S2's yellow primary, so the roles S3 does not draw (pressed, pressed link, on-accent, on-error, active pill, inverse, pressed overlays) copy the S2 value, and tokens S3 does not define (status, condition chips) use their S2 values.

**High contrast.** **S7 High Contrast** (`*-hc-light` / `*-hc-dark`, from the Colour Schemes canvas) turns on with the phone setting (iOS Increase Contrast, Android high-contrast text) or Settings › Accessibility › High contrast. Same screens and components; only colour tokens change, plus the focus ring, which S7 draws 3 px (`focus-ring-hc-light` / `focus-ring-hc-dark`). Surfaces equal the background and carry a 2 px outline (`outline-hc-light` #000000, `outline-hc-dark` #FFFFFF) instead of a tonal step. Tokens S7 does not redefine (status, condition chips, scrim) keep their S1 / S2 values. Every core role has an S7 value. Where the S7 board draws a role it is used as drawn: dividers in the outline colour, ink #000000 on the accent, and the active tab marked by colour plus underline with no pill (`active-pill-hc-*` is transparent). The roles S7 does not draw borrow the S1 value in `-hc-light` and the S2 value in `-hc-dark`, except `link-pressed-hc-light`, which goes one step darker than the #10312A link, to #000000.

### Primary

- **Garden Viridian** (`primary-light`): primary button fill, Capture button, switch on, selected date cell, progress fill. White text on it (`on-primary-light`). Pressed darkens to `primary-pressed-light`.
- **Naples Yellow** (`primary-dark`): the same roles in S2, with ink text (`on-primary-dark`). Pressed darkens to `primary-pressed-dark` (#EBCB8B with a 16 % #0F1F1B overlay).
- **Deep Viridian Ink** (`primary-text-light`) / Naples Yellow (`primary-text-dark`): links, active tab icon + label, text buttons, bullets, selected chips (light). Pressed link: `link-pressed-light` / `link-pressed-dark`.
- **Active pill** (`active-pill-light` = primary at 14 %, `active-pill-dark` = #EBCB8B at 16 %): soft pill behind the active tab and behind selected action buttons and priming rows.

### Secondary

- **Naples Yellow** (`accent-light`) / **Sage** (`accent-dark`): fill only, never text (one named exception, Undo on inverse surfaces; see The Accent Is Fill Rule). Weather chip in the context strip, "Differs" tag, capture-queue badge, trial pill on the profile card. Text on it is `on-accent-*`.

### Neutral

- **Paper Ground** (`background-*`): every screen's ground.
- **Card Paper** (`surface-*`): cards, tab bar, sheets, dialogs, inputs.
- **Linen** (`surface-2-*`): item tiles, neutral chips, icon buttons, skeleton blocks, disabled fills.
- **Ink** (`text-*`) and **Stone** (`text-secondary-*`): body and secondary text.
- **Hairline** (`divider-*`): 1 px dividers and card rings only, never text.
- **Field Edge** (`outline-*`): input and secondary-button outlines (3:1 non-text contrast).
- **Focus** (`focus-*`): 2 px focus ring at 2 px offset on every focusable control (`focus-ring-light` / `focus-ring-dark` in the components), following the control's own corners. S7 High Contrast draws it 3 px at the same 2 px offset (`focus-ring-hc-light` / `focus-ring-hc-dark`).
- **Inverse** (`inverse-surface-*` / `on-inverse-*`): colours that swap between themes, ink with paper text in light and paper with ink text in dark. Snackbar and "AI-generated preview" badge only. `inverse-primary-*` is the snackbar's Undo action (`snackbar-action-*`): the accent yellow in light, #1F5A47 in dark.
- **Pressed overlays** (`pressed-overlay-*`, `pressed-overlay-strong-*`): a tint laid over a component's own fill while it is pressed (`overlayColor` on its `-pressed` entry). Light: ink #1B1B19 at 12 % (weather chip) or 18 % (filled destructive button). Dark: background #0F1F1B at 16 % for both. `primary-pressed-dark` is that dark overlay already flattened onto `primary-dark`.
- `scrim`: behind sheets and dialogs (#1B1B19 at 45 %). **Camera** (`camera-ground`, `camera-track`, `camera-paper`, `camera-ink`, `camera-yellow`): the capture camera, a dark ground that looks the same in both themes except for the selected mode (C05).

### Status

Always icon + label, never colour alone. Light: `*-fg-light` text/icon on `*-bg-light`. Dark: dark fg on the dark tint, or on `surface-dark` with a divider ring for banners; the warning banner uses `warning-bg-dark` (#33280F), never a mixed tint; the offline banner uses `surface-2-*`.

| Status  | Example copy       | Light ratio | Dark ratio |
| ------- | ------------------ | ----------- | ---------- |
| success | "Saved"            | 5.0:1       | 7.3:1      |
| warning | "Forecast changed" | 5.0:1       | 7.3:1      |
| error   | "Upload failed"    | 4.8:1       | 6.3:1      |
| info    | "As of 07:10"      | 5.4:1       | 6.6:1      |

Dark status fg on `background-dark`: success 8.7, warning 8.6, error 7.1, info 7.7.

### Condition chips

Weather and occasion chips (`condition-<name>-fg|bg-*`, AppChip `condition-*` variants, drawn on C03 2026-10-21): 36 high in a 44 target, padding 0 14 0 10, radius full, Figtree 14/600, icon sm with gap 4 + words (sun, rain, cold, hot, wind, snow, evening); pressed lays `pressed-overlay-*` over the fill, as the weather chip presses. Light ratios 5.9–11.7, dark 7.0–11.0. Sunny (7.2 · 8.1), Rain (6.3 · 7.5), Cold (10.4 · 8.1), Hot (5.9 · 7.0), Windy (6.1 · 7.1), Snow (8.0 · 11.0, light chip has a `condition-snow-ring-light` ring), Evening out (11.7 · 8.7). The Today context-strip weather chip is different: it uses accent / on-accent (C03).

### Contrast summary (WCAG, R2)

| Pair                                                       | S1              | S2              | S3                      |
| ---------------------------------------------------------- | --------------- | --------------- | ----------------------- |
| text on background / on surface                            | 15.0 / 17.0     | 14.8 / 13.0     | 4.6 / 7.4               |
| text-secondary on background / surface / surface-2 (tiles) | 5.9 / 6.7 / 5.4 | 8.7 / 7.6 / 6.4 | surface only: 6.0       |
| on-primary on primary                                      | 5.0:1           | 11.0:1          | 9.0:1                   |
| primary-text (links, active tab) on background / surface   | 7.0 / 7.9       | 10.9 / 9.5      | 3.2 (24 pt+ only) / 5.1 |
| on-accent on accent                                        | 11.0:1          | 7.5:1           | —                       |
| focus ring on background                                   | 4.5:1           | 10.9:1          | —                       |
| outline (non-text) on background                           | 3.1:1           | 3.8:1           | —                       |

S7 High Contrast (light and dark): every text pair drawn on the S7 board is at least 12:1, except ink on the dark accent (9.2:1). The roles S7 does not draw borrow S1 / S2 values and are not yet checked against 12:1 (pressed states, Undo, on-error); the contrast check settles them.

### Named Rules

**The Confidence Is Words Rule.** Confidence is always a text band ("High confidence", "Medium confidence", "Low confidence · check this", "Good match", "Approximate"), never colour alone and never a percentage.

**The Accent Is Fill Rule.** `accent-*` is a fill, never a text colour. Text on it is `on-accent-*`. One named exception, **Undo on inverse surfaces**: the snackbar's Undo action shows the accent's yellow as text, through its own role `inverse-primary-light` (#EBCB8B on `inverse-surface-light`, 11.0:1), so no component sets `accent-*` as a text colour. Dark Undo is `inverse-primary-dark` (#1F5A47 on `inverse-surface-dark`, 7.0:1), as drawn on C04.

**The No New Colours Rule.** Every colour on screen is a token above. A colour the canvas does not have needs an approved canvas change first.

**The Twin Rule.** Every `-light` colour, elevation or component token has a `-dark` twin of the same name, and the reverse, and no component points at a token with the other theme's suffix. A twin keeps the role, not always the tonal step; these differ on purpose, as drawn: the outlined destructive button pressed (error-bg in light, surface-2 in dark), `chip-never-suggest` (error-bg / surface-2) and its pressed fill (error-bg / divider), `chip-soft-dislike` (surface-2 / surface) and its pressed fill (divider / surface-2), the disabled choice, filter and swatch chips and their selected twins (surface-2 / surface), the snow condition chip's ring (`condition-snow-ring-light` in light, its own fill in dark), the Essentials and Plus plan tags (status bg / surface + status ring), the new tag (info-bg / surface-2), the available tag (success-bg / surface-2), `segmented-control` (surface-2 / surface) and its selected segment (surface / surface-2), and `camera-mode-selected` (paper pill in light, yellow pill in dark). The tokens without a twin are on the line below: the shared fill of the dark info, success, error and stale banners (each kind also has its own twin), the light-only snow-chip ring, and the light segment-thumb shadow (dark draws surface-2 + a 1 px outline instead).

Unpaired by design: banner-dark, condition-snow-ring-light, segment-thumb-light.

## Typography

**Display Font:** Young Serif (with serif fallback), weight 400 only, for titles 20 pt and up.
**Body Font:** Figtree (with sans-serif fallback), weights 400 / 500 / 600 / 700.

**Character:** A soft, hand-set serif for the few words that name a moment ("Today's outfit", "Friday dinner"), paired with a friendly, even grotesque that does all the working text.

Sizes are pt on iOS and sp on Android at 100 %; every style scales with Dynamic Type and Android font scale.

### Hierarchy

| Token    | Font        | Size / line | Weight | Tracking   | iOS Dynamic Type | Android M3                                | Example                                  |
| -------- | ----------- | ----------- | ------ | ---------- | ---------------- | ----------------------------------------- | ---------------------------------------- |
| display  | Young Serif | 40 / 46     | 400    | 0          | .largeTitle      | displayLarge, displayMedium, displaySmall | Today's outfit                           |
| title-1  | Young Serif | 32 / 38     | 400    | 0          | .title           | headlineMedium                            | Your closet                              |
| title-2  | Young Serif | 26 / 32     | 400    | 0          | .title2          | headlineSmall                             | Rain-ready for 6°                        |
| title-3  | Young Serif | 20 / 26     | 400    | 0          | .title3          | titleLarge                                | Friday dinner                            |
| headline | Figtree     | 17 / 22     | 600    | 0          | .headline        | titleMedium                               | Green wool jacket                        |
| body     | Figtree     | 17 / 24     | 400    | 0          | .body            | bodyLarge                                 | Layer the knit under your jacket…        |
| callout  | Figtree     | 15 / 21     | 400    | 0          | .callout         | bodyMedium                                | Worn 2× since January                    |
| subhead  | Figtree     | 15 / 20     | 600    | 0          | .subheadline     | titleSmall                                | Why this outfit                          |
| footnote | Figtree     | 13 / 18     | 400    | 0          | .footnote        | bodySmall                                 | Based on this morning's forecast         |
| caption  | Figtree     | 12 / 16     | 500    | 0          | .caption         | labelMedium                               | AI-generated preview · Medium confidence |
| overline | Figtree     | 11 / 14     | 600    | +8 %, caps | .caption2        | labelSmall                                | TYPICAL DAY                              |
| button   | Figtree     | 17 / 22     | 600    | 0          | .headline        | labelLarge                                | Wear this                                |

Each of the 15 Material 3 type roles is filled by exactly one style, so Android's built-in components (the date picker, for example) set their text in Garderi type, not the M3 default. R2 has no style for `displayLarge`, `displayMedium` or `headlineLarge`: `display` also fills the first two, and `large-title-bar` (below) fills `headlineLarge`, so those components get the serif look. The frontmatter carries the same mapping per style: `dynamicType` is the iOS column without the dot, `m3Roles` the Android column as a list, and `textTransform: uppercase` the Tracking column's "caps" (the overline only; a style without it is drawn as written). The apps draw the caps and keep the words as written for screen readers.

Component label styles (drawn on C01–C10, not on R2) each scale with the nearest R2 style above, at or just over their size (the "Scales with" column), and take its Dynamic Type style. Only `large-title-bar` fills an M3 role; the others fill none (`m3Roles: []`) and scale in sp with the font scale. Tracking is 0 for all.

| Token           | Font        | Size / line | Weight | Scales with | iOS Dynamic Type | Android M3    | Used for                                                                  |
| --------------- | ----------- | ----------- | ------ | ----------- | ---------------- | ------------- | ------------------------------------------------------------------------- |
| large-title-bar | Young Serif | 34 / 40     | 400    | display     | .largeTitle      | headlineLarge | top-level large title (iOS large navigation title, M3 large top app bar)  |
| label-md        | Figtree     | 14 / 18     | 600    | subhead     | .subheadline     | —             | filter, condition, group/sort chips                                       |
| label-sm        | Figtree     | 13 / 18     | 600    | footnote    | .footnote        | —             | weather and reason chips, confidence label, trial pill, inline provenance |
| label-md-normal | Figtree     | 14 / 18     | 400    | subhead     | .subheadline     | —             | group and sort chip prefix ("Group:")                                     |
| label-md-medium | Figtree     | 14 / 18     | 500    | subhead     | .subheadline     | —             | filter chip count ("· 12")                                                |
| label-sm-medium | Figtree     | 13 / 18     | 500    | footnote    | .footnote        | —             | override chip detail ("· your setting")                                   |
| subhead-medium  | Figtree     | 15 / 20     | 500    | subhead     | .subheadline     | —             | choice chips, snackbar, toast, menu rows                                  |
| label-action    | Figtree     | 15 / 20     | 700    | subhead     | .subheadline     | —             | snackbar Undo action                                                      |
| caption-strong  | Figtree     | 12 / 16     | 600    | caption     | .caption         | —             | active tab label, plan tags                                               |
| badge           | Figtree     | 11 / 14     | 600    | overline    | .caption2        | —             | tile badge, provenance overlay                                            |
| badge-count     | Figtree     | 11 / 18     | 700    | overline    | .caption2        | —             | count badge (number)                                                      |
| button-disabled | Figtree     | 17 / 22     | 500    | button      | .headline        | —             | filled destructive button, disabled label (C01)                           |

### Named Rules

**The Serif Threshold Rule.** Young Serif only at 20 pt and up, weight 400. Anything smaller is Figtree.

**The Text Styles Only Rule.** Feature UI names a style token, never a font size. iOS maps each style relative to its Dynamic Type style; Android puts each style into the M3 roles it fills (`m3Roles`) and keeps the label styles beside the M3 type scale, all in sp.

## Layout

Phone reference 390 × 844. One column; content width = screen − 40.

- **Side margin** 20 at every width (320 to 430). Rows, cards and the outfit card stretch to width − 40.
- **Spacing scale** (`spacing`, pt / dp): 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Roles on R2: 16 card padding, 20 screen side margin, 24 section gap. On Today, R3 measures section gap 8 (12 on pushed screens). A component padding or gap part that equals a step names it in the frontmatter (`padding: '0 {spacing.24}'`); heights and off-scale parts stay literal (owner 2026-10-21).
- **Screen anatomy (R3):** content starts 8 below the OS safe area; large title 72 (padding 8 0 6, overline caps + `large-title-bar`, profile 44); context strip 44 with chips inside 44 targets; source line in Caption; outfit card radius 24, padding 14, gap 10; primary button 52, one per screen; action row 72 (radius 20, padding 8 6, buttons 56 tall, 48 min wide); section header 44 (Subhead + text action); alternatives rail 60, cards 164 wide, gap 10, scrolls past the right margin; tab bar 78 with the home-indicator zone inside its bottom 20.
- **Top bars:** top-level tabs use the large title 72, collapsing to the compact 52 bar (surface, bottom divider) on scroll and expanding at the top. Pushed screens use the standard 52 bar (back 44, centred title, at most one text action). Modals use the 56 bar (close 44 left, title + position, Save right). The tab bar never hides on scroll. iOS: large navigation title collapsing to inline · Android: M3 large top app bar collapsing to small.
- **Navigation:** five tabs, Today (launch) · Closet · Capture (centre, opens the camera modal) · Discover · You, each with its own stack. The tab bar shows on every screen inside a tab, top level and pushed; it hides only in modal flows (onboarding, the Capture flow, Edit and correct, Paywall, Trial ended recap, Deletion pending). A sheet sits over its parent with the tab bar under the scrim. iOS: tab view, one navigation stack per tab, full-screen cover for modals, sheets with detents · Android: M3 navigation bar, one back stack per tab, full-screen dialog destination, modal bottom sheet.
- **Bottom sheet:** max height 772 (top inset 72 of 844); short sheets fit content.
- **Closet grid:** 3 columns at every phone width; tile = (width − 40 − 20 gaps) ÷ 3, square, radius 16, label below with gap 4 (≈87 at 320, 110 at 390, ≈123 at 430). Tablets are not designed yet.
- **Touch targets:** 44 × 44 pt on iOS, 48 × 48 dp on Android, for every control, even when the visual is smaller (a 32 chip or 36 profile button pads its hit area). Targets never overlap.

**Open items (canvas discrepancies to settle before build):** component paddings drawn on C01–C10 use values off the R2 spacing steps (2, 3, 6, 9, 10, 11, 14, 18); outfit card padding is 14 (C08, R3) against R2's 16 card padding; bottom sheet padding is 20 on C09 and 10 20 34 on R3 (frontmatter uses R3); the Capture centre button is a 60 circle on C01 and 56 raised 26 on C05 / R3 (frontmatter uses 56); the outfit card title is Young Serif 22 on C08, which is not on the type scale.

## Elevation & Depth

Flat by default, with tonal layering: background → surface (cards, bars) → surface-2 (tiles, chips). Cards carry no shadow, only a 1 px `divider-*` ring. Shadows appear only on elements that float above the page. In dark, floating elements add a 1 px edge (divider; outline on the coach mark) because shadows read weakly on dark grounds.

### Shadow Vocabulary

- **Segment thumb** (`0 1px 2px rgba(27,27,25,0.12)`): the selected segment in light. Dark uses surface-2 + 1 px outline instead.
- **Sheet** (`0 -8px 24px rgba(27,27,25,0.14)`; dark adds `inset 0 1px 0 #2C4740`): bottom sheets.
- **Dialog** (`0 8px 24px rgba(27,27,25,0.14)`; dark adds a 1 px #2C4740 inset ring).
- **Coach mark** (the dialog shadow; dark adds a 1 px #5E7D72 `outline-dark` inset ring round the bubble and its arrow, as drawn on C09; owner choice 2026-10-19).
- **Snackbar** (`0 8px 24px rgba(27,27,25,0.18)`; dark `rgba(0,0,0,0.4)`).
- **Capture button** (4 px surface ring + `0 6px 14px rgba(27,27,25,0.18)`; dark `rgba(0,0,0,0.35)`).

Native: iOS draws these as layer shadows; Android uses M3 tonal elevation for surfaces plus these shadows only on the listed floating elements.

### Motion

| Token              | Use                              | Value                                                         |
| ------------------ | -------------------------------- | ------------------------------------------------------------- |
| motion.press       | Buttons, chips, toggles          | 150 ms linear                                                 |
| motion.sheet       | Sheets, snackbars                | 250 ms                                                        |
| motion.screen      | Push and modal screens           | 350 ms                                                        |
| easing.enter       | Screens in, sheets open          | cubic-bezier(0.2, 0, 0, 1), ease-out                          |
| easing.exit        | Screens out, sheets close        | cubic-bezier(0.4, 0, 1, 1), ease-in                           |
| reduced motion     | Replaces all movement            | 150 ms crossfade; no shimmer; progress static; no auto-rotate |
| snackbar with Undo | On screen                        | ≥ 5 s, longer with a screen reader                            |
| toast              | No action, centred above tab bar | 3 s                                                           |

iOS: honour Reduce Motion · Android: honour Remove animations · app: Settings › Accessibility › Reduced motion. Haptics: light tap on Like / Save, success on "Confirm all"; none on scroll or swipe; always paired with a visible change and off when Haptics is off.

### Named Rules

**The Flat Card Rule.** Cards never get a shadow. A shadow means "this floats above the page": sheet, dialog, coach mark, snackbar, Capture button.

## Shapes

Soft, rounded, friendly geometry. Interactive things are pills; containers are generously rounded rectangles; the only square-ish chip is the hard exclusion.

- **full (999):** buttons, chips, pills, tags, badges, toast, switches, segmented tracks.
- **24:** cards, sheets (top corners), dialogs, state cards.
- **20 / 18:** Discover, compare, upgrade and account cards (20); paywall tier card and collage (18).
- **16:** item tiles, banners, snackbar, grouped lists, consent rows, coach mark, expanded reason row.
- **14 / 12 / 10:** outfit-option collage and missing slot (14); inputs, text areas, date cells, item-row photos (12); upload-queue photos and the birth-year selection band (10).
- **8:** tags, planned-outfit thumbnails. **6:** never-suggest chip, checkbox. **3:** progress track. **2:** sheet handle. **4:** inline-link focus ring.
- Phone frame 48 is a canvas reference only, not a token.

**Icons:** one inline stroke set (C02, `AppIcon`): 24 × 24 grid, 2 px live-area keyline, round caps and joins, no fill, currentColor. Six named sizes, the icon scale (`components.icon-<step>`, owner 2026-10-21): xs 12 · sm 16 · md 20 · lg 24 (default) · xl 32 · hero 56. Stroke 1.7 in grid units, 2.2 at xs. Icons grow with the user's text size. Filled twins only for the favourite heart, the saved bookmark and the liked thumbs-up. Icons are hidden from screen readers; the button names the action. The AI-generated spark appears only beside the words "AI-generated preview".

**Garments (C10):** flat item art on a 64 viewBox, used only as mockup placeholders; the app always shows the user's real photos.

## Components

Every component is drawn in S1 and S2 on its canvas board, with states in this order: default, pressed, focused (`focus-ring-*`: 2 px ring, 2 px gap, following the control's corners; 3 px in S7 High Contrast, `focus-ring-hc-*`), disabled (surface-2 fill + text-secondary label, never opacity alone on text, text ≥ 3:1), loading, error, selected. Frontmatter carries colours, type, radius and size, plus shadows (`elevation`), `motion`, the button and chip outline rings (widths `button-outline-ring` and `chip-outline-ring`, colour `borderColor`), the button spinner colour (`spinnerColor`, where it is not the label colour), the chip icon tint (`iconColor`, where it is not the label colour), the focus ring and the pressed overlays (`overlayColor`); the other outline colours and rings are described here. The chip, tag, badge and reason-row entries also name a trailing icon slot, second text runs, the colour swatch, dashed rings, a dot and an outer ring; `.impeccable/components/README.md` "Entry properties" defines each one.

### Buttons (C01)

- **Shape:** pill (full radius).
- **API:** `.impeccable/components/button.yaml` (`AppButton`) lists the variants, sizes, states and tokens; where C01 and the screens disagree, the screens win (owner 2026-10-20).
- **Sizes (as the screens draw them):** Large 52 (padding 0 24, 17/600); Card 48 (17/600, `button-card`: the one action of a state template card, full width); Medium 44 (0 20, 17/600); Compact 44 (15/600 Subhead label: outlined 0 16 `button-compact`, filled 0 20 `button-compact-filled`, text 0 12 `button-text-compact`; row, card and dialog actions); Small 36 (0 16, 15/600, 44 hit area). Leading icon md at every size (`iconSize: icon-md`); gap 8, and 6 at Compact (SC05 Edit and Retry, SC12 Undo and Delete draw 18 there, which snaps to md as Small's same 15/20 label draws it). Heights are minimums: labels scale and wrap.
- **Primary:** Large, Card, Medium, Compact (C08 Add items, TR1 See plans), Small. Full width inside the 20 margins or hugs content. Pressed `primary-pressed-*` (dark: the background 16 % overlay, flattened); 150 ms.
- **Loading (every variant, owner 2026-10-20):** while its request runs, the button shows a spinner in the leading-icon slot (md), in the label colour (secondary: `primary-text-*`, `button-secondary-loading-*`), and the label stays. It ignores further taps and keyboard activation until the request ends, keeps its enabled look (never the disabled look) and is announced as busy.
- **Secondary (outlined):** Large, Medium, Compact (SC15 Unfollow, C07 Sign out, SC05 Edit, C08 and SC09 Choose option, SC10's disabled pair), Small; 1.5 `outline-*` ring, text colour; pressed fills surface-2; disabled divider ring + text-secondary.
- **Primary outline:** Compact only; 1.5 `primary-*` ring, `primary-text-*` label (P10, SC06, SC07 and C07 Confirm; SC12 Set my own; SC05 Retry). Pressed fills surface-2, disabled divider ring + text-secondary (derived from secondary, not drawn).
- **Text button:** Medium 44 (padding 0 12, 17/600) or Compact 44 (0 12, 15/600: row and section-header actions, SC12 Edit and Clear, SC09 Show me something different, the coach mark Got it), primary-text; pressed surface-2 pill; disabled text-secondary. **Inline link:** Callout 15/600, underline offset 3, focus ring radius 4.
- **Tonal (Linen):** surface-2 fill, text label; Large (SE1 Use my selfie / Use a generic face), Card (C04 offline Try again), Compact (TR1 and C09 Not now / Allow / Turn on). Pressed divider fill (as the icon button); disabled surface-2 + text-secondary (derived, not drawn).
- **Destructive:** outlined (error text + 1.5 ring, trash md; pressed error-bg light, surface-2 dark; disabled divider ring + text-secondary) for rows and screens, Medium 44 or Large 52; filled (error fill, `on-error-*` text, Large 52) only for the final confirm inside a dialog. Pressed filled: `pressed-overlay-strong-*` (ink 18 % light, background 16 % dark). Disabled filled: error-bg fill, error-fg label at 500 (`button-disabled`). Cancel stays enabled while deleting.
- **Destructive text:** error label, no ring, trash md, Compact (0 10) for row actions (SC12 and C07 Delete, beside the Undo text button). Pressed error-bg light, surface-2 dark (as outlined destructive); disabled text-secondary (as text); derived, not drawn.
- **Destructive tonal:** error-bg fill + error label in light, surface-2 + error label in dark, Large 52: step 1 of a two-step reset (C09 Reset; C09's 44 is lifted to 52 like every overlay action). Pressed `pressed-overlay-strong-*`; disabled surface-2 + text-secondary (derived, not drawn). Its enabled light colours equal the filled destructive's disabled colours; the label weight (600 against 500) and the dialog context tell them apart.
- **Icon buttons:** 44 circle on surface-2 (pressed divider) or ghost; icon lg. Accessible name is verb + object ("Back", "Close", "More options for this outfit").
- **Action row (Today):** Save · Schedule · Like · Dislike · More; icon lg over Caption, min 48 × 56, gap 2. Selected: active pill, filled icon, label changes (Like → Liked, Save → Saved) at 600.
- **Capture centre tab:** raised primary circle, camera icon lg, 4 surface ring, Caption 12/600 label; pressed `primary-pressed-*`; opens the camera modal.
- **Sign-in:** official Apple and Google button artwork, 52 tall, full width; "Continue with passkey" is a secondary Large with a key icon md, same width.
- **Equal-weight pairs:** Skip + Continue side by side, 52 each, flex 1 : 1, gap 12 (Skip secondary outlined, Continue primary, as SC02, SC03, SC09, P03 and P08 draw them); consent pairs (Not now + Allow, Not now + Turn on) are both tonal, Compact, flex 1 : 1 (TR1, C09); stacked pairs full width, 52 each, gap 10.

### Icons (C02)

- **API:** `.impeccable/components/icon.yaml` (`AppIcon`) lists every glyph as path data on the 24 grid; the sizes and strokes are the icon scale, the `components.icon-xs` … `components.icon-hero` tokens. Code names a step, never a number (`AppIcon(name: .heart, size: .sm)`), and a component that holds an icon names a step by its bare key (`iconSize: icon-md` on the buttons). Where C02 and the screens disagree, the screens win, and icons only the screens draw join the set (owner 2026-10-19); each choice is a "Screens win:" comment in the contract.
- **Sets:** navigation (the five tabs, back, close, chevrons, arrows, more, search, filter, sort, grid, list, group); actions (heart, thumbs, bookmark, schedule, edit, delete, archive, add, check, undo, refresh, upload, export, camera actions, photo, compare, plus / minus / pause circles, clear, hide, report); weather and context (sun, cloud, rain, snow, wind, cold, hot, evening, office, holiday, indoors, layers, leaf, temperature); closet (coat, laundry, packed, lent, repair, tag, collection, star, outfits, scissors); status (info, warning, error, success, offline, sync, processing, lock, AI-generated, confidence bars, pending, cancelled, never-suggest, approximate, step rings); account and settings; selfie, avatar and try-on (page 8: face, face scan, people, glasses off, timer, captions, palette, 3D avatar, rotate, zoom, poses).
- **Style:** 24 × 24 grid, 2 px live area, round caps and joins, no fill, currentColor. A selected state is its own filled glyph (`heart-filled`, `bookmark-filled`, `thumbs-up-filled`); small dots are filled.
- **Scale (owner 2026-10-21):** six named steps replace the 14 measured sizes: xs 12 · sm 16 · md 20 · lg 24 (the default) · xl 32 · hero 56 (`components.icon-<step>`). The stroke is in grid units, so the drawn width is stroke × size / 24; sizes and drawn widths are at the default text size. Each stroke is measured from the screens at its step: the stroke that most of the icons drawn at that size use. At xl the 28, 32 and 36 draw 1.7, and 1.7 also keeps the pose picker's line (2.5 px at 40) nearer than 1.5 would (2.27 against 2.0 px). Reason and filter chips (16 at 1.9) and the tile-badge warning (12 at 2.4) take their step's stroke, and the confidence bars, written as filled capsules, keep their drawn width at every step.

| Step | Size | Stroke | Drawn   | Stroke measured from                       |
| ---- | ---- | ------ | ------- | ------------------------------------------ |
| xs   | 12   | 2.2    | 1.1 px  | the 12s: 19 of 26 draw 2.2                 |
| sm   | 16   | 1.7    | 1.13 px | the 16s: 129 of 240 draw 1.7               |
| md   | 20   | 1.7    | 1.42 px | the 20s: 198 of 215 draw 1.7               |
| lg   | 24   | 1.7    | 1.7 px  | the 24s and 26s: all 828 draw 1.7          |
| xl   | 32   | 1.7    | 2.27 px | 28, 32 and 36 draw 1.7; 40 at 1.5 (2.5 px) |
| hero | 56   | 1.7    | 3.97 px | the 56s (SC01) draw 1.7                    |

- **Where each screen use lands:** every icon the screens draw snaps to the nearest step. A tie (14, 18, 22, 28) goes to the step a sibling in the same role already draws, named in the last column: the tags take the tile badges' 12, chips with a 13/18 or 14/18 label take the reason and filter chips' 16, chips and buttons with a 15/20 label take Small's 20, row chevrons take the picker row's 20, and the 22s take the icon buttons' 24. The shifts are accepted (owner 2026-10-21); the largest are the pose picker (40 to 32) and the SC11 and SC13 state-card art (36 to 32).

| Screen use                                                         | Drawn     | Step | Visible shift                    |
| ------------------------------------------------------------------ | --------- | ---- | -------------------------------- |
| Plan feature checks (SC14, P18, TR1)                               | 11 at 2.8 | xs   | slight: +1, a lighter tick       |
| Tile badges, 3D tag                                                | 12        | xs   | none                             |
| Status tags (Later, Lock, Available, Provisional)                  | 14        | xs   | small: -2, as tile badges        |
| Reason-chip chevron                                                | 14        | xs   | small: -2                        |
| Inline messages, reason and filter chips, date strip, confidence   | 16        | sm   | none                             |
| Weather chip, group and sort chips (13/18, 14/18 labels)           | 18        | sm   | small: -2, as reason chips       |
| Choice, never-suggest, soft-dislike chips (15/20 labels)           | 18        | md   | small: +2                        |
| Compact button icons, toast                                        | 18        | md   | small: +2, as the Small button   |
| Row chevrons                                                       | 18        | md   | small: +2, as the picker chevron |
| Banners, button leading icon, list rows, search, picker chevron    | 20        | md   | none                             |
| Action-menu rows, compact action row, profile button, history rows | 22        | lg   | small: +2, as icon buttons       |
| Icon buttons, settings rows, Today action row                      | 24        | lg   | none                             |
| Tab bar, Capture centre camera                                     | 26        | lg   | small: -2, every tab             |
| Generating spark in the 64 disc (TR1)                              | 28        | xl   | yes: +4                          |
| State-card art (TR1)                                               | 32        | xl   | none                             |
| State-card art (SC11, SC13)                                        | 36        | xl   | yes: -4, same slot as TR1        |
| Pose picker (AV1)                                                  | 40 at 1.5 | xl   | yes: -8, the most visible        |
| Privacy promise (SC01)                                             | 56        | hero | none                             |

- **Accessibility:** decorative. Icons are hidden from screen readers; the host control or the words beside the icon name it. Every tappable icon sits in a 44 pt / 48 dp target. An icon never carries meaning alone: icon + words. Icons grow with the user's text size (iOS Dynamic Type, Android font scale), as the platform's own icons do (owner 2026-10-21); the native lanes implement it. On iOS the xs–lg steps scale with the body text style, xl with title 2 and hero with large title, so the large steps grow more gently, like the system's large symbols; Android's non-linear font scale already damps large sizes (owner 2026-10-21).
- **Tint:** the host's foreground (text, text-secondary; primary-text on the active tab and text actions). Status icons use the status foregrounds (`*-fg-*`). No icon colour token. Confidence: the level glyph in the band colour over `confidence-high` in a muted colour, always beside its words ("Medium confidence").
- **Owner decisions (2026-10-20):** outfits use thumbs-up and thumbs-down for like and dislike, and the "a pairing you liked" chip and the Liked history follow; clothing items use the heart for favourite; the star marks only "Style preferences". The AI spark sits only beside "AI-generated preview"; Discover's trend tags use the tag. The five tab icons are C02 glyphs inside the native tab bar (DEC-87); native navigation bars keep the system back and close, and the C02 back and close serve custom headers (camera, onboarding). Every drawn icon is built, page 8 included. One drawing per meaning: where the screens tie, the drawing nearest C02 wins; credits are the coin stack; the "You follow" chip on Discover keeps the heart; the upsell cards keep the four-point sparkle, which is not the AI spark.
- **Owner decisions (2026-10-21):** a named icon scale (xs, sm, md, lg, xl, hero) replaces the measured sizes, every screen use snaps to the nearest step, and the small visual shifts are accepted. Components point at the shared scales instead of repeating numbers: an icon slot names an icon step (`iconSize: icon-md`), and a padding or gap part that equals a spacing step names it (`padding: '0 {spacing.24}'`); heights and off-scale values (44, 52, gap 6) stay literal. Icons grow with the user's text size.

### Chips and tags (C03)

- **API (owner 2026-10-21: "I don't want to left anything behind"):** `.impeccable/components/chip.yaml` (`AppChip`) holds every tappable chip: weather, context, the seven condition chips, override, reason, choice, swatch, filter (with its count), filter menu, group and sort (drawn on C05), never-suggest, soft-dislike, add and never-suggest add. Sizes compact 32, small 34, medium 36 and large 40 (`chip-<size>`: leading icon sm up to 36, md at 40; trailing chevron or pencil xs at 32 and 34, sm at 36); rings 1 px (`chip-outline-ring`). Selected and expanded combine with pressed, focused and disabled (`selected-pressed` …). `tag.yaml` (`AppTag`) holds the tags, `badge.yaml` (`AppBadge`) the count badge and the trial pill, `reason-row.yaml` (`AppReasonRow`) the expanded reason row. Where C03 and the screens disagree, the screens win (owner 2026-10-20). Tags, pills and badges are not chips: no tap and no pressed state (R4).
- **Weather chip (context strip):** 34 in a 44 target, padding 0 14 0 11, label-sm, accent / on-accent, icon sm; pressed `pressed-overlay-*` (ink 12 % light, background 16 % dark).
- **Condition chips:** see Colors › Condition chips; drawn on C03 beside the context chips.
- **Occasion / holiday chips:** 34 in a 44 target, padding 0 14 0 11, label-sm, icon sm, surface-2 / text, pressed divider. Holiday only when one applies. **Override chip:** 34, padding 0 11, surface + 1.5 primary-text ring, the caller's icon (house) in primary-text, the detail "· your setting" in 13/500 (`label-sm-medium`) primary-text, a trailing pencil xs in primary-text; pressed surface-2 (derived, not drawn). No selected state; tap opens a sheet.
- **Freshness caption:** chips gap 8; source + time ("Open-Meteo · 07:10") in Caption text-secondary, always visible.
- **Reason chip:** 32 in a 44 target, padding 0 12 0 10, label-sm, surface-2 / text, icon sm in primary-text, pressed divider; text comes from reason-code templates. Expanded: primary-text fill + white (dark: primary-text / ink) + chevron up xs, padding 0 10. **Expanded reason row:** padding 14 16, radius 16, surface + divider ring, sentence in Callout, fact 13/600 with icon disc, freshness in Caption, lines 8 apart (`AppReasonRow`).
- **Choice chip:** 40 in a 44 target, padding 0 14 (0 14 0 10 with check), 15/500 (selected 600), surface + 1 px outline; pressed surface-2; selected primary-text fill (dark: primary-text / ink) + check md, no ring; disabled surface-2 (dark: surface) + text-secondary + divider ring. Multi-select (feedback, onboarding) or one choice per group (SC08 What's on today).
- **Filter chip:** 36 in a 44 target, label-md, surface + 1 px outline; pressed surface-2; selected as choice chip + check sm (padding 0 14 0 10); disabled as choice chip; the count is the detail "· 12" in 14/500 (`label-md-medium`) text-secondary, 4 after the label (on the selected fill it takes the label colour, derived). **Filter menu** (opens a list): chevron-down sm at the end, padding 0 10 0 14; selected (a value chosen) 0 10 with check and chevron (SC06 More, Brand, Tags; SC09 More).
- **Never-suggest chip (hard exclusion):** 40, padding 0 14 0 10, radius 6 (never a pill), 15/600, error-bg + 1 px error ring (dark: surface-2 + 1 px dark error), slash icon md in error; pressed 2 px ring (dark: divider fill).
- **Soft-dislike chip:** 40, pill, padding 0 14 0 10, 15/500, surface-2 / text-secondary + divider ring (dark: surface), minus icon md; pressed divider fill + outline ring + text (dark: surface-2). **Add chip:** transparent, 1 px outline, primary-text, plus icon; 40 (15/600, gap 6) or 36 (label-md, icon sm, gap 4: SC06 Save filter); radius 6 beside never-suggest chips, a pill elsewhere; pressed surface-2 (derived, not drawn).
- **Colour swatch chip:** the choice chip with a 16 swatch circle, padding 0 14 0 12, gap 8 (selected: check, then the swatch ringed 1.5 in surface, gaps 6, padding 0 14 0 10); a 1 px outline edge inside the swatch when its contrast with the chip fill is below 3:1 ("swatches near the ground"); disabled rings the swatch in divider 1.5 off it; name always shown. The swatch colour is closet data passed at runtime, never a token.
- **Group and sort chips:** see Navigation › In-screen controls (AppChip `group-sort`).
- **Plan tags:** 24, padding 0 10, 12/600: Free surface-2, Essentials info, Plus success, Pro primary (dark: Essentials and Plus on surface with a 1 px ring in their fg). The name carries meaning, not the colour (`AppTag`).
- **Status tags:** 24, padding 0 10 0 7, icon xs, gap 4: Lock (surface-2 + lock xs, read as "Needs Plus"), Later (1 px text-secondary ring + clock), Provisional (warning, dashed 1 px, the pending ring icon, stays until the user confirms), New (info + 6 px dot, gap 5, padding 0 10 0 8; dark surface-2).
- **Other tags (`AppTag`):** availability on item rows (C07, SC15: 24, padding 0 8; Available success + check, dark surface-2; unavailable surface-2 / text-secondary + the availability icon); the Discover kind tag on card images (SC15: "Trend", "Runway" in overline caps on surface, 24, padding 0 10); the Differs tag (C08: 18, padding 0 7, 11/600, accent / on-accent).
- **Count badge:** dot 8 or number 18 high (min width 18, padding 0 5), badge-count, error fill with an `on-error-*` number, 2 px ring in the surface below; the count is also in the label (`AppBadge`).
- **Trial pill:** 28, padding 0 12 0 9, label-sm, surface + 1.5 text ring, clock icon sm with gap 5 + days in words ("Trial · 2 days left"); last day uses warning colours with a warning ring (`AppBadge`).

### Status and feedback (C04)

- **Tile badges:** 22, padding 0 8 0 6, icon xs + badge text, inset 6 bottom-left. Processing = info, Needs attention = warning, Waiting to sync and availability (Laundry, Packed · until 24 Oct, Lent · to Mari, Repair, Archived) on surface. Unavailable tiles mute the image, never the label.
- **Confidence label:** 28, bars icon sm + text band, label-sm.
- **Provenance badge:** "AI-generated preview" pill in inverse colours (`inverse-surface-*` / `on-inverse-*`: ink on light, paper on dark), 22, top-left of every generated view, with the confidence label bottom-left. Inline 13/600. Never on real photos. **Freshness label:** "Cached · based on data from 07:10", 13/18 secondary.
- **Banners:** full width (screen − 40), padding 12 4 12 14, radius 16, icon md, title 15/600, body 13/18, action 13/600 in the status fg, dismiss 44 × 44. Kinds: info, success, warning, error, offline (surface-2), stale (surface + divider). Dark: info, success, error and stale on `surface-dark` + divider ring (`banner-<kind>-dark`; `banner-dark` is the same shared fill), warning on `warning-bg-dark`, offline on `surface-2-dark`.
- **Inline field message:** 13/18, 6 below the field; error = 2 px error ring + icon sm + fix link, value kept as typed; helper in secondary.
- **Snackbar:** 56, radius 16, inverse colours (`inverse-surface-*` / `on-inverse-*`), Undo in `label-action` (15/20 700) in `inverse-primary-*` (`snackbar-action-*`: 44 high, padding 0 14, radius 12; the accent yellow in light, #1F5A47 in dark; the Undo on inverse surfaces exception to The Accent Is Fill Rule), 16 above the tab bar. **Toast:** 44 pill, icon md + 15/500, no action.
- **Progress:** linear track 6 (radius 3, surface-2, primary fill), ring 40 stroke 4, steps, upload row. Counts in words ("5 of 8"), never invented percentages.
- **Skeletons:** surface-2 blocks on surface matching the final layout (outfit card, item tile, list row); slow shimmer, none under reduced motion; announced once as "Loading".
- **State templates (empty, error, offline):** padding 20, radius 24, illustration slot 96 × 64, Title3 title, Callout body naming the cause, one action (button Card 48: primary; tonal on the offline template). Offline keeps cached content visible.

### Navigation (C05)

- **Tab bar:** 390 × 78, surface, top divider, padding 8 8 20, items 64 wide. Active: 56 × 30 active pill behind primary-text icon + caption-strong label. Inactive: text-secondary, 500. Capture: 56 primary circle, raised 26. Capture queue badge: min 22, accent / on-accent, 12/22 700, 2 px surface ring, label "Capture, 2 uploads in progress".
- **Top bars:** large title 72 (overline 11/14 caps + Young Serif 34/40, profile button 44 on surface-2); compact 52; standard 52; modal 56; search 60 (field 44, radius 12, outline, Cancel 17/600 primary-text).
- **Segmented control:** track 44, padding 4, pill; segment 36; selected surface + segment-thumb shadow (dark: surface-2 + 1 px outline), 15/20 600; others 500 text-secondary; disabled no track fill, 1 px divider.
- **Camera mode switch:** Single | Batch | Library on camera-ground; track camera-track; segment 36, padding 0 18; labels `camera-paper`; selected `camera-paper` / `camera-ink` (dark: `camera-yellow` / `camera-ink`, the S2 primary yellow); upload badge 36 with 1.5 ring, 14/600.
- **Page dots:** row 44; active 24 × 8 primary; inactive 8 × 8 outline; gap 8. **Step progress:** back 44, "Step 5 of 6" Footnote 13/18 600, "Finish later" 15/600 primary-text, bar 4 (track divider, fill primary).
- **In-screen controls:** group/sort chips 36 in 44 targets (surface, divider ring, padding 0 12 0 10, group or sort icon sm, prefix "Group:" / "Sort:" in 14/400 `label-md-normal` text-secondary, value 600, chevron-down sm, gaps 6, opens a list sheet; AppChip `group-sort`); grid/list toggle (track 44 surface-2, icon segments 44 × 36, labelled "Grid" / "List").
- **Deep-link fallback banner:** radius 16, info colours (dark: surface-2 + divider), dismiss 44 ("That item was deleted — here's your closet").

### Inputs and forms (C06)

- **Text field:** label 15/600 above (always visible), field 48, radius 12, padding 0 14, Figtree 17, surface + 1 px outline; focus ring 2 at 2 offset; error 1.5 ring + icon message 13; disabled names why ("Set by your sign-in"); "Why we ask" helper line.
- **Number field with unit:** unit suffix 17 secondary, unit toggle track 44 surface-2. Out-of-range values are kept, never clamped; a warning-bg suggestion card offers "Use 176 cm" / "Keep 1760 cm".
- **Search field:** 48 pill, surface-2, leading search md, clear 44 × 44; no-results card offers a relax step ("Remove Winter").
- **Text area:** min 84, radius 12, padding 12 14, 17/24, Caption counter, grows with content.
- **Consent toggle row:** padding 14 16, radius 16, surface, purpose 17/600, effect 15, status + date always shown ("Granted 14 Oct 2026"), switch 51 × 31.
- **Pickers:** picker row 52 (padding 0 8 0 16, radius 16, value 17 secondary + chevron md, time in a surface-2 pill); birth-year wheel 5 rows × 34, selection band surface-2 radius 10, selected 20/600, with a why-we-ask line.
- **Selection controls:** switch 51 × 31 (knob 25, on primary, off outline, state word beside it, disabled names the reason, row min 48); checkbox 24 radius 6 (on, off, mixed; row 44); radio 24 (dot 11, ring 2, row 44 + one-line effect).
- **Segmented choice:** 44, surface-2 track padding 3, selected surface + 1.5 primary ring + check, Callout. **Stepper:** buttons 44 pill, surface + outline, value Headline tabular, limit as text.
- **Sliders:** calibration (later): track 6, thumb 28, fill primary, estimate = dashed ring + label, your value = solid thumb + number. Range: two thumbs 28, both values as text.
- **Date strip:** cell 44 × 76, radius 12, gap 2, weather icon sm; selected primary / on-primary; past the 16-day horizon surface-2, dashed outline, disabled.

### Lists and rows (C07)

- **Grouped list:** section header in Overline caps, inset card radius 16 on surface, settings rows 52, divider inset 52, icon lg primary-text, value 15 secondary. **Plain list:** rows 52, full-width divider; pressed surface-2 radius 12.
- **Toggle row** 64 (label 17 + helper 13, switch); **destructive row** 64 (error fg + icon + plain words; pressed error-bg).
- **Detail row with confidence:** label 12/500 + value 15/600, confidence as text; low band on warning-bg with icon. **Provisional row:** estimated value with dashed underline + Provisional tag until confirmed; Confirm is a primary outline button, Compact.
- **Device row** 64 (Sign out outlined 44; none on this device). **Item row** 72 (photo 56 radius 12, name 15/600, category · colour 13, availability tag 24, `AppTag`; unavailable mutes the photo, text stays readable). **Planned outfit row** (date 15/600, 3 thumbs 28 radius 8; flagged strip warning-bg + icon + "Rain now expected — review your plan"). **Collection row** 64 (3 overlapping thumbs).
- **Feedback history row** (Undo text button + Delete destructive text button, both Compact with icon md). **Upload queue rows** (photo 44 radius 10, status icon + text, progress 4; failed shows "Upload failed · photo is safe" + Retry). **Consent processor row** 60 (purpose · processor · region).

### Cards (C08)

- **Item tile:** 110 square, radius 16, surface-2, garment 64, badge 22; selected 2 px primary ring + check; muted garment at 40 %, label at full contrast.
- **Outfit card (signature):** 350 wide, padding 14, radius 24, surface + 1 px divider, collage 176 radius 18, Young Serif title, 3 reason chips, confidence as text, "5 items from your closet". **Partial:** missing slot 1.5 dashed outline radius 14 named in Footnote 13/600 ("Shoes — none that suit rain"), "Partial outfit" pill in warning, "Add shoes to unlock outfits".
- **Outfit option thumbnail:** 140 wide, collage 140 × 112 radius 14, Subhead label, selected 2 px primary ring + "Showing".
- **Compare card:** 500 wide, padding 16, radius 20, 2 columns gap 16; differing reasons get a "Differs" tag (accent / on-accent, `AppTag`) + 600 weight.
- **Discover card:** 360 wide, radius 20, image 170, Young Serif 20/26, source + freshness Footnote, closet link row 52 ("Pairs with your black wide-leg trousers"), "Why you're seeing this", actions 44 (Save, Follow, Show less, Hide, Report). No shopping links.
- **Upgrade card:** padding 18, radius 20, readable, never blurred, Headline + Callout, link button 44.
- **Paywall tier card:** min 84, padding 16, radius 18, radio 22, selected 2 px primary ring + "Selected" pill; prices show "[PRICE]" (pricing not final).
- **Credits, trial recap, profile summary cards:** padding 18, radius 20; balance / stats in Young Serif 26; profile initials 48, progress 6 primary on surface-2.
- **Empty-closet card:** replaces the outfit card at 0 items, 5 progress segments ("0 of 5"), primary button 44 "Add items". Never a blank card.

### Sheets, dialogs and overlays (C09)

- **Bottom sheet:** handle 36 × 4 radius 2 in outline, Title3 title, Callout body, actions 52 pinned, top radius 24, surface, sheet shadow, scrim behind. Tall sheet: top inset 72, body scrolls, actions pinned above a 1 px divider; dismiss by swipe down or scrim tap.
- **Action menu sheet:** rows 48 (52 at full scale), icon lg, gap 12, 15/500, pressed surface-2, divider before "Report a problem".
- **Confirmation dialog:** inset 12, radius 24, padding 20, dialog shadow, kept vs cleared summary; reset is two-step (step 1: Cancel secondary + Reset destructive tonal, Large 52 each). **Destructive confirmation:** after re-auth, states what is deleted, the timeline ("Within 30 days, usually about 8") and the store note; "Delete account" filled error and "Keep account" outlined, stacked full width, Large 52 each (the screens draw every overlay action at 52; the compact C09 mockup shows 44).
- **Permission priming (location, notifications):** shown at first use, before the OS prompt; radio rows 44 with the active pill on the selected row; "Allow" / "Turn on" and "Not now" have equal fill, size and weight (both tonal, Compact); all notification categories start off.
- **Coach mark:** scrim + undimmed target, surface bubble radius 16, padding 14, arrow 12, dialog shadow (`coach-mark-*` elevation; dark adds a 1 px `outline-dark` ring round the bubble and arrow), "Got it" text button Compact, shown once.
- **Full-screen modal header:** 56, close 44 left, Headline title centred, primary Save right, 1 px divider; Save disabled until a change.

### Garment illustrations (C10)

Flat item art for tiles and outfit cards (tops, bottoms, one-pieces, outerwear, bags, shoes, accessories, colour variants): tile 92, radius 16, surface-2, name in Caption. Mockup placeholders only.

### Named Rules

**The One Primary Rule.** One primary button per screen. Everything else is secondary, text or an icon button.

**The Equal Weight Rule.** Skip and Continue are the same size and label weight, side by side 1 : 1; Skip is the outlined secondary, Continue the primary, as every screen draws them. Allow and Not now, opt-in and opt-out are the same size, fill and weight (both tonal).

**The Tokens Only Rule.** Feature UI uses tokens only: no literal colours, font sizes, spacing, radii or durations in Swift or Kotlin feature code. A missing value is a missing token, so change this file first.

**The Generated Badge Rule.** Every generated image or view wears the "AI-generated preview" badge and a confidence label. A real user photo never gets the badge and is never replaced by a generated one.

## Do's and Don'ts

### Do:

- **Do** use tokens only: every colour, type style, spacing step, radius and size in feature UI comes from this file through the generated theme (The Tokens Only Rule).
- **Do** follow the canvas before code: a new screen or UI element is drawn on the Garderi App UI canvas from C01–C10, in S1 and S2, and approved by the owner before it is built.
- **Do** draw and build every state: empty, loading (skeleton, never blank), partial, failure (cause + effect + one action), retry, offline ("Based on data from 07:10").
- **Do** pair every state with an icon + words; show source + freshness next to weather and generated content.
- **Do** show confidence as words ("High confidence", "Approximate") and mark estimated values differently from entered ones (dashed underline + Provisional tag).
- **Do** keep touch targets at 44 × 44 pt (iOS) and 48 × 48 dp (Android), and support Dynamic Type and Android font scale to 200 %: titles, names, reasons, body and button labels wrap; chips drop under the text; paired buttons stack full width; only grid-tile names truncate (after 2 lines, full name read aloud); photos and the collage keep their size, and icons grow with the text (owner 2026-10-21).
- **Do** label for screen readers: item tile = name, category, colour, availability ("Green wool jacket, outerwear, green, available"); icon buttons = verb + object; generated views = "AI-generated preview, medium confidence"; tab = "Today, tab, 1 of 5, selected".
- **Do** honour reduced motion with a 150 ms crossfade and no shimmer or auto-rotate; give every 3D view a non-3D equivalent (the collage).
- **Do** name the trigger on a paywall ("Planning ahead is part of Plus"), keep Restore visible, and show prices as "[PRICE]".
- **Do** use the honest avatar lines exactly: "An adjustable 3D model with your proportions", "A stylized avatar that resembles you", "A visualization, not a fit guarantee".

### Don't:

- **Don't** write "digital twin", "exact", "looks exactly like you" or any fit guarantee anywhere in the UI.
- **Don't** show confidence as colour alone or as a percentage, and don't invent progress percentages.
- **Don't** show a generated image without the "AI-generated preview" badge + confidence, and never put that badge on a real photo.
- **Don't** add a second primary button to a screen, or make Skip / Not now smaller or lighter than its partner.
- **Don't** write explanation text by hand or with an LLM: reason chips and their detail come from reason-code templates, and they never mention body data.
- **Don't** add colours, font sizes, spacing values or radii that are not in this file; don't use opacity alone for disabled text; don't use `accent-*` or `divider-*` as a text colour (the one exception: Undo on inverse surfaces).
- **Don't** put shadows on cards, or blur a paywall or upgrade card.
- **Don't** show shopping links, budget fields or any commerce.
- **Don't** use body judgment, BMI or health framing, attractiveness scores, or gendered labels for body presets (use "broad-shouldered", "curvy", "straight", "softer").
- **Don't** clamp a user's value silently; keep what they typed and suggest ("Did you mean 176 cm?").
- **Don't** edit tokens in Swift, Kotlin or any theme file: change this file (after an approved canvas change) and regenerate.
