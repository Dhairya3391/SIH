'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CloudRain,
  ExternalLink,
  Filter,
  Loader2,
  Newspaper,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { RouteGuard as RoleGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { LoadingSkeleton } from '@/components/shell/LoadingSkeleton';
import {
  fetchVerifyQueue,
  confirmVerification,
  rejectVerification,
  runCorroboration,
} from '@/lib/api';

/**
 * The verifier desk.
 *
 * Reports no human has confirmed yet, each carrying whatever the AI found.
 * The evidence sits ABOVE the model's conclusion on purpose: a verifier should
 * read the sources and then decide, not read a verdict and then rationalise it.
 *
 * An externally corroborated report is still in this queue. The model earns
 * its own confidence rung and nothing more — only a confirmation here makes a
 * problem visible to colleges.
 */

interface Citation {
  url: string;
  title: string;
  publisher: string | null;
  published_at: string | null;
  snippet: string;
}
interface Check {
  provider: string;
  verdict: string;
  confidence: number;
  citations: Citation[] | null;
  reasoning: string | null;
  provider_error: string | null;
  checked_at: string;
}
interface Row {
  id: string;
  ref: string;
  title: string;
  district: string;
  block: string | null;
  category: string;
  hazard_tags: string[] | null;
  severity: number;
  priority: number;
  confidence: string;
  people_est: number;
  report_count: number;
  brief: { problem?: string } | null;
  why_critical: string | null;
  created_at: string;
  external: {
    checked: boolean;
    verdict: string;
    citation_count: number;
    checks: Check[];
  };
}

const PROVIDER_ICON: Record<string, typeof CloudRain> = {
  weather: CloudRain,
  news: Newspaper,
  web: Search,
};

export default function VerifyQueuePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [district, setDistrict] = useState('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  // confirm form, per row
  const [sources, setSources] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetchVerifyQueue({
        district: district === 'all' ? undefined : district,
        limit: 60,
      });
      setRows(res.queue as Row[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the queue.');
    } finally {
      setLoading(false);
    }
  }, [district]);

  useEffect(() => {
    load();
  }, [load]);

  const districts = useMemo(() => [...new Set(rows.map((r) => r.district))].sort(), [rows]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title?.toLowerCase().includes(q) ||
        r.ref?.toLowerCase().includes(q) ||
        r.district?.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const onCorroborate = async (row: Row) => {
    setBusy(`ai-${row.id}`);
    setNotice('');
    setError('');
    try {
      const res = await runCorroboration(row.id);
      setNotice(
        res.verdict === 'supports'
          ? `Found ${res.citations.length} supporting source(s) for ${row.ref}. It still needs your confirmation.`
          : res.verdict === 'contradicts'
            ? `External sources appear to contradict ${row.ref}. Read them before deciding — the reporter may still be right.`
            : `Nothing conclusive found for ${row.ref}. ${res.all_providers_failed ? 'No provider could be reached.' : ''}`,
      );
      await load();
      setOpenId(row.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The check could not run.');
    } finally {
      setBusy(null);
    }
  };

  const onConfirm = async (row: Row) => {
    const urls = sources
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//.test(s));
    if (urls.length === 0) {
      setError(
        'A confirmation needs at least one source link. Verification without evidence is an opinion with a timestamp.',
      );
      return;
    }
    if (note.trim().length < 10) {
      setError('Say what you checked, in a sentence.');
      return;
    }
    setBusy(`ok-${row.id}`);
    setError('');
    try {
      await confirmVerification(row.id, {
        source_urls: urls,
        photo_paths: [],
        note: note.trim(),
      });
      setNotice(`${row.ref} is verified and now visible to colleges.`);
      setSources('');
      setNote('');
      setOpenId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record that.');
    } finally {
      setBusy(null);
    }
  };

  const onReject = async (row: Row) => {
    if (note.trim().length < 15) {
      setError('The reporter will read this. Give a proper reason, at least 15 characters.');
      return;
    }
    setBusy(`no-${row.id}`);
    setError('');
    try {
      await rejectVerification(row.id, note.trim());
      setNotice(`${row.ref} was rejected. The reporter will be told why.`);
      setNote('');
      setOpenId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record that.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <RoleGuard
      allowedRoles={['verifier', 'volunteer', 'coordinator', 'admin']}
      consoleTitle="Verifier Desk"
    >
      <div className="min-h-screen bg-[#F4F6F5] flex flex-col">
        <RoleNav />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                Stage 2 · Dual verification
              </div>
              <h1 className="text-2xl font-extrabold text-[#102027] tracking-tight">
                Reports waiting on a human
              </h1>
              <p className="text-sm text-gray-600 mt-1 max-w-2xl leading-relaxed">
                The AI can find corroboration, but only a confirmation here
                makes a problem visible to colleges.
              </p>
            </div>
            <button
              onClick={() => {
                setLoading(true);
                load();
              }}
              className="h-9 px-3 rounded-lg border border-[#CCD1C7] bg-white text-xs font-semibold text-gray-700 flex items-center gap-1.5 hover:border-[#2E7180]"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          <div className="bg-white rounded-xl border border-[#CCD1C7] p-3 flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] tracking-wider uppercase text-gray-500 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" /> {shown.length} in queue
            </span>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-[#CCD1C7] bg-[#F4F6F5] text-xs outline-none focus:border-[#2E7180]"
            >
              <option value="all">All districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, ref or district…"
              className="h-9 px-3 rounded-lg border border-[#CCD1C7] bg-[#F4F6F5] text-xs outline-none focus:border-[#2E7180] flex-1 min-w-[180px]"
            />
          </div>

          {notice && (
            <div className="flex items-start gap-2 text-xs text-emerald-900 bg-emerald-50 border border-emerald-300 rounded-xl p-3">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{notice}</span>
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 text-xs text-[#A8332A] bg-red-50 border border-red-200 rounded-xl p-3"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : shown.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#CCD1C7] p-10 text-center">
              <ShieldCheck className="w-7 h-7 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#102027]">Nothing waiting</p>
              <p className="text-xs text-gray-500 mt-1.5">
                Every report in this filter has been confirmed or rejected.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {shown.map((r) => {
                const open = openId === r.id;
                const ext = r.external;
                return (
                  <article
                    key={r.id}
                    className="bg-white rounded-xl border border-[#CCD1C7] overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span
                          className={`font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${
                            r.priority >= 75
                              ? 'bg-red-100 text-red-800'
                              : r.priority >= 55
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {r.priority}
                        </span>
                        <span className="font-mono text-[10px] text-gray-600 border border-[#CCD1C7] px-1.5 py-0.5 rounded uppercase">
                          {String(r.category).replace(/_/g, ' ')}
                        </span>
                        <span className="font-mono text-[10px] text-gray-500">
                          {r.district}
                          {r.block ? ` · ${r.block}` : ''} · {r.ref}
                        </span>
                        <span className="font-mono text-[10px] text-gray-500">
                          {r.report_count} report{r.report_count === 1 ? '' : 's'}
                        </span>

                        {/* what the AI found, as a badge */}
                        {!ext.checked ? (
                          <span className="font-mono text-[10px] text-gray-400 border border-dashed border-[#CCD1C7] px-1.5 py-0.5 rounded">
                            NOT CHECKED YET
                          </span>
                        ) : ext.verdict === 'supports' ? (
                          <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded">
                            CORROBORATED · {ext.citation_count} SOURCE
                            {ext.citation_count === 1 ? '' : 'S'}
                          </span>
                        ) : ext.verdict === 'contradicts' ? (
                          <span className="font-mono text-[10px] font-bold text-red-800 bg-red-50 border border-red-300 px-1.5 py-0.5 rounded">
                            SOURCES DISAGREE
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] text-gray-600 bg-gray-50 border border-[#CCD1C7] px-1.5 py-0.5 rounded">
                            NOTHING CONCLUSIVE
                          </span>
                        )}
                      </div>

                      <h2 className="font-bold text-[#102027] leading-snug">{r.title}</h2>
                      {r.brief?.problem && (
                        <p className="text-xs text-gray-600 mt-1.5 leading-relaxed line-clamp-2">
                          {r.brief.problem}
                        </p>
                      )}
                    </div>

                    <div className="px-4 py-3 bg-[#F4F6F5] border-t border-[#CCD1C7] flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => onCorroborate(r)}
                        disabled={busy !== null}
                        className="h-9 px-3 rounded-lg border border-[#2E7180] text-[#2E7180] text-xs font-semibold flex items-center gap-1.5 hover:bg-teal-50 disabled:opacity-50"
                      >
                        {busy === `ai-${r.id}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        {ext.checked ? 'Check again' : 'Look for proof'}
                      </button>
                      <button
                        onClick={() => {
                          setOpenId(open ? null : r.id);
                          setError('');
                        }}
                        className="h-9 px-3 rounded-lg bg-[#102027] text-white text-xs font-semibold hover:bg-[#1D3540]"
                      >
                        {open ? 'Close' : 'Review and decide'}
                      </button>
                      <Link
                        href={`/challenge/${r.ref}`}
                        className="ml-auto font-mono text-[10px] text-[#2E7180] hover:underline flex items-center gap-1"
                      >
                        Full brief <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>

                    {open && (
                      <div className="border-t border-[#CCD1C7] p-4 space-y-4">
                        {/* EVIDENCE FIRST, conclusion after */}
                        {ext.checked && (
                          <div>
                            <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-2">
                              What the sources say
                            </div>
                            <div className="space-y-2">
                              {ext.checks.map((c, i) => {
                                const Icon = PROVIDER_ICON[c.provider] ?? Search;
                                return (
                                  <div
                                    key={`${c.provider}-${i}`}
                                    className="border border-[#CCD1C7] rounded-lg p-3 bg-[#F4F6F5]"
                                  >
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <Icon className="w-3.5 h-3.5 text-gray-500" />
                                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-gray-600">
                                        {c.provider}
                                      </span>
                                      {c.provider_error ? (
                                        <span className="font-mono text-[10px] text-amber-800">
                                          could not run: {c.provider_error}
                                        </span>
                                      ) : (
                                        <span className="font-mono text-[10px] text-gray-500">
                                          {c.citations?.length ?? 0} cited
                                        </span>
                                      )}
                                    </div>
                                    {(c.citations ?? []).map((cit) => (
                                      <a
                                        key={cit.url}
                                        href={cit.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block bg-white border border-[#CCD1C7] rounded p-2 mb-1.5 hover:border-[#2E7180]"
                                      >
                                        <div className="text-xs font-semibold text-[#102027] leading-snug">
                                          {cit.title}
                                        </div>
                                        <div className="font-mono text-[10px] text-gray-500 mt-0.5">
                                          {cit.publisher ?? 'unknown publisher'}
                                          {cit.published_at
                                            ? ` · ${new Date(cit.published_at).toLocaleDateString('en-IN')}`
                                            : ''}
                                        </div>
                                        {cit.snippet && (
                                          <p className="text-[11px] text-gray-600 mt-1 leading-relaxed line-clamp-3">
                                            {cit.snippet}
                                          </p>
                                        )}
                                      </a>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                            {ext.checks[0]?.reasoning && (
                              <p className="text-[11px] text-gray-600 mt-2 leading-relaxed bg-white border border-[#CCD1C7] rounded-lg p-2.5">
                                <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
                                  The model concluded:{' '}
                                </span>
                                {ext.checks[0].reasoning}
                              </p>
                            )}
                            <p className="font-mono text-[10px] text-gray-500 mt-2">
                              This is the model&apos;s reading. You decide.
                            </p>
                          </div>
                        )}

                        {/* the decision */}
                        <div>
                          <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-2">
                            Your decision
                          </div>
                          <div className="space-y-2">
                            <input
                              value={sources}
                              onChange={(e) => setSources(e.target.value)}
                              placeholder="Source links, space or comma separated (https://…)"
                              className="w-full h-10 px-3 rounded-lg border border-[#CCD1C7] bg-[#F4F6F5] text-xs outline-none focus:border-[#2E7180]"
                            />
                            <textarea
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              rows={2}
                              placeholder="What did you check? A confirmation needs a sentence; a rejection is read by the reporter."
                              className="w-full px-3 py-2 rounded-lg border border-[#CCD1C7] bg-[#F4F6F5] text-xs outline-none focus:border-[#2E7180] resize-none"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => onConfirm(r)}
                                disabled={busy !== null}
                                className="h-10 px-4 rounded-lg bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-800 disabled:opacity-50"
                              >
                                {busy === `ok-${r.id}` ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                Confirm — open it to colleges
                              </button>
                              <button
                                onClick={() => onReject(r)}
                                disabled={busy !== null}
                                className="h-10 px-4 rounded-lg border border-[#A8332A] text-[#A8332A] text-xs font-semibold flex items-center gap-1.5 hover:bg-red-50 disabled:opacity-50"
                              >
                                {busy === `no-${r.id}` ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5" />
                                )}
                                Reject as inaccurate
                              </button>
                            </div>
                            <p className="text-[11px] text-gray-500 leading-relaxed flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                              Sources disagreeing is not proof the reporter is
                              wrong. Remote places are often genuinely
                              unreported — that is what Silent Zones exists for.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </RoleGuard>
  );
}
