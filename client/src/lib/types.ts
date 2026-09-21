export const CATEGORIES = {
  restaurant: { label: "Restaurant", emoji: "🍝", color: "#e0387a" },
  cafe: { label: "Café", emoji: "☕", color: "#f0b429" },
  activity: { label: "Activity", emoji: "🎨", color: "#17a398" },
  shopping: { label: "Shopping", emoji: "🛍️", color: "#4b3f9e" },
} as const;

export type Category = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export type Place = {
  id: number;
  name: string;
  area: string;
  category: Category;
  costEstimate: number | null;
  lat: number;
  lng: number;
  tiktokUrl: string | null;
  thumbnailUrl: string | null;
  author: string | null;
  notes: string | null;
  createdAt: string;
};

export type NewPlace = {
  name: string;
  area: string;
  category: Category;
  costEstimate: number | null;
  tiktokUrl: string | null;
  notes: string | null;
  lat?: number;
  lng?: number;
};

export type Suggestion = {
  name: string;
  area: string;
  lat: number;
  lng: number;
};

export type PlanStop = {
  id: number;
  name: string;
  category: Category;
  costEstimate: number | null;
  lat: number;
  lng: number;
};

export type Plan = {
  shapeId: string;
  shapeLabel: string;
  stops: PlanStop[];
  totalCost: number;
  totalDistanceKm: number;
  slack: number;
  unpricedStops: number[];
};

export type PlanResult =
  | { ok: true; plan: Plan; alternatives: Plan[] }
  | { ok: false; reason: string; cheapestPossible: number | null };

export type Filters = {
  categories: Category[];
  maxCost: number | null;
  maxDistanceKm: number | null;
};

export const NO_FILTERS: Filters = {
  categories: [],
  maxCost: null,
  maxDistanceKm: null,
};