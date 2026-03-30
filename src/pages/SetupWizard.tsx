import { useState } from 'react'
import { Moon, ShieldCheck, ShieldOff, Eye, EyeOff, Loader2 } from 'lucide-react'
import { api } from '../api'

interface SetupWizardProps {
  onComplete: () => void
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<'welcome' | 'encrypt'>('welcome')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSkip() {
    setLoading(true)
    try {
      await api.updateSettings({ setupComplete: true })
    } catch {
      // ignorieren – Überspringen soll immer funktionieren
    } finally {
      setLoading(false)
      onComplete()
    }
  }

  async function handleEnableEncryption(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.')
      return
    }
    if (password !== passwordConfirm) {
      setError('Die Passwörter stimmen nicht überein.')
      return
    }
    setLoading(true)
    try {
      await api.setEncryptionPassword(password)
      onComplete()
    } catch {
      setError('Verschlüsselung konnte nicht aktiviert werden.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-night-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-loona-300 to-loona-600 flex items-center justify-center mb-4 shadow-lg loona-glow">
            <Moon size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Loona</h1>
          <p className="text-night-400 text-sm mt-1">Zeiterfassung</p>
        </div>

        {step === 'welcome' && (
          <div className="bg-night-900 border border-night-700/50 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-xl font-semibold text-white mb-2">Willkommen bei Loona!</h2>
            <p className="text-night-300 text-sm mb-8">
              Deine Daten werden lokal auf diesem Gerät gespeichert. Möchtest du die Datenbank
              mit einem Passwort verschlüsseln, um sensible Informationen zu schützen?
            </p>

            <div className="grid grid-cols-1 gap-3 mb-6">
              {/* Verschlüsseln */}
              <button
                onClick={() => setStep('encrypt')}
                className="flex items-start gap-4 p-4 rounded-xl border border-loona-600/40 bg-loona-600/10 hover:bg-loona-600/20 transition-loona text-left"
              >
                <ShieldCheck size={24} className="text-loona-300 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-white font-medium text-sm">Verschlüsselung aktivieren</div>
                  <div className="text-night-400 text-xs mt-0.5">
                    Daten werden mit einem Passwort gesichert. Beim Start wird das Passwort abgefragt.
                  </div>
                </div>
              </button>

              {/* Überspringen */}
              <button
                onClick={handleSkip}
                disabled={loading}
                className="flex items-start gap-4 p-4 rounded-xl border border-night-700/50 bg-night-800/50 hover:bg-night-800 transition-loona text-left disabled:opacity-50"
              >
                <ShieldOff size={24} className="text-night-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-night-200 font-medium text-sm">Ohne Verschlüsselung fortfahren</div>
                  <div className="text-night-500 text-xs mt-0.5">
                    Daten werden unverschlüsselt gespeichert. Du kannst die Verschlüsselung
                    später jederzeit in den Einstellungen aktivieren.
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 'encrypt' && (
          <div className="bg-night-900 border border-night-700/50 rounded-2xl p-8 shadow-2xl">
            <button
              onClick={() => { setStep('welcome'); setError(''); setPassword(''); setPasswordConfirm('') }}
              className="text-night-400 hover:text-white text-sm mb-6 flex items-center gap-1 transition-colors"
            >
              ← Zurück
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-loona-600/20 flex items-center justify-center">
                <ShieldCheck size={20} className="text-loona-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Verschlüsselung einrichten</h2>
                <p className="text-night-400 text-xs">Wähle ein sicheres Passwort (mind. 8 Zeichen)</p>
              </div>
            </div>

            <form onSubmit={handleEnableEncryption} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-night-300 mb-1.5">
                  Passwort
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mindestens 8 Zeichen"
                    autoFocus
                    className="w-full bg-night-800 border border-night-600 rounded-lg px-4 py-2.5 text-white placeholder-night-500 focus:outline-none focus:border-loona-500 focus:ring-1 focus:ring-loona-500/30 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-night-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-night-300 mb-1.5">
                  Passwort bestätigen
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordConfirm}
                  onChange={e => setPasswordConfirm(e.target.value)}
                  placeholder="Passwort wiederholen"
                  className="w-full bg-night-800 border border-night-600 rounded-lg px-4 py-2.5 text-white placeholder-night-500 focus:outline-none focus:border-loona-500 focus:ring-1 focus:ring-loona-500/30"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !password || !passwordConfirm}
                className="w-full bg-loona-600 hover:bg-loona-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-loona flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Wird aktiviert…</>
                ) : (
                  <><ShieldCheck size={16} /> Verschlüsselung aktivieren</>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
