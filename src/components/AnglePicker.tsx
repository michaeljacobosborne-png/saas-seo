'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles, Users, AlertCircle, ArrowRight } from 'lucide-react'

export interface Angle {
  id: string
  headline: string
  description: string
  audience: string
}

interface AnglePickerProps {
  topic: string
  onSelect: (angle: Angle) => void
  onSkip: () => void
}

export default function AnglePicker({ topic, onSelect, onSkip }: AnglePickerProps) {
  const [angles, setAngles] = useState<Angle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/keywords/angles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic }),
        })
        const json = await res.json() as { angles?: Angle[]; error?: string }
        if (!active) return
        if (!res.ok || !json.angles) {
          setError(json.error ?? 'Could not generate angles')
          return
        }
        setAngles(json.angles)
      } catch {
        if (active) setError('Could not reach the angle generator')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [topic])

  function handlePick(angle: Angle) {
    setSelectedId(angle.id)
    onSelect(angle)
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-[#D4954A]" />
          <h3 className="text-base font-semibold text-[#F7F3EC]">Pick a research angle</h3>
        </div>
        <p className="text-sm text-[#A89070]">
          Choose a direction for <span className="font-medium text-[#A89070]">&ldquo;{topic}&rdquo;</span>{' '}
          — it shapes the competitor analysis and keyword suggestions.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-[rgba(184,115,51,0.15)] bg-[#231F1B] p-5 animate-pulse"
            >
              <div className="h-4 w-3/4 bg-[#2A2420] rounded mb-3" />
              <div className="h-3 w-full bg-[#2A2420] rounded mb-1.5" />
              <div className="h-3 w-5/6 bg-[#2A2420] rounded mb-4" />
              <div className="h-5 w-24 bg-[#2A2420] rounded-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={onSkip}
            className="text-sm font-medium text-[#B87333] hover:text-[#A0622A] transition-colors"
          >
            Continue without an angle →
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            {angles.map((angle) => {
              const isSelected = selectedId === angle.id
              return (
                <button
                  key={angle.id}
                  onClick={() => handlePick(angle)}
                  className={`group flex flex-col items-start text-left p-5 rounded-2xl border transition-all ${
                    isSelected
                      ? 'border-2 border-[#B87333] bg-[rgba(184,115,51,0.12)] ring-2 ring-[#B87333] ring-offset-2 ring-offset-[#1C1917]'
                      : 'border border-[rgba(184,115,51,0.2)] hover:border-[rgba(184,115,51,0.4)] hover:bg-[#231F1B]'
                  }`}
                >
                  <h4 className="font-semibold text-[#F7F3EC] text-sm mb-1.5">{angle.headline}</h4>
                  <p className="text-xs text-[#A89070] leading-relaxed mb-4">{angle.description}</p>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#2A2420] text-[#A89070]">
                    <Users className="w-3 h-3" />
                    {angle.audience}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="text-center mt-6">
            <button
              onClick={onSkip}
              className="inline-flex items-center gap-1.5 text-sm text-[#7A6555] hover:text-[#A89070] transition-colors"
            >
              Skip — run without a specific angle
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
