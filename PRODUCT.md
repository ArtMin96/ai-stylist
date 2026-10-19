# Product

<!-- impeccable:product-schema 1 -->

> Derived record. `planning/SPINE.md` and the decision log (`planning/16-risks-open-questions-and-decision-log.md`) are the source of truth; when they disagree with this file, they win and this file is updated. Shared by both native apps (iOS and Android). Visual system: `DESIGN.md` (token master) and the "Garderi App UI" canvas (https://claude.ai/artifact/3PfhQn2y9YKXtBz2fc1GeE).

## Platform

adaptive

## Users

Primary user (owner-confirmed 2026-10-18): the **daily dresser**, someone tired of deciding what to wear each morning who wants a good outfit for today's weather and plans, with reasons, in seconds. When design decisions conflict, favour this person; the Today tab is the launch tab for that reason.

Other audiences (planning doc 00 §2), served without overriding the daily dresser:

- Wardrobe organisers: a searchable closet, wear history, fewer duplicate purchases.
- Style developers: inspiration tied to what they already own.
- Fit-sensitive people: an avatar with their own proportions, never an idealised mannequin.

Age 16+ everywhere (DEC-60, self-declared birth year). Global, English first.

## Product Purpose

Garderi is a personal AI stylist. People add their own clothes, shoes and accessories; Garderi suggests explainable outfits made only from items they own, using the weather and forecast, holidays, the occasion and what it has learned about their preferences. Success is a person who gets dressed faster and more happily from their own closet, understands why each outfit was suggested, and trusts what the app says about their data.

## Positioning

Garderi suggests what to wear only from clothes you already own, explains every suggestion in plain words, and never sells you anything. (Owner-confirmed 2026-10-18.)

## Operating Context

- Used on the phone, mostly in the morning before getting dressed, often one-handed and in a hurry; also when adding new clothes (camera, plain background) and when planning a day ahead.
- Five tabs: Today (launch) · Closet · Capture (centre, opens the camera directly) · Discover · You (planning doc 02 §2.1; owner decisions 2026-10-18).
- Works offline for browsing, editing and capture (queued uploads); cached outfits and context are labelled with their age.
- Sign-in with Apple, Google or a passkey only (DEC-64); passkey sign-ups give an email for recovery (owner decision 2026-10-18).

## Capabilities and Constraints

- Closet capture: single and batch, background removal, automatic attributes shown as provisional until the user confirms; duplicates are never merged automatically.
- Closet organisation: categories and attributes from the closet taxonomy; six separate availability states (available, laundry, packed, lent, repair, archived); wear history marked by the user only.
- Today: outfits from available items only, with reason chips from fixed templates (no AI-written explanations, DEC-46), a confidence label in words, alternatives, feedback (like, dislike with reasons, replace an item, never suggest this pairing), save, schedule and plan a future day (up to 16 days).
- Every generated image carries an "AI-generated preview" marker and a confidence label; a real photo is never replaced by a generated one.
- Avatar, outfit-on-avatar, selfie personalisation and photo try-on are designed but wait for the 3D go/no-go (DEC-76), legal sign-off for face data, and the try-on provider privacy review. The 2D outfit collage is the first-class view.
- Plans: Free, Essentials, Plus, Pro, with a 3-day trial and credits for generation. All prices are hypotheses and are shown as placeholders until pricing is decided.
- Discover (trends) depends on licensed content (OQ-05) and has no shopping links.
- Not in scope: commerce or shopping links, budget fields, social feeds or shared closets, calendar access in v1, stylist chat before P15, body scoring, health framing, or inferring gender, age or ethnicity (planning doc 00 §5).
- Naming: the product is Garderi (DEC-85); the codebase keeps "ai-stylist" / "AI Stylist" until the rename pass (AI-182).
- Open decisions: the feature list of the first minimal release (DEC-79), final pricing (OQ-12), the avatar pose set (OQ-10), which plan includes the stylized face (OQ-22).

## Brand Commitments

- Name: Garderi, lowercase wordmark "garderi".
- App icon: logo P2 "Garden Viridian" (a Naples-yellow g on viridian oil-paint dabs), chosen by the owner 2026-10-18; brand visuals live in the Claude Design canvases, never generated into the repo.
- Voice, binding (owner-confirmed 2026-10-18): calm, perceptive, warm, crafted, honest. Warm, never silly; serious about trust, light in delivery.
- Honesty rules: never "digital twin", "exact" or "looks exactly like you", and no fit guarantees. Allowed lines: "An adjustable 3D model with your proportions" and "A stylized avatar that resembles you". Confidence is always words, never colour alone or invented percentages. Trial, never "free trial".

## Evidence on Hand

- Planning docs: `planning/` (SPINE, docs 00–16, phase files P00–P15).
- Brand context: `.agents/brand-context.md`.
- Design: the "Garderi App UI" canvas (wireframes, components, every core screen in light and dark, clickable prototype, design rules) and the "Garderi Colour Schemes" canvas (palette, schemes S1–S7, typography).
- No users, testimonials, reviews, press, metrics or case studies exist yet. Future work must not invent any.

## Product Principles

1. Only what you own: every suggestion comes from the user's own closet; the app never sells or links to shops.
2. Explain everything: each outfit shows why, from fixed reason templates, and names missing or stale data instead of guessing.
3. Honest about uncertainty: provisional values, assumptions and generated images are always labelled; nothing estimated is presented as fact.
4. Consent at the moment of use: sensitive permissions and consents are asked only when needed, with equal-weight yes and no; every notification starts off.
5. Fast for the morning: the daily dresser gets a usable outfit in seconds, and every screen has a clear empty, loading, error and offline state with one action that fixes it.

## Accessibility & Inclusion

- Standard: WCAG 2.2 AA (owner-confirmed 2026-10-18): 4.5:1 text contrast (3:1 for large text and controls), touch targets 44 pt on iOS and 48 dp on Android, VoiceOver and TalkBack support, text scaling to 200% with Dynamic Type and Android font scale, reduced motion respected.
- Every 3D view has a non-3D equivalent with the same information.
- Inclusive by default: body presets are named by shape, never gender; skin tones and hair cover a wide range; no body judgement anywhere.
- User-facing strings and test ids are identical on both apps.
