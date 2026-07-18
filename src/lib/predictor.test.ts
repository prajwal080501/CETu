import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eligibleSeatTypes,
  predictOffering,
  predict,
  type CutoffRow,
} from "./predictor";

const MU = 1; // Mumbai University
const SPPU = 2; // Pune University

// A COEP (home university = SPPU) Computer Engineering offering, 2024.
const coepRows: CutoffRow[] = [
  {
    collegeBranchId: 10,
    collegeId: 1,
    collegeHomeUniversityId: SPPU,
    seatType: "HU",
    categoryCode: "GOPEN",
    closingPercentile: 99.62,
  },
  {
    collegeBranchId: 10,
    collegeId: 1,
    collegeHomeUniversityId: SPPU,
    seatType: "OHU",
    categoryCode: "GOPEN",
    closingPercentile: 99.71,
  },
  {
    collegeBranchId: 10,
    collegeId: 1,
    collegeHomeUniversityId: SPPU,
    seatType: "SL",
    categoryCode: "GOPEN",
    closingPercentile: 99.55,
  },
];

test("eligibleSeatTypes: home student gets HU+SL+AI", () => {
  assert.deepEqual(eligibleSeatTypes(SPPU, SPPU), ["HU", "SL", "AI"]);
});

test("eligibleSeatTypes: outside student gets OHU+HU_OHU+SL+AI (never HU)", () => {
  const types = eligibleSeatTypes(MU, SPPU);
  assert.ok(!types.includes("HU"));
  assert.deepEqual(types, ["OHU", "HU_OHU", "SL", "AI"]);
});

test("eligibleSeatTypes: null home university -> treated as outside", () => {
  assert.deepEqual(eligibleSeatTypes(null, SPPU), ["OHU", "HU_OHU", "SL", "AI"]);
});

test("CORE DIFFERENTIATOR: same percentile predicts differently by home university", () => {
  const homeStudent = {
    percentile: 99.6,
    categoryCode: "GOPEN",
    homeUniversityId: SPPU,
  };
  const outsideStudent = {
    percentile: 99.6,
    categoryCode: "GOPEN",
    homeUniversityId: MU,
  };

  const home = predictOffering(homeStudent, coepRows)!;
  const outside = predictOffering(outsideStudent, coepRows)!;

  // Home student's best route is SL (99.55) or HU (99.62); best margin is SL.
  assert.equal(home.viaSeatType, "SL");
  // 99.6 - 99.55 = 0.05 -> within moderate band.
  assert.equal(home.chance, "moderate");

  // Outside student cannot use HU. Their options: OHU (99.71) or SL (99.55).
  // Best margin is SL again here, but they must never be offered HU.
  assert.notEqual(outside.viaSeatType, "HU");

  // The prediction machinery treated the two students differently in eligibility
  // even when the winning seat type coincides — verify by removing SL.
  const noSl = coepRows.filter((r) => r.seatType !== "SL");
  const homeNoSl = predictOffering(homeStudent, noSl)!;
  const outsideNoSl = predictOffering(outsideStudent, noSl)!;
  assert.equal(homeNoSl.viaSeatType, "HU"); // 99.6 vs 99.62 -> moderate
  assert.equal(homeNoSl.chance, "moderate");
  assert.equal(outsideNoSl.viaSeatType, "OHU"); // 99.6 vs 99.71 -> below
  assert.equal(outsideNoSl.chance, "moderate"); // within 1.5 moderate margin
});

test("safe when comfortably above closing", () => {
  const topper = {
    percentile: 99.99,
    categoryCode: "GOPEN",
    homeUniversityId: SPPU,
  };
  const r = predictOffering(topper, coepRows)!;
  assert.equal(r.chance, "safe");
});

test("reach when well below closing", () => {
  const student = {
    percentile: 95.0,
    categoryCode: "GOPEN",
    homeUniversityId: SPPU,
  };
  const r = predictOffering(student, coepRows)!;
  assert.equal(r.chance, "reach");
});

test("returns null when no matching category exists", () => {
  const scStudent = {
    percentile: 99.9,
    categoryCode: "GSC",
    homeUniversityId: SPPU,
  };
  assert.equal(predictOffering(scStudent, coepRows), null);
});

test("predict sorts safe first, then by margin", () => {
  const map = new Map<number, CutoffRow[]>();
  map.set(10, coepRows);
  map.set(20, [
    {
      collegeBranchId: 20,
      collegeId: 2,
      collegeHomeUniversityId: SPPU,
      seatType: "SL",
      categoryCode: "GOPEN",
      closingPercentile: 97.0,
    },
  ]);
  const results = predict(
    { percentile: 99.6, categoryCode: "GOPEN", homeUniversityId: SPPU },
    map
  );
  assert.equal(results.length, 2);
  assert.equal(results[0].chance, "safe"); // the 97.0 offering
  assert.equal(results[0].collegeBranchId, 20);
});
