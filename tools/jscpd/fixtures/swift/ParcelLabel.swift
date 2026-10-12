// Clone-check fixture (tools/jscpd/README.md): the body of `describeParcel` is copied into
// ParcelLabelCopy.swift on purpose, so `just clone-check --fixtures` must report a swift clone.
import Foundation

struct Parcel {
  let id: String
  let weightGrams: Int
  let lengthMm: Int
  let widthMm: Int
  let heightMm: Int
  let fragile: Bool
}

func describeParcel(_ parcel: Parcel) -> String {
  let volumeLitres = Double(parcel.lengthMm * parcel.widthMm * parcel.heightMm) / 1_000_000
  let weightKg = Double(parcel.weightGrams) / 1000
  let density = volumeLitres == 0 ? 0 : weightKg / volumeLitres
  var size = "standard"
  if volumeLitres > 60 {
    size = "oversize"
  } else if volumeLitres > 20 {
    size = "large"
  }
  var handling = "normal"
  if parcel.fragile {
    handling = "fragile"
  } else if density > 2 {
    handling = "heavy"
  }
  var parts = [
    "parcel \(parcel.id)",
    String(format: "%.2f kg", weightKg),
    String(format: "%.1f l", volumeLitres),
    "size \(size)",
    "handling \(handling)",
  ]
  if density > 5 {
    parts.append("check declared weight")
  }
  return parts.joined(separator: " | ")
}
