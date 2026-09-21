export type LatLng = [number, number];

/** Nairobi CBD — the fallback origin when a browser won't share location. */
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

export const formatKsh = (n: number) => `KSh ${n.toLocaleString("en-KE")}`;

export const formatKm = (km: number) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;