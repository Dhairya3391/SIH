'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Users, Flame, ChevronDown, CheckCircle2, ShieldQuestion, Wrench, Building2, PackagePlus, Loader2, ArrowRight } from 'lucide-react';
import { fetchChallengeDetail, fetchNearbyResources, adoptChallenge, pledgeResource } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function ChallengeDetailPage({ params }: { params: Promise<{ ref: string }> }) {
  const resolvedParams = use(params);
  const { user, role } = useAuth();
  const [data, setData] = useState<any>(null);
  const [nearby, setNearby] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // For Adopt and Pledge
  const [adopting, setAdopting] = useState(false);
  const [pledging, setPledging] = useState<string | null>(null);
  const [pledgeQty, setPledgeQty] = useState<{ [key: string]: number }>({});

  const loadData = async () => {
    try {
      const res = await fetchChallengeDetail(resolvedParams.ref);
      setData(res);
      const nearbyRes = await fetchNearbyResources(res.challenge.id, 30);
      setNearby(nearbyRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [resolvedParams.ref]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading challenge...</div>;
  if (error || !data) return <div className="min-h-screen flex items-center justify-center text-red-500">{error || 'Challenge not found'}</div>;

  const { challenge, gap, matches, cluster, assignments } = data;

  const handleAdopt = async () => {
    if (!user?.org_id) return alert('No organisation associated with this user.');
    try {
      setAdopting(true);
      await adoptChallenge(challenge.id, { org_id: user.org_id, role: 'builder' });
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdopting(false);
    }
  };

  const handlePledge = async (needId: string) => {
    const qty = pledgeQty[needId];
    if (!qty || qty <= 0) return;
    if (!user?.org_id) return alert('No organisation associated with this user.');
    try {
      setPledging(needId);
      await pledgeResource(challenge.id, {
        need_id: needId,
        org_id: user.org_id,
        qty,
        kind: 'equipment',
        note: 'Pledged via demo'
      });
      setPledgeQty({ ...pledgeQty, [needId]: 0 });
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPledging(null);
    }
  };

  const hasAdopted = assignments?.some((a: any) => a.org_id === user?.org_id);

  return (
    <div className="min-h-screen bg-[#F4F6F5] text-[#102027] flex flex-col">
      <header className="bg-white border-b border-[#CCD1C7] px-4 py-3 sticky top-0 z-20 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/queue" className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-[#102027]">
              <ArrowLeft className="w-4 h-4" /> Back to Queue
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">Challenge {challenge.ref ?? challenge.id}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full p-4 sm:p-6 flex-1 space-y-6">
        <div className="bg-white rounded-2xl border border-[#CCD1C7] shadow-xs p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#D94F45]/15 text-[#A8332A] border border-[#D94F45]/30">
              PRIORITY {challenge.priority}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 uppercase">
              {String(challenge.category).replace(/_/g, " ")}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold mb-3 text-[#102027]">{challenge.title}</h1>
          <p className="text-sm text-gray-700 leading-relaxed mb-6">{challenge.problem}</p>
          
          <div className="flex items-center gap-4 text-xs font-mono text-gray-600">
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {challenge.district}</span>
            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {challenge.people_est} affected</span>
            <span className="flex items-center gap-1">Confidence: {String(challenge.confidence || 'unverified').replace(/_/g, ' ')}</span>
          </div>
        </div>

        {/* Cluster & Evidence + Priority Explanation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-[#CCD1C7] shadow-xs p-5 sm:p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#102027] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#2E7180]" /> Ground Reports & Evidence
            </h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-[#102027]">
                {cluster?.report_count || 0} reports from {cluster?.villages || 0} villages
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-mono">
                <span className="px-2 py-1 bg-white border border-gray-200 rounded text-gray-600">
                  {cluster?.photos || 0} photos
                </span>
                {(cluster?.via_sms || 0) > 0 && (
                  <span className="px-2 py-1 bg-amber-50 border border-amber-200 rounded text-amber-800 font-bold">
                    {cluster.via_sms} via SMS
                  </span>
                )}
              </div>
            </div>
            
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Community Validation</h3>
              <div className="flex gap-2">
                <button className="flex-1 bg-white border border-[#CCD1C7] text-[#102027] hover:bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-bold transition">
                  Confirm Impact
                </button>
                <button className="flex-1 bg-white border border-[#CCD1C7] text-[#102027] hover:bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-bold transition">
                  Flag as Invalid
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#CCD1C7] shadow-xs p-5 sm:p-6">
            <h2 className="text-lg font-bold text-[#102027] flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-[#D94F45]" /> Why this rank?
            </h2>
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <span className="text-[11px] font-mono font-bold text-red-800 uppercase tracking-wider mb-1 block">Verdict</span>
                <p className="text-sm text-red-900 leading-relaxed">
                  {challenge.score_breakdown?.why_critical || 'Analysis pending.'}
                </p>
              </div>
              <div className="text-[11px] text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
                {challenge.ai_disclaimer || 'Analysis performed by automated system.'}
              </div>
            </div>
          </div>
        </div>

        {/* Partner Matching & Nearby Resources Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-[#CCD1C7] shadow-xs overflow-hidden">
            <div className="bg-[#2E7180] text-white p-4 flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5" /> Recommended Partners
              </h2>
              {role === 'university' && (
                hasAdopted ? (
                  <span className="bg-emerald-600 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Adopted
                  </span>
                ) : (
                  <button 
                    onClick={handleAdopt} 
                    disabled={adopting}
                    className="bg-white text-[#2E7180] hover:bg-teal-50 px-3 py-1 rounded text-xs font-bold flex items-center gap-1 shadow-sm transition"
                  >
                    {adopting ? 'Adopting...' : 'Adopt Challenge'}
                  </button>
                )
              )}
            </div>
            <div className="p-4 space-y-4">
              {matches && matches.length > 0 ? (
                matches.map((m: any, idx: number) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-[#F4F6F5]">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-sm text-[#102027]">{m.organizations.name}</h4>
                      <span className="text-[10px] font-mono font-bold bg-[#E5A83B]/20 text-[#8A5A00] px-2 py-0.5 rounded">
                        FIT {Math.round(m.score)}%
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 mb-1">{m.organizations.type} · {m.organizations.district}</p>
                    <p className="text-[11px] font-medium text-[#2E7180]">Reason: {m.reasons?.text || 'Strong capability match'}</p>
                  </div>
                ))
              ) : (
                <div className="text-xs text-gray-500 text-center py-4">No recommended partners found.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#CCD1C7] shadow-xs overflow-hidden">
            <div className="bg-gray-100 text-[#102027] border-b border-[#CCD1C7] p-4">
              <h2 className="font-bold flex items-center gap-2">
                <MapPin className="w-5 h-5" /> Available Nearby
              </h2>
            </div>
            <div className="p-4 space-y-4">
              {nearby && nearby.resources && nearby.resources.length > 0 ? (
                nearby.resources.map((r: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div>
                      <h4 className="text-sm font-bold text-[#102027]">{r.quantity} {r.unit} {r.type}</h4>
                      <p className="text-[11px] text-gray-500">{r.org_name || 'Partner Org'} · {r.distance_km != null ? Math.round(r.distance_km) : '?'} km away</p>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                      {r.availability.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-gray-500 text-center py-4">No resources currently listed nearby.</div>
              )}
            </div>
          </div>
        </div>

        {/* Team Builder */}
        {data.team && data.team.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#CCD1C7] shadow-xs overflow-hidden">
            <div className="bg-[#102027] text-white border-b border-gray-800 p-4">
              <h2 className="font-bold flex items-center gap-2 text-sm">
                <Users className="w-4 h-4" /> Skill-Gap Team Builder
              </h2>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {data.team.map((member: any, idx: number) => (
                  <span 
                    key={idx} 
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      member.filled 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-white text-gray-600 border-gray-200 border-dashed'
                    }`}
                  >
                    {member.seat} {member.filled && '✓'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Resource Swarm & Pledges */}
        {gap && gap.needs && gap.needs.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#CCD1C7] shadow-xs p-5 sm:p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-[#2E7180]" /> Resource Swarm (Gap Bar)
            </h2>
            <div className="space-y-6">
              {gap.needs.map((need: any) => {
                const open = need.qty_needed - need.qty_pledged;
                const pct = Math.min(100, (need.qty_pledged / need.qty_needed) * 100);
                const isFullyPledged = open <= 0;
                
                return (
                  <div key={need.need_id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-sm text-[#102027]">{need.item}</h3>
                      <span className="font-mono text-xs font-bold text-[#2E7180]">
                        {need.qty_pledged} / {need.qty_needed} {need.unit}
                      </span>
                    </div>
                    
                    <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden mb-3">
                      <div 
                        className="bg-[#2E7180] h-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    
                    {role === 'industry' && !isFullyPledged && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                        <span className="text-xs text-gray-500 font-medium">Industry Pledge:</span>
                        <input 
                          type="number" 
                          min={1} 
                          max={open}
                          value={pledgeQty[need.need_id] || ''}
                          onChange={(e) => setPledgeQty({ ...pledgeQty, [need.need_id]: parseInt(e.target.value) || 0 })}
                          placeholder="Qty"
                          className="w-20 text-xs border border-gray-300 rounded px-2 py-1 outline-none focus:border-[#2E7180]"
                        />
                        <button 
                          onClick={() => handlePledge(need.need_id)}
                          disabled={pledging === need.need_id}
                          className="bg-[#102027] text-white hover:bg-gray-800 px-3 py-1 rounded text-xs font-bold transition"
                        >
                          {pledging === need.need_id ? '...' : 'Pledge'}
                        </button>
                      </div>
                    )}
                    {isFullyPledged && (
                      <div className="mt-2 text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Fully Pledged
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Proposals / Solutions */}
        {data.solutions && data.solutions.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#CCD1C7] shadow-xs p-5 sm:p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-[#2E7180]" /> Proposals & Readiness
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.solutions.map((sol: any) => (
                <div key={sol.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-sm text-[#102027]">{sol.title}</h3>
                      <span className="font-mono text-xs font-bold px-2 py-1 bg-white border border-gray-200 rounded text-gray-700">
                        Readiness: {sol.readiness || '?'}/100
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mb-3">{sol.organizations?.name || 'Unknown Partner'}</p>
                    <p className="text-xs text-gray-700 leading-relaxed line-clamp-3 mb-3">{sol.approach}</p>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-200">
                    <span className="text-xs font-mono text-gray-600">Cost: {sol.cost_estimate || 'TBD'}</span>
                    <span className="text-xs font-mono text-gray-600">Time: {sol.deploy_days ? `${sol.deploy_days} days` : 'TBD'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        {data.timeline && data.timeline.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#CCD1C7] shadow-xs p-5 sm:p-6 mb-8">
            <h2 className="text-lg font-bold mb-4 text-[#102027]">Timeline & Log</h2>
            <div className="space-y-4">
              {data.timeline.map((entry: any, i: number) => (
                <div key={i} className="flex gap-4">
                  <div className="w-24 shrink-0 text-xs text-gray-500 font-mono text-right pt-0.5">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </div>
                  <div className="w-px bg-gray-200 relative">
                    <div className="absolute top-1.5 -left-1 w-2.5 h-2.5 rounded-full bg-[#2E7180]" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-semibold text-[#102027]">{entry.kind || entry.title}</p>
                    {entry.note && <p className="text-xs text-gray-600 mt-1">{entry.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
