import { distanceKm, type LatLng } from "./geo.js";
import type { Filters, Place } from "./types.js";

/**
 * Filtering happens on the client because the whole saved list is already in
 * memory — a personal collection is tens of rows, not a paginated dataset.
 * Round-tripping to the server per keystroke would make the chips feel laggy
 * for no benefit. If this ever grew to thousands of saves, this function is
 * the seam where a query-parameter version would slot in.
 */
export function applyFilters(
  places: Place[],
  filters: Filters,
  origin: LatLng
): Place[] {
  return places.filter((place) => {
    if (filters.categories.length && !filters.categories.includes(place.category)) {
      return false;
    }

    if (filters.maxCost !== null) {
      // A place with no saved price can't be proven to fit a price ceiling.
      if (place.costEstimate === null || place.costEstimate > filters.maxCost) {
        return false;
      }
    }

    if (filters.maxDistanceKm !== null) {
      if (distanceKm(origin, [place.lat, place.lng]) > filters.maxDistanceKm) {
        return false;
      }
    }

    return true;
  });
}