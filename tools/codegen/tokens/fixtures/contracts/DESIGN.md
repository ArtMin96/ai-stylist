---
version: alpha
name: Contract fixture
description: Synthetic tokens for the component-contract tests; not the product design system.
colors:
  background-light: '#FAFAFA'
  background-dark: '#0A0A0A'
  text-light: '#111111'
  text-dark: '#EEEEEE'
  text-secondary-light: '#666666'
  text-secondary-dark: '#999999'
  primary-light: '#336699'
  primary-dark: '#99CCFF'
  primary-pressed-light: '#224477'
  primary-pressed-dark: '#77AADD'
  on-primary-light: '#FFFFFF'
  on-primary-dark: '#000000'
  surface-2-light: '#EEEEEE'
  surface-2-dark: '#222222'
  outline-light: '#888888'
  outline-dark: '#777777'
  focus-light: '#0055CC'
  focus-dark: '#66AAFF'
  focus-hc-light: '#000000'
  focus-hc-dark: '#FFFFFF'
typography:
  heading:
    fontFamily: 'Fixture Serif, serif'
    fontSize: 28px
    fontWeight: 400
    lineHeight: 34px
    letterSpacing: 0em
    dynamicType: title
    m3Roles: [displayLarge, displayMedium, displaySmall, headlineLarge, headlineMedium]
  body:
    fontFamily: 'Fixture Sans, sans-serif'
    fontSize: 16px
    fontWeight: 400
    lineHeight: 22px
    letterSpacing: 0em
    dynamicType: body
    m3Roles: [headlineSmall, titleLarge, titleMedium, titleSmall, bodyLarge]
  label:
    fontFamily: 'Fixture Sans, sans-serif'
    fontSize: 12px
    fontWeight: 600
    lineHeight: 16px
    letterSpacing: 0em
    dynamicType: caption
    m3Roles: [bodyMedium, bodySmall, labelLarge, labelMedium, labelSmall]
  label-muted:
    fontFamily: 'Fixture Sans, sans-serif'
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0em
    dynamicType: caption
    m3Roles: []
rounded:
  full: 999px
spacing:
  '8': 8px
  '12': 12px
  '16': 16px
elevation:
  raised: 2px
motion:
  press: 150ms
components:
  focus-ring-light: { width: 2px, offset: 2px, color: '{colors.focus-light}' }
  focus-ring-dark: { width: 2px, offset: 2px, color: '{colors.focus-dark}' }
  focus-ring-hc-light: { width: 3px, offset: 2px, color: '{colors.focus-hc-light}' }
  focus-ring-hc-dark: { width: 3px, offset: 2px, color: '{colors.focus-hc-dark}' }
  button-primary-light:
    backgroundColor: '{colors.primary-light}'
    textColor: '{colors.on-primary-light}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    height: 48px
    padding: 0 16px
  button-primary-dark:
    backgroundColor: '{colors.primary-dark}'
    textColor: '{colors.on-primary-dark}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    height: 48px
    padding: 0 16px
  button-primary-pressed-light:
    backgroundColor: '{colors.primary-pressed-light}'
  button-primary-pressed-dark:
    backgroundColor: '{colors.surface-2-dark}'
  button-primary-disabled-light:
    backgroundColor: '{colors.surface-2-light}'
    textColor: '{colors.text-secondary-light}'
    typography: '{typography.label-muted}'
  button-primary-disabled-dark:
    backgroundColor: '{colors.surface-2-dark}'
    textColor: '{colors.text-secondary-dark}'
    typography: '{typography.label-muted}'
  # Shared size entries: each holds its size's icon slot (iconSize, iconGap) for every variant.
  # button-large serves only the slots: the variants' own bases hold the large height and padding.
  # It also holds the trailing slot (trailingIconSize, trailingIconGap), which only the large
  # secondary draws; button-small lacks it on purpose (../CC-08-trailing/button.yaml).
  # button-medium lacks the slot on purpose: only ../CC-08/button.yaml uses the medium size.
  # The slot names an icon size (CC-12), by its key (large: the form the pinned design.md lint
  # accepts) or as a {components.…} reference (small), and the spacing scale; 4px is on no scale.
  button-large:
    height: 48px
    padding: '0 {spacing.16}'
    iconSize: icon-md
    iconGap: '{spacing.8}'
    trailingIconSize: icon-sm
    trailingIconGap: 6px
  button-medium: { height: 40px, padding: 0 14px }
  button-small:
    typography: '{typography.body}'
    height: 36px
    padding: '0 {spacing.12}'
    iconSize: '{components.icon-sm}'
    iconGap: 4px
  button-outline-ring: { width: 1.5px }
  button-secondary-light:
    textColor: '{colors.text-light}'
    borderColor: '{colors.outline-light}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    height: 48px
    padding: 0 16px
  button-secondary-dark:
    textColor: '{colors.text-dark}'
    borderColor: '{colors.outline-dark}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    height: 48px
    padding: 0 16px
  button-secondary-pressed-light:
    backgroundColor: '{colors.surface-2-light}'
  button-secondary-pressed-dark:
    backgroundColor: '{colors.surface-2-dark}'
  button-secondary-loading-light:
    spinnerColor: '{colors.primary-light}'
  button-secondary-loading-dark:
    spinnerColor: '{colors.primary-dark}'
  # The chip of ../_valid/chip.yaml (the C03 fields). chip-medium is the shared size entry: the
  # assist chip's label, height and padding, and both icon slots (assist draws a trailing glyph).
  # The choice base holds its own size, so its states stay visible in the merge: selected, then
  # the compound selected-pressed (G2), whose key regroups under chip-choice.
  chip-medium:
    typography: '{typography.body}'
    height: 36px
    padding: '0 {spacing.12}'
    iconSize: icon-sm
    iconGap: 4px
    trailingIconSize: icon-sm
    trailingIconGap: 4px
  chip-outline-ring: { width: 1px }
  chip-assist-light:
    backgroundColor: '{colors.surface-2-light}'
    textColor: '{colors.text-light}'
    rounded: '{rounded.full}'
    dotSize: 6px
    noteTypography: '{typography.label-muted}'
    outerRingWidth: 2px
  chip-assist-dark:
    backgroundColor: '{colors.surface-2-dark}'
    textColor: '{colors.text-dark}'
    rounded: '{rounded.full}'
    dotSize: 6px
    noteTypography: '{typography.label-muted}'
    outerRingWidth: 2px
  chip-assist-pressed-light: { backgroundColor: '{colors.outline-light}' }
  chip-assist-pressed-dark: { backgroundColor: '{colors.outline-dark}' }
  chip-choice-light:
    textColor: '{colors.text-light}'
    borderColor: '{colors.outline-light}'
    detailColor: '{colors.text-secondary-light}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    height: 36px
    padding: 0 12px
    swatchSize: 16px
  chip-choice-dark:
    textColor: '{colors.text-dark}'
    borderColor: '{colors.outline-dark}'
    detailColor: '{colors.text-secondary-dark}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    height: 36px
    padding: 0 12px
    swatchSize: 16px
  chip-choice-pressed-light: { backgroundColor: '{colors.surface-2-light}' }
  chip-choice-pressed-dark: { backgroundColor: '{colors.surface-2-dark}' }
  chip-choice-selected-light:
    backgroundColor: '{colors.primary-light}'
    textColor: '{colors.on-primary-light}'
    borderColor: '{colors.primary-light}'
    padding: 0 12px 0 8px
  chip-choice-selected-dark:
    backgroundColor: '{colors.primary-dark}'
    textColor: '{colors.on-primary-dark}'
    borderColor: '{colors.primary-dark}'
    padding: 0 12px 0 8px
  chip-choice-selected-pressed-light: { backgroundColor: '{colors.primary-pressed-light}' }
  chip-choice-selected-pressed-dark: { backgroundColor: '{colors.primary-pressed-dark}' }
  # The icon scale for ../_valid/icon.yaml: size in px, strokeWidth in viewBox units (24 x 24).
  # ../CC-10/icon.yaml names icon-xl, which is missing on purpose.
  icon-xs: { size: 12px, strokeWidth: 2.2 }
  icon-sm: { size: 16px, strokeWidth: 1.9 }
  icon-md: { size: 20px, strokeWidth: 1.7 }
  icon-lg: { size: 24px, strokeWidth: 1.7 }
---

# Design System: Contract fixture

Synthetic input for the component-contract tests (`tools/codegen/tokens/contracts.mjs`). Every
value is made up.
