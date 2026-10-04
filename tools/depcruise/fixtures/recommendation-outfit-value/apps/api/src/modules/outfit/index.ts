// FIXTURE: public API of the outfit module (a type, which recommendation may import, and a value,
// which it may not).
export type Composition = readonly string[];
export const composeOutfit = (itemIds: readonly string[]): Composition => itemIds;
