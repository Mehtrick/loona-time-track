import { useEffect, useRef, useState } from 'react'
import { Save, Info, Download, Upload, AlertTriangle, X, Lock, LockOpen, KeyRound, Eye, EyeOff, Loader2 } from 'lucide-react'
import { api } from '../api'
import { useToast } from '../components/Toast'
import type { Settings as SettingsType } from '../types'

const INPUT = "w-full bg-night-800 border border-night-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-loona-500 focus:ring-1 focus:ring-loona-500 transition-loona"
const INPUT_ERR = "w-full bg-night-800 border border-red-500/70 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-loona"
const LABEL = "block text-sm font-medium text-night-200 mb-1.5"

const KLEINUNTERNEHMER_TEXT = 'Abrechnung nach § 19 Abs. 1 UStG ohne Umsatzsteuer (Kleinunternehmerregelung)'

const ENTITY_LABELS: Record<string, string> = {
  clients: 'Kunden',
  tickets: 'Tickets',
  entries: 'Buchungen',
  invoices: 'Rechnungen',
}

interface ImportConflict {
  entity: string
  id: number
  name: string
}

interface ConflictDialogProps {
  conflicts: ImportConflict[]
  onResolve: (resolutions: Record<string, 'overwrite' | 'skip'>) => void
  onCancel: () => void
}

function ConflictDialog({ conflicts, onResolve, onCancel }: ConflictDialogProps) {
  const [resolutions, setResolutions] = useState<Record<string, 'overwrite' | 'skip'>>(() => {
    const init: Record<string, 'overwrite' | 'skip'> = {}
    conflicts.forEach(c => { init[`${c.entity}:${c.id}`] = 'skip' })
    return init
  })

  function setAll(value: 'overwrite' | 'skip') {
    const next: Record<string, 'overwrite' | 'skip'> = {}
    conflicts.forEach(c => { next[`${c.entity}:${c.id}`] = value })
    setResolutions(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-night-900 border border-night-700/50 rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 p-6 border-b border-night-700/50">
          <AlertTriangle size={22} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">ID-Konflikte beim Import</h3>
            <p className="text-night-300 text-sm mt-0.5">
              {conflicts.length} {conflicts.length === 1 ? 'Datensatz existiert' : 'Datensätze existieren'} bereits. Bitte wähle für jeden, ob er überschrieben oder übersprungen werden soll.
            </p>
          </div>
          <button onClick={onCancel} className="text-night-400 hover:text-white transition-loona">
            <X size={20} />
          </button>
        </div>

        {/* Schnellauswahl */}
        <div className="flex gap-2 px-6 pt-4">
          <button
            type="button"
            onClick={() => setAll('skip')}
            className="text-xs px-3 py-1.5 rounded-lg bg-night-700 hover:bg-night-600 text-night-200 hover:text-white transition-loona"
          >
            Alle überspringen
          </button>
          <button
            type="button"
            onClick={() => setAll('overwrite')}
            className="text-xs px-3 py-1.5 rounded-lg bg-amber-900/50 hover:bg-amber-800/50 text-amber-300 hover:text-amber-100 transition-loona"
          >
            Alle überschreiben
          </button>
        </div>

        {/* Konflikt-Liste */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {conflicts.map(c => {
            const key = `${c.entity}:${c.id}`
            return (
              <div key={key} className="flex items-center justify-between gap-3 bg-night-800 rounded-xl px-4 py-3">
                <div className="min-w-0">
                  <span className="text-xs text-night-400 uppercase tracking-wide">{ENTITY_LABELS[c.entity] ?? c.entity}</span>
                  <p className="text-white text-sm truncate">{c.name} <span className="text-night-400">#{c.id}</span></p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setResolutions(r => ({ ...r, [key]: 'skip' }))}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-loona ${
                      resolutions[key] === 'skip'
                        ? 'bg-night-600 text-white'
                        : 'bg-night-700/50 text-night-400 hover:text-white hover:bg-night-700'
                    }`}
                  >
                    Überspringen
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolutions(r => ({ ...r, [key]: 'overwrite' }))}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-loona ${
                      resolutions[key] === 'overwrite'
                        ? 'bg-amber-700 text-amber-100'
                        : 'bg-night-700/50 text-night-400 hover:text-amber-300 hover:bg-amber-900/40'
                    }`}
                  >
                    Überschreiben
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-night-700/50">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl bg-night-700 hover:bg-night-600 text-white text-sm font-medium transition-loona"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => onResolve(resolutions)}
            className="px-5 py-2.5 rounded-xl bg-loona-600 hover:bg-loona-500 text-white text-sm font-medium transition-loona loona-glow-hover"
          >
            Import fortsetzen
          </button>
        </div>
      </div>
    </div>
  )
}

function validateTaxNumber(val: string): boolean {
  if (!val) return true
  return /^\d{2,3}\/\d{3,5}\/\d{3,5}$/.test(val.trim())
}

function validateIBAN(raw: string): boolean {
  if (!raw) return true
  const iban = raw.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  // Move first 4 chars to end, convert letters to numbers, mod 97
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  const numeric = rearranged.split('').map(c => {
    const code = c.charCodeAt(0)
    return code >= 65 ? String(code - 55) : c
  }).join('')
  let remainder = 0
  for (const ch of numeric) {
    remainder = (remainder * 10 + parseInt(ch)) % 97
  }
  return remainder === 1
}

export default function Settings() {
  const { toast } = useToast()
  const [s, setS] = useState<SettingsType>({})
  const [taxError, setTaxError] = useState('')
  const [ibanError, setIbanError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [pendingImport, setPendingImport] = useState<{ data: any; conflicts: ImportConflict[] } | null>(null)
  const [encryptionEnabled, setEncryptionEnabled] = useState(false)
  const [encPassword, setEncPassword] = useState('')
  const [encPasswordConfirm, setEncPasswordConfirm] = useState('')
  const [encShowPw, setEncShowPw] = useState(false)
  const [encLoading, setEncLoading] = useState(false)

  useEffect(() => {
    api.getSettings().then(setS)
    api.getStatus().then(s => setEncryptionEnabled(s.encrypted)).catch(() => {})
  }, [])

  function set(field: keyof SettingsType, value: any) {
    setS(prev => ({ ...prev, [field]: value }))
  }

  function handleTaxChange(val: string) {
    set('tax_number', val)
    setTaxError(val && !validateTaxNumber(val) ? 'Format: 123/4567/8901' : '')
  }

  function handleIbanChange(val: string) {
    set('bank_iban', val)
    setIbanError(val && !validateIBAN(val) ? 'Ungültige IBAN' : '')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (taxError || ibanError) {
      toast('Bitte korrigiere die markierten Felder.', 'error')
      return
    }
    if (s.tax_number && !validateTaxNumber(s.tax_number)) {
      setTaxError('Format: 123/4567/8901')
      toast('Steuernummer hat ein ungültiges Format.', 'error')
      return
    }
    if (s.bank_iban && !validateIBAN(s.bank_iban)) {
      setIbanError('Ungültige IBAN')
      toast('Die IBAN ist ungültig.', 'error')
      return
    }
    try {
      await api.updateSettings(s)
      toast('Einstellungen gespeichert.')
    } catch {
      toast('Fehler beim Speichern.', 'error')
    }
  }

  function handleExport() {
    const url = api.getExportUrl()
    const a = document.createElement('a')
    a.href = url
    a.download = `loona-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    let parsed: any
    try {
      const text = await file.text()
      parsed = JSON.parse(text)
    } catch {
      toast('Datei konnte nicht gelesen werden. Bitte eine gültige JSON-Exportdatei wählen.', 'error')
      return
    }

    await runImport(parsed, {})
  }

  async function runImport(importData: any, conflicts: Record<string, 'overwrite' | 'skip'>) {
    setImporting(true)
    try {
      const res = await api.importData({ data: importData, conflicts })
      if (res.status === 409) {
        const body = await res.json()
        setPendingImport({ data: importData, conflicts: body.conflicts })
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast(body.error || 'Fehler beim Import.', 'error')
        return
      }
      const result = await res.json()
      setPendingImport(null)
      const total = Object.values(result.imported as Record<string, number>).reduce((a, b) => a + b, 0)
      toast(`Import abgeschlossen: ${total} Datensatz/Datensätze hinzugefügt bzw. aktualisiert.`)
    } catch {
      toast('Import fehlgeschlagen.', 'error')
    } finally {
      setImporting(false)
    }
  }

  function handleConflictResolve(resolutions: Record<string, 'overwrite' | 'skip'>) {
    if (!pendingImport) return
    runImport(pendingImport.data, resolutions)
  }

  async function handleEnableEncryption() {
    if (!encPassword) { toast('Bitte ein Passwort eingeben.', 'error'); return }
    if (encPassword !== encPasswordConfirm) { toast('Passwörter stimmen nicht überein.', 'error'); return }
    if (encPassword.length < 8) { toast('Das Passwort muss mindestens 8 Zeichen lang sein.', 'error'); return }
    setEncLoading(true)
    try {
      await api.setEncryptionPassword(encPassword)
      setEncryptionEnabled(true)
      setEncPassword('')
      setEncPasswordConfirm('')
      toast('Datenbank wird ab jetzt verschlüsselt gespeichert.')
    } catch {
      toast('Fehler beim Aktivieren der Verschlüsselung.', 'error')
    } finally {
      setEncLoading(false)
    }
  }

  async function handleDisableEncryption() {
    setEncLoading(true)
    try {
      await api.removeEncryption()
      setEncryptionEnabled(false)
      toast('Verschlüsselung deaktiviert. Datenbank wird jetzt unverschlüsselt gespeichert.')
    } catch {
      toast('Fehler beim Deaktivieren der Verschlüsselung.', 'error')
    } finally {
      setEncLoading(false)
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {pendingImport && (
        <ConflictDialog
          conflicts={pendingImport.conflicts}
          onResolve={handleConflictResolve}
          onCancel={() => setPendingImport(null)}
        />
      )}

      <div>
        <h2 className="text-2xl font-bold text-white">Einstellungen</h2>
        <p className="text-night-300 mt-1">Deine Geschäftsdaten für Rechnungen</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Absender */}
        <section className="bg-night-900 rounded-2xl border border-night-700/50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Absender</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={LABEL}>Firmenname / Name</label>
              <input className={INPUT} value={s.company_name || ''} onChange={e => set('company_name', e.target.value)} placeholder="Max Mustermann Softwareentwicklung" />
            </div>
            <div>
              <label className={LABEL}>Straße + Nr.</label>
              <input className={INPUT} value={s.address_line1 || ''} onChange={e => set('address_line1', e.target.value)} placeholder="Musterstr. 1" />
            </div>
            <div>
              <label className={LABEL}>PLZ + Ort</label>
              <input className={INPUT} value={s.address_line2 || ''} onChange={e => set('address_line2', e.target.value)} placeholder="12345 Musterstadt" />
            </div>
            <div>
              <label className={LABEL}>Telefon</label>
              <input className={INPUT} value={s.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="+49 123 456789" />
            </div>
            <div>
              <label className={LABEL}>E-Mail</label>
              <input className={INPUT} type="email" value={s.email || ''} onChange={e => set('email', e.target.value)} placeholder="mail@example.com" />
            </div>
            <div>
              <label className={LABEL}>Steuernummer</label>
              <input
                className={taxError ? INPUT_ERR : INPUT}
                value={s.tax_number || ''}
                onChange={e => handleTaxChange(e.target.value)}
                placeholder="123/4567/8901"
              />
              {taxError && <p className="text-red-400 text-xs mt-1">{taxError}</p>}
            </div>
          </div>
        </section>

        {/* Bankverbindung */}
        <section className="bg-night-900 rounded-2xl border border-night-700/50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Bankverbindung</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>Bank</label>
              <input className={INPUT} value={s.bank_name || ''} onChange={e => set('bank_name', e.target.value)} placeholder="Meine Bank" />
            </div>
            <div>
              <label className={LABEL}>BIC</label>
              <input className={INPUT} value={s.bank_bic || ''} onChange={e => set('bank_bic', e.target.value)} placeholder="BXXXXXXXX" />
            </div>
            <div>
              <label className={LABEL}>IBAN</label>
              <input
                className={ibanError ? INPUT_ERR : INPUT}
                value={s.bank_iban || ''}
                onChange={e => handleIbanChange(e.target.value)}
                placeholder="DE00 0000 0000 0000 0000 00"
              />
              {ibanError && <p className="text-red-400 text-xs mt-1">{ibanError}</p>}
            </div>
          </div>
        </section>

        {/* Rechnungseinstellungen */}
        <section className="bg-night-900 rounded-2xl border border-night-700/50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Rechnungseinstellungen</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Stundensatz (EUR)</label>
              <input className={INPUT} type="number" step="0.01" min="0" value={s.hourly_rate ?? ''} onChange={e => set('hourly_rate', e.target.value ? Number(e.target.value) : undefined)} placeholder="80" />
            </div>
            <div>
              <label className={LABEL}>Zahlungsziel (Tage)</label>
              <input className={INPUT} type="number" min="0" value={s.payment_terms_days ?? ''} onChange={e => set('payment_terms_days', e.target.value ? Number(e.target.value) : undefined)} placeholder="14" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className={LABEL + ' mb-0'}>Rechnungshinweis</label>
                <button
                  type="button"
                  onClick={() => set('invoice_note', KLEINUNTERNEHMER_TEXT)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-night-700 hover:bg-night-600 text-night-200 hover:text-white text-xs font-medium transition-loona"
                >
                  <Info size={12} />
                  Hinweis zur Kleinunternehmerregelung
                </button>
              </div>
              <textarea
                className={INPUT + ' resize-none'}
                rows={2}
                value={s.invoice_note || ''}
                onChange={e => set('invoice_note', e.target.value)}
                placeholder="z.B. Gemäß § 19 UStG wird keine Umsatzsteuer berechnet."
              />
            </div>
          </div>
        </section>

        <button
          type="submit"
          className="flex items-center gap-2 px-6 py-3 bg-loona-600 hover:bg-loona-500 text-white rounded-xl font-medium transition-loona loona-glow-hover"
        >
          <Save size={18} />
          Speichern
        </button>
      </form>

      {/* Verschlüsselung */}
      <section className="bg-night-900 rounded-2xl border border-night-700/50 p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${encryptionEnabled ? 'bg-loona-600/20' : 'bg-night-800'}`}>
            {encryptionEnabled
              ? <Lock size={18} className="text-loona-300" />
              : <LockOpen size={18} className="text-night-400" />}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Verschlüsselung</h3>
            <p className="text-night-400 text-sm mt-0.5">
              {encryptionEnabled
                ? 'Die Datenbank ist mit einem Passwort verschlüsselt (AES-256-GCM). Beim nächsten Start wird das Passwort abgefragt.'
                : 'Die Datenbank ist aktuell unverschlüsselt. Setze ein Passwort um sie zu schützen.'}
            </p>
          </div>
        </div>

        {encryptionEnabled ? (
          /* Verschlüsselung aktiv */
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-loona-600/10 border border-loona-600/20">
              <Lock size={14} className="text-loona-300 flex-shrink-0" />
              <span className="text-loona-200 text-sm">Datenbank ist verschlüsselt</span>
            </div>

            {/* Passwort ändern */}
            <details className="group">
              <summary className="cursor-pointer flex items-center gap-2 text-sm text-night-300 hover:text-white transition-loona list-none">
                <KeyRound size={15} />
                Passwort ändern
              </summary>
              <div className="mt-3 space-y-3">
                <div className="relative">
                  <input
                    type={encShowPw ? 'text' : 'password'}
                    value={encPassword}
                    onChange={e => setEncPassword(e.target.value)}
                    placeholder="Neues Passwort (min. 8 Zeichen)"
                    className={INPUT + ' pr-11'}
                  />
                  <button type="button" onClick={() => setEncShowPw(v => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-night-500 hover:text-night-300 transition-loona">
                    {encShowPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <input
                  type={encShowPw ? 'text' : 'password'}
                  value={encPasswordConfirm}
                  onChange={e => setEncPasswordConfirm(e.target.value)}
                  placeholder="Passwort bestätigen"
                  className={INPUT}
                />
                <button
                  type="button"
                  onClick={handleEnableEncryption}
                  disabled={encLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-loona-600 hover:bg-loona-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-loona"
                >
                  {encLoading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                  Passwort ändern
                </button>
              </div>
            </details>

            <div className="border-t border-night-700/50 pt-4">
              <button
                type="button"
                onClick={handleDisableEncryption}
                disabled={encLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-night-700 hover:bg-red-900/50 disabled:opacity-50 text-night-300 hover:text-red-300 rounded-xl text-sm font-medium transition-loona"
              >
                {encLoading ? <Loader2 size={15} className="animate-spin" /> : <LockOpen size={15} />}
                Verschlüsselung deaktivieren
              </button>
            </div>
          </div>
        ) : (
          /* Verschlüsselung inaktiv */
          <div className="space-y-3">
            <div className="relative">
              <input
                type={encShowPw ? 'text' : 'password'}
                value={encPassword}
                onChange={e => setEncPassword(e.target.value)}
                placeholder="Neues Passwort (min. 8 Zeichen)"
                className={INPUT + ' pr-11'}
              />
              <button type="button" onClick={() => setEncShowPw(v => !v)} tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-night-500 hover:text-night-300 transition-loona">
                {encShowPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <input
              type={encShowPw ? 'text' : 'password'}
              value={encPasswordConfirm}
              onChange={e => setEncPasswordConfirm(e.target.value)}
              placeholder="Passwort bestätigen"
              className={INPUT}
            />
            <button
              type="button"
              onClick={handleEnableEncryption}
              disabled={encLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-loona-600 hover:bg-loona-500 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition-loona loona-glow-hover"
            >
              {encLoading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              {encLoading ? 'Verschlüssele…' : 'Verschlüsselung aktivieren'}
            </button>
          </div>
        )}
      </section>

      {/* Daten-Export / Import */}
      <section className="bg-night-900 rounded-2xl border border-night-700/50 p-6 space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-white">Daten sichern & wiederherstellen</h3>
          <p className="text-night-400 text-sm mt-1">
            Exportiere alle Daten als unverschlüsselte JSON-Datei oder importiere eine Sicherung.
            Beim Import werden vorhandene Datensätze nicht gelöscht – nur neue hinzugefügt oder auf Wunsch überschrieben.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2.5 bg-night-700 hover:bg-night-600 text-white rounded-xl font-medium text-sm transition-loona"
          >
            <Upload size={16} />
            Datenbank exportieren
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-5 py-2.5 bg-night-700 hover:bg-night-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-loona"
          >
            <Download size={16} />
            {importing ? 'Importiere…' : 'Datenbank importieren'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>

        <p className="text-night-500 text-xs">
          Der Export enthält alle Kunden, Tickets, Buchungen und Rechnungen im Klartext (unverschlüsselt). Bewahre die Datei sicher auf.
        </p>
      </section>
    </div>
  )
}
