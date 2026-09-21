import { distanceKm, routeLengthKm, type LatLng } from "./geo.js";

export type Category = "restaurant" | "cafe" | "activity" | "shopping";

export type Candidate = {
  id: number;
  name: string;
  category: Category;
  costEstimate: number | null;
  lat: number;
  lng: number;
};

/**
 * A day has a shape: you don't do three cafés in a row. Each shape is an
 * ordered list of category slots, and a plan fills one place into each slot.
 */
export type DayShape = { id: string; label: string; slots: Category[] };

export const DAY_SHAPES: DayShape[] = [
  {
    id: "classic",
    label: "Brunch, something to do, then coffee",
    slots: ["restaurant", "activity", "cafe"],
  },
  {
    id: "browse",
    label: "Coffee, a wander round the shops, then dinner",
    slots: ["cafe", "shopping", "restaurant"],
  },
  {
    id: "lowkey",
    label: "Coffee and one thing to do",
    slots: ["cafe", "activity"],
  },
  {
    id: "eat",
    label: "Coffee then a long lunch",
    slots: ["cafe", "restaurant"],
  },
];

export type Plan = {
  shapeId: string;
  shapeLabel: string;
  stops: Candidate[];
  totalCost: number;
  totalDistanceKm: number;
  /** Budget left over. */
  slack: number;
  /** Stops whose cost we're guessing at, because none was saved. */
  unpricedStops: number[];
};

export type PlanResult =
  | { ok: true; plan: Plan; alternatives: Plan[] }
  | { ok: false; reason: string; cheapestPossible: number | null };

const cost = (c: Candidate) => c.costEstimate ?? 0;
const at = (c: Candidate): LatLng => [c.lat, c.lng];

/**
 * Best plan for one shape.
 *
 * This is a constrained selection: pick one place per slot so that total cost
 * stays within budget, minimising how far you have to travel. Worst case is
 * O(n^k) over k slots, but two things keep it cheap in practice — k is 2 or 3,
 * and each slot's candidates are sorted by cost ascending so we can `break` the
 * moment the running total exceeds budget instead of exploring the rest.
 *
 * A saved-places list is tens of entries, not millions. Reaching for dynamic
 * programming here would be more code for no measurable gain.
 */
function bestForShape(
  shape: DayShape,
  byCategory: Map<Category, Candidate[]>,
  budget: number,
  origin: LatLng
): { plan: Plan | null; cheapest: number | null } {
  const slots = shape.slots.map((category) =>
    [...(byCategory.get(category) ?? [])].sort((a, b) => cost(a) - cost(b))
  );

  // A shape we can't fill at all isn't a near miss, it's not applicable.
  if (slots.some((s) => s.length === 0)) return { plan: null, cheapest: null };

  // The floor: cheapest place in each slot. Used to explain a failed plan.
  const cheapest = slots.reduce((sum, s) => sum + cost(s[0]), 0);

  let best: Plan | null = null;
  const chosen: Candidate[] = [];

  const walk = (slotIndex: number, spent: number, travelled: number) => {
    if (slotIndex === slots.length) {
      const stops = [...chosen];
      const totalDistanceKm = travelled;

      if (best === null || totalDistanceKm < best.totalDistanceKm) {
        best = {
          shapeId: shape.id,
          shapeLabel: shape.label,
          stops,
          totalCost: spent,
          totalDistanceKm,
          slack: budget - spent,
          unpricedStops: stops
            .filter((s) => s.costEstimate === null)
            .map((s) => s.id),
        };
      }
      return;
    }

    const previous = chosen.length ? at(chosen[chosen.length - 1]) : origin;

    for (const candidate of slots[slotIndex]) {
      const nextSpend = spent + cost(candidate);

      // Sorted ascending, so everything after this is at least as expensive.
      if (nextSpend > budget) break;

      // One shape can name the same category twice; don't visit a place twice.
      if (chosen.some((c) => c.id === candidate.id)) continue;

      const leg = distanceKm(previous, at(candidate));

      // Already further than the best complete plan — no point continuing.
      if (best !== null && travelled + leg >= best.totalDistanceKm) continue;

      chosen.push(candidate);
      walk(slotIndex + 1, nextSpend, travelled + leg);
      chosen.pop();
    }
  };

  walk(0, 0, 0);
  return { plan: best, cheapest };
}

export function planDay(
  places: Candidate[],
  budget: number,
  origin: LatLng,
  shapes: DayShape[] = DAY_SHAPES
): PlanResult {
  if (places.length === 0) {
    return {
      ok: false,
      reason: "Save a few places first and TokiMap can build you a day.",
      cheapestPossible: null,
    };
  }

  const byCategory = new Map<Category, Candidate[]>();
  for (const place of places) {
    const bucket = byCategory.get(place.category) ?? [];
    bucket.push(place);
    byCategory.set(place.category, bucket);
  }

  const found: Plan[] = [];
  let cheapestOverall: number | null = null;

  for (const shape of shapes) {
    const { plan, cheapest } = bestForShape(shape, byCategory, budget, origin);
    if (plan) found.push(plan);
    if (cheapest !== null) {
      cheapestOverall =
        cheapestOverall === null ? cheapest : Math.min(cheapestOverall, cheapest);
    }
  }

  if (found.length === 0) {
    return {
      ok: false,
      reason:
        cheapestOverall === null
          ? "Your saved places don't cover enough categories yet — try adding a café or something to do."
          : `Nothing fits KSh ${budget.toLocaleString("en-KE")}. The cheapest day your saved places can make is about KSh ${cheapestOverall.toLocaleString("en-KE")}.`,
      cheapestPossible: cheapestOverall,
    };
  }

  // Prefer a fuller day; among equals, the one with the least walking.
  found.sort(
    (a, b) =>
      b.stops.length - a.stops.length || a.totalDistanceKm - b.totalDistanceKm
  );

  return { ok: true, plan: found[0], alternatives: found.slice(1, 3) };
}

export { routeLengthKm };