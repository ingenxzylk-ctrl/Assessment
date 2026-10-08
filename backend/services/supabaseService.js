import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://tzvfapbdprtbxgttgfw.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

let supabaseClient = null;

export function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient;
}

/**
 * Saves completed hair quiz data into Supabase tables:
 * 1. public.find_or_create_customer(email, phone, fullName, 'quiz')
 * 2. public.quiz_sessions
 * 3. public.personalized_regimens
 */
export async function syncQuizToSupabase(payload) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn("[supabase] Client not initialized. Please set SUPABASE_SERVICE_ROLE_KEY in .env");
    return { ok: false, reason: "no_credentials" };
  }

  try {
    const aboutMe = payload?.aboutMe || {};
    const email = String(aboutMe.email || "").trim() || null;
    const phone = String(aboutMe.whatsapp || aboutMe.phone || "").trim() || null;
    const fullName = String(aboutMe.fullName || aboutMe.name || "Guest Patient").trim();

    if (!email && !phone) {
      console.warn("[supabase] No email or phone provided, skipping Supabase sync.");
      return { ok: false, reason: "missing_contact" };
    }

    // 1. Reconcile or create master customer profile
    const { data: customerId, error: custErr } = await supabase.rpc("find_or_create_customer", {
      p_email: email,
      p_phone: phone,
      p_full_name: fullName,
      p_channel: "quiz",
    });

    if (custErr || !customerId) {
      console.error("[supabase] Error reconciling customer:", custErr?.message || custErr);
      return { ok: false, error: custErr };
    }

    const hairHealth = payload?.hairHealth || {};
    const internalHealth = payload?.internalHealth || {};
    const scalpAnalysis = payload?.scalpAnalysis || {};
    const reportMeta = payload?.reportMeta || {};

    const rawStage = scalpAnalysis.aiPredictedStage || hairHealth.norwood_stage || hairHealth.hair_fall_zone || "Stage 1";
    const stageTitle = `Stage ${rawStage} Pattern Hair Loss`;
    const scalpType = String(hairHealth.dandruff_experience || hairHealth.scalp_oiliness || "normal");

    // 2. Insert into public.quiz_sessions
    const { data: quizSession, error: sessionErr } = await supabase
      .from("quiz_sessions")
      .insert({
        customer_id: customerId,
        age: parseInt(aboutMe.age, 10) || 25,
        gender: String(payload.gender || aboutMe.gender || "male").toLowerCase(),
        hair_loss_stage: stageTitle,
        scalp_type: scalpType,
        family_history: Boolean(hairHealth.family_history && hairHealth.family_history !== "no"),
        diet_and_lifestyle: {
          diet: internalHealth.food_habits || null,
          stress: internalHealth.stress_level || null,
          sleep: internalHealth.sleep_cycle || null,
          energy: internalHealth.energy_level || null,
          water_intake: internalHealth.water_intake || null,
        },
        raw_answers: {
          aboutMe,
          hairHealth,
          internalHealth,
          scalpAnalysis,
        },
        status: "completed",
      })
      .select("id")
      .single();

    if (sessionErr) {
      console.error("[supabase] Error inserting quiz_session:", sessionErr?.message || sessionErr);
      return { ok: false, error: sessionErr };
    }

    const quizSessionId = quizSession.id;

    // 3. Insert into public.personalized_regimens
    const recommendedBundle = reportMeta?.recommendedBundle || {};
    const bundleItems = recommendedBundle.products || [];

    const { error: regimenErr } = await supabase
      .from("personalized_regimens")
      .insert({
        customer_id: customerId,
        quiz_session_id: quizSessionId,
        existing_products_held: [],
        recommended_additions: bundleItems,
        morning_routine: {
          step_1: "Apply Stage Treatment / Mist to scalp areas",
          step_2: "Gently massage with fingertips for 2 minutes",
        },
        night_routine: {
          step_1: "Use scalp stimulation / dermaroller as directed",
          step_2: "Apply recommended follicle serum before sleep",
        },
        diet_advice: "Focus on iron, zinc, and nutrient-dense foods to strengthen follicle recovery.",
        is_active: true,
      });

    if (regimenErr) {
      console.error("[supabase] Error inserting personalized_regimen:", regimenErr?.message || regimenErr);
    }

    console.log(`[supabase] Successfully synced quiz report ${payload?.reportId} for customer ${customerId}`);
    return { ok: true, customerId, quizSessionId };
  } catch (err) {
    console.error("[supabase] Unexpected exception in syncQuizToSupabase:", err?.message || err);
    return { ok: false, error: err?.message };
  }
}
