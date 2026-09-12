import React from 'react';

export function SkeletonLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200/80 rounded ${className}`} />
  );
}

export function ChallengeDetailSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-pulse">
      {/* Top breadcrumb & back */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-32 bg-gray-200 rounded" />
        <div className="h-8 w-48 bg-gray-200 rounded" />
      </div>

      {/* Header Banner */}
      <div className="bg-white rounded-xl p-6 border border-[#CCD1C7] space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-6 w-24 bg-red-100 rounded-full" />
          <div className="h-6 w-32 bg-teal-100 rounded-full" />
          <div className="h-6 w-20 bg-gray-200 rounded-full" />
        </div>
        <div className="h-10 w-3/4 bg-gray-200 rounded" />
        <div className="h-5 w-1/2 bg-gray-100 rounded" />
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl p-6 border border-[#CCD1C7] space-y-4">
            <div className="h-6 w-40 bg-gray-200 rounded" />
            <div className="h-4 w-full bg-gray-100 rounded" />
            <div className="h-4 w-5/6 bg-gray-100 rounded" />
            <div className="h-4 w-4/6 bg-gray-100 rounded" />
          </div>

          <div className="bg-white rounded-xl p-6 border border-[#CCD1C7] space-y-4">
            <div className="h-6 w-48 bg-gray-200 rounded" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="h-20 bg-gray-100 rounded-lg" />
              <div className="h-20 bg-gray-100 rounded-lg" />
              <div className="h-20 bg-gray-100 rounded-lg" />
              <div className="h-20 bg-gray-100 rounded-lg" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-[#CCD1C7] space-y-4">
            <div className="h-6 w-36 bg-gray-200 rounded" />
            <div className="h-32 bg-gray-100 rounded-lg" />
            <div className="h-10 w-full bg-teal-100 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-5 border border-[#CCD1C7] space-y-3 animate-pulse">
      <div className="flex justify-between">
        <div className="h-5 w-24 bg-gray-200 rounded" />
        <div className="h-5 w-16 bg-gray-200 rounded" />
      </div>
      <div className="h-6 w-4/5 bg-gray-200 rounded" />
      <div className="h-4 w-full bg-gray-100 rounded" />
      <div className="h-4 w-3/4 bg-gray-100 rounded" />
      <div className="pt-2 flex justify-between items-center">
        <div className="h-4 w-28 bg-gray-100 rounded" />
        <div className="h-8 w-20 bg-gray-200 rounded" />
      </div>
    </div>
  );
}
