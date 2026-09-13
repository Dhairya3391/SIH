/**
 * Seed data for both demo scenarios.
 *
 * Everything here is simulated and every row carries `is_simulated`, so the UI
 * can label it. Districts, hazards and university names are real, because the
 * map has to look like the real state. Companies and NGOs are fictional, so we
 * never imply that a real organisation pledged anything.
 */

export interface DistrictSeed {
  name: string;
  lat: number;
  lng: number;
}

/** Jharkhand's 24 districts, with their headquarters. */
export const JHARKHAND_DISTRICTS: DistrictSeed[] = [
  { name: "Ranchi", lat: 23.3441, lng: 85.3096 },
  { name: "Gumla", lat: 23.0444, lng: 84.5385 },
  { name: "Sahebganj", lat: 25.2481, lng: 87.6412 },
  { name: "Dhanbad", lat: 23.7957, lng: 86.4304 },
  { name: "Bokaro", lat: 23.6693, lng: 86.1511 },
  { name: "Palamu", lat: 24.0333, lng: 84.0667 },
  { name: "Garhwa", lat: 24.16, lng: 83.81 },
  { name: "East Singhbhum", lat: 22.8046, lng: 86.2029 },
  { name: "West Singhbhum", lat: 22.55, lng: 85.8 },
  { name: "Hazaribagh", lat: 23.9925, lng: 85.3637 },
  { name: "Deoghar", lat: 24.4823, lng: 86.6947 },
  { name: "Dumka", lat: 24.2676, lng: 87.2497 },
  { name: "Giridih", lat: 24.1913, lng: 86.3094 },
  { name: "Godda", lat: 24.827, lng: 87.213 },
  { name: "Pakur", lat: 24.6373, lng: 87.8464 },
  { name: "Chatra", lat: 24.2064, lng: 84.8709 },
  { name: "Khunti", lat: 23.0712, lng: 85.2783 },
  { name: "Simdega", lat: 22.6152, lng: 84.5144 },
  { name: "Lohardaga", lat: 23.4333, lng: 84.6833 },
  { name: "Latehar", lat: 23.7449, lng: 84.4998 },
  { name: "Ramgarh", lat: 23.6307, lng: 85.5617 },
  { name: "Koderma", lat: 24.4677, lng: 85.594 },
  { name: "Jamtara", lat: 23.96, lng: 86.8 },
  { name: "Seraikela Kharsawan", lat: 22.7, lng: 85.9333 },
];

export const RAJKOT_AREAS: DistrictSeed[] = [
  { name: "Rajkot", lat: 22.3039, lng: 70.8022 },
  { name: "Gondal", lat: 21.9611, lng: 70.8017 },
  { name: "Jetpur", lat: 21.7544, lng: 70.6231 },
  { name: "Morbi", lat: 22.8173, lng: 70.8377 },
];

/** The twelve Gumla villages in the lightning cluster. */
export const GUMLA_VILLAGES = [
  { name: "Karra Toli", lat: 23.0512, lng: 84.5421 },
  { name: "Bishunpur", lat: 23.0601, lng: 84.5233 },
  { name: "Ghaghra", lat: 23.0388, lng: 84.5567 },
  { name: "Sisai", lat: 23.0295, lng: 84.5188 },
  { name: "Basia", lat: 23.0677, lng: 84.5502 },
  { name: "Kamdara", lat: 23.0198, lng: 84.5344 },
  { name: "Palkot", lat: 23.0455, lng: 84.5611 },
  { name: "Raidih", lat: 23.0533, lng: 84.5099 },
  { name: "Chainpur", lat: 23.0366, lng: 84.5455 },
  { name: "Dumri", lat: 23.0622, lng: 84.5388 },
  { name: "Albert Ekka", lat: 23.0411, lng: 84.5277 },
  { name: "Jari", lat: 23.0577, lng: 84.5544 },
];

/** The Sahebganj villages cut off by the simulated Ganga flood. */
export const SAHEBGANJ_VILLAGES = [
  { name: "Radhanagar", lat: 25.2544, lng: 87.6488 },
  { name: "Shivapur", lat: 25.2411, lng: 87.6299 },
  { name: "Diwani Ghat", lat: 25.2622, lng: 87.6533 },
  { name: "Mirzachowki", lat: 25.2288, lng: 87.6677 },
];

// ---------------------------------------------------------------------------
// Scenario A: lightning safety for farm workers, Gumla
// ---------------------------------------------------------------------------

/**
 * Thirty-one reports across twelve villages, in Hindi and English, with
 * deliberate near-duplicates so the clustering has real work to do.
 */
export const GUMLA_LIGHTNING_REPORTS: Array<{
  text: string;
  lang: string;
  village: string;
  people?: number;
  urgency?: number;
  vulnerable?: string[];
}> = [
  { text: "Bijli girne se hamare khet me do log mar gaye. Koi shelter nahi hai yahan. Kheti ke waqt sab log khule me rehte hain.", lang: "hi", village: "Karra Toli", people: 400, urgency: 5, vulnerable: ["elderly"] },
  { text: "Lightning killed two farmers in our field last month. There is nowhere to take shelter when a storm comes.", lang: "en", village: "Karra Toli", people: 380, urgency: 5 },
  { text: "Vajrapat se kisan ghayal hua. Alert ka pata nahi chalta kyunki mobile nahi hai kisi ke paas.", lang: "hi", village: "Bishunpur", people: 320, urgency: 5, vulnerable: ["no_signal"] },
  { text: "Bijli gir rahi hai baar baar. Bacche school jate waqt khule maidan se guzarte hain.", lang: "hi", village: "Bishunpur", people: 250, urgency: 4, vulnerable: ["children"] },
  { text: "No warning reaches us before thunderstorms. Farm workers are in open fields all day.", lang: "en", village: "Ghaghra", people: 410, urgency: 4, vulnerable: ["no_signal"] },
  { text: "Pichle saal do aadmi bijli girne se mare. Is saal bhi wahi khatra hai. Koi suraksha nahi.", lang: "hi", village: "Ghaghra", people: 390, urgency: 5 },
  { text: "Thunderstorm alerts exist on TV but we are in the field. Nobody tells us.", lang: "en", village: "Sisai", people: 300, urgency: 4 },
  { text: "Bijli girne ka darr hai. Buzurg log khet me kaam karte hain, bhaag nahi sakte.", lang: "hi", village: "Sisai", people: 280, urgency: 4, vulnerable: ["elderly"] },
  { text: "Vajrapat se ek mahila ghayal ho gayi. Paas me koi pakka makan nahi jahan chhup sake.", lang: "hi", village: "Basia", people: 260, urgency: 5, vulnerable: ["elderly"] },
  { text: "We need some kind of siren. By the time the sky changes it is already too late to run home.", lang: "en", village: "Basia", people: 275, urgency: 4 },
  { text: "Bijli girne se bail mar gaya aur kisan bach gaya. Har monsoon me yahi hota hai.", lang: "hi", village: "Kamdara", people: 340, urgency: 4 },
  { text: "Lightning strikes are common here every monsoon. No shelter, no warning system.", lang: "en", village: "Kamdara", people: 330, urgency: 4 },
  { text: "Khet me kaam karte waqt bijli gir gayi. Do log ghayal. Hospital door hai.", lang: "hi", village: "Palkot", people: 290, urgency: 5, vulnerable: ["isolated"] },
  { text: "Damini app ke baare me suna hai par kisi ke paas smartphone nahi hai.", lang: "hi", village: "Palkot", people: 300, urgency: 3, vulnerable: ["no_signal"] },
  { text: "Farm workers here have basic phones only. Official alerts never reach them.", lang: "en", village: "Raidih", people: 355, urgency: 4, vulnerable: ["no_signal"] },
  { text: "Bijli girne se ek kisan ki maut. Gaon me koi safe jagah nahi hai barish me.", lang: "hi", village: "Raidih", people: 360, urgency: 5 },
  { text: "Need a shelter in the fields. Two deaths in this block last season.", lang: "en", village: "Chainpur", people: 310, urgency: 5 },
  { text: "Vajrapat ka khatra bahut zyada hai. Community hall door hai, khet se bhagna mushkil.", lang: "hi", village: "Chainpur", people: 295, urgency: 4, vulnerable: ["elderly", "children"] },
  { text: "Bijli girne se ghar ka chhat jal gaya. Koi alert nahi mila tha.", lang: "hi", village: "Dumri", people: 200, urgency: 4 },
  { text: "Lightning hit a tree beside the field while people were working. Nobody had any warning.", lang: "en", village: "Dumri", people: 210, urgency: 4 },
  { text: "Har saal bijli girne se koi na koi marta hai. Sarkar ka alert humtak nahi pahunchta.", lang: "hi", village: "Albert Ekka", people: 370, urgency: 5 },
  { text: "We want a loudspeaker that plays the government warning. We cannot read SMS in English.", lang: "en", village: "Albert Ekka", people: 365, urgency: 4 },
  { text: "Bijli girne se do bachche dar gaye the, school se ghar aate waqt.", lang: "hi", village: "Jari", people: 180, urgency: 3, vulnerable: ["children"] },
  { text: "Thunderstorm warning never reaches the fields. Please do something before monsoon.", lang: "en", village: "Jari", people: 195, urgency: 4 },
  { text: "Vajrapat se pashu mare aur kisan ghayal hue. Shelter chahiye khet ke paas.", lang: "hi", village: "Karra Toli", people: 400, urgency: 4 },
  { text: "Bijli gir gayi jab log dhan ropte the. Bahut log khule me the.", lang: "hi", village: "Ghaghra", people: 405, urgency: 5 },
  { text: "Two neighbours were killed by lightning last monsoon in this panchayat.", lang: "en", village: "Bishunpur", people: 325, urgency: 5 },
  { text: "Barish aur bijli ke waqt chhupne ki jagah nahi hai kisi bhi khet ke paas.", lang: "hi", village: "Sisai", people: 285, urgency: 4 },
  { text: "Lightning risk is very high in this block. Farmers work through storms because they must.", lang: "en", village: "Basia", people: 270, urgency: 4 },
  { text: "Bijli girne ki chetavni gaon tak nahi aati. Mobile network bhi kharab rehta hai.", lang: "hi", village: "Kamdara", people: 335, urgency: 4, vulnerable: ["no_signal"] },
  { text: "Ek buzurg kisan bijli girne se mar gaya pichle mahine. Koi shelter nahi tha paas me.", lang: "hi", village: "Palkot", people: 305, urgency: 5, vulnerable: ["elderly"] },
];

// ---------------------------------------------------------------------------
// Scenario B: the Sahebganj flood drill
// ---------------------------------------------------------------------------

export const SAHEBGANJ_FLOOD_NEEDS = [
  {
    title: "Safe drinking water for a cut-off village, Radhanagar",
    village: "Radhanagar",
    text: "About 200 people have had no safe drinking water for two days. The main road is partly blocked and the handpump is under water. Elderly people and children are among them.",
    people: 200,
    severity: 5,
    urgency: 5,
    vulnerable: ["elderly", "children", "isolated"],
    category: "water",
    capabilities: ["water_testing", "water_quality", "logistics"],
    needs: [
      { item: "Water filtration units", qty: 10, unit: "unit", kind: "equipment", capability: "water_testing" },
      { item: "Water-quality testing and a distribution plan", qty: 1, unit: "team", kind: "expertise", capability: "water_quality" },
      { item: "Last-mile distribution by boat", qty: 2, unit: "boat", kind: "people", capability: "logistics" },
    ],
  },
  {
    title: "Last-mile medicine route for flood-isolated residents, Shivapur",
    village: "Shivapur",
    text: "Road blocked and medicines cannot reach the village. 350 residents are cut off, including an elderly patient who needs regular medication.",
    people: 350,
    severity: 5,
    urgency: 5,
    vulnerable: ["elderly", "medical_dependency", "isolated"],
    category: "health",
    capabilities: ["logistics", "mapping", "health"],
    needs: [
      { item: "Essential medicine kits", qty: 50, unit: "kit", kind: "equipment", capability: "health" },
      { item: "Route mapping for the blocked road", qty: 1, unit: "survey", kind: "expertise", capability: "mapping" },
    ],
  },
  {
    title: "No mobile data at two locations, Diwani Ghat",
    village: "Diwani Ghat",
    text: "Mobile data is down at two locations, which is why reports from there are arriving by SMS. People cannot reach relatives or services.",
    people: 500,
    severity: 4,
    urgency: 4,
    vulnerable: ["no_signal", "isolated"],
    category: "energy_connectivity",
    capabilities: ["telemetry", "electronics", "energy"],
    needs: [
      { item: "Portable connectivity units", qty: 2, unit: "unit", kind: "equipment", capability: "telemetry" },
    ],
  },
  {
    title: "Temporary shelter capacity is short, Mirzachowki",
    village: "Mirzachowki",
    text: "Temporary shelter capacity is short for families displaced by the river. Around 180 people need somewhere dry tonight.",
    people: 180,
    severity: 4,
    urgency: 5,
    vulnerable: ["children", "elderly"],
    category: "disaster_safety",
    capabilities: ["civil", "logistics"],
    needs: [
      { item: "Shelter kits", qty: 40, unit: "kit", kind: "equipment", capability: "civil" },
    ],
  },
];

/**
 * Two SMS reports seeded into the drill. One is a coded message with an exact
 * GPS fix; the other is plain Hindi from a basic phone that names only a
 * village, so it starts lower on the confidence ladder.
 */
export const SAHEBGANJ_SMS_REPORTS = [
  {
    raw: 'JS1 K7F2 W5 25.2481,87.6412 P200 VCE "pani nahi 2 din"',
    coded: true,
  },
  {
    raw: "Radhanagar gaon me pani nahi hai do din se. Buzurg aur bacche bimar ho rahe hain. Madad chahiye.",
    coded: false,
  },
];

// ---------------------------------------------------------------------------
// Organisations. Universities are real and labelled "potential partner";
// companies and NGOs are fictional so nobody is misrepresented.
// ---------------------------------------------------------------------------

export interface OrgSeed {
  name: string;
  type: "univ" | "company" | "ngo" | "govt" | "volunteers";
  district: string;
  expertise: string[];
  csr_focus?: string[];
  csr_budget?: number;
  response_radius_km: number;
  about: string;
  capabilities: Array<{ capability: string; capacity: number }>;
}

export const JHARKHAND_ORGS: OrgSeed[] = [
  {
    name: "BIT Mesra, Department of Electronics and Communication",
    type: "univ", district: "Ranchi", response_radius_km: 120,
    expertise: ["electronics", "sensors", "embedded", "siren", "telemetry"],
    about: "Demo data, potential partner. Electronics and communication laboratory.",
    capabilities: [
      { capability: "electronics", capacity: 3 },
      { capability: "siren", capacity: 2 },
      { capability: "sensors", capacity: 3 },
      { capability: "telemetry", capacity: 2 },
    ],
  },
  {
    name: "IIT (ISM) Dhanbad, Department of Mining Engineering",
    type: "univ", district: "Dhanbad", response_radius_km: 100,
    expertise: ["mining", "civil", "sensors", "mapping", "structural"],
    about: "Demo data, potential partner. Sits next to the Jharia coalfield.",
    capabilities: [
      { capability: "civil", capacity: 3 },
      { capability: "mapping", capacity: 2 },
      { capability: "sensors", capacity: 2 },
    ],
  },
  {
    name: "NIT Jamshedpur, Department of Civil Engineering",
    type: "univ", district: "East Singhbhum", response_radius_km: 110,
    expertise: ["civil", "structural", "shelter", "construction"],
    about: "Demo data, potential partner.",
    capabilities: [
      { capability: "civil", capacity: 4 },
      { capability: "shelter", capacity: 3 },
      { capability: "construction", capacity: 2 },
    ],
  },
  {
    name: "Birsa Agricultural University, Extension Directorate",
    type: "univ", district: "Ranchi", response_radius_km: 150,
    expertise: ["agriculture", "extension", "training", "water_quality"],
    about: "Demo data, potential partner. Agricultural extension across the state.",
    capabilities: [
      { capability: "agriculture", capacity: 4 },
      { capability: "extension", capacity: 4 },
      { capability: "training", capacity: 3 },
    ],
  },
  {
    name: "Central University of Jharkhand, Environmental Sciences",
    type: "univ", district: "Ranchi", response_radius_km: 130,
    expertise: ["environment", "water_testing", "water_quality", "mapping"],
    about: "Demo data, potential partner. Water testing and environmental assessment.",
    capabilities: [
      { capability: "water_testing", capacity: 3 },
      { capability: "water_quality", capacity: 3 },
      { capability: "environment", capacity: 2 },
    ],
  },
  {
    name: "Ranchi University, Department of Geography",
    type: "univ", district: "Ranchi", response_radius_km: 90,
    expertise: ["mapping", "drone_mapping", "data", "environment"],
    about: "Demo data, potential partner. Mapping and spatial analysis.",
    capabilities: [
      { capability: "mapping", capacity: 3 },
      { capability: "drone_mapping", capacity: 2 },
    ],
  },
  {
    name: "RIMS Ranchi, Community Medicine",
    type: "univ", district: "Ranchi", response_radius_km: 100,
    expertise: ["health", "training", "logistics"],
    about: "Demo data, potential partner. Community health.",
    capabilities: [
      { capability: "health", capacity: 3 },
      { capability: "training", capacity: 2 },
    ],
  },
  {
    name: "Sahebganj Polytechnic, Applied Sciences",
    type: "univ", district: "Sahebganj", response_radius_km: 60,
    expertise: ["water_testing", "electronics", "civil"],
    about: "Demo data, potential partner. Nearest institution to the flood belt.",
    capabilities: [
      { capability: "water_testing", capacity: 2 },
      { capability: "electronics", capacity: 1 },
    ],
  },
  // --- fictional companies ---
  {
    name: "Damodar Steel Works (fictional)",
    type: "company", district: "East Singhbhum", response_radius_km: 200,
    expertise: ["manufacturing", "logistics", "electronics"],
    csr_focus: ["disaster management", "rural safety", "education"],
    csr_budget: 45_000_000,
    about: "Fictional company used for the demo. No real organisation is implied.",
    capabilities: [
      { capability: "electronics", capacity: 5 },
      { capability: "logistics", capacity: 4 },
      { capability: "siren", capacity: 4 },
    ],
  },
  {
    name: "Koel Valley Minerals (fictional)",
    type: "company", district: "Palamu", response_radius_km: 180,
    expertise: ["logistics", "heavy_equipment", "civil"],
    csr_focus: ["disaster management", "water", "livelihood"],
    csr_budget: 28_000_000,
    about: "Fictional company used for the demo.",
    capabilities: [
      { capability: "logistics", capacity: 4 },
      { capability: "civil", capacity: 3 },
    ],
  },
  {
    name: "Subarnarekha Power (fictional)",
    type: "company", district: "Ranchi", response_radius_km: 200,
    expertise: ["energy", "electronics", "telemetry"],
    csr_focus: ["energy access", "disaster management"],
    csr_budget: 33_000_000,
    about: "Fictional company used for the demo.",
    capabilities: [
      { capability: "energy", capacity: 4 },
      { capability: "telemetry", capacity: 3 },
      { capability: "siren", capacity: 3 },
    ],
  },
  {
    name: "Ganga Water Systems (fictional)",
    type: "company", district: "Sahebganj", response_radius_km: 120,
    expertise: ["water_testing", "filtration", "manufacturing"],
    csr_focus: ["water", "disaster management", "health"],
    csr_budget: 12_000_000,
    about: "Fictional water-equipment company used for the demo.",
    capabilities: [
      { capability: "water_testing", capacity: 4 },
      { capability: "filtration", capacity: 5 },
    ],
  },
  {
    name: "Chhotanagpur Electricals (fictional)",
    type: "company", district: "Ranchi", response_radius_km: 150,
    expertise: ["electronics", "siren", "manufacturing"],
    csr_focus: ["rural safety", "disaster management"],
    csr_budget: 8_000_000,
    about: "Fictional electrical supplier used for the demo. Holds siren stock in Ranchi.",
    capabilities: [
      { capability: "siren", capacity: 5 },
      { capability: "electronics", capacity: 4 },
    ],
  },
  {
    name: "Netarhat Agritech (fictional)",
    type: "company", district: "Latehar", response_radius_km: 140,
    expertise: ["agriculture", "sensors", "extension"],
    csr_focus: ["agriculture", "livelihood"],
    csr_budget: 6_000_000,
    about: "Fictional company used for the demo.",
    capabilities: [{ capability: "agriculture", capacity: 3 }],
  },
  {
    name: "Parasnath Logistics (fictional)",
    type: "company", district: "Giridih", response_radius_km: 220,
    expertise: ["logistics", "transport"],
    csr_focus: ["disaster management", "logistics"],
    csr_budget: 9_000_000,
    about: "Fictional company used for the demo.",
    capabilities: [{ capability: "logistics", capacity: 5 }],
  },
  {
    name: "Hazaribagh Renewables (fictional)",
    type: "company", district: "Hazaribagh", response_radius_km: 160,
    expertise: ["energy", "solar", "electronics"],
    csr_focus: ["energy access", "education"],
    csr_budget: 7_500_000,
    about: "Fictional company used for the demo.",
    capabilities: [{ capability: "energy", capacity: 3 }],
  },
  // --- fictional NGOs and volunteer groups ---
  {
    name: "Gram Sahyog Samiti (fictional)",
    type: "ngo", district: "Gumla", response_radius_km: 50,
    expertise: ["training", "community", "extension"],
    about: "Fictional local NGO used for the demo.",
    capabilities: [
      { capability: "training", capacity: 4 },
      { capability: "community", capacity: 5 },
    ],
  },
  {
    name: "Ganga Tat Seva Sansthan (fictional)",
    type: "ngo", district: "Sahebganj", response_radius_km: 60,
    expertise: ["logistics", "boats", "community"],
    about: "Fictional local NGO used for the demo. Operates boats along the river.",
    capabilities: [
      { capability: "logistics", capacity: 4 },
      { capability: "community", capacity: 4 },
    ],
  },
  {
    name: "Palamu Jan Kalyan Trust (fictional)",
    type: "ngo", district: "Palamu", response_radius_km: 70,
    expertise: ["health", "community", "training"],
    about: "Fictional NGO used for the demo.",
    capabilities: [{ capability: "health", capacity: 3 }],
  },
  {
    name: "NSS Unit, Ranchi colleges (demo data)",
    type: "volunteers", district: "Ranchi", response_radius_km: 80,
    expertise: ["community", "survey", "training"],
    about: "Demo data representing an NSS volunteer network.",
    capabilities: [{ capability: "community", capacity: 6 }],
  },
  {
    name: "Aapda Mitra volunteers, Sahebganj (demo data)",
    type: "volunteers", district: "Sahebganj", response_radius_km: 45,
    expertise: ["community", "survey", "rescue_support"],
    about: "Demo data representing the Aapda Mitra network.",
    capabilities: [{ capability: "community", capacity: 5 }],
  },
  {
    name: "Jharkhand State Disaster Management Authority (demo data)",
    type: "govt", district: "Ranchi", response_radius_km: 400,
    expertise: ["coordination", "alerts", "training"],
    about: "Demo data. Coordination authority for the state.",
    capabilities: [{ capability: "coordination", capacity: 10 }],
  },
];

export const RAJKOT_ORGS: OrgSeed[] = [
  {
    name: "Marwadi University, Rajkot",
    type: "univ", district: "Rajkot", response_radius_km: 80,
    expertise: ["electronics", "software", "civil", "data", "sensors"],
    about: "Demo data, potential partner. Our own university, for the college round.",
    capabilities: [
      { capability: "electronics", capacity: 4 },
      { capability: "software", capacity: 5 },
      { capability: "civil", capacity: 3 },
      { capability: "sensors", capacity: 3 },
    ],
  },
  {
    name: "Saurashtra Ceramics (fictional)",
    type: "company", district: "Morbi", response_radius_km: 100,
    expertise: ["manufacturing", "logistics"],
    csr_focus: ["water", "worker safety", "disaster management"],
    csr_budget: 15_000_000,
    about: "Fictional company used for the demo.",
    capabilities: [{ capability: "logistics", capacity: 4 }],
  },
  {
    name: "Rajkot Nagrik Seva Mandal (fictional)",
    type: "ngo", district: "Rajkot", response_radius_km: 40,
    expertise: ["community", "training", "health"],
    about: "Fictional local NGO used for the demo.",
    capabilities: [{ capability: "community", capacity: 4 }],
  },
];

// ---------------------------------------------------------------------------
// The resource registry. This is what "available nearby" reads.
// ---------------------------------------------------------------------------

export interface ResourceSeed {
  orgName: string;
  type: string;
  label: string;
  quantity: number;
  unit: string;
  district: string;
}

export const RESOURCES: ResourceSeed[] = [
  { orgName: "Chhotanagpur Electricals (fictional)", type: "siren_unit", label: "Siren units in stock", quantity: 30, unit: "unit", district: "Ranchi" },
  { orgName: "Damodar Steel Works (fictional)", type: "siren_unit", label: "Siren units, warehouse", quantity: 12, unit: "unit", district: "East Singhbhum" },
  { orgName: "Ganga Tat Seva Sansthan (fictional)", type: "boat", label: "River boats with crew", quantity: 2, unit: "boat", district: "Sahebganj" },
  { orgName: "Ganga Tat Seva Sansthan (fictional)", type: "satellite_phone", label: "Satellite phone with a volunteer", quantity: 1, unit: "unit", district: "Sahebganj" },
  { orgName: "Ranchi University, Department of Geography", type: "drone", label: "Mapping drone team", quantity: 2, unit: "team", district: "Ranchi" },
  { orgName: "Central University of Jharkhand, Environmental Sciences", type: "water_test_kit", label: "Water-quality test kits", quantity: 25, unit: "kit", district: "Ranchi" },
  { orgName: "Ganga Water Systems (fictional)", type: "filtration_unit", label: "Portable filtration units", quantity: 14, unit: "unit", district: "Sahebganj" },
  { orgName: "Gram Sahyog Samiti (fictional)", type: "community_hall", label: "Community halls usable as shelters", quantity: 4, unit: "building", district: "Gumla" },
  { orgName: "Aapda Mitra volunteers, Sahebganj (demo data)", type: "volunteer_team", label: "Trained volunteer teams", quantity: 6, unit: "team", district: "Sahebganj" },
  { orgName: "RIMS Ranchi, Community Medicine", type: "medical_kit", label: "Essential medicine kits", quantity: 60, unit: "kit", district: "Ranchi" },
  { orgName: "BIT Mesra, Department of Electronics and Communication", type: "workshop", label: "Electronics workshop and 3D printer", quantity: 1, unit: "lab", district: "Ranchi" },
  { orgName: "Parasnath Logistics (fictional)", type: "truck", label: "Light trucks", quantity: 8, unit: "vehicle", district: "Giridih" },
];

// ---------------------------------------------------------------------------
// Hazard layers. Approximate, sketched for the demo, and labelled as such.
// ---------------------------------------------------------------------------

export interface HazardSeed {
  hazard: string;
  district: string;
  intensity: number;
  population: number;
  expectedReports: number;
  radiusKm: number;
}

export const JHARKHAND_HAZARDS: HazardSeed[] = [
  { hazard: "lightning", district: "Gumla", intensity: 0.95, population: 48000, expectedReports: 30, radiusKm: 25 },
  { hazard: "flood", district: "Sahebganj", intensity: 0.92, population: 52000, expectedReports: 28, radiusKm: 30 },
  // Palamu has high drought risk and deliberately zero reports: the silent
  // zone the dashboard points at.
  { hazard: "drought", district: "Palamu", intensity: 0.87, population: 44000, expectedReports: 22, radiusKm: 35 },
  { hazard: "mining", district: "Dhanbad", intensity: 0.9, population: 61000, expectedReports: 26, radiusKm: 20 },
  { hazard: "lightning", district: "Simdega", intensity: 0.88, population: 36000, expectedReports: 24, radiusKm: 25 },
];

export const RAJKOT_HAZARDS: HazardSeed[] = [
  { hazard: "waterlogging", district: "Rajkot", intensity: 0.76, population: 42000, expectedReports: 18, radiusKm: 12 },
  { hazard: "heat", district: "Rajkot", intensity: 0.84, population: 55000, expectedReports: 20, radiusKm: 15 },
];

// ---------------------------------------------------------------------------
// Rajkot: three challenges, enough for the ten-second region switch.
// ---------------------------------------------------------------------------

export const RAJKOT_TEMPLATES: Array<{
  text: string;
  category: string;
  severity: number;
  people: number;
  vulnerable?: string[];
  area: string;
}> = [
  { text: "Monsoon waterlogging in the low-lying ward stays for days. Shops and homes flood every year.", category: "roads_infra", severity: 4, people: 2600, area: "Rajkot" },
  { text: "Construction and delivery workers have no shaded rest point. Heat stress cases rise every May.", category: "health", severity: 4, people: 1400, vulnerable: ["elderly"], area: "Rajkot" },
  { text: "Summer water supply drops to alternate days. Tanker dependence is high.", category: "water", severity: 3, people: 3200, area: "Jetpur" },
];

/** Three solved challenges, so the do-not-duplicate library is not empty. */
export const SOLVED_LIBRARY: Array<{
  title: string;
  district: string;
  category: string;
  approach: string;
  cost: number;
  days: number;
  peopleServed: number;
}> = [
  { title: "Siren relay for official lightning alerts, Simdega block", district: "Simdega", category: "disaster_safety", approach: "Solar-powered siren relays at panchayat buildings, triggered by the official alert feed and a manual key.", cost: 210000, days: 45, peopleServed: 3200 },
  { title: "Low-cost field shelters for farm workers, Khunti", district: "Khunti", category: "disaster_safety", approach: "Brick and ferrocement shelters with earthed lightning rods, built with village labour.", cost: 380000, days: 75, peopleServed: 1800 },
  { title: "Handpump repair and water testing programme, Lohardaga", district: "Lohardaga", category: "water", approach: "Trained village mechanics plus quarterly water testing by a university lab.", cost: 145000, days: 60, peopleServed: 4100 },
];
