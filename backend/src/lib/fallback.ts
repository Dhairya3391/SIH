import { Category, DisasterPhase } from '../types/database';

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

export function compileReport(text: string, peopleEstimateInput?: number): CompiledBrief {
  const lower = text.toLowerCase();
  
  let category: Category = 'disaster';
  let dm_phase: DisasterPhase = 'mitigation';
  let severity = 3;
  let capabilities: string[] = ['Ground Verification', 'Emergency Response'];
  let title = 'Community Report: Urgent Assistance Required';
  let unsure = 'Exact number of families affected; ground verification needed.';

  // 1. Keyword Categorization
  if (lower.includes('bijli') || lower.includes('lightning') || lower.includes('thunder') || lower.includes('vajrapaat')) {
    category = 'disaster';
    dm_phase = 'mitigation';
    severity = 5;
    title = 'Last-mile lightning alerts and agricultural shelter';
    capabilities = ['Acoustic Siren Relay', 'Embedded Hardware', 'Field Shelter Design'];
    unsure = 'Whether siren range covers outer hamlets and panchayat alert pole location.';
  } else if (lower.includes('flood') || lower.includes('ganga') || lower.includes('baadh') || lower.includes('submerged') || lower.includes('culvert')) {
    category = 'disaster';
    dm_phase = 'response';
    severity = 5;
    title = 'Flood isolation emergency access & clean water';
    capabilities = ['Inflatable Boat Logistics', 'Mobile Water Purification', 'Temporary Footbridge'];
    unsure = 'Tractor route passability on eastern embankment.';
  } else if (lower.includes('fire') || lower.includes('subsidence') || lower.includes('crack') || lower.includes('coal') || lower.includes('jharia')) {
    category = 'disaster';
    dm_phase = 'mitigation';
    severity = 4;
    title = 'Mine subsidence & underground fire early warning';
    capabilities = ['InSAR/Tiltmeter Sensing', 'Thermal Drone Imagery', 'Sand Stowing'];
    unsure = 'Underground temperature expansion boundary.';
  } else if (lower.includes('water') || lower.includes('arsenic') || lower.includes('borewell') || lower.includes('handpump') || lower.includes('pani')) {
    category = 'water';
    dm_phase = 'mitigation';
    severity = 4;
    title = 'Potable drinking water filtration & solar pumping';
    capabilities = ['Adsorptive Media Filtration', 'Water Quality Lab Testing', 'Solar PV Pump'];
    unsure = 'Seasonal depth fluctuation of local aquifer.';
  } else if (lower.includes('school') || lower.includes('bridge') || lower.includes('children') || lower.includes('padhai') || lower.includes('nullah')) {
    category = 'education';
    dm_phase = 'preparedness';
    severity = 4;
    title = 'All-weather pedestrian access & educational infrastructure';
    capabilities = ['Structural Cable Footbridge', 'Offline Digital Tablets', 'Civil Anchor Masonry'];
    unsure = 'Peak monsoon stream discharge velocity.';
  } else if (lower.includes('crop') || lower.includes('drought') || lower.includes('kisan') || lower.includes('sukha') || lower.includes('irrigation')) {
    category = 'agriculture';
    dm_phase = 'mitigation';
    severity = 3;
    title = 'Drought mitigation & solar micro-irrigation';
    capabilities = ['Solar DC Pump Lift', 'Micro-drip Reticulation', 'Check-dam Desilting'];
    unsure = 'Remaining water table capacity in upstream catchment.';
  } else if (lower.includes('hospital') || lower.includes('doctor') || lower.includes('vaccine') || lower.includes('medicine') || lower.includes('snakebite')) {
    category = 'health';
    dm_phase = 'preparedness';
    severity = 4;
    title = 'Mobile cold-chain medical transit & emergency antivenom';
    capabilities = ['Solar Thermoelectric Cooling', 'Phase Change Cold Box', 'Emergency Boat Transit'];
    unsure = 'Cold-chain battery autonomy during 48-hour continuous power outage.';
  }

  // Calculate People affected
  let people_est = peopleEstimateInput || 100;
  if (!peopleEstimateInput) {
    const match = text.match(/(\d+)\s*(people|residents|villagers|baccho|kisan|log)/i);
    if (match) {
      people_est = parseInt(match[1], 10);
    }
  }

  // Calculate priority score (0-100) using deterministic formula
  // 25 * severity/5 + 15 * urgency/5 + 15 * log(people) + 15 * vulnerability
  const severityScore = (severity / 5) * 25;
  const urgencyScore = severity >= 4 ? 15 : 10;
  const peopleScore = Math.min(15, Math.round(Math.log10(Math.max(10, people_est)) * 5));
  const vulnScore = 12;
  const priority = Math.min(100, Math.round(severityScore + urgencyScore + peopleScore + vulnScore + 10));

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
