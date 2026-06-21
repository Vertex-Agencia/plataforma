import { useState, useRef } from 'react'
import { LogOut, Upload, X, ImageIcon } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Avatar'

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
const MAX_LOGO_SIZE = 2 * 1024 * 1024 // 2MB

export function Configuracoes() {
  const { user } = useAuthStore()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const logoUrl: string | null = user?.user_metadata?.logo_url ?? null
  const email = user?.email ?? ''
  const name = user?.user_metadata?.name ?? email.split('@')[0]

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadError('Formato não suportado. Use PNG, JPG, SVG ou WEBP.')
      return
    }
    if (file.size > MAX_LOGO_SIZE) {
      setUploadError('Arquivo muito grande. Máximo 2MB.')
      return
    }

    setUploading(true)
    setUploadError(null)

    const ext = file.name.split('.').pop()
    const path = `${user!.id}/logo.${ext}`

    const { error: storageError } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true, cacheControl: '3600' })

    if (storageError) {
      setUploadError('Erro ao fazer upload: ' + storageError.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)

    const { error: updateError } = await supabase.auth.updateUser({
      data: { logo_url: urlData.publicUrl },
    })

    if (updateError) {
      setUploadError('Erro ao salvar logo: ' + updateError.message)
    }

    setUploading(false)
  }

  async function handleLogoRemove() {
    setUploadError(null)
    await supabase.auth.updateUser({ data: { logo_url: null } })
  }

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
        <p className="text-sm font-semibold text-[#fafafa] mb-1">Logo da Empresa</p>
        <p className="text-xs text-[#71717a] mb-4">Aparece no topo do menu lateral. PNG, JPG, SVG ou WEBP até 2MB.</p>

        <div className="flex items-center gap-4">
          {/* Preview */}
          <div className="w-16 h-16 rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#18181b] flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <ImageIcon size={24} className="text-[#3f3f46]" />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <Button
              variant="ghost"
              size="sm"
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} /> {logoUrl ? 'Alterar logo' : 'Enviar logo'}
            </Button>
            {logoUrl && (
              <Button variant="ghost" size="sm" onClick={handleLogoRemove}>
                <X size={14} /> Remover
              </Button>
            )}
          </div>
        </div>

        {uploadError && (
          <p className="text-xs text-[#ef4444] mt-3">{uploadError}</p>
        )}
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
