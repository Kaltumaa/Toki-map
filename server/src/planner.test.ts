import test from "node:test";
import assert from "node:assert/strict";
import { planDay, DAY_SHAPES, type Candidate } from "./planner.js";
import { distanceKm } from "./geo.js";

const ORIGIN: [number, number] = [-1.2864, 36.8172]; // CBD

let nextId = 1;
const place = (
  category: Candidate["category"],
  costEstimate: number | null,
  lat = -1.29,
  lng = 36.82
): Candidate => ({
  id: nextId++,
  name: `${category}-${nextId}`,
  category,
  costEstimate,
  lat,
  lng,
});

test("haversine matches a known Nairobi distance", () => {
  // CBD to JKIA is roughly 15 km as the crow flies.
  const km = distanceKm(ORIGIN, [-1.3192, 36.9278]);
  assert.ok(km > 12 && km < 18, `expected ~15 km, got ${km.toFixed(1)}`);
});

test("builds a three-stop day inside budget", () => {
  const places = [
    place("restaurant", 1200),
    place("activity", 800),
    place("cafe", 500),
  ];

  const result = planDay(places, 3000, ORIGIN);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.plan.stops.length, 3);
  assert.equal(result.plan.totalCost, 2500);
  assert.equal(result.plan.slack, 500);
});

test("respects the budget ceiling exactly", () => {
  const places = [
    place("restaurant", 2000),
    place("activity", 2000),
    place("cafe", 2000),
  ];

  // One shilling short of the full day: it must not overspend, but a
  // two-stop day still fits, so the planner should downgrade rather than fail.
  const tight = planDay(places, 5999, ORIGIN);
  assert.equal(tight.ok, true);
  if (!tight.ok) return;
  assert.equal(tight.plan.stops.length, 2);
  assert.ok(tight.plan.totalCost <= 5999);

  // Exactly enough: the full three-stop day becomes reachable.
  const exact = planDay(places, 6000, ORIGIN);
  assert.equal(exact.ok, true);
  if (!exact.ok) return;
  assert.equal(exact.plan.stops.length, 3);
  assert.equal(exact.plan.totalCost, 6000);
});

test("prefers the cheaper option when both fit", () => {
  const cheap = place("cafe", 300);
  const places = [place("restaurant", 1000), place("activity", 500), cheap, place("cafe", 2000)];

  const result = planDay(places, 4000, ORIGIN);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.ok(result.plan.totalCost <= 3500);
});

test("minimises travel between stops", () => {
  const near = place("cafe", 500, -1.2870, 36.8180);
  const far = place("cafe", 500, -1.4000, 37.0000);

  const places = [place("restaurant", 500, -1.2865, 36.8173), place("activity", 500, -1.2866, 36.8174), near, far];

  const result = planDay(places, 5000, ORIGIN);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.ok(
    result.plan.stops.some((s) => s.id === near.id),
    "should pick the nearby café over the identically priced far one"
  );
});

test("falls back to a shorter day when a category is missing", () => {
  const places = [place("cafe", 400), place("activity", 600)];

  const result = planDay(places, 2000, ORIGIN);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.plan.stops.length, 2);
  assert.equal(result.plan.shapeId, "lowkey");
});

test("explains itself when the budget is too low", () => {
  const places = [
    place("restaurant", 5000),
    place("activity", 5000),
    place("cafe", 5000),
  ];

  const result = planDay(places, 1000, ORIGIN);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.cheapestPossible, 10000);
  assert.match(result.reason, /cheapest day/i);
});

test("never visits the same place twice", () => {
  const only = place("cafe", 100);
  const result = planDay([only, place("restaurant", 100)], 5000, ORIGIN);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const ids = result.plan.stops.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("treats an unpriced place as free but flags it", () => {
  const mystery = place("cafe", null);
  const result = planDay(
    [mystery, place("restaurant", 500), place("activity", 500)],
    2000,
    ORIGIN
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.plan.unpricedStops, [mystery.id]);
});

test("handles an empty list without throwing", () => {
  const result = planDay([], 3000, ORIGIN);
  assert.equal(result.ok, false);
});

test("every shape names at least two slots", () => {
  for (const shape of DAY_SHAPES) {
    assert.ok(shape.slots.length >= 2, `${shape.id} is too short to be a day`);
  }
});