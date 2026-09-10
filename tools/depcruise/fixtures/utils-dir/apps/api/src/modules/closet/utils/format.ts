// FIXTURE: violates no-utils-dirs (a utils/ directory).
export const titleCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
