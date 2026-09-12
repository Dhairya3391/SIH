import { Category, DisasterPhase } from '@/types/database';

export interface CompiledBrief {
  title: string;
  category: Category;
  dm_phase: DisasterPhase;
  severity: number;
  priority: number;
  people_est: number;
  capabilities: string[];
  ai_unsure_about?: string;
  is_rule_based: boolean;
}

/**
 * Task 3: AI Compiler (Rule-based Fallback for Hour 0-10)
 * 
 * "What's Next" Architecture:
 * - Current (Hour 0-10): Deterministic keyword classifier & priority formula. Zero API latency, 100% offline uptime.
 * - Hour 12: Real AI (Claude Haiku 4.5 / Sonnet 5 via Groq/OpenAI/Gemini) plugs in behind this exact `compile()` function signature in `llm.ts`.
 * - Hour 12-15: Embedding vector deduplication (pgvector cosine >= 0.85 + distance <= 2km + time <= 30 days).
 * 
 * Stage Line at 10:30:
 * "It's rule-based right now. Real AI plugs in behind the same function by hour 12."
 */
export const COMPILER_STATUS = {
  mode: 'rule-based-fallback',
  stage_line: "It's rule-based right now. Real AI plugs in behind the same function by hour 12.",
  next_step: 'Plug Claude Haiku/Sonnet behind compile() by Hour 12, followed by pgvector embeddings dedup.'
};

export function compileReport(text: string, peopleEstimateInput?: number): CompiledBrief {
  const lower = text.toLowerCase();
  
  let category: Category = 'disaster';
  let dm_phase: DisasterPhase = 'mitigation';
  let severity = 3;
  let capabilities: string[] = ['Ground Verification', 'Emergency Response'];
  let title = 'Community Report: Urgent Ground Response Required';
  let unsure = 'Exact number of affected families; awaiting coordinator verification.';

  // 1. Keyword Categorization (English + Roman Hindi + Devanagari)
  const isLightning = 
    lower.includes('bijli') || lower.includes('lightning') || lower.includes('thunder') || 
    lower.includes('vajrapaat') || lower.includes('बिजली') || lower.includes('गाज') || lower.includes('आकाशीय');

  const isFlood = 
    lower.includes('flood') || lower.includes('ganga') || lower.includes('baadh') || 
    lower.includes('submerged') || lower.includes('culvert') || lower.includes('बाढ़') || 
    lower.includes('डूब') || lower.includes('जलभराव');

  const isFireOrMine = 
    lower.includes('fire') || lower.includes('subsidence') || lower.includes('crack') || 
    lower.includes('coal') || lower.includes('jharia') || lower.includes('aag') || 
    lower.includes('धसान') || lower.includes('आग') || lower.includes('कोयला');

  const isWater = 
    lower.includes('water') || lower.includes('arsenic') || lower.includes('borewell') || 
    lower.includes('handpump') || lower.includes('pani') || lower.includes('drinking') || 
    lower.includes('पानी') || lower.includes('चापाकल') || lower.includes('जल');

  const isEducation = 
    lower.includes('school') || lower.includes('bridge') || lower.includes('children') || 
    lower.includes('padhai') || lower.includes('nullah') || lower.includes('baccho') || 
    lower.includes('स्कूल') || lower.includes('पुल') || lower.includes('बच्चे') || lower.includes('पढ़ाई');

  const isAgriculture = 
    lower.includes('crop') || lower.includes('drought') || lower.includes('kisan') || 
    lower.includes('sukha') || lower.includes('irrigation') || lower.includes('khet') || 
    lower.includes('किसान') || lower.includes('सूखा') || lower.includes('फसल') || lower.includes('सिंचाई');

  const isHealth = 
    lower.includes('hospital') || lower.includes('doctor') || lower.includes('vaccine') || 
    lower.includes('medicine') || lower.includes('snakebite') || lower.includes('saap') || 
    lower.includes('bimar') || lower.includes('अस्पताल') || lower.includes('दवा') || lower.includes('सांप');

  if (isLightning) {
    category = 'disaster';
    dm_phase = 'mitigation';
    severity = 5;
    title = 'Last-mile lightning alerts and agricultural field shelter';
    capabilities = ['Acoustic Siren Relay', 'Embedded Hardware', 'Low-cost Faraday Field Shelter', 'Nagpuri Audio Warnings'];
    unsure = 'Whether siren radius covers exterior hamlet grazing grounds.';
  } else if (isFlood) {
    category = 'disaster';
    dm_phase = 'response';
    severity = 5;
    title = 'Emergency flood isolation access & potable water delivery';
    capabilities = ['Inflatable Boat Logistics', 'Mobile Water Purification', 'Temporary Footbridge'];
    unsure = 'Passability of tractor route on embankment.';
  } else if (isFireOrMine) {
    category = 'disaster';
    dm_phase = 'mitigation';
    severity = 4;
    title = 'Mine subsidence & underground coalfire early warning';
    capabilities = ['InSAR/Tiltmeter Sensing', 'Thermal Drone Imagery', 'Sand Stowing Verification'];
    unsure = 'Rate of subsurface fissure expansion toward residential wall.';
  } else if (isWater) {
    category = 'water';
    dm_phase = 'mitigation';
    severity = 4;
    title = 'Arsenic/iron community water filtration & solar pumping';
    capabilities = ['Adsorptive Media Filtration', 'Water Quality Lab Testing', 'Solar PV Pump'];
    unsure = 'Seasonal depth fluctuation of local aquifer.';
  } else if (isEducation) {
    category = 'education';
    dm_phase = 'preparedness';
    severity = 4;
    title = 'All-weather pedestrian cable bridge for school access';
    capabilities = ['Structural Cable Footbridge', 'Offline Digital Learning Kits', 'Civil Anchor Masonry'];
    unsure = 'Peak monsoon stream discharge velocity across ravine.';
  } else if (isAgriculture) {
    category = 'agriculture';
    dm_phase = 'mitigation';
    severity = 3;
    title = 'Drought mitigation & solar micro-irrigation lift';
    capabilities = ['Solar DC Pump Lift', 'Micro-drip Reticulation', 'Check-dam Desilting'];
    unsure = 'Remaining water table capacity in upstream catchment.';
  } else if (isHealth) {
    category = 'health';
    dm_phase = 'preparedness';
    severity = 4;
    title = 'Mobile solar cold-chain storage & boat medical route';
    capabilities = ['Solar Thermoelectric Cooling', 'Phase Change Cold Box', 'Emergency Boat Transit'];
    unsure = 'Cold-chain battery reserve during multi-day grid blackout.';
  }

  // 2. Extract People affected (defaults to 100 if unspecified).
  // The unit is required: a bare number is usually days ("4 days"), not people.
  let people_est = peopleEstimateInput || 100;
  if (!peopleEstimateInput) {
    const match = text.match(/(\d+)\s*(people|residents|villagers|baccho|bachche|bachchon|children|kisan|kisanon|farmers|students|log|logon|families|ghar|parivar)/i);
    if (match) {
      people_est = parseInt(match[1], 10);
    }
  }

  // 3. Compute Priority Score (0-100) using deterministic formula:
  // 25 * severity/5 + 15 * urgency/5 + 15 * log10(people) + 15 * vulnerability
  const severityWeight = (severity / 5) * 25;
  const urgencyWeight = severity >= 4 ? 15 : 10;
  const peopleWeight = Math.min(15, Math.round(Math.log10(Math.max(10, people_est)) * 5));
  const vulnerabilityWeight = 12; // Standard rural baseline
  const priority = Math.min(100, Math.round(severityWeight + urgencyWeight + peopleWeight + vulnerabilityWeight + 10));

  return {
    title,
    category,
    dm_phase,
    severity,
    priority,
    people_est,
    capabilities,
    ai_unsure_about: unsure,
    is_rule_based: true,
  };
}

// Export as both `compile` and `compileReport` to satisfy both conventions
export const compile = compileReport;
