'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NavPill from '@/components/NavPill';
import { toDateKey, parseDateKey, addDays } from '@/lib/dateUtils';

export default function DataPage() {
  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setImportError(null);
    setImportSuccess(null);
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    const file = selectedFile;

    // Authenticate user for RLS
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (sessionError || !userId) {
      setImportError('Unable to authenticate user.');
      setLoadingImport(false);
      return;
    }

    setLoadingImport(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      const [headerLine, ...rows] = lines;
      const headers = headerLine.trim().split(',');
      const dateIndex = headers.indexOf('date');
      const timeSecondsIndex = headers.indexOf('time_seconds');

      if (dateIndex === -1 || timeSecondsIndex === -1) {
        setImportError('Invalid CSV header. Must contain "date" and "time_seconds".');
        setLoadingImport(false);
        return;
      }

      const toUpsert = [];
      const errors: string[] = [];
      for (const [idx, line] of rows.entries()) {
        const parts = line.split(',');
        const date = parts[dateIndex];
        const secondsStr = parts[timeSecondsIndex];
        
        if (!date || !secondsStr || isNaN(Number(secondsStr))) {
          // Skip empty rows or invalid formats
          if (date && (!secondsStr || isNaN(Number(secondsStr)))) continue; 
          errors.push(`Line ${idx + 2}: invalid format`);
          continue;
        }
        toUpsert.push({ user_id: userId, date, time_seconds: Number(secondsStr) });
      }

      const { error } = await supabase
        .from('puzzle_times')
        .upsert(toUpsert, { onConflict: 'user_id,date' });
      if (error) {
        setImportError(error.message);
      } else {
        setImportSuccess(
          `Imported ${toUpsert.length - errors.length} rows${errors.length ? `, ${errors.length} skipped` : ''}.`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setImportError(message);
    }

    setLoadingImport(false);
  };

  const handleExport = async () => {
    setLoadingExport(true);
    const { data, error } = await supabase
      .from('puzzle_times')
      .select('date, time_seconds')
      .order('date', { ascending: true });
    
    if (error || !data) {
      setImportError(error?.message || 'Export failed');
      setLoadingExport(false);
      return;
    }

    if (data.length === 0) {
      setImportError('No data found to export');
      setLoadingExport(false);
      return;
    }

    const firstDate = parseDateKey(data[0].date.slice(0, 10));
    const lastDate = parseDateKey(data[data.length - 1].date.slice(0, 10));
    
    const dataMap = new Map(
      data.map(row => [row.date.slice(0, 10), row.time_seconds])
    );

    const header = 'date,Solved Time,time_seconds';
    const csvRows: string[] = [];

    let current = firstDate;
    while (current <= lastDate) {
      const key = toDateKey(current);
      const timeSeconds = dataMap.get(key);
      
      let row = `${key},`;
      if (timeSeconds !== undefined && timeSeconds !== null) {
        const minutes = Math.floor(timeSeconds / 60);
        const seconds = timeSeconds % 60;
        const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        // Prepend a tab character to force Excel to treat this as text
        row += `\t${formattedTime},${timeSeconds}`;
      } else {
        row += ',';
      }
      csvRows.push(row);
      current = addDays(current, 1);
    }

    const csvString = [header, ...csvRows].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `puzzle_times_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setLoadingExport(false);
  };

  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-5 py-16">
      <div className="space-y-3">
        <NavPill currentHref="/data" />
        <h1 className="text-3xl font-extrabold text-white md:text-4xl">Import & Export</h1>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_0%,rgba(255,255,255,0.1),transparent_45%)]" />
        <div className="relative grid gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Export your data</h2>
            <p className="text-sm text-white/70">
              Generates a CSV with all dates from your first to last entry. 
              Includes a formatted `Solved Time` (M:SS) and time in seconds.
            </p>
            <button
              onClick={handleExport}
              disabled={loadingExport}
              className="w-full rounded-xl border border-sky-300/40 bg-gradient-to-r from-sky-500/80 to-indigo-500/80 px-4 py-3 text-sm font-semibold text-white shadow-[0_15px_40px_rgba(56,189,248,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(99,102,241,0.35)] disabled:opacity-60"
            >
              {loadingExport ? 'Exporting…' : 'Download CSV'}
            </button>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0c182e]/80 p-6 shadow-inner backdrop-blur-xl">
            <h2 className="text-xl font-semibold text-white">Import a CSV</h2>
            <p className="text-sm text-white/70">
              Uses RLS with your session. Accepts CSV with `date` and `time_seconds` columns.
            </p>
            <label className="flex flex-col gap-2 text-sm text-white/80">
              <span className="text-xs uppercase tracking-[0.18em] text-white/60">Upload CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={loadingImport}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white file:mr-3 file:rounded-lg file:border-0 file:bg-sky-500/80 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
            </label>
            <button
              onClick={handleImport}
              disabled={!selectedFile || loadingImport}
              className="w-full rounded-xl border border-emerald-300/40 bg-gradient-to-r from-emerald-500/80 to-teal-500/80 px-4 py-3 text-sm font-semibold text-white shadow-[0_15px_40px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(20,184,166,0.35)] disabled:opacity-60"
            >
              {loadingImport ? 'Importing…' : 'Upload CSV'}
            </button>
            {importError && <p className="text-sm text-rose-300">{importError}</p>}
            {importSuccess && <p className="text-sm text-emerald-200">{importSuccess}</p>}
          </div>
        </div>
      </section>
    </main>
  );
}
