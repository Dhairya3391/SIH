'use client';

import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  FileText, 
  Download, 
  Search,
  Maximize2,
  CheckCircle2
} from 'lucide-react';

export interface DocumentPage {
  pageNumber: number;
  title: string;
  excerpt: string;
  keyDataPoints: { label: string; value: string }[];
}

interface DocumentViewerProps {
  documentTitle?: string;
  totalPages?: number;
  activePage?: number;
  onPageChange?: (page: number) => void;
  pagesData?: DocumentPage[];
  fileUrl?: string;
}

const DEFAULT_PAGES: DocumentPage[] = [
  {
    pageNumber: 1,
    title: 'Cover & Executive Summary',
    excerpt: 'Project Proposal: Community-Centric Early Warning & Resilient Siren Telemetry for Gumla District. Submitted by BIT Mesra ECE Lab in collaboration with Aapda Mitra Volunteers.',
    keyDataPoints: [
      { label: 'Lead University', value: 'BIT Mesra (ECE Dept)' },
      { label: 'Principal Investigator', value: 'Dr. A. Verma' },
      { label: 'Proposed Duration', value: '28 Deployment Days' },
    ],
  },
  {
    pageNumber: 2,
    title: 'Technical Architecture & Schematic',
    excerpt: 'Solar-powered RF relay node utilizing an ESP32 microcontroller with a SIM800L GSM backup unit. Communicates with Indian Meteorological Dept (IMD) Damini lightning CAP feed with a 15-minute lead time buffer. High-decibel horn speaker (120dB) mounted atop the Panchayat building.',
    keyDataPoints: [
      { label: 'Audible Radius', value: '2.5 km per unit' },
      { label: 'Power Autonomy', value: '72 hours (Lithium-Iron-Phosphate)' },
      { label: 'Trigger Latency', value: '< 4.2 seconds' },
    ],
  },
  {
    pageNumber: 3,
    title: 'Bill of Materials & Local Sourcing',
    excerpt: 'Direct deployment of 12 siren towers. Sourcing structural poles and casing locally from Tata Steel Ranchi stockpile. Assembly performed by 4 student engineering apprentices under faculty supervision.',
    keyDataPoints: [
      { label: 'Steel & Structural Enclosures', value: '800 kg (Locally stocked)' },
      { label: 'Horn Drivers (120dB)', value: '12 units' },
      { label: 'Community Shelters', value: '4 designated halls' },
    ],
  },
  {
    pageNumber: 4,
    title: 'Cost Breakdown & Financial Schedule',
    excerpt: 'Detailed itemized expenditure: Hardware components ₹72,000; Structural fabrication and mounting hardware ₹38,000; Field testing, batteries, and logistics ₹30,000. Total estimate: ₹1,40,000.',
    keyDataPoints: [
      { label: 'Total Budget', value: '₹1,40,000' },
      { label: 'Cost Per Beneficiary', value: '₹29.16' },
      { label: 'Payment Milestones', value: '3 phases (50% upfront, 30% pilot, 20% closure)' },
    ],
  },
  {
    pageNumber: 5,
    title: 'Safety Protocol, Community Engagement & Maintenance',
    excerpt: 'Fail-safe lightning arrestors installed on every tower to prevent secondary induction. Audio alerts programmed in Hindi and Nagpuri dialect. Regular weekly siren test scheduled at 10:00 AM every Sunday in coordination with Aapda Mitra volunteers.',
    keyDataPoints: [
      { label: 'Fail-safe', value: 'Dual optical isolation' },
      { label: 'Languages', value: 'Hindi, Nagpuri' },
      { label: 'Volunteer Protocol', value: 'Aapda Mitra physical verification' },
    ],
  },
];

export function DocumentViewer({
  documentTitle = 'BIT_Mesra_Proposal_Lightning_Gumla.pdf',
  totalPages = 5,
  activePage = 1,
  onPageChange,
  pagesData = DEFAULT_PAGES,
  fileUrl,
}: DocumentViewerProps) {
  const [currentPage, setCurrentPage] = useState(activePage);
  const [zoomLevel, setZoomLevel] = useState(100);

  useEffect(() => {
    if (activePage && activePage !== currentPage) {
      setCurrentPage(activePage);
    }
  }, [activePage]);

  const handlePageSelect = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    onPageChange?.(page);
  };

  const pageInfo = pagesData.find((p) => p.pageNumber === currentPage) || pagesData[0];

  return (
    <div className="flex flex-col h-full bg-[#102027] text-gray-200 rounded-lg border border-gray-700 overflow-hidden shadow-lg">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800 text-xs font-mono">
        <div className="flex items-center gap-2 truncate">
          <FileText className="w-4 h-4 text-[#2E7180] shrink-0" />
          <span className="font-semibold text-white truncate">{documentTitle}</span>
        </div>

        {/* Page Nav Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handlePageSelect(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="px-2 py-0.5 bg-gray-800 rounded text-gray-200">
            Page <strong className="text-white">{currentPage}</strong> of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => handlePageSelect(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Zoom controls */}
          <div className="hidden sm:flex items-center gap-1 ml-2 border-l border-gray-700 pl-2">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(70, z - 15))}
              className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-gray-400">{zoomLevel}%</span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(150, z + 15))}
              className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Document Content Area */}
      <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-gray-950/60 min-h-[420px]">
        <div
          className="w-full max-w-xl bg-white text-[#102027] rounded shadow-md transition-all p-6 font-sans flex flex-col justify-between"
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
        >
          <div>
            {/* Header Stamp */}
            <div className="border-b border-gray-200 pb-3 mb-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#2E7180] font-bold">
                  Government of Jharkhand SIH Evaluation Draft
                </span>
                <h3 className="text-base font-bold text-gray-900 mt-0.5">{pageInfo.title}</h3>
              </div>
              <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                P. {currentPage}
              </span>
            </div>

            {/* Extracted Paragraph with Highlight */}
            <div className="p-3.5 bg-yellow-50/60 border-l-3 border-amber-500 rounded-r text-xs leading-relaxed text-gray-800 mb-5">
              <span className="font-mono text-[10px] text-amber-800 font-bold block mb-1 uppercase tracking-wider">
                Audited Proposal Text (Page {currentPage}):
              </span>
              {pageInfo.excerpt}
            </div>

            {/* Structured Table for this page */}
            <div className="space-y-2 mt-4">
              <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wider font-semibold">
                Extracted Values on this Page
              </span>
              <div className="border border-gray-200 rounded divide-y divide-gray-200 overflow-hidden text-xs">
                {pageInfo.keyDataPoints.map((dp, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50/50">
                    <span className="text-gray-600 font-medium">{dp.label}</span>
                    <span className="font-mono font-bold text-[#102027]">{dp.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer of the document page */}
          <div className="pt-6 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400 font-mono">
            <span>Verified Document Hash: 9e4f...12cb</span>
            <span>Page {currentPage} of {totalPages}</span>
          </div>
        </div>
      </div>

      {/* Bottom Page Thumbnail Selector */}
      <div className="px-3 py-2 bg-gray-900 border-t border-gray-800 flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] text-gray-400 font-mono shrink-0">Jump to:</span>
        {pagesData.map((p) => (
          <button
            key={p.pageNumber}
            type="button"
            onClick={() => handlePageSelect(p.pageNumber)}
            className={`px-2.5 py-1 rounded text-xs font-mono shrink-0 transition ${
              currentPage === p.pageNumber
                ? 'bg-[#2E7180] text-white font-bold'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Page {p.pageNumber}
          </button>
        ))}
      </div>
    </div>
  );
}
