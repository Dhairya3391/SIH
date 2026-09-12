'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Search, 
  Filter, 
  MapPin, 
  Users, 
  ArrowRight, 
  GraduationCap, 
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft
} from 'lucide-react';
import { RouteGuard as RoleGuard } from '@/components/shell/RouteGuard';
import { SEED_CHALLENGES } from '@/data/seedData';

export default function CollegeProblemsCatalogPage() {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');

  const problems = SEED_CHALLENGES.filter(c => {
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (c.title || '').toLowerCase().includes(q) || (c.problem || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <RoleGuard 
      allowedRoles={['university', 'coordinator', 'admin']} 
      title="Problem Statements Catalog"
      description="Curated engineering and societal problem statements derived from verified citizen reports, ready for university student capstones and faculty lab adoption."
    >
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-[#CCD1C7] shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-blue-700">
              <Link href="/college" className="hover:underline flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Campus R&D Node
              </Link>
              <span>/</span>
              <span>Problem Catalog</span>
            </div>
            <h1 className="text-2xl font-bold text-[#102027] mt-1">
              District Problem Statements for University Adoption
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Select an open challenge to assemble a student team or submit a technical proposal.
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#CCD1C7]">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none"
            >
              <option value="all">All Disciplines (Civil, Water, Health, Energy, Agri)</option>
              <option value="water">Water & Sanitation</option>
              <option value="disaster">Disaster & Flash Floods</option>
              <option value="health">Healthcare & Primary Care</option>
              <option value="energy">Clean Energy & Microgrids</option>
              <option value="agriculture">Agriculture & Irrigation</option>
              <option value="roads">Rural Roads & Infrastructure</option>
            </select>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search problem statements..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-600"
            />
          </div>
        </div>

        {/* Problems Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {problems.map((prob) => {
            const isCritical = prob.priority >= 75;
            return (
              <div
                key={prob.id}
                className="bg-white rounded-2xl border border-[#CCD1C7] p-6 hover:border-blue-500 transition shadow-sm flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                        {prob.ref || prob.id}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-800">
                        {prob.category.toUpperCase()}
                      </span>
                    </div>

                    <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                      isCritical ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      PRIORITY {prob.priority}/100
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#102027]">
                    {prob.title}
                  </h3>

                  <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">
                    {prob.problem}
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      {prob.district}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      ~{prob.people_est.toLocaleString()} Impacted
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/college/problems/${prob.ref || prob.id}`}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs transition shadow-sm"
                    >
                      <Lightbulb className="w-4 h-4" />
                      <span>Adopt & Submit Proposal</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </RoleGuard>
  );
}
