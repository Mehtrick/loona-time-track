import { useEffect, useState } from 'react'
import { Save, Info } from 'lucide-react'
import { api } from '../api'
import { useToast } from '../components/Toast'
import type { Settings as SettingsType } from '../types'

const INPUT = "w-full bg-night-800 border border-night-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-loona-500 focus:ring-1 focus:ring-loona-500 transition-loona"
const INPUT_ERR = "w-full bg-night-800 border border-red-500/70 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-loona"
const LABEL = "block text-sm font-medium text-night-200 mb-1.5"

const KLEINUNTERNEHMER_TEXT = 'Abrechnung nach § 19 Abs. 1 UStG ohne Umsatzsteuer (Kleinunternehmerregelung)'

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

  useEffect(() => { api.getSettings().then(setS) }, [])

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

  return (
    <div className="space-y-8 max-w-3xl">
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
    </div>
  )
}
