import { FileText } from 'lucide-react'

export default function ArticlesPage() {
  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Articles</h1>
        <p className="mt-1 text-sm text-gray-500">
          AI-generated SEO articles grounded in your brand profile and keyword research.
        </p>
      </div>

      <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
        <div className="inline-flex p-3 bg-sky-50 rounded-xl mb-4">
          <FileText className="w-6 h-6 text-sky-500" />
        </div>
        <h3 className="text-base font-semibold text-gray-700 mb-2">Coming in Phase 3</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Select keywords from your research projects, generate detailed content briefs, then produce full SEO-optimized article drafts — all in your brand voice.
        </p>
      </div>
    </div>
  )
}
