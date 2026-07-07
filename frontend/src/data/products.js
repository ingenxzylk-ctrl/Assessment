/**
 * ✅ Generates a strictly tailored clinical combo pack based on Stage, Gender, and Dandruff profile.
 * @param {string} gender - "male" | "female"
 * @param {string|number} stage - The calculated hair fall pattern stage
 * @param {boolean} hasDandruff - Dandruff surface indication flag
 * @param {Array<string>} rootCauses - Contextual physiological stressors from quiz responses
 */
export const getCustomBundle = (gender, stage, hasDandruff, rootCauses = []) => {
  const isMale = gender === "male";
  const stageString = String(stage);
  const isStage1 = stageString === "1";

  // 1. Primary Growth Compound Routing Logic (Stage 1 uses Rosemary; Stage 2+ uses Minoxidil variants)
  let growthTreatmentItem = {};
  if (isStage1) {
    growthTreatmentItem = {
      id: "prod-rosemary-concentrate",
      name: "Premium Rosemary Follicle Growth Concentrate",
      subtitle: "Natural Root Revitalizer & Anti-Thinning Serum (Replaces Minoxidil for Stage 1 Maintenance)",
      price: 699
    };
  } else {
    growthTreatmentItem = isMale
      ? {
          id: "prod-minox-male-rx",
          name: "Rx: 5% Minoxidil + 0.1% Finasteride Topical Solution",
          subtitle: "Dual-Action Synergistic Hairline Restoration Fluid (Prescribed for Stages 2-5)",
          price: 850
        }
      : {
          id: "prod-minox-female-rx",
          name: "Rx: 2% Minoxidil Topical Solution",
          subtitle: "Gentle Hair Density Activator Optimized for Women (Prescribed for Stages 2-3)",
          price: 750
        };
  }

  // 2. ProGro Oil Base Customization Rule
  const oilItem = hasDandruff
    ? {
        id: "prod-oil-mct-dandruff",
        name: "Custom ProGro Oil (Anti-Dandruff MCT Base)",
        subtitle: "MCT Oil Base enriched with Tea Tree + Rosemary + Peppermint Oil (Formulated for Dandruff Presence)",
        price: 599
      }
    : {
        id: "prod-oil-jojoba-clear",
        name: "Custom ProGro Oil (Nourishing Jojoba Base)",
        subtitle: "Pure Jojoba Base blended with Rosemary + Peppermint Oil (Formulated for Absence of Dandruff)",
        price: 599
      };

  // 3. Supplement Mix Customization Rule
  let supplementName = `Customized Advanced ${isMale ? "Male" : "Female"} Hair Vitality Complex`;
  let supplementSubtitle = "";

  if (rootCauses.length > 0) {
    supplementSubtitle = `Daily capsules optimized with Protein, Amino Acids, Collagen, Vitamin D3, and Adaptogens targeting: ${rootCauses.join(" + ")}`;
  } else {
    supplementName = `Advanced Hair Supplement Mix`;
    supplementSubtitle = "Premium balanced mix of essential Proteins, Amino Acids, Collagen, and Vitamin D3 for holistic root optimization";
  }

  const supplementItem = {
    id: `prod-supplements-${gender}-${isStage1 ? "stage1" : "remedy"}`,
    name: supplementName,
    subtitle: supplementSubtitle,
    price: 800
  };

  // 4. Build Complete Pack Inventory
  const itemsList = [
    growthTreatmentItem,
    { id: "prod-derma", name: "Scalp Micro-Needling Derma Roller (0.5mm)", subtitle: "Follicle Cluster Micro-Channel Activator", price: 350 },
    { id: "prod-shampoo", name: "Clinical Anti-Dandruff Clarifying Shampoo", subtitle: "pH-Balanced Botanical Scalp Cleanser", price: 350 },
    { id: "prod-massager", name: "Ergonomic Silicone Scalp Massager Brush", subtitle: "Micro-Circulation Deep Tissue Stimulator", price: 250 },
    oilItem,
    supplementItem
  ];

  return {
    bundleId: `combo-pack-complete-${gender}-stage${stageString}`,
    bundleTitle: `Complete Customized ${isMale ? "Male" : "Female"} Hair Recovery System`,
    originalPrice: 3999,
    bundlePrice: 2999, // Fixed Offer Price
    items: itemsList
  };
};