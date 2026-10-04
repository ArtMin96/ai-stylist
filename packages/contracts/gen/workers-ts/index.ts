// GENERATED — do not edit. Run `just generate`.
// Source: packages/contracts/workers/**/*.json (JSON Schema 2020-12)

// ---- workers/segmentation/segmentation.v1.json ----

/**
 * Any message of the internal HTTP contract between the API's job handlers and the segmentation worker (workers/ml/segmentation); not part of the public OpenAPI. `POST /v1/segment` takes a SegmentRequest and returns a SegmentResponse; `GET /health` returns a HealthResponse. Field names are snake_case on the wire. Additive-only within v1 (planning/06 §4); a breaking change ships as segmentation.v2.json next to this file. The worker never receives image bytes or user data, only R2 object references (planning/04 §2).
 */
export type SegmentationWorkerV1 = SegmentRequest | SegmentResponse | HealthResponse;
/**
 * Label of a segmentation mask. The six garment values (top, bottom, dress, outerwear, shoes, accessory) are owned by the `closet` taxonomy (docs/modules/closet.md) and restated here until the closet taxonomy registry (P06-T01) exists; then they come from it. `background` is segmentation-only (pixels that belong to no garment) and is not a taxonomy class.
 */
export type MaskLabel =
  'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'accessory' | 'background';

/**
 * Body of `POST /v1/segment`: segment one garment photo already stored in R2. An object reference only, never image bytes or user data. `hint` is an optional garment class hint from the closet taxonomy.
 */
export interface SegmentRequest {
  /**
   * Caller correlation id
   */
  request_id: string;
  /**
   * R2 object key of the source image
   */
  image_ref: string;
  hint?: MaskLabel;
}
/**
 * Reply of `POST /v1/segment`: mask references for the requested image, plus the provenance and confidence marker.
 */
export interface SegmentResponse {
  /**
   * The request's request_id
   */
  request_id: string;
  /**
   * The request's image_ref
   */
  image_ref: string;
  masks: MaskRef[];
  provenance: Provenance;
}
/**
 * A derived mask stored back to R2 (never inline pixels).
 */
export interface MaskRef {
  label: MaskLabel;
  /**
   * R2 object key of the mask
   */
  mask_ref: string;
  score: number;
}
/**
 * Honesty marker: every generated view carries provenance and confidence.
 */
export interface Provenance {
  /**
   * True: the result was produced by a model
   */
  generated: boolean;
  /**
   * Identifier of the model that produced the result
   */
  model: string;
  confidence: number;
}
/**
 * Reply of `GET /health`.
 */
export interface HealthResponse {
  status: 'ok';
  /**
   * Service name
   */
  service: string;
  /**
   * Service version
   */
  version: string;
}
