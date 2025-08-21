import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'

interface GeographicMapProps {
  data: Array<{ country: string; count: number }>
}

export function GeographicMap({ data }: GeographicMapProps) {
  // Sort and take top 10 countries
  const sortedData = [...data]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((item) => ({
      ...item,
      country: getCountryName(item.country),
    }))

  const colors = [
    'hsl(var(--primary))',
    'hsl(210, 70%, 50%)',
    'hsl(180, 70%, 45%)',
    'hsl(150, 70%, 40%)',
    'hsl(120, 70%, 35%)',
    'hsl(90, 70%, 40%)',
    'hsl(60, 70%, 45%)',
    'hsl(30, 70%, 50%)',
    'hsl(0, 70%, 50%)',
    'hsl(330, 70%, 50%)',
  ]

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={sortedData} layout="horizontal">
        <XAxis
          type="number"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="country"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={100}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <div className="flex flex-col">
                    <span className="font-bold">
                      {payload[0].payload.country}
                    </span>
                    <span className="text-muted-foreground">
                      {payload[0].value} visits
                    </span>
                  </div>
                </div>
              )
            }
            return null
          }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {sortedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function getCountryName(code: string): string {
  const countries: Record<string, string> = {
    US: 'United States',
    GB: 'United Kingdom',
    CA: 'Canada',
    AU: 'Australia',
    DE: 'Germany',
    FR: 'France',
    ES: 'Spain',
    IT: 'Italy',
    NL: 'Netherlands',
    BR: 'Brazil',
    IN: 'India',
    CN: 'China',
    JP: 'Japan',
    KR: 'South Korea',
    RU: 'Russia',
    MX: 'Mexico',
    TR: 'Turkey',
    ID: 'Indonesia',
    PH: 'Philippines',
    VN: 'Vietnam',
  }
  
  return countries[code] || code
}