// Clone-check fixture: the copy-and-diverge twin of parcel-label.mjs. Only the function name
// differs; the body is the copied block the gate must report.
export function describeReturnParcel(parcel) {
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
