import { useState } from 'react'
import { Moon, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { api } from '../api'

interface LockScreenProps {
  onUnlocked: () => void
}

export default function LockScreen({ onUnlocked }: LockScreenProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    setError('')
    try {
      const res = await api.unlock(password)
      if (res.ok) {
        onUnlocked()
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Falsches Passwort.')
        setPassword('')
      }
    } catch {
      setError('Verbindung zum Server fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-night-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-loona-300 to-loona-600 flex items-center justify-center mb-4 shadow-lg loona-glow">
            <Moon size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Loona</h1>
          <p className="text-night-400 text-sm mt-1">Zeiterfassung</p>
        </div>

        {/* Lock Card */}
        <div className="bg-night-900 border border-night-700/50 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-loona-600/20 flex items-center justify-center">
              <Lock size={18} className="text-loona-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Datenbank gesperrt</h2>
              <p className="text-night-400 text-xs mt-0.5">Gib dein Passwort ein um fortzufahren</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="Passwort"
                autoFocus
                className="w-full bg-night-800 border border-night-600/50 rounded-xl px-4 py-3 pr-11 text-white placeholder-night-500 focus:outline-none focus:border-loona-500 focus:ring-1 focus:ring-loona-500 transition-loona"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-night-500 hover:text-night-300 transition-loona"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-sm flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!password || loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-loona-600 hover:bg-loona-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-loona loona-glow-hover"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
              {loading ? 'Wird entsperrt…' : 'Entsperren'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
