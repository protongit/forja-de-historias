export default function GenerationSkeleton() {
  return (
    <div className="flex justify-center my-3">
      <div className="px-5 py-4 rounded-lg bg-indigo-900/60 border border-indigo-700/50 text-indigo-200 text-sm max-w-[85%] w-full">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span>Creando tu personaje y aventura...</span>
        </div>

        <div className="space-y-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-700/50" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-indigo-700/40 rounded w-1/3" />
              <div className="h-2 bg-indigo-700/30 rounded w-2/3" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="h-2 bg-indigo-700/30 rounded w-full" />
            <div className="h-2 bg-indigo-700/30 rounded w-5/6" />
            <div className="h-2 bg-indigo-700/30 rounded w-4/6" />
          </div>

          <div className="space-y-2 pt-1">
            <div className="h-3 bg-indigo-700/40 rounded w-1/4" />
            {[80, 60, 45, 70, 55, 65].map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-2 bg-indigo-700/30 rounded w-12" />
                <div className="flex-1 h-2 bg-indigo-700/30 rounded" style={{ maxWidth: `${w}%` }} />
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-1">
            <div className="h-3 bg-indigo-700/40 rounded w-1/5" />
            <div className="h-8 bg-indigo-700/30 rounded w-full" />
            <div className="h-8 bg-indigo-700/30 rounded w-5/6" />
            <div className="h-8 bg-indigo-700/30 rounded w-4/6" />
          </div>
        </div>
      </div>
    </div>
  )
}