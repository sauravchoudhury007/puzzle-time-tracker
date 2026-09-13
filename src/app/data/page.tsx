'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import NavBar from '@/components/pulse/NavBar'
import { Card, PageShell } from '@/components/pulse/Surface'
import { invalidatePuzzleTimes } from '@/hooks/usePuzzleTimes'
import { toDateKey, parseDateKey, addDays } from '@/lib/dateUtils'

const buttonStyle = (disabled: boolean, tone: 'accent' | 'ink' = 'accent') => ({
  width: '100%',
  background: disabled ? 'var(--surface2)' : tone === 'accent' ? 'var(--accent)' : 'var(--ink)',
  color: disabled ? 'var(--muted)' : tone === 'accent' ? '#0c0c0a' : 'var(--bg)',
  border: disabled ? '1px solid var(--rule-soft)' : 0,
  borderRadius: 'var(--card-r)',
  padding: '14px 20px',
  fontFamily: 'var(--mono)',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '.22em',
  textTransform: 'uppercase' as const,
  cursor: disabled ? 'default' : 'pointer',
})

export default function DataPage() {
  const [loadingExport, setLoadingExport] = useState(false)
  const [loadingImport, setLoadingImport] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] || null)
    setImportError(null)
    setImportSuccess(null)
  }

  const handleImport = async () => {
    if (!selectedFile) return
    const file = selectedFile

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (sessionError || !userId) {
      setImportError('Unable to authenticate user.')
      return
    }

    setLoadingImport(true)
    setImportError(null)
    setImportSuccess(null)

    try {
      const text = await file.text()
      const lines = text.trim().split('\n')
      const [headerLine, ...rows] = lines
      const headers = headerLine.trim().split(',')
      const dateIndex = headers.indexOf('date')
      const timeSecondsIndex = headers.indexOf('time_seconds')

      if (dateIndex === -1 || timeSecondsIndex === -1) {
        setImportError('Invalid CSV header. Must contain "date" and "time_seconds".')
        setLoadingImport(false)
        return
      }

      const toUpsert = []
      const errors: string[] = []
      for (const [idx, line] of rows.entries()) {
        const parts = line.split(',')
        const date = parts[dateIndex]
        const secondsStr = parts[timeSecondsIndex]

        if (!date || !secondsStr || isNaN(Number(secondsStr))) {
          // Skip blank rows; only flag rows that look like real but broken data.
          if (date && (!secondsStr || isNaN(Number(secondsStr)))) continue
          errors.push(`Line ${idx + 2}: invalid format`)
          continue
        }
        toUpsert.push({ user_id: userId, date, time_seconds: Number(secondsStr) })
      }

      const { error } = await supabase
        .from('puzzle_times')
        .upsert(toUpsert, { onConflict: 'user_id,date' })
      if (error) {
        setImportError(error.message)
      } else {
        invalidatePuzzleTimes()
        setImportSuccess(
          `Imported ${toUpsert.length - errors.length} rows${errors.length ? `, ${errors.length} skipped` : ''}.`
        )
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    }

    setLoadingImport(false)
  }

  const handleExport = async () => {
    setLoadingExport(true)
    setImportError(null)

    const { data, error } = await supabase
      .from('puzzle_times')
      .select('date, time_seconds')
      .order('date', { ascending: true })

    if (error || !data) {
      setImportError(error?.message || 'Export failed')
      setLoadingExport(false)
      return
    }

    if (data.length === 0) {
      setImportError('No data found to export')
      setLoadingExport(false)
      return
    }

    const firstDate = parseDateKey(data[0].date.slice(0, 10))
    const lastDate = parseDateKey(data[data.length - 1].date.slice(0, 10))
    const dataMap = new Map(data.map(row => [row.date.slice(0, 10), row.time_seconds]))

    const header = 'date,Solved Time,time_seconds'
    const csvRows: string[] = []

    let current = firstDate
    while (current <= lastDate) {
      const key = toDateKey(current)
      const timeSeconds = dataMap.get(key)

      let row = `${key},`
      if (timeSeconds !== undefined && timeSeconds !== null) {
        const minutes = Math.floor(timeSeconds / 60)
        const seconds = timeSeconds % 60
        // Leading tab keeps Excel from reading M:SS as a date.
        row += `\t${minutes}:${seconds.toString().padStart(2, '0')},${timeSeconds}`
      } else {
        row += ','
      }
      csvRows.push(row)
      current = addDays(current, 1)
    }

    const blob = new Blob([[header, ...csvRows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `puzzle_times_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setLoadingExport(false)
  }

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh' }}>
      <NavBar />

      <PageShell maxWidth={1080}>
        <div style={{ marginBottom: 32 }}>
          <div className="eyebrow">Import &amp; export</div>
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 'clamp(44px, 8vw, 84px)',
              lineHeight: 0.95,
              letterSpacing: '-.03em',
              margin: '14px 0 0',
              fontWeight: 400,
            }}
          >
            The whole ledger, portable.
          </h1>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20,
          }}
        >
          <Card>
            <div className="eyebrow">Export</div>
            <div
              style={{
                fontFamily: 'var(--sans)',
                fontWeight: 700,
                fontSize: 22,
                marginTop: 4,
                marginBottom: 12,
                letterSpacing: '-.01em',
              }}
            >
              Download a CSV
            </div>
            <p
              style={{
                fontFamily: 'var(--sans)',
                fontSize: 14,
                color: 'var(--muted)',
                lineHeight: 1.6,
                marginTop: 0,
                marginBottom: 22,
              }}
            >
              Every date from your first entry to your last, with a formatted{' '}
              <code style={{ fontFamily: 'var(--mono)' }}>Solved Time</code> (M:SS) alongside the raw
              seconds. Unlogged days come through blank.
            </p>
            <button
              type="button"
              onClick={handleExport}
              disabled={loadingExport}
              style={buttonStyle(loadingExport)}
            >
              {loadingExport ? 'Exporting…' : 'Download CSV'}
            </button>
          </Card>

          <Card>
            <div className="eyebrow">Import</div>
            <div
              style={{
                fontFamily: 'var(--sans)',
                fontWeight: 700,
                fontSize: 22,
                marginTop: 4,
                marginBottom: 12,
                letterSpacing: '-.01em',
              }}
            >
              Upload a CSV
            </div>
            <p
              style={{
                fontFamily: 'var(--sans)',
                fontSize: 14,
                color: 'var(--muted)',
                lineHeight: 1.6,
                marginTop: 0,
                marginBottom: 18,
              }}
            >
              Needs <code style={{ fontFamily: 'var(--mono)' }}>date</code> and{' '}
              <code style={{ fontFamily: 'var(--mono)' }}>time_seconds</code> columns. Rows are
              upserted against your own account, so re-importing is safe.
            </p>

            <div style={{ marginBottom: 18 }}>
              <span className="eyebrow">CSV file</span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 8,
                  background: 'var(--surface2)',
                  border: '1px solid var(--rule-soft)',
                  borderRadius: 'var(--card-r)',
                  padding: 10,
                }}
              >
                <label
                  style={{
                    background: 'var(--ink)',
                    color: 'var(--bg)',
                    borderRadius: 99,
                    padding: '8px 16px',
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    letterSpacing: '.14em',
                    textTransform: 'uppercase',
                    cursor: loadingImport ? 'default' : 'pointer',
                    flex: '0 0 auto',
                  }}
                >
                  Choose file
                  <input
                    className="sr-only"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    disabled={loadingImport}
                  />
                </label>
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 12,
                    color: selectedFile ? 'var(--ink)' : 'var(--muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedFile ? selectedFile.name : 'No file chosen'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleImport}
              disabled={!selectedFile || loadingImport}
              style={buttonStyle(!selectedFile || loadingImport, 'ink')}
            >
              {loadingImport ? 'Importing…' : 'Upload CSV'}
            </button>

            {importError && (
              <p
                role="status"
                style={{ marginTop: 16, fontSize: 14, color: 'var(--negative)', fontFamily: 'var(--sans)' }}
              >
                {importError}
              </p>
            )}
            {importSuccess && (
              <p
                role="status"
                style={{ marginTop: 16, fontSize: 14, color: 'var(--accent)', fontFamily: 'var(--sans)' }}
              >
                {importSuccess}
              </p>
            )}
          </Card>
        </div>
      </PageShell>
    </main>
  )
}
