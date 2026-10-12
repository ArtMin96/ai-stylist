// Clone-check fixture (tools/jscpd/README.md): the body of `describeParcel` is copied into
// parcel-label-copy.mjs on purpose, so `just clone-check --fixtures` must report a javascript
// clone. The files are `.mjs` because the repo's Node tools are: the case fails when jscpd does
// not read that extension as javascript.
export function describeParcel(parcel) {
  const volumeLitres = (parcel.lengthMm * parcel.widthMm * parcel.heightMm) / 1_000_000;
  const weightKg = parcel.weightGrams / 1000;
  const density = volumeLitres === 0 ? 0 : weightKg / volumeLitres;
  let size = 'standard';
  if (volumeLitres > 60) {
    size = 'oversize';
  } else if (volumeLitres > 20) {
    size = 'large';
  }
  let handling = 'normal';
  if (parcel.fragile) {
    handling = 'fragile';
  } else if (density > 2) {
    handling = 'heavy';
  }
  const parts = [
    `parcel ${parcel.id}`,
    `${weightKg.toFixed(2)} kg`,
    `${volumeLitres.toFixed(1)} l`,
    `size ${size}`,
    `handling ${handling}`,
  ];
  if (density > 5) {
    parts.push('check declared weight');
  }
  return parts.join(' | ');
}
