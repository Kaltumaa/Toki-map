export type LatLng = [number, number];

/** Nairobi CBD — fallback origin when we don't know where the user is. */
export const NAIROBI: LatLng = [-1.2864, 36.8172];

/** Great-circle distance in kilometres. */
export function distanceKm([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Total distance of a walk from an origin through an ordered list of stops. */
export function routeLengthKm(origin: LatLng, stops: LatLng[]): number {
  let total = 0;
  let cursor = origin;
  for (const stop of stops) {
    total += distanceKm(cursor, stop);
    cursor = stop;
  }
  return total;
}