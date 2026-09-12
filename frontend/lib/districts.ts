/**
 * The 24 districts of Jharkhand, as the database spells them.
 *
 * Hardcoded rather than fetched: the report form is the one screen that has to
 * work with no network (the submission is queued), and a district picker that
 * needs a round trip before a citizen can type is a picker that fails in the
 * one place it matters.
 */
export const DISTRICTS = [
  "Bokaro",
  "Chatra",
  "Deoghar",
  "Dhanbad",
  "Dumka",
  "East Singhbhum",
  "Garhwa",
  "Giridih",
  "Godda",
  "Gumla",
  "Hazaribagh",
  "Jamtara",
  "Khunti",
  "Koderma",
  "Latehar",
  "Lohardaga",
  "Pakur",
  "Palamu",
  "Ramgarh",
  "Ranchi",
  "Sahebganj",
  "Seraikela Kharsawan",
  "Simdega",
  "West Singhbhum",
] as const;

/** Who is affected. The wording is what a citizen would say, not a schema. */
export const VULNERABLE_GROUPS: { key: string; label: string }[] = [
  { key: "children", label: "Children" },
  { key: "elderly", label: "Elderly people" },
  { key: "disability", label: "People with a disability" },
  { key: "pregnancy", label: "Pregnant women" },
  { key: "medical", label: "People needing medicine" },
];

export const HAZARDS: { key: string; label: string }[] = [
  { key: "lightning", label: "Lightning" },
  { key: "flood", label: "Flood" },
  { key: "drought", label: "Drought" },
  { key: "mining", label: "Mining subsidence" },
  { key: "forest_fire", label: "Forest fire" },
  { key: "elephant_conflict", label: "Elephant conflict" },
  { key: "heatwave", label: "Heatwave" },
  { key: "cyclone", label: "Cyclone" },
];
