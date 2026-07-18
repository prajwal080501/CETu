import { test } from "node:test";
import assert from "node:assert/strict";
import { projectSeries, backtestPoint } from "./trend";

test("projectSeries: rising linear trend projects upward", () => {
  const p = projectSeries(
    [
      { year: 2022, value: 90 },
      { year: 2023, value: 91 },
      { year: 2024, value: 92 },
      { year: 2025, value: 93 },
    ],
    2026
  )!;
  assert.equal(p.direction, "rising");
  assert.ok(Math.abs(p.projected - 94) < 0.5, `projected ~94, got ${p.projected}`);
  assert.equal(p.latest, 93);
});

test("projectSeries: falling trend detected", () => {
  const p = projectSeries(
    [
      { year: 2023, value: 95 },
      { year: 2024, value: 93 },
      { year: 2025, value: 91 },
    ],
    2026
  )!;
  assert.equal(p.direction, "falling");
  assert.ok(p.projected < 91);
});

test("projectSeries: flat series is stable", () => {
  const p = projectSeries(
    [
      { year: 2023, value: 88 },
      { year: 2024, value: 88.02 },
      { year: 2025, value: 87.98 },
    ],
    2026
  )!;
  assert.equal(p.direction, "stable");
});

test("projectSeries: single point returns latest, stable", () => {
  const p = projectSeries([{ year: 2025, value: 99 }], 2026)!;
  assert.equal(p.projected, 99);
  assert.equal(p.direction, "stable");
  assert.equal(p.years, 1);
});

test("projectSeries: projection clamped to observed spread (no wild extrapolation)", () => {
  const p = projectSeries(
    [
      { year: 2021, value: 80 },
      { year: 2022, value: 85 },
      { year: 2023, value: 90 },
      { year: 2024, value: 95 },
      { year: 2025, value: 99 },
    ],
    2035 // far future
  )!;
  // spread is 19; projection can't exceed latest(99)+spread but is also capped at 100
  assert.ok(p.projected <= 100);
});

test("projectSeries: nulls ignored; empty -> null", () => {
  assert.equal(projectSeries([{ year: 2025, value: null }], 2026), null);
});

test("backtestPoint: predicts held-out year with small error on a clean line", () => {
  const pts = [
    { year: 2022, value: 90 },
    { year: 2023, value: 91 },
    { year: 2024, value: 92 },
    { year: 2025, value: 93 },
  ];
  const err = backtestPoint(pts, 2025)!;
  assert.ok(err < 0.5, `error should be small, got ${err}`);
});
