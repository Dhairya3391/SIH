"use client";

import React from "react";
import Link from "next/link";
import { GovStrip, Logo } from "@/components/shell/GovStrip";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Surface";
import { Skeleton } from "@/components/ui/States";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/format";

/**
 * The front door.
 *
 * Two jobs and no more: get a signed-in person to their console, and get a
 * citizen to the report form without asking them to sign in for anything. It
 * is not a marketing page — this is a government service, and the useful thing
 * to put in front of someone is the action they came for.
 */
export default function HomePage() {
  const { loading, isAuthenticated, role, user } = useAuth();

  const CHAIN: { icon: IconName; title: string; body: string }[] = [
    {
      icon: "mic",
      title: "A citizen reports",
      body: "In their own words, by voice, text or SMS. No account, no form to learn, no English required.",
    },
    {
      icon: "spark",
      title: "The report is compiled",
      body: "Translated, deduplicated against what is already open, and scored — with every factor and its reason kept on the record.",
    },
    {
      icon: "shield",
      title: "A person verifies it",
      body: "Weather records, news and the open web are searched for independent proof, and then a verifier decides. The AI never decides.",
    },
    {
      icon: "grad",
      title: "A college proposes",
      body: "The first proposal opens a window sized to the severity. The highest scoring document takes the work, judged on a rubric published in advance.",
    },
    {
      icon: "box",
      title: "Organisations fund the parts",
      body: "Needs are itemised and divisible, so six companies can close one line between them instead of one writing a large cheque.",
    },
    {
      icon: "check",
      title: "The work is tracked to done",
      body: "Stage by stage, with the time between every step on the record, and the funders shown what their material unblocked.",
    },
  ];

  return (
    <>
      <GovStrip />

      <div className="shell flex h-[72px] items-center justify-between gap-4 lg:h-[78px]">
        <Logo href={null} />
        {loading ? (
          <Skeleton height={36} rounded={10} className="w-[120px]" />
        ) : isAuthenticated && role ? (
          <div className="flex items-center gap-3">
            <span className="mono hidden text-[10px] uppercase tracking-[0.08em] text-mute sm:inline">
              {user?.full_name ?? "signed in"} · {ROLE_LABEL[role]}
            </span>
            <ButtonLink href={ROLE_HOME[role]} variant="primary" size="sm" iconAfter="arrow">
              My console
            </ButtonLink>
          </div>
        ) : (
          <ButtonLink href="/login" variant="secondary" size="sm" icon="login">
            Sign in
          </ButtonLink>
        )}
      </div>

      <main id="main" className="shell pb-20">
        <section className="pt-8 lg:pt-12">
          <span className="eyebrow">Department of Disaster Management · SIH26043</span>
          <h1 className="mt-4 max-w-[24ch] text-[34px] font-extrabold leading-[1.05] text-navy-dark sm:text-[46px] lg:text-[56px]">
            From one person&rsquo;s report to work that actually gets done
          </h1>
          <p className="mt-5 max-w-[68ch] text-[16px] leading-relaxed text-body sm:text-[17px]">
            JharSetu is the bridge between a citizen who can see a problem, the officer who has to
            rank it, the college that can solve it and the organisation that can pay for it. Every
            step is on the record, including how long it took.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <ButtonLink href="/report" variant="primary" icon="mic">
              Report a problem
            </ButtonLink>
            {!isAuthenticated && (
              <ButtonLink href="/login" variant="secondary" icon="login">
                Sign in to a console
              </ButtonLink>
            )}
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-mute">
            Reporting needs no account. Your name and number are never published.
          </p>
        </section>

        <section className="mt-12 lg:mt-16">
          <h2 className="text-[22px] font-bold text-navy-dark">How a report becomes work</h2>
          <p className="mt-2 max-w-[70ch] text-[14.5px] leading-relaxed text-body">
            Six links, and no link can do another&rsquo;s job. That is the whole design — an AI
            that ranks but does not decide, a verifier who decides but does not build, a college
            that builds but does not self-award.
          </p>

          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CHAIN.map((step, i) => (
              <li key={step.title} className="up flex flex-col p-5">
                <div className="flex items-center gap-3">
                  <span className="in-s grid h-10 w-10 flex-none place-items-center text-navy">
                    <Icon name={step.icon} size={17} />
                  </span>
                  <span className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
                    step {i + 1}
                  </span>
                </div>
                <h3 className="mt-3.5 text-[16px] font-bold text-navy-dark">{step.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-body">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12 lg:mt-16">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card depth="in" className="p-5">
              <div className="flex items-center gap-2.5">
                <span className="text-navy">
                  <Icon name="spark" size={16} />
                </span>
                <h3 className="text-[15px] font-bold text-navy-dark">
                  Every score can be opened
                </h3>
              </div>
              <p className="mt-2.5 text-[13px] leading-relaxed text-body">
                No number appears anywhere in this system without a route to the factors that
                produced it, with the weight and the sentence behind each one. A score nobody can
                open is a score nobody should act on.
              </p>
            </Card>

            <Card depth="in" className="p-5">
              <div className="flex items-center gap-2.5">
                <span className="text-navy">
                  <Icon name="shield" size={16} />
                </span>
                <h3 className="text-[15px] font-bold text-navy-dark">
                  The AI is evidence, not authority
                </h3>
              </div>
              <p className="mt-2.5 text-[13px] leading-relaxed text-body">
                Models translate, compile, corroborate and score. A person verifies, approves and
                awards. Where a model was unavailable, the screen says a rule wrote it instead.
              </p>
            </Card>

            <Card depth="in" className="p-5">
              <div className="flex items-center gap-2.5">
                <span className="text-navy">
                  <Icon name="clock" size={16} />
                </span>
                <h3 className="text-[15px] font-bold text-navy-dark">
                  Silence is reported as silence
                </h3>
              </div>
              <p className="mt-2.5 text-[13px] leading-relaxed text-body">
                A figure with no data behind it prints as a dash and a reason, never as a zero.
                Blocks in hazard zones that have sent nothing are a finding, not an absence.
              </p>
            </Card>
          </div>
        </section>

        <footer className="hairline mt-14 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
              Government of Jharkhand · Department of Disaster Management
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/report" className="mono text-[10.5px] uppercase tracking-[0.1em]">
                Report a problem
              </Link>
              <Link href="/login" className="mono text-[10.5px] uppercase tracking-[0.1em]">
                Sign in
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
