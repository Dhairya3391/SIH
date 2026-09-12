"use client";

import React from "react";
import { useParams } from "next/navigation";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { ProjectWorkspace } from "@/components/domain/ProjectWorkspace";
import { useAuth } from "@/lib/auth";

/**
 * A project, as a company, NGO or member of staff reads it: what is still
 * needed, who gave what, the delivery stages and the college's progress.
 * The college itself edits from /college/projects/[ref].
 */
export default function ProjectPage() {
  const params = useParams<{ ref: string }>();
  const { role } = useAuth();
  const back =
    role === "industry" || role === "ngo"
      ? { href: "/contributions", label: "My contributions" }
      : role === "admin"
        ? { href: "/admin", label: "Command centre" }
        : role === "university"
          ? { href: "/college/projects", label: "Projects" }
          : { href: "/challenges", label: "All challenges" };
  return (
    <RouteGuard>
      <ProjectWorkspace reference={params?.ref ?? ""} backHref={back.href} backLabel={back.label} />
    </RouteGuard>
  );
}
