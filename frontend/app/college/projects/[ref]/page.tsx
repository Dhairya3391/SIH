"use client";

import React from "react";
import { useParams } from "next/navigation";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { ProjectWorkspace } from "@/components/domain/ProjectWorkspace";

/** The college's workspace for one project it won. */
export default function CollegeProjectPage() {
  const params = useParams<{ ref: string }>();
  return (
    <RouteGuard>
      <ProjectWorkspace reference={params?.ref ?? ""} backHref="/college/projects" backLabel="Projects" />
    </RouteGuard>
  );
}
