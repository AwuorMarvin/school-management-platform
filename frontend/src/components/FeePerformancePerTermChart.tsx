import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { termsApi, Term } from '../api/terms'
import { feeSummaryApi } from '../api/feeSummary'

interface TermChartPoint {
  termId: string
  label: string
  expected: number
  paid: number
  rate: number
}

const FeePerformancePerTermChart: React.FC = () => {
  const [data, setData] = useState<TermChartPoint[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      // Fetch all terms for the current school (first page, large page_size)
      const termResponse = await termsApi.list({
        page: 1,
        page_size: 50,
      })

      const terms: Term[] = termResponse.data

      // Group terms by academic year and pick the one that has an is_current term if possible
      const currentTerm = terms.find((t) => t.is_current)
      let activeYearId: string | undefined
      if (currentTerm) {
        activeYearId = currentTerm.academic_year_id
      } else if (terms.length > 0) {
        activeYearId = terms[0].academic_year_id
      }

      const activeYearTerms = terms
        .filter((t) => t.academic_year_id === activeYearId)
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

      const points: TermChartPoint[] = []

      for (const term of activeYearTerms) {
        const label = term.is_current ? `${term.name} (Current Term)` : term.name

        try {
          const campusSummary = await feeSummaryApi.getCampusSummary({
            term_id: term.id,
          })

          const summary = campusSummary.summary

          points.push({
            termId: term.id,
            label,
            expected: summary.total_expected,
            paid: summary.total_paid,
            rate: summary.payment_rate,
          })
        } catch (err) {
          // Skip terms that fail to load
          // eslint-disable-next-line no-console
          console.error('Failed to load fee summary for term', term.id, err)
        }
      }

      setData(points)
    } finally {
      setLoading(false)
    }
  }

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        <span className="ml-3 text-sm text-gray-600">Loading fee performance per term...</span>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-sm text-gray-600">No term fee data available for the active academic year.</span>
      </div>
    )
  }

  return (
    <div className="w-full" style={{ height: 480, paddingBottom: 3 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 20, right: 40, left: 0, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="label"
            angle={-20}
            textAnchor="end"
            height={50}
            tick={{ fontSize: 12, fill: '#4B5563' }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12, fill: '#4B5563' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(value) => `${value}%`}
            tick={{ fontSize: 12, fill: '#4B5563' }}
          />
          <Tooltip
            formatter={(value, name) => {
              if (name === 'Rate') {
                return [`${(value as number).toFixed(1)}%`, 'Rate']
              }
              return [value, name]
            }}
          />
          <Legend
            verticalAlign="top"
            align="left"
          />
          {/* Expected (green) */}
          <Bar
            yAxisId="left"
            dataKey="expected"
            name="Expected"
            barSize={50}
            fill="#22c55e"
          />
          {/* Paid (red) */}
          <Bar
            yAxisId="left"
            dataKey="paid"
            name="Paid"
            barSize={50}
            fill="#ef4444"
          />
          {/* Rate (purple line) */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="rate"
            name="Rate"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default FeePerformancePerTermChart


