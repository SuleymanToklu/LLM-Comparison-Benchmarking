'use client'

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-800 rounded ${className}`} />
  )
}

export default function SkeletonLoader({ status }: { status: string }) {
  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center gap-3 text-sm text-indigo-400 bg-indigo-950/40 border border-indigo-900/30 rounded-xl px-4 py-3">
        <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
        {status}
      </div>

      {/* Profile header skeleton */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex gap-5">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-5">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Two column skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <Skeleton className="h-5 w-32 mb-4" />
          <Skeleton className="h-[280px]" />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-[240px]" />
        </div>
      </div>

      {/* Three column skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
            <Skeleton className="h-5 w-24" />
            {[...Array(3)].map((_, j) => (
              <Skeleton key={j} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
