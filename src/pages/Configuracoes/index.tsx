import { LogOut } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Avatar'

export function Configuracoes() {
  const { user } = useAuthStore()

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const email = user?.email ?? ''
  const name = user?.user_metadata?.name ?? email.split('@')[0]

  return (
    <div className="max-w-lg flex flex-col gap-5">
      <Card className="p-5">
        <p className="text-sm font-semibold text-[#fafafa] mb-4">Perfil</p>
        <div className="flex items-center gap-4">
          <Avatar name={name} size="lg" />
          <div>
            <p className="font-medium text-[#fafafa]">{name}</p>
            <p className="text-sm text-[#a1a1aa]">{email}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.07)] grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[#a1a1aa]">Email</p>
            <p className="text-[#fafafa] mt-0.5">{email}</p>
          </div>
          <div>
            <p className="text-[#a1a1aa]">ID do usuário</p>
            <p className="text-[#fafafa] mt-0.5 font-mono text-xs truncate">{user?.id}</p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-[#fafafa] mb-4">Sessão</p>
        <Button variant="danger" onClick={handleLogout}>
          <LogOut size={16} /> Sair da conta
        </Button>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-[#fafafa] mb-1">Vertex</p>
        <p className="text-sm text-[#a1a1aa]">Sistema interno de gestão operacional</p>
        <p className="text-xs text-[#52525b] mt-2">v1.0.0</p>
      </Card>
    </div>
  )
}
