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
import { classesApi } from '../api/classes'
import { feeSummaryApi } from '../api/feeSummary'

interface ClassChartPoint {
  className: string
  expected: number
  paid: number
  rate: number
}

interface FeePerformancePerClassChartProps {
  termId?: string
}

const FeePerformancePerClassChart: React.FC<FeePerformancePerClassChartProps> = ({ termId }) => {
  const [data, setData] = useState<ClassChartPoint[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void loadData()
  }, [termId])

  const loadData = async () => {
    try {
      setLoading(true)

      // Fetch all classes (first page with large page_size)
      const classesResponse = await classesApi.list({
        page: 1,
        page_size: 100,
      })

      const points: ClassChartPoint[] = []

      for (const cls of classesResponse.data) {
        try {
          const summary = await feeSummaryApi.getClassSummary(cls.id, { term_id: termId })
          points.push({
            className: summary.class_name,
            expected: summary.total_expected_fee,
            paid: summary.total_paid_amount,
            rate: summary.payment_rate,
          })
        } catch (err) {
          // Skip classes that fail to load fee summary
          // eslint-disable-next-line no-console
          console.error('Failed to load fee summary for class', cls.id, err)
        }
      }

      // Sort by class name for stable order
      points.sort((a, b) => a.className.localeCompare(b.className))
      setData(points)
    } finally {
      setLoading(false)
    }
  }

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        <span className="ml-3 text-sm text-gray-600">Loading fee performance per class...</span>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-sm text-gray-600">No class fee data available for the current term.</span>
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
            dataKey="className"
            angle={-35}
            textAnchor="end"
            height={60}
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

export default FeePerformancePerClassChart


