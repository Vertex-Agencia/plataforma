import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function Login() {
  const { user } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-[12px] bg-[#22c55e] flex items-center justify-center">
            <Zap size={22} className="text-[#09090b]" fill="currentColor" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-[#fafafa]">Vertex</h1>
            <p className="text-sm text-[#a1a1aa] mt-0.5">Sistema de gestão operacional</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#111113] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-6 flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && (
            <p className="text-sm text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-[8px] px-3 py-2">
              {error}
            </p>
          )}
          <Button type="submit" variant="accent" loading={loading} className="w-full justify-center mt-1">
            Entrar
          </Button>
        </form>
      </div>
    </div>
  )
}
