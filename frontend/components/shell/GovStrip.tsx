import React from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/**
 * The government identity strip. It sits above every screen, including the
 * login page, because a citizen handing over a report needs to see whose
 * service this is before they type anything into it.
 */
export function GovStrip() {
  const [lang, setLang] = React.useState("en");

  React.useEffect(() => {
    setLang(localStorage.getItem("jharsetu_lang") || "en");
  }, []);

  const title = lang === "hi" ? "झारखंड सरकार" : "Government of Jharkhand";
  const subtitle = lang === "hi" ? " · आपदा प्रबंधन विभाग" : " · Department of Disaster Management";

  return (
    <div className="bg-navy-dark">
      <div className="shell flex h-[34px] items-center justify-between gap-3">
        <span className="mono truncate text-[10px] uppercase tracking-[0.08em] text-navy-pale sm:text-[11px]">
          {title}
          <span className="hidden sm:inline">{subtitle}</span>
        </span>
        <span className="mono flex-none text-[10px] uppercase tracking-[0.08em] text-[#8DB9D8] sm:text-[11px]">
          SIH26043
        </span>
      </div>
    </div>
  );
}

/** The wordmark. Devanagari under the latin, in the same family. */
export function Logo({
  size = 40,
  nameSize = 19,
  href = "/",
}: {
  size?: number;
  nameSize?: number;
  href?: string | null;
}) {
  const mark = (
    <span className="flex items-center gap-3">
      <span
        className="up-s grid place-items-center bg-navy text-white"
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.26) }}
      >
        <Icon name="bridge" size={Math.round(size * 0.55)} />
      </span>
      <span className="flex flex-col gap-px">
        <span
          className="font-extrabold leading-none tracking-[-0.02em] text-navy-dark"
          style={{ fontSize: nameSize }}
        >
          JharSetu
        </span>
        <span className="mono text-[11px] leading-none text-mute">झारसेतु</span>
      </span>
    </span>
  );

  if (!href) return mark;
  return (
    <Link href={href} className="flex-none">
      {mark}
    </Link>
  );
}
