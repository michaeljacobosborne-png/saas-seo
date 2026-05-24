import { Search } from 'lucide-react'

export default function KeywordsPage() {
  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Keyword Research</h1>
        <p className="mt-1 text-sm text-gray-500">
          Discover high-value keywords powered by Google Ads data.
        </p>
      </div>

      <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
        <div className="inline-flex p-3 bg-violet-50 rounded-xl mb-4">
          <Search className="w-6 h-6 text-violet-500" />
        </div>
        <h3 className="text-base font-semibold text-gray-700 mb-2">Coming in Phase 2</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Enter a seed topic and get keyword ideas with search volume, competition, and CPC data from Google Ads Keyword Planner.
        </p>
      </div>
    </div>
  )
}
