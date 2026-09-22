"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Card, Panel } from "@/components/ui/Surface";
import { Chip, BandChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { num } from "@/lib/format";

export interface MapChallenge {
  id: string;
  ref?: string;
  title: string;
  district?: string | null;
  priority: number;
  band?: "critical" | "high" | "moderate" | "long_term";
  lat?: number | null;
  lng?: number | null;
  category?: string;
  people_est?: number;
  is_simulated?: boolean;
}

export interface MapSilentZone {
  district: string;
  block?: string;
  hazard?: string;
  population?: number;
  intensity?: number;
}

interface DistrictGeo {
  name: string;
  lat: number;
  lng: number;
  hazard?: "lightning" | "flood" | "mining" | "drought";
  population: number;
}

const JHARKHAND_GEO: DistrictGeo[] = [
  { name: "Ranchi", lat: 23.3441, lng: 85.3096, hazard: "lightning", population: 2914253 },
  { name: "Gumla", lat: 23.0444, lng: 84.5385, hazard: "lightning", population: 1025213 },
  { name: "Sahebganj", lat: 25.2481, lng: 87.6412, hazard: "flood", population: 1150567 },
  { name: "Dhanbad", lat: 23.7957, lng: 86.4304, hazard: "mining", population: 2684487 },
  { name: "Bokaro", lat: 23.6693, lng: 86.1511, hazard: "mining", population: 2062330 },
  { name: "Palamu", lat: 24.0333, lng: 84.0667, hazard: "drought", population: 1939869 },
  { name: "Garhwa", lat: 24.16, lng: 83.81, hazard: "drought", population: 1322784 },
  { name: "East Singhbhum", lat: 22.8046, lng: 86.2029, population: 2293919 },
  { name: "West Singhbhum", lat: 22.55, lng: 85.8, population: 1502338 },
  { name: "Hazaribagh", lat: 23.9925, lng: 85.3637, population: 1734495 },
  { name: "Deoghar", lat: 24.4823, lng: 86.6947, population: 1492073 },
  { name: "Dumka", lat: 24.2676, lng: 87.2497, population: 1321442 },
  { name: "Giridih", lat: 24.1913, lng: 86.3094, population: 2445474 },
  { name: "Godda", lat: 24.827, lng: 87.213, hazard: "flood", population: 1313551 },
  { name: "Pakur", lat: 24.6373, lng: 87.8464, hazard: "flood", population: 900422 },
  { name: "Chatra", lat: 24.2064, lng: 84.8709, hazard: "drought", population: 1042886 },
  { name: "Khunti", lat: 23.0712, lng: 85.2783, hazard: "lightning", population: 531885 },
  { name: "Simdega", lat: 22.6152, lng: 84.5144, hazard: "lightning", population: 599578 },
  { name: "Lohardaga", lat: 23.4333, lng: 84.6833, population: 461790 },
  { name: "Latehar", lat: 23.7449, lng: 84.4998, population: 726978 },
  { name: "Ramgarh", lat: 23.6307, lng: 85.5617, hazard: "mining", population: 949443 },
  { name: "Koderma", lat: 24.4677, lng: 85.594, population: 716259 },
  { name: "Jamtara", lat: 23.96, lng: 86.8, population: 791042 },
  { name: "Seraikela Kharsawan", lat: 22.7, lng: 85.9333, population: 1065056 },
];

const RAJKOT_GEO: DistrictGeo[] = [
  { name: "Rajkot City", lat: 22.3039, lng: 70.8022, population: 1390640 },
  { name: "Gondal", lat: 21.9611, lng: 70.8017, population: 173000 },
  { name: "Jetpur", lat: 21.7544, lng: 70.6231, population: 118302 },
  { name: "Morbi", lat: 22.8173, lng: 70.8377, population: 213943 },
];

export function DisasterMap({
  challenges = [],
  silentZones = [],
  selectedDistrict = "",
  onSelectDistrict,
  currentRegion = "jharkhand",
  className = "",
}: {
  challenges?: MapChallenge[];
  silentZones?: MapSilentZone[];
  selectedDistrict?: string;
  onSelectDistrict?: (district: string) => void;
  currentRegion?: "jharkhand" | "rajkot";
  className?: string;
}) {
  const [activeLayer, setActiveLayer] = useState<"all" | "lightning" | "flood" | "mining" | "silent">("all");
  const [hoveredDistrict, setHoveredDistrict] = useState<DistrictGeo | null>(null);
  const [activeChallenge, setActiveChallenge] = useState<MapChallenge | null>(null);

  const isJharkhand = currentRegion === "jharkhand";
  const geoList = isJharkhand ? JHARKHAND_GEO : RAJKOT_GEO;

  // Bounding boxes
  const bounds = useMemo(() => {
    if (isJharkhand) {
      return { minLat: 22.0, maxLat: 25.5, minLng: 83.4, maxLng: 88.0 };
    }
    return { minLat: 21.5, maxLat: 23.1, minLng: 70.2, maxLng: 71.3 };
  }, [isJharkhand]);

  // Project lat/lng to SVG viewBox (0,0 to 800, 520)
  const project = (lat: number, lng: number) => {
    const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 740 + 30;
    const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * 460 + 30;
    return { x, y };
  };

  // Group challenges by district
  const districtStats = useMemo(() => {
    const map = new Map<string, { count: number; maxPriority: number; criticalCount: number }>();
    for (const c of challenges) {
      const d = c.district ?? "Unknown";
      const curr = map.get(d) ?? { count: 0, maxPriority: 0, criticalCount: 0 };
      curr.count++;
      if (c.priority > curr.maxPriority) curr.maxPriority = c.priority;
      if (c.priority >= 75) curr.criticalCount++;
      map.set(d, curr);
    }
    return map;
  }, [challenges]);

  // Check if a district is in silent zones
  const isSilentDistrict = (name: string) => {
    return silentZones.some((z) => z.district?.toLowerCase() === name.toLowerCase());
  };

  return (
    <div className={`up overflow-hidden rounded-2xl bg-ground ${className}`}>
      {/* Top Map Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="in-s grid h-8 w-8 place-items-center text-navy">
            <Icon name="pin" size={15} />
          </span>
          <div>
            <h3 className="text-[14px] font-bold text-navy-dark">
              {isJharkhand ? "Jharkhand State Operational GIS" : "Rajkot District Operational GIS"}
            </h3>
            <p className="mono text-[10px] uppercase tracking-[0.08em] text-mute">
              {geoList.length} mapped territories · Live hazard & silence telemetry
            </p>
          </div>
        </div>

        {/* Hazard Layer Toggles */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mute mr-1">
            Layer:
          </span>
          {(
            [
              { key: "all", label: "All Layers", icon: "gauge" },
              { key: "lightning", label: "Lightning Risk", icon: "bolt" },
              { key: "flood", label: "Flood Plains", icon: "drop" },
              { key: "mining", label: "Mine Subsidence", icon: "alert" },
              { key: "silent", label: "Silent Zones", icon: "signal" },
            ] as const
          ).map((layer) => (
            <button
              key={layer.key}
              type="button"
              onClick={() => setActiveLayer(layer.key)}
              className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition-all ${
                activeLayer === layer.key
                  ? "bg-navy text-white shadow-sm"
                  : "bg-ground text-body hover:text-navy"
              }`}
            >
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map Canvas & Legend Area */}
      <div className="relative h-[480px] w-full bg-[#EBF0EE] overflow-hidden">
        {/* Background Grid Lines */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none opacity-20">
          <defs>
            <pattern id="gis-grid" width="40" height="40" patternUnits="userSpace">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#2E7180" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gis-grid)" />
        </svg>

        {/* Main SVG Vector Canvas */}
        <svg
          viewBox="0 0 800 520"
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Natural Hazard Region Halos */}
          {activeLayer === "all" || activeLayer === "lightning" ? (
            <g className="transition-opacity duration-300">
              {/* Lightning High-Vulnerability Corridor (Gumla - Ranchi - Khunti - Simdega) */}
              <ellipse
                cx={project(23.0444, 84.85).x}
                cy={project(23.0444, 84.85).y}
                rx="110"
                ry="70"
                fill="#E07B2E"
                fillOpacity="0.12"
                stroke="#E07B2E"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <text
                x={project(23.0444, 84.85).x - 90}
                y={project(23.0444, 84.85).y - 45}
                className="mono text-[9px] font-bold fill-[#9A4A12] uppercase tracking-[0.1em]"
              >
                Lightning Strike Hazard Corridor (&gt;2,400 fatalities)
              </text>
            </g>
          ) : null}

          {activeLayer === "all" || activeLayer === "flood" ? (
            <g className="transition-opacity duration-300">
              {/* Ganga River Flood Plain Corridor (Sahebganj - Pakur - Godda) */}
              <ellipse
                cx={project(25.0, 87.5).x}
                cy={project(25.0, 87.5).y}
                rx="70"
                ry="60"
                fill="#3867A6"
                fillOpacity="0.14"
                stroke="#3867A6"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <text
                x={project(25.0, 87.5).x - 65}
                y={project(25.0, 87.5).y - 40}
                className="mono text-[9px] font-bold fill-[#274E82] uppercase tracking-[0.1em]"
              >
                Ganga River Flood Inundation Zone
              </text>
            </g>
          ) : null}

          {activeLayer === "all" || activeLayer === "mining" ? (
            <g className="transition-opacity duration-300">
              {/* Jharia & Dhanbad Coalfire/Subsidence Corridor */}
              <ellipse
                cx={project(23.75, 86.3).x}
                cy={project(23.75, 86.3).y}
                rx="65"
                ry="45"
                fill="#D94F45"
                fillOpacity="0.12"
                stroke="#D94F45"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <text
                x={project(23.75, 86.3).x - 60}
                y={project(23.75, 86.3).y - 30}
                className="mono text-[9px] font-bold fill-[#A8332A] uppercase tracking-[0.1em]"
              >
                Jharia Mine Subsidence Belt
              </text>
            </g>
          ) : null}

          {/* District Polygons / Territory Nodes */}
          {geoList.map((d) => {
            const { x, y } = project(d.lat, d.lng);
            const stats = districtStats.get(d.name) ?? { count: 0, maxPriority: 0, criticalCount: 0 };
            const isSilent = isSilentDistrict(d.name);
            const isSelected = selectedDistrict?.toLowerCase() === d.name.toLowerCase();
            const isHovered = hoveredDistrict?.name === d.name;

            // Fill color based on highest priority in district
            let fill = "#CBD5E1"; // neutral slate
            let stroke = "#94A3B8";
            if (stats.maxPriority >= 75) {
              fill = "#FCA5A5"; // red
              stroke = "#DC2626";
            } else if (stats.maxPriority >= 50) {
              fill = "#FED7AA"; // orange
              stroke = "#EA580C";
            } else if (stats.count > 0) {
              fill = "#A7F3D0"; // green/teal
              stroke = "#059669";
            }

            return (
              <g
                key={d.name}
                className="cursor-pointer transition-transform duration-150"
                onClick={() => onSelectDistrict?.(d.name)}
                onMouseEnter={() => setHoveredDistrict(d)}
                onMouseLeave={() => setHoveredDistrict(null)}
              >
                {/* District Radius Node */}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 26 : isHovered ? 24 : 18}
                  fill={fill}
                  stroke={isSelected ? "#102027" : stroke}
                  strokeWidth={isSelected ? 3 : 1.5}
                  className="transition-all duration-200"
                />

                {/* Silent Zone Pulsing Indicator */}
                {isSilent && (activeLayer === "all" || activeLayer === "silent") && (
                  <g>
                    <circle
                      cx={x}
                      cy={y}
                      r="32"
                      fill="none"
                      stroke="#DC2626"
                      strokeWidth="2"
                      className="animate-ping opacity-60"
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r="22"
                      fill="none"
                      stroke="#DC2626"
                      strokeWidth="1.5"
                    />
                  </g>
                )}

                {/* District Label */}
                <text
                  x={x}
                  y={y - 22}
                  textAnchor="middle"
                  className={`text-[11px] font-bold ${
                    isSelected ? "fill-navy-dark font-extrabold" : "fill-navy"
                  }`}
                >
                  {d.name}
                </text>

                {/* Report / Challenge Badge count */}
                <text
                  x={x}
                  y={y + 4}
                  textAnchor="middle"
                  className="mono text-[10px] font-bold fill-navy-dark pointer-events-none"
                >
                  {stats.count > 0 ? stats.count : isSilent ? "!" : "0"}
                </text>
              </g>
            );
          })}

          {/* Plotted Active Challenges */}
          {challenges
            .filter((c) => c.lat && c.lng)
            .slice(0, 40)
            .map((c) => {
              const { x, y } = project(c.lat!, c.lng!);
              const isCrit = c.priority >= 75;
              return (
                <g
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => setActiveChallenge(c)}
                >
                  <circle
                    cx={x + 7}
                    cy={y + 7}
                    r={isCrit ? 6 : 5}
                    fill={isCrit ? "#DC2626" : "#EA580C"}
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                </g>
              );
            })}
        </svg>

        {/* Hover / Selected Territory HUD Card */}
        {hoveredDistrict && (
          <div className="absolute top-4 left-4 z-10 w-72 rounded-xl border border-line bg-surface/95 p-4 shadow-lg backdrop-blur-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-[15px] font-bold text-navy-dark">{hoveredDistrict.name}</h4>
                <p className="mono text-[10px] uppercase tracking-[0.08em] text-mute">
                  Pop: {num(hoveredDistrict.population)} · {hoveredDistrict.hazard ? `${hoveredDistrict.hazard} risk zone` : "Standard monitoring"}
                </p>
              </div>
              {isSilentDistrict(hoveredDistrict.name) && (
                <Chip tone="alert">Silent Zone</Chip>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line/60 pt-2.5">
              <div>
                <span className="mono text-[9.5px] uppercase tracking-[0.08em] text-mute">Open Reports</span>
                <p className="text-[14px] font-bold text-ink">
                  {districtStats.get(hoveredDistrict.name)?.count ?? 0}
                </p>
              </div>
              <div>
                <span className="mono text-[9.5px] uppercase tracking-[0.08em] text-mute">Max Priority</span>
                <p className="text-[14px] font-bold text-navy">
                  {districtStats.get(hoveredDistrict.name)?.maxPriority ?? 0}/100
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Challenge Detail Popover */}
        {activeChallenge && (
          <div className="absolute bottom-4 right-4 z-10 w-80 rounded-xl border border-line bg-surface p-4 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <span className="mono text-[11px] font-bold text-navy">
                {activeChallenge.ref ?? activeChallenge.id.slice(0, 8)}
              </span>
              <BandChip band={activeChallenge.band ?? (activeChallenge.priority >= 75 ? "critical" : "high")} />
            </div>
            <h5 className="mt-1.5 text-[13.5px] font-bold text-navy-dark line-clamp-2">
              {activeChallenge.title}
            </h5>
            <p className="mono mt-1 text-[10px] text-mute">
              District: {activeChallenge.district ?? "Unspecified"} · Affected: ~{num(activeChallenge.people_est ?? 0)}
            </p>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-2">
              <span className="mono text-[12px] font-semibold text-ink">
                Priority: {activeChallenge.priority}/100
              </span>
              <Link
                href={`/challenge/${activeChallenge.ref ?? activeChallenge.id}`}
                className="mono text-[11px] font-bold text-navy hover:underline"
              >
                Inspect Brief →
              </Link>
            </div>
          </div>
        )}

        {/* Live Map Legend */}
        <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-line/80 bg-surface/90 px-3.5 py-2 shadow-sm backdrop-blur-xs">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
            <span className="h-3 w-3 rounded-full bg-[#DC2626]" /> Critical (≥75)
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
            <span className="h-3 w-3 rounded-full bg-[#EA580C]" /> High (50–74)
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
            <span className="h-3 w-3 rounded-full bg-[#059669]" /> Active / Normal
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
            <span className="h-3 w-3 rounded-full border border-red-600 bg-red-100" /> Silent Zone
          </span>
        </div>
      </div>
    </div>
  );
}
