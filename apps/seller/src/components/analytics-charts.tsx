'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { formatMoney } from '@/lib/format';

type Point = { day: string; revenue: number; units: number; orders: number };

export function RevenueChart({ data, currency }: { data: Point[]; currency: string }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#78716c' }} />
          <YAxis
            tick={{ fontSize: 11, fill: '#78716c' }}
            tickFormatter={(v) => formatMoney(Number(v), currency)}
            width={80}
          />
          <Tooltip
            formatter={(v: number) => formatMoney(v, currency)}
            labelFormatter={(d) => `Day: ${d}`}
            contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #d6d3d1' }}
          />
          <Line type="monotone" dataKey="revenue" stroke="#047857" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function UnitsChart({ data }: { data: Point[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#78716c' }} />
          <YAxis tick={{ fontSize: 11, fill: '#78716c' }} width={48} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #d6d3d1' }} />
          <Line type="monotone" dataKey="units" stroke="#0c0a09" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
