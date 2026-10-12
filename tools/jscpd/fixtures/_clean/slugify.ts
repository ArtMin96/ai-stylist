// Clone-check fixture (tools/jscpd/README.md): `_clean` holds one unrelated file per format, so
// `just clone-check --fixtures` must find no clone here and exit 0.
export function slugify(title: string, maxLength = 60): string {
  const words = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/[\s-]+/)
    .filter((word) => word.length > 0);
  let slug = '';
  for (const word of words) {
    const next = slug === '' ? word : `${slug}-${word}`;
    if (next.length > maxLength) {
      break;
    }
    slug = next;
  }
  return slug;
}
