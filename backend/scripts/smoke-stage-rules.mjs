/**
 * Lightweight regression checks for male stage rules (no Gemini call).
 * Run: node backend/scripts/smoke-stage-rules.mjs
 */

const SEVERITY = { none: 0, mild: 1, moderate: 2, severe: 3 };
const level = (value) => SEVERITY[String(value || "none").toLowerCase()] ?? 0;

const isUnknownObservation = (value) => {
  const s = String(value || "")
    .toLowerCase()
    .trim();
  return (
    !s ||
    s === "not_visible" ||
    s === "unknown" ||
    s === "n/a" ||
    s === "na" ||
    s === "unclear" ||
    s.includes("not visible") ||
    s.includes("not_visible")
  );
};

const templesAssessable = (front = {}) => {
  const leftOk = !isUnknownObservation(front.templeRecessionLeft);
  const rightOk = !isUnknownObservation(front.templeRecessionRight);
  const hairlineOk = !isUnknownObservation(front.frontalHairline);
  return leftOk || rightOk || hairlineOk;
};

const stageFromCrownOnly = (observations = {}) => {
  const top = observations.topView || {};
  const bridge = String(observations.midscalpBridge || "not_visible").toLowerCase();
  const scalp = String(top.visibleScalp || "minimal").toLowerCase();
  const crown = isUnknownObservation(top.crownThinning) ? 0 : level(top.crownThinning);

  if (crown >= 3 || scalp === "extensive" || bridge === "absent") return "5";
  if (crown >= 2 || scalp === "partial" || bridge === "thinning") return "4";
  if (crown >= 1) return "3";
  return null;
};

const cases = [
  {
    name: "Naveen PDF — duplicate crown photos, temples not visible, mild crown",
    obs: {
      frontView: {
        templeRecessionLeft: "Not Visible",
        templeRecessionRight: "Not Visible",
        frontalHairline: "Not Visible",
      },
      topView: { crownThinning: "Mild", visibleScalp: "minimal" },
      midscalpBridge: "Full",
    },
    expect: "3",
  },
  {
    name: "Clear center loss with mild temples",
    obs: {
      frontView: {
        templeRecessionLeft: "mild",
        templeRecessionRight: "mild",
        frontalHairline: "receding_mild",
      },
      topView: { crownThinning: "moderate", visibleScalp: "partial" },
      midscalpBridge: "full",
    },
    expectMinCrown: 2,
  },
  {
    name: "Temple-only mild recession, full crown",
    obs: {
      frontView: {
        templeRecessionLeft: "mild",
        templeRecessionRight: "mild",
        frontalHairline: "receding_mild",
      },
      topView: { crownThinning: "none", visibleScalp: "minimal" },
      midscalpBridge: "full",
    },
    expectTemplesOnly: true,
  },
];

let failed = 0;
for (const c of cases) {
  const can = templesAssessable(c.obs.frontView);
  const crownStage = stageFromCrownOnly(c.obs);
  if (c.expect) {
    const got = !can ? crownStage || "3" : "temple-path";
    const ok = got === c.expect;
    console.log(ok ? "OK" : "FAIL", c.name, "→", got);
    if (!ok) failed += 1;
  } else if (c.expectMinCrown) {
    const crown = level(c.obs.topView.crownThinning);
    const pass = can && crown >= c.expectMinCrown;
    console.log(pass ? "OK" : "FAIL", c.name, { can, crown });
    if (!pass) failed += 1;
  } else {
    const pass = can && crownStage == null;
    console.log(pass ? "OK" : "FAIL", c.name, { can, crownStage });
    if (!pass) failed += 1;
  }
}

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("All stage smoke checks passed");
