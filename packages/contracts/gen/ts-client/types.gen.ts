// GENERATED — do not edit. Run `just generate`.
// Source: packages/contracts/openapi/**

export type ClientOptions = {
  baseUrl: 'https://api.ai-stylist.app' | 'http://localhost:3000' | (string & {});
};

/**
 * RFC 9457 problem details (planning/06 §2). `code` is stable and machine-readable.
 */
export type ProblemDetails = {
  /**
   * URI identifying the problem type
   */
  type: string;
  title: string;
  status: number;
  /**
   * Stable machine code from the shared-kernel error registry
   */
  code: string;
  detail?: string;
  instance?: string;
  /**
   * Field-level validation failures with JSON-pointer paths
   */
  errors?: Array<ProblemFieldError>;
};

export type ProblemFieldError = {
  /**
   * RFC 6901 JSON pointer into the request body
   */
  pointer: string;
  message: string;
  code?: string;
};

export type HealthCheckStatus = 'ok' | 'down';

export type HealthReport = {
  status: 'ok';
  checks: {
    db: HealthCheckStatus;
  };
};

export type VersionInfo = {
  /**
   * Semantic version of the deployed API
   */
  version: string;
  /**
   * Git commit SHA the build was produced from
   */
  commit: string;
  /**
   * RFC 3339 UTC build timestamp
   */
  builtAt: string;
};

/**
 * Identity providers that sign in with a native identity token (DEC-64).
 */
export type IdentityProvider = 'apple' | 'google';

export type IdTokenSignInRequest = {
  provider: IdentityProvider;
  idToken: {
    /**
     * The provider's identity token (a JWT), verified against the provider's keys.
     */
    token: string;
    /**
     * The unhashed nonce the app generated for the provider request. The identity
     * token's `nonce` claim must equal it or its SHA-256 digest. Sign in with Apple
     * requires it.
     *
     */
    nonce?: string;
    /**
     * Name the provider reports to the app on the first authorization only (Sign in with Apple).
     */
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
    };
  };
};

/**
 * Account id, a prefixed ULID (`usr_`, shared-kernel `ID_PREFIXES.user`).
 */
export type UserId = string;

/**
 * A session the server opened or renewed.
 */
export type SessionGrant = {
  userId: UserId;
  /**
   * The session token for `bearerAuth`. Kept in the Keychain or Keystore-backed storage only (doc 11 §4.2).
   */
  token: string;
  /**
   * When the session ends unless renewed with `refreshSession`. The server may refuse
   * the token earlier (revocation, or a shorter access window, doc 11 §4.2); the client
   * then renews once.
   *
   */
  expiresAt: string;
};

/**
 * The account is inside its 7-day deletion grace window (DEC-65): no session was opened.
 * The only thing the client can do is offer to cancel the deletion with `cancelToken`.
 *
 */
export type DeletionPending = {
  /**
   * End of the grace window; the purge starts after it.
   */
  graceEndsAt: string;
  /**
   * Value for the `Deletion-Cancel-Token` header (`deletionCancelToken`); valid only for `DELETE /v1/me/deletion`.
   */
  cancelToken: string;
  /**
   * At most 15 minutes after issue (doc 11 §4.2).
   */
  cancelTokenExpiresAt: string;
};

/**
 * The verified identity has no account. Nothing is stored. The client asks for the birth
 * year and calls `completeSignUp` with `token`.
 *
 */
export type SignUpPending = {
  /**
   * Sign-up credential for `CompleteSignUpRequest.signUpToken`. Single use, valid only
   * for `completeSignUp`; it opens no session and grants nothing else.
   *
   */
  token: string;
  /**
   * At most 15 minutes after issue.
   */
  expiresAt: string;
};

/**
 * One sign-in outcome. `outcome` names it, and exactly the object of that outcome is
 * present: `session` for `session`, `deletionPending` for `deletion_pending`, `signUp` for
 * `sign_up_required`. Only `session` opens a session.
 *
 */
export type SignInResult = {
  outcome: 'session' | 'deletion_pending' | 'sign_up_required';
  session?: SessionGrant;
  deletionPending?: DeletionPending;
  signUp?: SignUpPending;
};

export type CompleteSignUpRequest = {
  /**
   * `SignUpPending.token` of the `sign_up_required` answer.
   */
  signUpToken: string;
  /**
   * Self-declared birth year (DEC-60). Only a sanity range is enforced here; the age
   * floor is the server's rule and is never restated by a client.
   *
   */
  birthYear: number;
};

/**
 * Base64url without padding (RFC 4648 §5), as WebAuthn JSON encodes binary values.
 */
export type Base64Url = string;

/**
 * W3C WebAuthn `PublicKeyCredentialDescriptorJSON`.
 */
export type PasskeyCredentialDescriptor = {
  id: Base64Url;
  type: 'public-key';
  transports?: Array<string>;
};

/**
 * WebAuthn extension inputs (`AuthenticationExtensionsClientInputsJSON`). Only the
 * extensions this API requests are modelled.
 *
 */
export type PasskeyExtensionInputs = {
  credProps?: boolean;
};

/**
 * W3C WebAuthn `PublicKeyCredentialRequestOptionsJSON`.
 */
export type PasskeyRequestOptions = {
  challenge: Base64Url;
  timeout?: number;
  rpId?: string;
  allowCredentials?: Array<PasskeyCredentialDescriptor>;
  userVerification?: 'required' | 'preferred' | 'discouraged';
  hints?: Array<string>;
  extensions?: PasskeyExtensionInputs;
};

/**
 * WebAuthn extension outputs (`AuthenticationExtensionsClientOutputsJSON`). Only the
 * extensions this API reads are modelled; send `{}` when there are none.
 *
 */
export type PasskeyExtensionOutputs = {
  credProps?: {
    rk?: boolean;
  };
};

/**
 * W3C WebAuthn `AuthenticationResponseJSON`.
 */
export type PasskeyAuthenticationResponse = {
  id: Base64Url;
  rawId: Base64Url;
  type: 'public-key';
  authenticatorAttachment?: 'platform' | 'cross-platform';
  clientExtensionResults: PasskeyExtensionOutputs;
  response: {
    clientDataJSON: Base64Url;
    authenticatorData: Base64Url;
    signature: Base64Url;
    userHandle?: Base64Url;
  };
};

export type PasskeySignInRequest = {
  response: PasskeyAuthenticationResponse;
};

/**
 * W3C WebAuthn `PublicKeyCredentialCreationOptionsJSON`.
 */
export type PasskeyCreationOptions = {
  rp: {
    id?: string;
    name: string;
  };
  user: {
    id: Base64Url;
    name: string;
    displayName: string;
  };
  challenge: Base64Url;
  pubKeyCredParams: Array<{
    type: 'public-key';
    alg: number;
  }>;
  timeout?: number;
  excludeCredentials?: Array<PasskeyCredentialDescriptor>;
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    residentKey?: 'discouraged' | 'preferred' | 'required';
    requireResidentKey?: boolean;
    userVerification?: 'required' | 'preferred' | 'discouraged';
  };
  attestation?: 'none' | 'indirect' | 'direct' | 'enterprise';
  hints?: Array<string>;
  extensions?: PasskeyExtensionInputs;
};

/**
 * W3C WebAuthn `RegistrationResponseJSON`.
 */
export type PasskeyRegistrationResponse = {
  id: Base64Url;
  rawId: Base64Url;
  type: 'public-key';
  authenticatorAttachment?: 'platform' | 'cross-platform';
  clientExtensionResults: PasskeyExtensionOutputs;
  response: {
    clientDataJSON: Base64Url;
    attestationObject: Base64Url;
    authenticatorData?: Base64Url;
    transports?: Array<string>;
    publicKeyAlgorithm?: number;
    publicKey?: Base64Url;
  };
};

export type PasskeyRegistrationRequest = {
  response: PasskeyRegistrationResponse;
  /**
   * Label the person gives the passkey.
   */
  name?: string;
};

/**
 * A passkey stored on the account. Carries no key material.
 */
export type PasskeySummary = {
  name?: string;
  createdAt: string;
};

/**
 * The current session, without its token.
 */
export type SessionInfo = {
  userId: UserId;
  expiresAt: string;
  /**
   * True when the server asks the client to renew now with `refreshSession`.
   */
  needsRefresh?: boolean;
};

export type SignOutResult = {
  success: boolean;
};

/**
 * One signed-in device of the caller. Carries no token and no IP address.
 */
export type DeviceSession = {
  /**
   * True for the session that made this request.
   */
  current: boolean;
  /**
   * When the device signed in.
   */
  createdAt: string;
  /**
   * Last renewal of the session.
   */
  lastActiveAt: string;
  expiresAt: string;
  /**
   * The `User-Agent` the device sent at sign-in, to tell devices apart.
   */
  userAgent?: string;
};

export type DeviceSessionPage = {
  items: Array<DeviceSession>;
  /**
   * Cursor of the next page; null on the last page.
   */
  nextCursor: string | null;
};

export type RevokeSessionsResult = {
  status: boolean;
};

export type RecoveryRequest = {
  email: string;
};

export type RecoveryRequestAccepted = {
  /**
   * Always true, whether or not an account exists for the address.
   */
  status: boolean;
};

/**
 * Consent record id, a prefixed ULID (`cns_`, shared-kernel `ID_PREFIXES.consentRecord`).
 */
export type ConsentRecordId = string;

/**
 * Consent purpose keys of doc 11 §7.2, in that order. Mirrors shared-kernel
 * `CONSENT_PURPOSES` value for value (pinned by packages/contracts/tests/kernel-enums.test.ts).
 *
 */
export type ConsentPurpose =
  | 'core_service'
  | 'face_processing'
  | 'location_precise'
  | 'analytics'
  | 'ai_generative'
  | 'notifications'
  | 'training_data';

export type ConsentStatus = 'granted' | 'withdrawn';

/**
 * Version of the policy text the person saw, e.g. `0.1.0-draft`.
 */
export type PolicyVersion = string;

/**
 * Identifier of the app screen where the decision was made, e.g. `onboarding_consent`.
 */
export type ConsentSurface = string;

/**
 * BCP 47 language tag, e.g. `en-GB`.
 */
export type Locale = string;

/**
 * One append-only consent record (doc 11 §7.1); `locale` is the language of the text the
 * person saw.
 *
 */
export type ConsentRecord = {
  id: ConsentRecordId;
  purpose: ConsentPurpose;
  status: ConsentStatus;
  policyVersion: PolicyVersion;
  /**
   * When the consent was granted; present when `status` is `granted`.
   */
  grantedAt?: string;
  /**
   * When the consent was withdrawn; present when `status` is `withdrawn`.
   */
  withdrawnAt?: string;
  surface: ConsentSurface;
  locale: Locale;
};

export type ConsentPage = {
  items: Array<ConsentRecord>;
  /**
   * Cursor of the next page; null on the last page.
   */
  nextCursor: string | null;
};

/**
 * One consent decision; `locale` is the language of the text the person saw.
 */
export type ConsentChange = {
  purpose: ConsentPurpose;
  status: ConsentStatus;
  policyVersion: PolicyVersion;
  surface: ConsentSurface;
  locale: Locale;
};

/**
 * Profile id, a prefixed ULID (`prf_`, shared-kernel `ID_PREFIXES.profile`).
 */
export type ProfileId = string;

/**
 * Version of the resource (doc 06 §2). It grows by one with every accepted write; 0 means
 * nothing has been written yet. Send it back as `If-Match: "<version>"`.
 *
 */
export type ResourceVersion = number;

/**
 * Presentation the person chooses (doc 03 §1.2, doc 07 §3.1); never inferred, and it never
 * limits which starting shape or measurements are valid. Default `unspecified`. Mirrors
 * shared-kernel `PRESENTATIONS`.
 *
 */
export type Presentation = 'feminine' | 'masculine' | 'androgynous' | 'unspecified';

/**
 * Id of the starting shape the avatar begins from (doc 07 §3.1), the base-model selection
 * of onboarding. One of the shapes of the shared-kernel registry
 * `registry/starting-shapes.json`; the server refuses any other id with 400
 * `VALIDATION_FAILED`. Default `from_measurements`. An id string, not an enum, so that a
 * shape can be added or retired (P04) without a breaking contract change. The base mesh
 * all shapes share is a kernel constant and is not stored per person.
 *
 */
export type StartingShapeId = string;

/**
 * How the apps show measurements; it never changes what the API stores or returns (SI).
 * Mirrors shared-kernel `UNIT_SYSTEMS`.
 *
 */
export type UnitSystem = 'metric' | 'imperial';

/**
 * IANA time zone name, e.g. `Europe/Berlin`.
 */
export type TimeZone = string;

/**
 * ISO 3166-1 alpha-2 region code, e.g. `DE`. A setting the person chooses, not a location.
 */
export type RegionCode = string;

/**
 * Accessibility settings the apps apply (phase P03 §4). Both are `false` by default.
 */
export type AccessibilitySettings = {
  /**
   * Show no motion that is not needed to understand the screen.
   */
  reducedMotion: boolean;
  /**
   * Prefer flat images to 3D views wherever the app offers both.
   */
  prefersNon3d: boolean;
};

/**
 * The caller's profile settings. `presentation` and `startingShape` are independent: any
 * presentation goes with any starting shape (REQ-ONB-050). The six settings of REQ-ONB-100
 * are `locale` (formats dates and numbers, e.g. `en-GB`), `language` (the language of the
 * app's text, e.g. `en`), `unitSystem`, `timezone`, `region` and `accessibility`. The first
 * five are absent until the person confirms them in onboarding (step "units and locale";
 * the app pre-fills them from the device), and are edited, not removed, after that.
 *
 */
export type Profile = {
  id: ProfileId;
  version: ResourceVersion;
  presentation: Presentation;
  startingShape: StartingShapeId;
  locale?: Locale;
  language?: Locale;
  unitSystem?: UnitSystem;
  timezone?: TimeZone;
  region?: RegionCode;
  accessibility: AccessibilitySettings;
};

/**
 * Partial update of `Profile`: each member present replaces its stored value. `presentation`
 * returns to its default by sending `unspecified`, `startingShape` by sending
 * `from_measurements`.
 *
 */
export type ProfileUpdate = {
  presentation?: Presentation;
  startingShape?: StartingShapeId;
  locale?: Locale;
  language?: Locale;
  unitSystem?: UnitSystem;
  timezone?: TimeZone;
  region?: RegionCode;
  accessibility?: AccessibilitySettings;
};

/**
 * A problem (RFC 9457) that carries the stored profile when `code` is `VERSION_MISMATCH`.
 */
export type ProfileVersionConflict = ProblemDetails & {
  current?: Profile;
};

/**
 * Stored length unit. Mirrors shared-kernel `LENGTH_UNITS`.
 */
export type LengthUnit = 'cm';

/**
 * Who produced the value (doc 06 §3.1): the person (`user`), an estimate, or a value
 * derived from other values. Mirrors shared-kernel `MEASUREMENT_SOURCES`.
 *
 */
export type MeasurementSource = 'user' | 'estimated' | 'derived';

/**
 * Confidence in the value, from 0 to 1.
 */
export type MeasurementConfidence = number;

/**
 * A body length in centimetres with its provenance (doc 06 §3.1). `confidence` is always
 * present when `source` is `estimated` or `derived`, and optional for `user`.
 *
 */
export type LengthMeasurement = {
  /**
   * The length, in `unit`.
   */
  value: number;
  unit: LengthUnit;
  source: MeasurementSource;
  confidence?: MeasurementConfidence;
  /**
   * When the value was taken or entered.
   */
  measuredAt?: string;
};

/**
 * Stored mass unit. Mirrors shared-kernel `MASS_UNITS`.
 */
export type MassUnit = 'kg';

/**
 * A body mass in kilograms with its provenance (doc 06 §3.1). `confidence` is always
 * present when `source` is `estimated` or `derived`, and optional for `user`.
 *
 */
export type MassMeasurement = {
  /**
   * The mass, in `unit`.
   */
  value: number;
  unit: MassUnit;
  source: MeasurementSource;
  confidence?: MeasurementConfidence;
  /**
   * When the value was taken or entered.
   */
  measuredAt?: string;
};

/**
 * The ten body measurements of doc 07 §3.3, each optional: an absent one has not been
 * given. Their ids, units and hard bounds are shared-kernel registry data
 * (`registry/measurement-definitions.json`); a value outside its bounds is refused with
 * 400 `MEASUREMENT_IMPLAUSIBLE` and never stored.
 *
 */
export type BodyMeasurements = {
  height?: LengthMeasurement;
  weight?: MassMeasurement;
  chest?: LengthMeasurement;
  waist?: LengthMeasurement;
  hips?: LengthMeasurement;
  inseam?: LengthMeasurement;
  shoulder?: LengthMeasurement;
  sleeve?: LengthMeasurement;
  thigh?: LengthMeasurement;
  neck?: LengthMeasurement;
};

/**
 * The caller's current measurement set (doc 03 §1.2). Each value is SI with its unit and
 * source; `unitSystem` changes only how an app shows it.
 *
 */
export type MeasurementSet = {
  version: ResourceVersion;
  measurements: BodyMeasurements;
};

/**
 * The whole new measurement set; a measurement left out is removed.
 */
export type MeasurementsReplacement = {
  measurements: BodyMeasurements;
};

/**
 * A problem (RFC 9457) that carries the stored measurement set when `code` is `VERSION_MISMATCH`.
 */
export type MeasurementSetVersionConflict = ProblemDetails & {
  current?: MeasurementSet;
};

/**
 * Mirrors shared-kernel `FIT_CHOICES`.
 */
export type FitChoice = 'fitted' | 'regular' | 'relaxed' | 'oversized';

/**
 * Preferred fit per garment group (doc 08 §4.2 `attr.cut`); a group with no choice is
 * absent. The keys are the shared-kernel `GARMENT_GROUPS` except `shoes`.
 *
 */
export type FitPreferences = {
  tops?: FitChoice;
  bottoms?: FitChoice;
  dresses?: FitChoice;
  outerwear?: FitChoice;
};

/**
 * Mirrors shared-kernel `STYLE_TYPES`.
 */
export type StyleType = 'minimal' | 'classic' | 'smart_casual';

/**
 * The style types the person selected (style identity, doc 03 §1.2).
 */
export type StyleTypeList = Array<StyleType>;

/**
 * Mirrors shared-kernel `PREFERENCE_KINDS`.
 */
export type PreferenceKind = 'material';

/**
 * Material values of doc 08 §4.1 `attr.material`. Mirrors shared-kernel `MATERIALS`.
 */
export type Material =
  | 'cotton'
  | 'linen'
  | 'wool'
  | 'cashmere'
  | 'silk'
  | 'denim'
  | 'leather'
  | 'suede'
  | 'synthetic'
  | 'blend'
  | 'knit'
  | 'down'
  | 'canvas'
  | 'metal'
  | 'other';

/**
 * One soft dislike or hard exclusion. `kind` names the list `value` comes from; the only
 * kind is `material`.
 *
 */
export type PreferenceItem = {
  kind: PreferenceKind;
  value: Material;
};

export type PreferenceItemList = Array<PreferenceItem>;

/**
 * How warm or cold the person usually feels (REQ-ONB-070). Mirrors shared-kernel `CLIMATE_TOLERANCES`.
 */
export type ClimateTolerance = 'runs_cold' | 'neutral' | 'runs_hot';

/**
 * Occasion presets (doc 03 §1.7). As `typicalDay`, the occasion suggestions use whenever
 * the person selects none (DEC-71). Mirrors shared-kernel `OCCASION_PRESETS`.
 *
 */
export type OccasionPreset = 'work_day' | 'dinner' | 'travel' | 'sport';

/**
 * The occasions the person selected in onboarding.
 */
export type OccasionPresetList = Array<OccasionPreset>;

/**
 * Label size systems (doc 08 §5). Mirrors shared-kernel `SIZE_SYSTEMS`.
 */
export type SizeSystem = 'EU' | 'US' | 'UK' | 'ALPHA';

/**
 * Top-level garment groups (doc 08 §3 `cat.*`). Mirrors shared-kernel `GARMENT_GROUPS`.
 */
export type GarmentGroup = 'tops' | 'bottoms' | 'dresses' | 'outerwear' | 'shoes';

/**
 * A usual label size in one size system for one garment group (doc 08 §5).
 */
export type UsualSize = {
  system: SizeSystem;
  group: GarmentGroup;
  /**
   * The label size as written, e.g. `39`, `M` or `10.5`.
   */
  size: string;
};

/**
 * The person's usual label sizes, at most one per size system and garment group (one entry
 * for each pair of `SizeSystem` and `GarmentGroup`). No size per brand.
 *
 */
export type UsualSizeList = Array<UsualSize>;

/**
 * The caller's style preferences. Hard exclusions are never broken by a suggestion; soft
 * dislikes only lower a score (REQ-ONB-060, doc 03 §1.2). An unset `climateTolerance`
 * counts as `neutral`.
 *
 */
export type Preferences = {
  version: ResourceVersion;
  fitPreferences: FitPreferences;
  styleTypes: StyleTypeList;
  softDislikes: PreferenceItemList;
  hardExclusions: PreferenceItemList;
  climateTolerance?: ClimateTolerance;
  occasionPresets: OccasionPresetList;
  typicalDay?: OccasionPreset;
  sizingByRegion: UsualSizeList;
};

/**
 * A `Preferences` member that holds one optional value and can be removed.
 */
export type ClearablePreference = 'climateTolerance' | 'typicalDay';

/**
 * Partial update of `Preferences`: each member present replaces its stored value whole. A
 * member may not be both set and named in `clear`.
 *
 */
export type PreferencesUpdate = {
  fitPreferences?: FitPreferences;
  styleTypes?: StyleTypeList;
  softDislikes?: PreferenceItemList;
  hardExclusions?: PreferenceItemList;
  climateTolerance?: ClimateTolerance;
  occasionPresets?: OccasionPresetList;
  typicalDay?: OccasionPreset;
  sizingByRegion?: UsualSizeList;
  /**
   * Optional single values to remove.
   */
  clear?: Array<ClearablePreference>;
};

/**
 * A problem (RFC 9457) that carries the stored preferences when `code` is `VERSION_MISMATCH`.
 */
export type PreferencesVersionConflict = ProblemDetails & {
  current?: Preferences;
};

/**
 * `pending` until the person completes or skips the step; it never returns to `pending`.
 */
export type OnboardingStepStatus = 'pending' | 'completed' | 'skipped';

export type OnboardingStepState = {
  /**
   * True when onboarding cannot finish without this step; only optional steps offer Skip.
   */
  required: boolean;
  status: OnboardingStepStatus;
};

/**
 * One entry per onboarding step, keyed by step; the keys are the `OnboardingStep` values in
 * camelCase. `signIn` is completed by the server when the account is created.
 *
 */
export type OnboardingSteps = {
  welcome: OnboardingStepState;
  signIn: OnboardingStepState;
  coreConsents: OnboardingStepState;
  unitsLocale: OnboardingStepState;
  presentationBaseModel: OnboardingStepState;
  heightWeight: OnboardingStepState;
  additionalMeasurements: OnboardingStepState;
  fitStylePreferences: OnboardingStepState;
  lifestyleOccasions: OnboardingStepState;
  firstCaptureNudge: OnboardingStepState;
};

/**
 * Onboarding steps of doc 02 §3.2, in flow order.
 */
export type OnboardingStep =
  | 'welcome'
  | 'sign_in'
  | 'core_consents'
  | 'units_locale'
  | 'presentation_base_model'
  | 'height_weight'
  | 'additional_measurements'
  | 'fit_style_preferences'
  | 'lifestyle_occasions'
  | 'first_capture_nudge';

/**
 * Per-step onboarding progress (doc 02 §3.2), kept on the server so the app resumes after
 * a quit or a crash. `nextRequiredStep` is the first required step not yet completed; the
 * app resumes there, and opens Today when it is absent.
 *
 */
export type OnboardingProgress = {
  steps: OnboardingSteps;
  nextRequiredStep?: OnboardingStep;
};

/**
 * `skipped` is refused for a required step.
 */
export type OnboardingStepOutcome = 'completed' | 'skipped';

/**
 * The outcome of each step present; an absent step is left unchanged.
 */
export type OnboardingStepsUpdate = {
  welcome?: OnboardingStepOutcome;
  signIn?: OnboardingStepOutcome;
  coreConsents?: OnboardingStepOutcome;
  unitsLocale?: OnboardingStepOutcome;
  presentationBaseModel?: OnboardingStepOutcome;
  heightWeight?: OnboardingStepOutcome;
  additionalMeasurements?: OnboardingStepOutcome;
  fitStylePreferences?: OnboardingStepOutcome;
  lifestyleOccasions?: OnboardingStepOutcome;
  firstCaptureNudge?: OnboardingStepOutcome;
};

export type OnboardingProgressUpdate = {
  steps: OnboardingStepsUpdate;
};

/**
 * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
 * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
 * a replay with the same body returns the stored response, the same key with a different
 * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
 *
 */
export type IdempotencyKey = string;

/**
 * Opaque cursor from the `nextCursor` of the previous page; omit for the first page.
 */
export type Cursor = string;

/**
 * Page size (doc 06 §2 cursor pagination).
 */
export type Limit = number;

/**
 * The `version` of the resource the client last read, as a quoted integer, e.g. `"3"`
 * (doc 06 §2). Every write to a versioned resource sends it; a stale version is refused
 * with 409 `VERSION_MISMATCH`.
 *
 */
export type IfMatch = string;

export type GetHealthData = {
  body?: never;
  path?: never;
  query?: never;
  url: '/v1/health';
};

export type GetHealthErrors = {
  /**
   * One or more dependencies are down
   */
  503: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type GetHealthError = GetHealthErrors[keyof GetHealthErrors];

export type GetHealthResponses = {
  /**
   * Health report
   */
  200: HealthReport;
};

export type GetHealthResponse = GetHealthResponses[keyof GetHealthResponses];

export type GetVersionData = {
  body?: never;
  path?: never;
  query?: never;
  url: '/v1/version';
};

export type GetVersionErrors = {
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type GetVersionError = GetVersionErrors[keyof GetVersionErrors];

export type GetVersionResponses = {
  /**
   * Version information
   */
  200: VersionInfo;
};

export type GetVersionResponse = GetVersionResponses[keyof GetVersionResponses];

export type SignInWithIdTokenData = {
  body: IdTokenSignInRequest;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/auth/sign-in/social';
};

export type SignInWithIdTokenErrors = {
  /**
   * `UNAUTHENTICATED`: the identity token or passkey assertion was not accepted.
   */
  401: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type SignInWithIdTokenError = SignInWithIdTokenErrors[keyof SignInWithIdTokenErrors];

export type SignInWithIdTokenResponses = {
  /**
   * The outcome of a sign-in (see `SignInResult`)
   */
  200: SignInResult;
};

export type SignInWithIdTokenResponse =
  SignInWithIdTokenResponses[keyof SignInWithIdTokenResponses];

export type CompleteSignUpData = {
  body: CompleteSignUpRequest;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/auth/sign-up/complete';
};

export type CompleteSignUpErrors = {
  /**
   * `UNAUTHENTICATED`: the sign-up token is missing, expired, already spent or unknown. Start again with a sign-in.
   */
  401: ProblemDetails;
  /**
   * `AGE_GATE_FAILED`: the birth year lies fewer than 16 years back (DEC-60). Terminal
   * for this attempt: nothing is stored and the sign-up token is spent. The client shows
   * its refusal screen and offers no way to change the year.
   *
   */
  403: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type CompleteSignUpError = CompleteSignUpErrors[keyof CompleteSignUpErrors];

export type CompleteSignUpResponses = {
  /**
   * The outcome of a sign-in (see `SignInResult`)
   */
  200: SignInResult;
};

export type CompleteSignUpResponse = CompleteSignUpResponses[keyof CompleteSignUpResponses];

export type GetPasskeySignInOptionsData = {
  body?: never;
  path?: never;
  query?: never;
  url: '/v1/auth/passkey/generate-authenticate-options';
};

export type GetPasskeySignInOptionsErrors = {
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type GetPasskeySignInOptionsError =
  GetPasskeySignInOptionsErrors[keyof GetPasskeySignInOptionsErrors];

export type GetPasskeySignInOptionsResponses = {
  /**
   * WebAuthn request options
   */
  200: PasskeyRequestOptions;
};

export type GetPasskeySignInOptionsResponse =
  GetPasskeySignInOptionsResponses[keyof GetPasskeySignInOptionsResponses];

export type SignInWithPasskeyData = {
  body: PasskeySignInRequest;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/auth/passkey/verify-authentication';
};

export type SignInWithPasskeyErrors = {
  /**
   * `UNAUTHENTICATED`: the identity token or passkey assertion was not accepted.
   */
  401: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type SignInWithPasskeyError = SignInWithPasskeyErrors[keyof SignInWithPasskeyErrors];

export type SignInWithPasskeyResponses = {
  /**
   * The outcome of a sign-in (see `SignInResult`)
   */
  200: SignInResult;
};

export type SignInWithPasskeyResponse =
  SignInWithPasskeyResponses[keyof SignInWithPasskeyResponses];

export type GetPasskeyRegistrationOptionsData = {
  body?: never;
  path?: never;
  query?: never;
  url: '/v1/auth/passkey/generate-register-options';
};

export type GetPasskeyRegistrationOptionsErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * The caller is authenticated but may not perform this operation. `code` is `FORBIDDEN`
   * unless the operation names a more specific code for this status.
   *
   */
  403: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type GetPasskeyRegistrationOptionsError =
  GetPasskeyRegistrationOptionsErrors[keyof GetPasskeyRegistrationOptionsErrors];

export type GetPasskeyRegistrationOptionsResponses = {
  /**
   * WebAuthn creation options
   */
  200: PasskeyCreationOptions;
};

export type GetPasskeyRegistrationOptionsResponse =
  GetPasskeyRegistrationOptionsResponses[keyof GetPasskeyRegistrationOptionsResponses];

export type RegisterPasskeyData = {
  body: PasskeyRegistrationRequest;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/auth/passkey/verify-registration';
};

export type RegisterPasskeyErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * The caller is authenticated but may not perform this operation. `code` is `FORBIDDEN`
   * unless the operation names a more specific code for this status.
   *
   */
  403: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type RegisterPasskeyError = RegisterPasskeyErrors[keyof RegisterPasskeyErrors];

export type RegisterPasskeyResponses = {
  /**
   * The stored passkey
   */
  200: PasskeySummary;
};

export type RegisterPasskeyResponse = RegisterPasskeyResponses[keyof RegisterPasskeyResponses];

export type GetSessionData = {
  body?: never;
  path?: never;
  query?: never;
  url: '/v1/auth/get-session';
};

export type GetSessionErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type GetSessionError = GetSessionErrors[keyof GetSessionErrors];

export type GetSessionResponses = {
  /**
   * The current session
   */
  200: SessionInfo;
};

export type GetSessionResponse = GetSessionResponses[keyof GetSessionResponses];

export type RefreshSessionData = {
  body?: never;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/auth/get-session';
};

export type RefreshSessionErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type RefreshSessionError = RefreshSessionErrors[keyof RefreshSessionErrors];

export type RefreshSessionResponses = {
  /**
   * The renewed session
   */
  200: SessionGrant;
};

export type RefreshSessionResponse = RefreshSessionResponses[keyof RefreshSessionResponses];

export type SignOutData = {
  body?: never;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/auth/sign-out';
};

export type SignOutErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type SignOutError = SignOutErrors[keyof SignOutErrors];

export type SignOutResponses = {
  /**
   * The session is revoked
   */
  200: SignOutResult;
};

export type SignOutResponse = SignOutResponses[keyof SignOutResponses];

export type ListDeviceSessionsData = {
  body?: never;
  path?: never;
  query?: {
    /**
     * Opaque cursor from the `nextCursor` of the previous page; omit for the first page.
     */
    cursor?: string;
    /**
     * Page size (doc 06 §2 cursor pagination).
     */
    limit?: number;
  };
  url: '/v1/auth/list-sessions';
};

export type ListDeviceSessionsErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type ListDeviceSessionsError = ListDeviceSessionsErrors[keyof ListDeviceSessionsErrors];

export type ListDeviceSessionsResponses = {
  /**
   * One page of the caller's sessions
   */
  200: DeviceSessionPage;
};

export type ListDeviceSessionsResponse =
  ListDeviceSessionsResponses[keyof ListDeviceSessionsResponses];

export type SignOutAllDevicesData = {
  body?: never;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/auth/revoke-sessions';
};

export type SignOutAllDevicesErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type SignOutAllDevicesError = SignOutAllDevicesErrors[keyof SignOutAllDevicesErrors];

export type SignOutAllDevicesResponses = {
  /**
   * Every session of the account is revoked
   */
  200: RevokeSessionsResult;
};

export type SignOutAllDevicesResponse =
  SignOutAllDevicesResponses[keyof SignOutAllDevicesResponses];

export type RequestAccountRecoveryData = {
  body: RecoveryRequest;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/auth/sign-in/magic-link';
};

export type RequestAccountRecoveryErrors = {
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type RequestAccountRecoveryError =
  RequestAccountRecoveryErrors[keyof RequestAccountRecoveryErrors];

export type RequestAccountRecoveryResponses = {
  /**
   * Accepted (uniform for every address)
   */
  200: RecoveryRequestAccepted;
};

export type RequestAccountRecoveryResponse =
  RequestAccountRecoveryResponses[keyof RequestAccountRecoveryResponses];

export type CompleteAccountRecoveryData = {
  body?: never;
  path?: never;
  query: {
    /**
     * Single-use token from the emailed link.
     */
    token: string;
  };
  url: '/v1/auth/magic-link/verify';
};

export type CompleteAccountRecoveryErrors = {
  /**
   * `UNAUTHENTICATED`: the link is unknown, used, cancelled, not yet valid or expired.
   */
  401: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type CompleteAccountRecoveryError =
  CompleteAccountRecoveryErrors[keyof CompleteAccountRecoveryErrors];

export type CompleteAccountRecoveryResponses = {
  /**
   * The outcome of a sign-in (see `SignInResult`)
   */
  200: SignInResult;
};

export type CompleteAccountRecoveryResponse =
  CompleteAccountRecoveryResponses[keyof CompleteAccountRecoveryResponses];

export type CancelAccountRecoveryData = {
  body?: never;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/me/recovery';
};

export type CancelAccountRecoveryErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `NOT_FOUND`: the account has no pending recovery.
   */
  404: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type CancelAccountRecoveryError =
  CancelAccountRecoveryErrors[keyof CancelAccountRecoveryErrors];

export type CancelAccountRecoveryResponses = {
  /**
   * The pending recovery is cancelled; its link no longer works.
   */
  204: void;
};

export type CancelAccountRecoveryResponse =
  CancelAccountRecoveryResponses[keyof CancelAccountRecoveryResponses];

export type ListConsentsData = {
  body?: never;
  path?: never;
  query?: {
    /**
     * Opaque cursor from the `nextCursor` of the previous page; omit for the first page.
     */
    cursor?: string;
    /**
     * Page size (doc 06 §2 cursor pagination).
     */
    limit?: number;
  };
  url: '/v1/me/consents';
};

export type ListConsentsErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type ListConsentsError = ListConsentsErrors[keyof ListConsentsErrors];

export type ListConsentsResponses = {
  /**
   * One page of current consent records
   */
  200: ConsentPage;
};

export type ListConsentsResponse = ListConsentsResponses[keyof ListConsentsResponses];

export type RecordConsentData = {
  body: ConsentChange;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/me/consents';
};

export type RecordConsentErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `CONSENT_REQUIRED`: a withdrawal of `core_service` is refused. This consent is
   * required to use the app (doc 11 §7.2). Deleting the account is what ends this
   * processing (`POST /v1/me/deletion`).
   *
   */
  403: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type RecordConsentError = RecordConsentErrors[keyof RecordConsentErrors];

export type RecordConsentResponses = {
  /**
   * Unchanged; the current record
   */
  200: ConsentRecord;
  /**
   * The appended record
   */
  201: ConsentRecord;
};

export type RecordConsentResponse = RecordConsentResponses[keyof RecordConsentResponses];

export type GetProfileData = {
  body?: never;
  path?: never;
  query?: never;
  url: '/v1/me/profile';
};

export type GetProfileErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type GetProfileError = GetProfileErrors[keyof GetProfileErrors];

export type GetProfileResponses = {
  /**
   * The caller's profile
   */
  200: Profile;
};

export type GetProfileResponse = GetProfileResponses[keyof GetProfileResponses];

export type UpdateProfileData = {
  body: ProfileUpdate;
  headers: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
    /**
     * The `version` of the resource the client last read, as a quoted integer, e.g. `"3"`
     * (doc 06 §2). Every write to a versioned resource sends it; a stale version is refused
     * with 409 `VERSION_MISMATCH`.
     *
     */
    'If-Match': string;
  };
  path?: never;
  query?: never;
  url: '/v1/me/profile';
};

export type UpdateProfileErrors = {
  /**
   * `VALIDATION_FAILED`: the body breaks this schema, or `startingShape` is not a shape
   * of the shared-kernel registry. `errors[]` names each field.
   *
   */
  400: ProblemDetails;
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `VERSION_MISMATCH`: `If-Match` names an older version than the stored one. `current` is
   * the stored profile, so the app can keep the losing edit and offer to re-apply it on top
   * (doc 04 §8). `IDEMPOTENCY_KEY_REUSED` or `CONFLICT` otherwise, without `current`.
   *
   */
  409: ProfileVersionConflict;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type UpdateProfileError = UpdateProfileErrors[keyof UpdateProfileErrors];

export type UpdateProfileResponses = {
  /**
   * The updated profile
   */
  200: Profile;
};

export type UpdateProfileResponse = UpdateProfileResponses[keyof UpdateProfileResponses];

export type GetMeasurementsData = {
  body?: never;
  path?: never;
  query?: never;
  url: '/v1/me/measurements';
};

export type GetMeasurementsErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type GetMeasurementsError = GetMeasurementsErrors[keyof GetMeasurementsErrors];

export type GetMeasurementsResponses = {
  /**
   * The caller's measurement set
   */
  200: MeasurementSet;
};

export type GetMeasurementsResponse = GetMeasurementsResponses[keyof GetMeasurementsResponses];

export type ReplaceMeasurementsData = {
  body: MeasurementsReplacement;
  headers: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
    /**
     * The `version` of the resource the client last read, as a quoted integer, e.g. `"3"`
     * (doc 06 §2). Every write to a versioned resource sends it; a stale version is refused
     * with 409 `VERSION_MISMATCH`.
     *
     */
    'If-Match': string;
  };
  path?: never;
  query?: never;
  url: '/v1/me/measurements';
};

export type ReplaceMeasurementsErrors = {
  /**
   * `MEASUREMENT_IMPLAUSIBLE`: a value lies outside its hard bounds (shared-kernel
   * `registry/measurement-definitions.json`, doc 07 §3.3). Nothing of the request is
   * stored. `errors[]` points at each refused value (e.g. `/measurements/height/value`)
   * and never repeats it (doc 11 §8). `VALIDATION_FAILED`: the body breaks this schema,
   * e.g. an estimated or derived value without `confidence`.
   *
   */
  400: ProblemDetails;
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `VERSION_MISMATCH`: `If-Match` names an older version than the stored one. `current` is
   * the stored measurement set, so the app can keep the losing edit and offer to re-apply it
   * on top (doc 04 §8). `IDEMPOTENCY_KEY_REUSED` or `CONFLICT` otherwise, without `current`.
   *
   */
  409: MeasurementSetVersionConflict;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type ReplaceMeasurementsError = ReplaceMeasurementsErrors[keyof ReplaceMeasurementsErrors];

export type ReplaceMeasurementsResponses = {
  /**
   * The stored measurement set
   */
  200: MeasurementSet;
};

export type ReplaceMeasurementsResponse =
  ReplaceMeasurementsResponses[keyof ReplaceMeasurementsResponses];

export type GetPreferencesData = {
  body?: never;
  path?: never;
  query?: never;
  url: '/v1/me/preferences';
};

export type GetPreferencesErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type GetPreferencesError = GetPreferencesErrors[keyof GetPreferencesErrors];

export type GetPreferencesResponses = {
  /**
   * The caller's preferences
   */
  200: Preferences;
};

export type GetPreferencesResponse = GetPreferencesResponses[keyof GetPreferencesResponses];

export type UpdatePreferencesData = {
  body: PreferencesUpdate;
  headers: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
    /**
     * The `version` of the resource the client last read, as a quoted integer, e.g. `"3"`
     * (doc 06 §2). Every write to a versioned resource sends it; a stale version is refused
     * with 409 `VERSION_MISMATCH`.
     *
     */
    'If-Match': string;
  };
  path?: never;
  query?: never;
  url: '/v1/me/preferences';
};

export type UpdatePreferencesErrors = {
  /**
   * `VALIDATION_FAILED`: the body breaks this schema, a member is both set and named in
   * `clear`, or `sizingByRegion` holds two entries for one size system and garment group.
   * `errors[]` names each field.
   *
   */
  400: ProblemDetails;
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `VERSION_MISMATCH`: `If-Match` names an older version than the stored one. `current` is
   * the stored preferences, so the app can keep the losing edit and offer to re-apply it on
   * top (doc 04 §8). `IDEMPOTENCY_KEY_REUSED` or `CONFLICT` otherwise, without `current`.
   *
   */
  409: PreferencesVersionConflict;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type UpdatePreferencesError = UpdatePreferencesErrors[keyof UpdatePreferencesErrors];

export type UpdatePreferencesResponses = {
  /**
   * The updated preferences
   */
  200: Preferences;
};

export type UpdatePreferencesResponse =
  UpdatePreferencesResponses[keyof UpdatePreferencesResponses];

export type GetOnboardingProgressData = {
  body?: never;
  path?: never;
  query?: never;
  url: '/v1/me/onboarding-progress';
};

export type GetOnboardingProgressErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type GetOnboardingProgressError =
  GetOnboardingProgressErrors[keyof GetOnboardingProgressErrors];

export type GetOnboardingProgressResponses = {
  /**
   * The caller's onboarding progress
   */
  200: OnboardingProgress;
};

export type GetOnboardingProgressResponse =
  GetOnboardingProgressResponses[keyof GetOnboardingProgressResponses];

export type UpdateOnboardingProgressData = {
  body: OnboardingProgressUpdate;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/me/onboarding-progress';
};

export type UpdateOnboardingProgressErrors = {
  /**
   * `VALIDATION_FAILED`: the body breaks this schema, or it marks a required step
   * `skipped`. `errors[]` names each step.
   *
   */
  400: ProblemDetails;
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type UpdateOnboardingProgressError =
  UpdateOnboardingProgressErrors[keyof UpdateOnboardingProgressErrors];

export type UpdateOnboardingProgressResponses = {
  /**
   * The updated onboarding progress
   */
  200: OnboardingProgress;
};

export type UpdateOnboardingProgressResponse =
  UpdateOnboardingProgressResponses[keyof UpdateOnboardingProgressResponses];
