import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { supabase, type PlaceRow } from "./db.js";
import { geocode, suggest, shortArea } from "./geocode.js";
import { fetchTikTokMeta } from "./tiktok.js";
import { planDay, DAY_SHAPES, type Candidate } from "./planner.js";
import { NAIROBI } from "./geo.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "*" }));
app.use(express.json());

const toPlace = (r: PlaceRow) => ({
  id: r.id,
  name: r.name,
  area: r.area,
  category: r.category,
  costEstimate: r.cost_estimate,
  lat: r.lat,
  lng: r.lng,
  tiktokUrl: r.tiktok_url,
  thumbnailUrl: r.thumbnail_url,
  author: r.author,
  notes: r.notes,
  createdAt: r.created_at,
});

async function allPlaces(): Promise<PlaceRow[]> {
  const { data, error } = await supabase
    .from("places")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as PlaceRow[];
}

app.get("/api/preview", async (req, res) => {
  const url = z.string().url().safeParse(req.query.url);
  if (!url.success) {
    return res.status(400).json({ error: "That doesn't look like a link." });
  }
  res.json(await fetchTikTokMeta(url.data));
});

app.get("/api/suggest", async (req, res) => {
  const q = z.string().min(1).safeParse(req.query.q);
  if (!q.success) return res.json([]);

  const hits = await suggest(q.data);
  res.json(
    hits.map((h) => ({
      name: h.name,
      area: shortArea(h.displayName),
      lat: h.lat,
      lng: h.lng,
    }))
  );
});

app.get("/api/places", async (_req, res) => {
  try {
    res.json((await allPlaces()).map(toPlace));
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

const NewPlace = z.object({
  name: z.string().min(1, "Give the place a name."),
  area: z.string().min(1, "Which part of town?"),
  category: z.enum(["restaurant", "cafe", "activity", "shopping"]),
  costEstimate: z.number().int().nonnegative().nullable().optional(),
  tiktokUrl: z.string().url().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

app.post("/api/places", async (req, res) => {
  const parsed = NewPlace.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const input = parsed.data;

  let { lat, lng } = input;

  if (lat === undefined || lng === undefined) {
    const hit = await geocode(`${input.name}, ${input.area}, Nairobi`);
    if (!hit) {
      return res.status(422).json({
        error: `Couldn't find "${input.name}" in ${input.area}. Try picking it from the suggestions, or use a nearby landmark.`,
      });
    }
    lat = hit.lat;
    lng = hit.lng;
  }

  const meta = input.tiktokUrl
    ? await fetchTikTokMeta(input.tiktokUrl)
    : { title: null, author: null, thumbnailUrl: null };

  const { data, error } = await supabase
    .from("places")
    .insert({
      name: input.name,
      area: input.area,
      category: input.category,
      cost_estimate: input.costEstimate ?? null,
      lat,
      lng,
      tiktok_url: input.tiktokUrl ?? null,
      thumbnail_url: meta.thumbnailUrl,
      author: meta.author,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) return res.status(502).json({ error: error.message });
  res.status(201).json(toPlace(data as PlaceRow));
});

const PlaceEdit = z.object({
  costEstimate: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

app.patch("/api/places/:id", async (req, res) => {
  const parsed = PlaceEdit.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json({ error: "Nothing to update." });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.costEstimate !== undefined) patch.cost_estimate = parsed.data.costEstimate;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
  if (parsed.data.lat !== undefined) patch.lat = parsed.data.lat;
  if (parsed.data.lng !== undefined) patch.lng = parsed.data.lng;

  const { data, error } = await supabase
    .from("places")
    .update(patch)
    .eq("id", Number(req.params.id))
    .select()
    .maybeSingle();

  if (error) return res.status(502).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "No such place." });
  res.json(toPlace(data as PlaceRow));
});

app.delete("/api/places/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("places")
    .delete()
    .eq("id", Number(req.params.id))
    .select();

  if (error) return res.status(502).json({ error: error.message });
  if (!data?.length) return res.status(404).json({ error: "No such place." });
  res.status(204).end();
});

const PlanRequest = z.object({
  budget: z.number().int().positive("Give the day a budget."),
  origin: z.tuple([z.number(), z.number()]).optional(),
  categories: z
    .array(z.enum(["restaurant", "cafe", "activity", "shopping"]))
    .optional(),
});

app.post("/api/plan", async (req, res) => {
  const parsed = PlanRequest.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { budget, origin = NAIROBI, categories } = parsed.data;

  let rows: PlaceRow[];
  try {
    rows = await allPlaces();
  } catch (e) {
    return res.status(502).json({ error: (e as Error).message });
  }

  const candidates: Candidate[] = rows
    .filter((r) => !categories?.length || categories.includes(r.category))
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      costEstimate: r.cost_estimate,
      lat: r.lat,
      lng: r.lng,
    }));

  res.json(planDay(candidates, budget, origin));
});

app.get("/api/shapes", (_req, res) => res.json(DAY_SHAPES));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => console.log(`TokiMap API on http://localhost:${PORT}`));