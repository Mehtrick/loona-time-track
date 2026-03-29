import { useEffect, useState } from 'react'
import { Save, CheckCircle } from 'lucide-react'
import { api } from '../api'
import type { Settings as SettingsType } from '../types'

const INPUT = "w-full bg-night-800 border border-night-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-loona-500 focus:ring-1 focus:ring-loona-500 transition-loona"
const LABEL = "block text-sm font-medium text-night-200 mb-1.5"

export default function Settings() {
  const [s, setS] = useState<SettingsType>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => { api.getSettings().then(setS) }, [])

  function set(field: keyof SettingsType, value: any) {
    setS(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    await api.updateSettings(s)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Einstellungen</h2>
        <p className="text-night-300 mt-1">Deine Geschaeftsdaten fuer Rechnungen</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Company info */}
        <section className="bg-night-900 rounded-2xl border border-night-700/50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Absender</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={LABEL}>Firmenname / Name</label>
              <input className={INPUT} value={s.company_name || ''} onChange={e => set('company_name', e.target.value)} placeholder="Max Mustermann Softwareentwicklung" />
            </div>
            <div>
              <label className={LABEL}>Strasse + Nr.</label>
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
              <input className={INPUT} value={s.tax_number || ''} onChange={e => set('tax_number', e.target.value)} placeholder="123/4567/8901" />
            </div>
          </div>
        </section>

        {/* Bank */}
        <section className="bg-night-900 rounded-2xl border border-night-700/50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Bankverbindung</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>Bank</label>
              <input className={INPUT} value={s.bank_name || ''} onChange={e => set('bank_name', e.target.value)} placeholder="Volksbank" />
            </div>
            <div>
              <label className={LABEL}>BIC</label>
              <input className={INPUT} value={s.bank_bic || ''} onChange={e => set('bank_bic', e.target.value)} placeholder="DGPBDE3MXXX" />
            </div>
            <div className="md:col-span-1">
              <label className={LABEL}>IBAN</label>
              <input className={INPUT} value={s.bank_iban || ''} onChange={e => set('bank_iban', e.target.value)} placeholder="DE12 3456 7890 1234 5678 90" />
            </div>
          </div>
        </section>

        {/* Invoice defaults */}
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
            <div className="md:col-span-2">
              <label className={LABEL}>Rechnungshinweis</label>
              <textarea className={INPUT + ' resize-none'} rows={2} value={s.invoice_note || ''} onChange={e => set('invoice_note', e.target.value)} placeholder="Abrechnung nach § 19 Abs. 1 UStG ohne Umsatzsteuer (Kleinunternehmerregelung)" />
            </div>
          </div>
        </section>

        <button type="submit" className="flex items-center gap-2 px-6 py-3 bg-loona-600 hover:bg-loona-500 text-white rounded-xl font-medium transition-loona loona-glow-hover">
          {saved ? <CheckCircle size={18} /> : <Save size={18} />}
          {saved ? 'Gespeichert' : 'Speichern'}
        </button>
      </form>
    </div>
  )
}
