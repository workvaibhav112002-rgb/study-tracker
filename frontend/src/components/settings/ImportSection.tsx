import React, { useRef, useState } from 'react'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { api, errorMessage } from '../../api/client'
import { validateImport, type ImportCheck } from '../../lib/importValidate'
import { sessionsFromCsv } from '../../lib/csv'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Toast'

const MAX_BYTES = 5 * 1024 * 1024

export const ImportSection: React.FC<{ onImported: () => Promise<void> | void }> = ({ onImported }) => {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [check, setCheck] = useState<ImportCheck | null>(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [skipped, setSkipped] = useState(0)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setCheck(null)
    if (!file) return
    if (file.size > MAX_BYTES) {
      setCheck({ ok: false, error: 'The file is larger than 5 MB.' })
      return
    }
    setSkipped(0)
    const text = await file.text()
    if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
      const r = sessionsFromCsv(text)
      setSkipped(r.counts?.skipped ?? 0)
      setCheck(r.ok && r.payload && r.counts ? { ok: true, payload: r.payload, counts: { projects: r.counts.projects, sessions: r.counts.sessions } } : { ok: false, error: r.error })
      return
    }
    try {
      setCheck(validateImport(JSON.parse(text)))
    } catch {
      setCheck({ ok: false, error: 'The file is not valid JSON.' })
    }
  }

  const run = async () => {
    if (!check?.ok || !check.payload) return
    setBusy(true)
    try {
      const r = await api.importBackup(check.payload)
      toast.success(`Imported ${r.sessions_inserted} sessions and ${r.projects_created} new projects${r.sessions_skipped ? `, ${r.sessions_skipped} already existed` : ''}.`)
      setCheck(null)
      if (fileRef.current) fileRef.current.value = ''
      await onImported()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const exportNow = async () => {
    setExporting(true)
    try {
      await api.exportBackup()
      toast.success('Backup downloaded.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  const exportCsv = async () => {
    setExportingCsv(true)
    try {
      await api.exportSessionsCsv()
      toast.success('CSV downloaded.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setExportingCsv(false)
    }
  }

  return (
    <section aria-labelledby="data-section" className="space-y-3">
      <div>
        <h3 id="data-section" className="eyebrow">
          Your data
        </h3>
        <p className="mt-1 text-xs text-ink-500">Download everything as JSON or your sessions as CSV. Restore a backup, or import a CSV with project, start_time and duration_minutes columns. Duplicates are skipped.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={exportNow} loading={exporting} icon={<Download className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />}>
          Export backup
        </Button>
        <Button size="sm" variant="secondary" onClick={exportCsv} loading={exportingCsv} icon={<FileSpreadsheet className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />}>
          Sessions CSV
        </Button>
        <label className="focus-ring inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-fg/[0.08] bg-fg/[0.06] px-3 text-xs font-medium text-ink-100 shadow-inner-hi transition hover:bg-fg/[0.10]">
          <Upload className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />
          Choose file
          <input ref={fileRef} type="file" accept="application/json,.json,text/csv,.csv" onChange={onFile} className="sr-only" />
        </label>
      </div>
      {check && (
        <div className={`rounded-2xl border p-3 text-xs ${check.ok ? 'border-brand-500/20 bg-brand-500/[0.06] text-ink-200' : 'border-rose-500/20 bg-rose-500/10 text-rose-300'}`} role="status">
          {check.ok && check.counts ? (
            <div className="flex items-center justify-between gap-3">
              <span>
                Found <strong>{check.counts.projects}</strong> projects and <strong>{check.counts.sessions}</strong> sessions.{skipped > 0 ? ` ${skipped} rows skipped.` : ''}
              </span>
              <Button size="sm" loading={busy} onClick={run}>
                Import
              </Button>
            </div>
          ) : (
            check.error
          )}
        </div>
      )}
    </section>
  )
}
