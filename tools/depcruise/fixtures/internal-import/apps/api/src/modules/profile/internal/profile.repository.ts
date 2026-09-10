// FIXTURE (tools/depcruise/check-fixtures.sh): a module internal that must stay unimportable.
export type ProfileId = string;
export const findProfile = (id: string): { id: string } => ({ id });
