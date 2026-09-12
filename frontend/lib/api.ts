export async function fetchChallenges(regionId: string = 'jharkhand') {
  const res = await fetch(`/api/challenges?region_id=${regionId}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch challenges');
  return res.json();
}

export async function submitReport(payload: {
  text: string;
  district?: string;
  village?: string;
  people_est?: number;
  reporter_name?: string;
  vulnerable?: string[];
  photo_urls?: string[];
}) {
  const res = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to submit report');
  return res.json();
}
