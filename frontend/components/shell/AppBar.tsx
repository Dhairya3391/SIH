"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GovStrip, Logo } from "@/components/shell/GovStrip";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth";
import { ROLE_NAV } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/format";

/**
 * The signed-in application bar: who you are, what your role can reach, and
 * one way out. The nav is a raised pill group; the page you are on is pressed
 * in rather than recoloured, which is the whole grammar of the interface.
 *
 * On a phone the pill group becomes a sheet, because six nav entries at a 44px
 * target do not fit across 390px and shrinking them below 44px is not an
 * option for a field tool.
 */
export function AppBar() {
  const { user, organisation, role, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const items = role ? ROLE_NAV[role] : [];

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  async function onSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <>
      <GovStrip />
      <div className="bg-ground">
        <div className="shell flex h-[72px] items-center justify-between gap-4 lg:h-[78px]">
          <Logo href={role ? "/" : "/login"} />

          {/* Desktop nav */}
          <nav className="up-s hidden items-center gap-1 rounded-[14px] p-[5px] lg:flex">
            {items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "inline-flex h-[38px] items-center gap-[7px] rounded-xl px-[13px] text-[14px] transition-colors",
                    active
                      ? "press font-bold text-navy"
                      : "font-medium text-body hover:text-navy",
                  ].join(" ")}
                >
                  <Icon name={item.icon} size={15} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="in-s mono hidden h-9 items-center gap-[7px] px-3 text-[12px] font-semibold text-navy xl:inline-flex">
              <span className="text-moderate">
                <Icon name="pin" size={13} />
              </span>
              {user?.district ? `${user.district}, Jharkhand` : "Jharkhand"}
            </span>

            <div className="hidden flex-col items-end gap-px sm:flex">
              <span className="max-w-[180px] truncate text-[13.5px] font-bold text-ink">
                {user?.full_name ?? "Signed in"}
              </span>
              <span className="mono text-[10px] uppercase tracking-[0.08em] text-mute">
                {role ? ROLE_LABEL[role] : ""}
              </span>
              {organisation?.name && (
                <span className="mono max-w-[220px] truncate text-[10px] text-mute">
                  {organisation.name}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="up-s up-hit grid h-10 w-10 place-items-center rounded-xl text-mute hover:text-navy"
            >
              <Icon name="logout" size={16} />
            </button>

            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="up-s up-hit grid h-10 w-10 place-items-center rounded-xl text-navy lg:hidden"
            >
              <Icon name={open ? "x" : "list"} size={18} />
            </button>
          </div>
        </div>

        {/* Mobile sheet */}
        {open && (
          <nav className="shell pb-4 lg:hidden">
            <div className="up flex flex-col gap-1 p-2">
              {items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "flex min-h-[46px] items-center gap-2.5 rounded-xl px-4 text-[15px]",
                      active ? "press font-bold text-navy" : "font-medium text-body",
                    ].join(" ")}
                  >
                    <Icon name={item.icon} size={16} />
                    {item.label}
                  </Link>
                );
              })}
              <div className="hairline mt-1 px-4 pt-3 pb-1 sm:hidden">
                <div className="text-[13.5px] font-bold text-ink">
                  {user?.full_name ?? "Signed in"}
                </div>
                <div className="mono text-[10px] uppercase tracking-[0.08em] text-mute">
                  {role ? ROLE_LABEL[role] : ""}
                  {organisation?.name ? ` · ${organisation.name}` : ""}
                </div>
              </div>
            </div>
          </nav>
        )}
      </div>
    </>
  );
}
