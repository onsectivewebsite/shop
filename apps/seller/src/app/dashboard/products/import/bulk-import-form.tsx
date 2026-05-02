'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ImportError = { row: number; column?: string; message: string };
type ImportResult = {
  totalRows: number;
  created: number;
  updated: number;
  errors: ImportError[];
};

const MAX_BYTES = 1024 * 1024;

export function BulkImportForm() {
  const router = useRouter();
  const [csv, setCsv] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <label className="block text-sm font-medium text-stone-900">
        CSV file
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > MAX_BYTES) {
              setError(`File too large. Max ${MAX_BYTES / 1024} KB.`);
              return;
            }
            setError(null);
            setCsv(await file.text());
          }}
          className="mt-1 block w-full text-sm"
        />
      </label>

      <p className="mt-3 text-xs text-stone-500">— or paste below —</p>

      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value.slice(0, MAX_BYTES))}
        rows={10}
        placeholder="slug,title,description,..."
        className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-xs focus:border-stone-900 focus:outline-none"
      />

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={submitting || csv.trim().length === 0}
          onClick={async () => {
            setSubmitting(true);
            setError(null);
            setResult(null);
            try {
              const res = await fetch('/api/seller/products/bulk-import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ csv }),
              });
              if (!res.ok) {
                const j = (await res.json().catch(() => ({}))) as { error?: string };
                setError(j.error ?? `Import failed (${res.status}).`);
                return;
              }
              const data = (await res.json()) as ImportResult;
              setResult(data);
              if (data.created > 0 || data.updated > 0) router.refresh();
            } finally {
              setSubmitting(false);
            }
          }}
          className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {submitting ? 'Importing…' : 'Import'}
        </button>
        {csv.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setCsv('');
              setResult(null);
              setError(null);
            }}
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            Clear
          </button>
        )}
      </div>

      {result && (
        <div className="mt-6 space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-900">
            {result.created + result.updated} of {result.totalRows} row
            {result.totalRows === 1 ? '' : 's'} imported
          </p>
          <ul className="text-sm text-stone-700">
            <li>
              Created:{' '}
              <span className="font-medium text-emerald-700">{result.created}</span>
            </li>
            <li>
              Updated:{' '}
              <span className="font-medium text-emerald-700">{result.updated}</span>
            </li>
            <li>
              Errors:{' '}
              <span
                className={
                  result.errors.length > 0
                    ? 'font-medium text-red-700'
                    : 'font-medium text-stone-700'
                }
              >
                {result.errors.length}
              </span>
            </li>
          </ul>
          {result.errors.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded border border-red-200 bg-white">
              <table className="min-w-full text-xs">
                <thead className="bg-red-50 text-red-900">
                  <tr>
                    <th className="px-3 py-2 text-left">Row</th>
                    <th className="px-3 py-2 text-left">Column</th>
                    <th className="px-3 py-2 text-left">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((e, i) => (
                    <tr key={i} className="border-t border-red-100">
                      <td className="px-3 py-2 font-mono">{e.row}</td>
                      <td className="px-3 py-2 font-mono">{e.column ?? ''}</td>
                      <td className="px-3 py-2 text-stone-800">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result.created > 0 && (
            <p className="text-xs text-stone-500">
              New products are in <span className="font-medium">Draft</span>.{' '}
              <a
                href="/dashboard/products?status=draft"
                className="text-emerald-700 hover:underline"
              >
                Review and publish →
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
