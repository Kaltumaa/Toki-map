import { useState } from "react";
import { CATEGORIES, type Plan, type PlanResult } from "../lib/types.js";
import { formatKm, formatKsh } from "../lib/geo.js";

type Props = {
  result: PlanResult | null;
  busy: boolean;
  onPlan: (budget: number) => void;
  onClear: () => void;
  onFocusStop: (id: number) => void;
};

const PRESETS = [1500, 3000, 5000];

function PlanSummary({ plan, onFocusStop }: { plan: Plan; onFocusStop: (id: number) => void }) {
  return (
    <div className="bg-white p-4">
      <p className="text-sm text-ink/60">{plan.shapeLabel}</p>

      <ol className="mt-3 space-y-0">
        {plan.stops.map((stop, i) => {
          const { emoji, color, label } = CATEGORIES[stop.category];
          const last = i === plan.stops.length - 1;
          return (
            <li key={stop.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm"
                  style={{ background: color }}
                >
                  {emoji}
                </span>
                {!last && <span className="w-px flex-1 bg-deep/20" />}
              </div>

              <button
                onClick={() => onFocusStop(stop.id)}
                className={`flex-1 text-left ${last ? "" : "pb-4"}`}
              >
                <span className="font-display font-bold tracking-tight">
                  {stop.name}
                </span>
                <span className="block text-sm text-ink/60">
                  {label}
                  {stop.costEstimate !== null
                    ? ` · ~${formatKsh(stop.costEstimate)}`
                    : " · no price saved"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <dl className="mt-4 flex gap-6 border-t border-deep/10 pt-3">
        <div>
          <dt className="text-sm text-ink/60">Total</dt>
          <dd className="font-display text-xl font-bold">
            {formatKsh(plan.totalCost)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink/60">Ground covered</dt>
          <dd className="font-display text-xl font-bold">
            {formatKm(plan.totalDistanceKm)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink/60">Left over</dt>
          <dd className="font-display text-xl font-bold">
            {formatKsh(plan.slack)}
          </dd>
        </div>
      </dl>

      {plan.unpricedStops.length > 0 && (
        <p className="mt-3 text-sm text-ink/60">
          {plan.unpricedStops.length === 1 ? "One stop has" : "Some stops have"}{" "}
          no price saved, so the total is lower than what you'll actually spend.
        </p>
      )}
    </div>
  );
}

export default function PlanMyDay({
  result,
  busy,
  onPlan,
  onClear,
  onFocusStop,
}: Props) {
  const [budget, setBudget] = useState("3000");

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-paper-dim">
      <div className="bg-deep-soft px-5 py-5 text-paper">
        <h2 className="font-display text-xl font-bold tracking-tight">
          Plan my day
        </h2>
        <p className="mt-1 text-sm text-paper/70">
          Pick a budget and TokiMap builds a day out of places you already saved.
        </p>

        <div className="mt-4 flex gap-2">
          {PRESETS.map((amount) => (
            <button
              key={amount}
              onClick={() => setBudget(String(amount))}
              aria-pressed={budget === String(amount)}
              className={`flex-1 rounded-full border px-2 py-1.5 text-sm transition ${
                budget === String(amount)
                  ? "border-cafe bg-cafe text-ink"
                  : "border-paper/25 text-paper/85 hover:border-paper/60"
              }`}
            >
              {amount.toLocaleString("en-KE")}
            </button>
          ))}
        </div>

        <label htmlFor="budget" className="mt-4 mb-1 block text-sm text-paper/80">
          Budget (KSh)
        </label>
        <input
          id="budget"
          inputMode="numeric"
          value={budget}
          onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))}
          className="w-full border border-deep/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-cafe"
        />

        <button
          onClick={() => onPlan(Number(budget))}
          disabled={busy || !budget}
          className="mt-3 w-full bg-cafe px-4 py-2.5 font-display font-bold text-ink transition disabled:opacity-40"
        >
          {busy ? "Working out a route…" : "Plan my day"}
        </button>
      </div>

      {result === null && (
        <p className="p-5 text-sm text-ink/60">
          Nothing planned yet. Set a budget above and TokiMap will find stops
          that fit it, ordered so you're not crossing town twice.
        </p>
      )}

      {result?.ok === false && (
        <div className="p-5">
          <p className="font-display text-lg font-bold">No day fits that.</p>
          <p className="mt-1 text-sm text-ink/70">{result.reason}</p>
          {result.cheapestPossible !== null && (
            <button
              onClick={() => setBudget(String(result.cheapestPossible))}
              className="mt-3 text-sm font-medium text-deep underline underline-offset-4"
            >
              Try {formatKsh(result.cheapestPossible)} instead
            </button>
          )}
        </div>
      )}

      {result?.ok && (
        <div className="space-y-3 p-3">
          <PlanSummary plan={result.plan} onFocusStop={onFocusStop} />

          {result.alternatives.length > 0 && (
            <details className="bg-white px-4 py-3">
              <summary className="cursor-pointer font-display font-bold tracking-tight">
                Other days that fit ({result.alternatives.length})
              </summary>
              <ul className="mt-3 space-y-2 text-sm">
                {result.alternatives.map((alt) => (
                  <li key={alt.shapeId} className="border-t border-deep/10 pt-2">
                    <p className="font-medium">{alt.shapeLabel}</p>
                    <p className="text-ink/60">
                      {alt.stops.map((s) => s.name).join(" → ")} ·{" "}
                      {formatKsh(alt.totalCost)} · {formatKm(alt.totalDistanceKm)}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <button
            onClick={onClear}
            className="w-full border border-deep/20 px-4 py-2 text-sm hover:border-deep/50"
          >
            Clear this plan
          </button>
        </div>
      )}
    </div>
  );
}