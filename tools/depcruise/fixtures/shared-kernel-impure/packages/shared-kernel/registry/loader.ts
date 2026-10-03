// FIXTURE: code under registry/ is not registry data; importing it breaks shared-kernel-pure.
export const parseFlags = (text: string): unknown => JSON.parse(text);
