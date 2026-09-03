import {
  computeMaleNorwoodFromObservations,
  reconcileStage,
  capMaleStageByBridge,
  alignMaleStageDescription,
} from "./norwoodStage.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function finalMaleStage(ai, rule, observations, confidence = 0.87) {
  return capMaleStageByBridge(
    reconcileStage(ai, rule, "male", observations, confidence),
    observations
  );
}

/** Observations from the Stage 5 PDF that was wrongly predicted as 7. */
const thinningBridgeSevere = {
  frontView: {
    templeRecessionLeft: "Severe",
    templeRecessionRight: "Severe",
    frontalHairline: "Receding Severe",
  },
  topView: {
    crownThinning: "Severe",
    visibleScalp: "Extensive",
  },
  midscalpBridge: "Thinning",
};

const absentBridgeHorseshoe = {
  frontView: {
    templeRecessionLeft: "severe",
    templeRecessionRight: "severe",
    frontalHairline: "receding_severe",
  },
  topView: {
    crownThinning: "severe",
    visibleScalp: "extensive",
  },
  midscalpBridge: "absent",
};

assert(
  computeMaleNorwoodFromObservations(thinningBridgeSevere) === "5",
  "thinning bridge + severe front/crown must be Stage 5, not 6/7"
);

assert(
  capMaleStageByBridge("7", thinningBridgeSevere) === "5",
  "cap predicted 7 down to 5 when the mid-scalp bridge is still thinning"
);

assert(
  finalMaleStage("7", "5", thinningBridgeSevere) === "5",
  "Gemini 7 + rule 5 with thinning bridge must display as Stage 5"
);

assert(
  finalMaleStage("7", "7", thinningBridgeSevere) === "5",
  "even if both sources say 7, thinning bridge stays Stage 5"
);

assert(
  alignMaleStageDescription("Norwood Stage 5: Large areas of baldness at the front and crown, with a thinning bridge of hair remaining between them.", "7").startsWith("Norwood Stage 7"),
  "description must follow the predicted stage number"
);

assert(
  alignMaleStageDescription("Norwood Stage 5: Large areas of baldness.", "5").includes("Stage 5"),
  "matching description is kept"
);

assert(
  computeMaleNorwoodFromObservations(absentBridgeHorseshoe) === "7",
  "absent bridge + extensive severe loss is Stage 7"
);

assert(
  capMaleStageByBridge("7", absentBridgeHorseshoe) === "7",
  "do not cap Stage 7 when the bridge is absent"
);

assert(
  finalMaleStage("7", "7", absentBridgeHorseshoe) === "7",
  "absent-bridge horseshoe stays Stage 7"
);

console.log("norwoodStage.test.mjs passed");
