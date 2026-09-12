'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { fetchMyProposals } from '@/lib/api';

/**
 * A proposal's verdict lives on the problem page, beside the brief it was
 * scored against - reading a rubric without the problem in front of you is
 * how a college misreads "problem fit".
 *
 * So this route resolves the proposal to its challenge and redirects there,
 * rather than becoming a second place the same rubric is rendered and has to
 * be kept in step.
 */
export default function ProposalRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [failed, setFailed] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { id } = await params;
      try {
        const res = await fetchMyProposals();
        const found = (res.proposals as { id: string; challenge?: { ref?: string } }[]).find(
          (p) => p.id === id,
        );
        if (cancelled) return;
        if (found?.challenge?.ref) {
          router.replace(`/college/problems/${found.challenge.ref}`);
        } else {
          setFailed('That proposal is not on your college account.');
        }
      } catch (err) {
        if (!cancelled) setFailed(err instanceof Error ? err.message : 'Could not load it.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <div className="min-h-screen bg-[#F4F6F5] flex items-center justify-center p-6">
      <div className="text-center">
        {failed ? (
          <>
            <p className="text-sm font-semibold text-[#102027]">{failed}</p>
            <Link
              href="/college/projects"
              className="inline-flex mt-3 h-9 px-4 rounded-lg bg-[#102027] text-white text-xs font-semibold items-center hover:bg-[#1D3540]"
            >
              Your proposals
            </Link>
          </>
        ) : (
          <p className="font-mono text-xs text-gray-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Opening the brief this was scored
            against…
          </p>
        )}
      </div>
    </div>
  );
}
