---
version: alpha
name: Token fixture TK-05
description: The valid fixture whose light and dark primary buttons disagree on height.
colors:
  background-light: '#FAFAFA'
  background-dark: '#0A0A0A'
  text-light: '#111111'
  text-dark: '#EEEEEE'
  primary-light: '#336699'
  primary-dark: '#99CCFF'
  primary-pressed-light: '#224477'
  primary-pressed-dark: '#77AADD'
  on-primary-light: '#FFFFFF'
  on-primary-dark: '#000000'
  surface-2-light: '#EEEEEE'
  surface-2-dark: '#222222'
  background-brand: '#225533'
  text-brand: '#F5F5F5'
  background-hc-light: '#FFFFFF'
  text-hc-light: '#000000'
  background-hc-dark: '#000000'
  text-hc-dark: '#FFFFFF'
  scrim: 'rgba(0,0,0,0.5)'
  ring-light: '#CCCCCC'
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
    letterSpacing: 0.05em
    dynamicType: .caption
    m3Roles: [bodyMedium, bodySmall, labelLarge, labelMedium, labelSmall]
  badge:
    fontFamily: 'Fixture Sans, sans-serif'
    fontSize: 11px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: 0.5px
    dynamicType: caption2
    m3Roles: []
rounded:
  '4': 4px
  full: 999px
spacing:
  '4': 4px
  '8': 8px
  '16': 16px
elevation:
  raised: 2px
  sheet:
    offsetY: -4px
    blur: 16px
    color: '{colors.scrim}'
motion:
  press: 150ms
  screen: 0.3s
  easing-enter: 'cubic-bezier(0.2, 0, 0, 1)'
components:
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
    height: 44px
    padding: 0 16px
  button-primary-pressed-light:
    backgroundColor: '{colors.primary-pressed-light}'
  button-primary-pressed-dark:
    backgroundColor: '{colors.primary-pressed-dark}'
  chip-outline-light:
    backgroundColor: '{colors.surface-2-light}'
    borderColor: '{colors.ring-light}'
    rounded: '{rounded.4}'
    padding: 4px 8px
  overlay:
    backgroundColor: '{colors.scrim}'
    gap: '{spacing.8}'
    duration: '{motion.press}'
---

# Design System: Token fixture TK-05

Synthetic input for the design-token generator tests. Every value is made up.

## Colors

Unpaired by design: `scrim`, `ring-light`.
