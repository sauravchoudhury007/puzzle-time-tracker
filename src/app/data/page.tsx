'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

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
      const [header, ...rows] = lines;
      if (header.trim() !== 'date,time_seconds') {
        setImportError('Invalid CSV header. Expected: date,time_seconds');
        setLoadingImport(false);
        return;
      }

      const toUpsert = [];
      const errors: string[] = [];
      for (const [idx, line] of rows.entries()) {
        const [date, secondsStr] = line.split(',');
        if (!date || !secondsStr || isNaN(Number(secondsStr))) {
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
    const header = 'date,time_seconds';
    const csvRows = data.map(row => `${row.date},${row.time_seconds}`);
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
    <main className="max-w-lg mx-auto mt-16 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow">
      <h1 className="text-2xl font-bold mb-4">Data Import & Export</h1>
      <div className="space-y-4">
        <button
          onClick={handleExport}
          disabled={loadingExport}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
        >
          {loadingExport ? 'Exporting…' : 'Download CSV'}
        </button>
        <div>
          <label className="block mb-2 text-gray-700 dark:text-gray-300">
            Upload CSV
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={loadingImport}
            className="w-full text-gray-900 bg-gray-100 rounded border border-gray-300 py-2 px-3"
          />
        </div>
        <button
          onClick={handleImport}
          disabled={!selectedFile || loadingImport}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded mt-2"
        >
          {loadingImport ? 'Importing…' : 'Upload CSV'}
        </button>
        {importError && <p className="text-red-600">{importError}</p>}
        {importSuccess && <p className="text-green-600">{importSuccess}</p>}
      </div>
    </main>
);}