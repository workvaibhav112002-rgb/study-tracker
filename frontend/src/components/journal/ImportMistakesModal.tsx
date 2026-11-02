import React, { useRef, useState } from 'react'
import { FileSpreadsheet, Download } from 'lucide-react'
import type { MistakeImportResult, Project } from '../../types'
import { api, errorMessage } from '../../api/client'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

interface Props {
  isOpen: boolean
  project: Project
  onClose: () => void
  onImported: (n: number) => void
}

/** Upload an Excel error log: preview (dry run) first, then import the valid rows. */
export const ImportMistakesModal: React.FC<Props> = ({ isOpen, project, onClose, onImported }) => {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<MistakeImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setFile(null)
    setPreview(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }
  const close = () => {
    reset()
    onClose()
  }

  const check = async (f: File) => {
    setFile(f)
    setPreview(null)
    setError(null)
    setBusy(true)
    try {
      setPreview(await api.importMistakes(f, { dryRun: true, projectId: project.id }))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const commit = async () => {
    if (!file) return
    setBusy(true)
    try {
      const res = await api.importMistakes(file, { dryRun: false, projectId: project.id })
      onImported(res.imported)
      close()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={close} size="lg" title="Import an Excel error log" description={`Rows without a Project column go to ${project.name}.`} icon={<FileSpreadsheet className="h-5 w-5" aria-hidden="true" />}>
      <div className="space-y-4 text-sm">
        <p className="text-xs text-ink-400">
          Columns are matched to your categories and fields by name, so download the template for the right layout. Older files with Subject, Pattern and Root cause columns also work, and an Excel export from this app imports as it is.
        </p>
        <Button size="sm" variant="ghost" onClick={() => void api.downloadMistakeTemplate(project.id).catch((err) => setError(errorMessage(err)))} icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}>Download the template</Button>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-300">Workbook (.xlsx)</span>
          <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="block w-full text-xs text-ink-300 file:mr-3 file:rounded-lg file:border-0 file:bg-fg/[0.08] file:px-3 file:py-2 file:text-ink-100" onChange={(e) => { const f = e.target.files?.[0]; if (f) void check(f) }} />
        </label>
        {busy && !preview && <p className="text-xs text-ink-400" role="status">Checking the file…</p>}
        {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
        {preview && (
          <div className="rounded-2xl border border-fg/[0.06] bg-fg/[0.03] p-3 text-xs" role="status">
            <p className="text-ink-100"><strong>{preview.valid}</strong> of {preview.rows} rows are ready to import.</p>
            {preview.sample.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-ink-400">
                {preview.sample.map((s, i) => <li key={i}>{Object.values(s.tags).flat().join(' · ')}{s.question ? ` · ${s.question.slice(0, 60)}` : ''}</li>)}
              </ul>
            )}
            {preview.errors.length > 0 && (
              <details className="mt-2 text-amber-200">
                <summary className="cursor-pointer">{preview.errors.length} row{preview.errors.length === 1 ? '' : 's'} will be skipped</summary>
                <ul className="mt-1 space-y-0.5">
                  {preview.errors.map((e) => <li key={e.row}>Row {e.row}: {e.message}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button disabled={!preview || preview.valid === 0} loading={busy && Boolean(preview)} onClick={() => void commit()}>
            Import {preview?.valid ?? ''} {preview?.valid === 1 ? 'mistake' : 'mistakes'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
