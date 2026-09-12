'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Building2,
  GraduationCap,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
} from 'lucide-react';
import { RouteGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { LoadingSkeleton } from '@/components/shell/LoadingSkeleton';
import { fetchThreads, fetchMessages, sendMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * Conversations between a college and one contributing organisation.
 *
 * A thread is about ONE challenge and between exactly TWO organisations,
 * which is what keeps it answerable: a company asking "will the steel fit the
 * mounting you designed?" wants the college that designed it, not a broadcast
 * channel. Nobody outside the two can read it.
 */

interface ThreadRow {
  id: string;
  challenge: { id: string; ref: string; title: string; district: string } | null;
  college: { id: string; name: string; type: string } | null;
  contributor: { id: string; name: string; type: string } | null;
  my_side: 'college' | 'contributor' | 'observer';
  message_count: number;
  unread_count: number;
  last_message_at: string | null;
}

interface Message {
  id: string;
  body: string;
  created_at: string;
  author_name: string;
  author_role: string;
  author_org: string | null;
  is_self: boolean;
}

function whenLabel(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function MessagesPage() {
  const { organisation } = useAuth();
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<Record<string, any> | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const loadThreads = useCallback(async () => {
    setError('');
    try {
      const res = await fetchThreads();
      setThreads(res.threads as ThreadRow[]);
      setActiveId((prev) => prev ?? (res.threads[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your conversations.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    setLoadingThread(true);
    try {
      const res = await fetchMessages(id);
      setThread(res.thread);
      setMessages(res.messages as Message[]);
      // Reading clears the unread badge server-side; reflect that here.
      setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread_count: 0 } : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that conversation.');
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId, loadMessages]);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId || !draft.trim()) return;
    setSending(true);
    setError('');
    try {
      await sendMessage(activeId, draft.trim());
      setDraft('');
      await loadMessages(activeId);
      await loadThreads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that.');
    } finally {
      setSending(false);
    }
  };

  const otherSide = (t: ThreadRow) =>
    t.my_side === 'college' ? t.contributor : t.college;

  return (
    <RouteGuard
      allowedRoles={['university', 'industry', 'coordinator', 'admin']}
      consoleTitle="Messages"
    >
      <div className="min-h-screen bg-[#F4F6F5] flex flex-col">
        <RoleNav />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                Stage 4 · Direct college contact
              </div>
              <h1 className="text-2xl font-extrabold text-[#102027] tracking-tight">
                Conversations
              </h1>
              <p className="text-sm text-gray-600 mt-1 max-w-2xl leading-relaxed">
                One thread per project per partner. Only the two organisations
                in a thread can read it.
              </p>
            </div>
            <button
              onClick={() => {
                setLoading(true);
                loadThreads();
              }}
              className="h-9 px-3 rounded-lg border border-[#CCD1C7] bg-white text-xs font-semibold text-gray-700 flex items-center gap-1.5 hover:border-[#2E7180]"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 text-xs text-[#A8332A] bg-red-50 border border-red-200 rounded-xl p-3 mb-4"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {loading ? (
            <LoadingSkeleton rows={3} />
          ) : threads.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#CCD1C7] p-10 text-center">
              <MessageSquare className="w-7 h-7 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#102027]">No conversations yet</p>
              <p className="text-xs text-gray-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                A thread opens when a company or NGO contributes to a project a
                college has won — that is the point at which the two sides have
                something to sort out. Pledge against an open need and the
                conversation appears here.
              </p>
              <Link
                href="/needs"
                className="inline-flex mt-4 h-9 px-4 rounded-lg bg-[#102027] text-white text-xs font-semibold items-center hover:bg-[#1D3540]"
              >
                Browse open needs
              </Link>
            </div>
          ) : (
            <div className="grid lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] gap-4">
              {/* list */}
              <aside className="bg-white rounded-xl border border-[#CCD1C7] overflow-hidden h-fit">
                <div className="px-3 py-2.5 border-b border-[#CCD1C7] font-mono text-[10px] tracking-wider uppercase text-gray-500">
                  {threads.length} thread{threads.length === 1 ? '' : 's'}
                </div>
                <div className="divide-y divide-[#DFE4DC] max-h-[560px] overflow-y-auto">
                  {threads.map((t) => {
                    const other = otherSide(t);
                    const active = t.id === activeId;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setActiveId(t.id)}
                        className={`w-full text-left p-3 hover:bg-[#F4F6F5] ${
                          active ? 'bg-[#F4F6F5] border-l-2 border-l-[#2E7180]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {t.my_side === 'college' ? (
                            <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          ) : (
                            <GraduationCap className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          )}
                          <span className="font-semibold text-xs text-[#102027] truncate flex-1">
                            {other?.name ?? 'Unknown partner'}
                          </span>
                          {t.unread_count > 0 && (
                            <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#A8332A] text-white shrink-0">
                              {t.unread_count}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-600 leading-snug line-clamp-2">
                          {t.challenge?.title ?? 'Unknown project'}
                        </div>
                        <div className="font-mono text-[9.5px] text-gray-400 mt-1">
                          {t.challenge?.ref} · {t.message_count} message
                          {t.message_count === 1 ? '' : 's'}
                          {t.last_message_at ? ` · ${whenLabel(t.last_message_at)}` : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              {/* conversation */}
              <section className="bg-white rounded-xl border border-[#CCD1C7] flex flex-col min-h-[440px]">
                {thread && (
                  <header className="px-4 py-3 border-b border-[#CCD1C7]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-[#102027]">
                        {thread.my_side === 'college'
                          ? thread.contributor?.name
                          : thread.college?.name}
                      </span>
                      <span className="font-mono text-[10px] text-gray-500">
                        {thread.my_side === 'college' ? 'contributor' : 'college'}
                      </span>
                    </div>
                    {thread.challenge && (
                      <Link
                        href={`/challenge/${thread.challenge.ref}`}
                        className="text-xs text-[#2E7180] hover:underline"
                      >
                        {thread.challenge.ref} · {thread.challenge.title}
                      </Link>
                    )}
                  </header>
                )}

                <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[420px]">
                  {loadingThread ? (
                    <p className="font-mono text-xs text-gray-500 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Opening…
                    </p>
                  ) : messages.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-8 leading-relaxed max-w-sm mx-auto">
                      Nothing said yet. Ask whatever would otherwise hold the
                      delivery up — specifications, dispatch dates, who signs
                      for it.
                    </p>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.is_self ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-xl px-3.5 py-2.5 ${
                            m.is_self
                              ? 'bg-[#102027] text-white'
                              : 'bg-[#F4F6F5] border border-[#CCD1C7] text-[#102027]'
                          }`}
                        >
                          <div
                            className={`font-mono text-[9.5px] mb-1 ${
                              m.is_self ? 'text-gray-300' : 'text-gray-500'
                            }`}
                          >
                            {m.author_name}
                            {m.author_org ? ` · ${m.author_org}` : ''} ·{' '}
                            {whenLabel(m.created_at)}
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.body}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form
                  onSubmit={onSend}
                  className="p-3 border-t border-[#CCD1C7] flex items-end gap-2"
                >
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    maxLength={4000}
                    placeholder={
                      organisation
                        ? `Write as ${organisation.name}…`
                        : 'This account has no organisation, so it cannot post.'
                    }
                    disabled={!organisation}
                    className="flex-1 px-3 py-2 rounded-lg border border-[#CCD1C7] bg-[#F4F6F5] text-sm outline-none focus:border-[#2E7180] resize-none disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim() || !organisation}
                    className="h-10 px-4 rounded-lg bg-[#102027] text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-[#1D3540] disabled:opacity-50 shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Send
                  </button>
                </form>
              </section>
            </div>
          )}
        </main>
      </div>
    </RouteGuard>
  );
}
