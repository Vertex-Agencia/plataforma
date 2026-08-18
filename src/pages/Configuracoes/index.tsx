import { useEffect, useState, useRef } from 'react'
import { LogOut, Upload, X, ImageIcon, KeyRound, Eye, EyeOff, RotateCcw, Sparkles } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { getConfiguracoes, salvarApifyToken, salvarConfigAgente } from '../../services/configuracoes'
import { getErrorMessage } from '../../utils/format'
import { PROMPT_PADRAO_AGENTE, MODELO_PADRAO_AGENTE, MODELOS_OPENAI } from '../../constants/agenteIA'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { Avatar } from '../../components/ui/Avatar'

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
const MAX_LOGO_SIZE = 2 * 1024 * 1024 // 2MB

export function Configuracoes() {
  const { user } = useAuthStore()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const logoUrl: string | null = user?.user_metadata?.logo_url ?? null
  const avatarUrl: string | null = user?.user_metadata?.avatar_url ?? null
  const email = user?.email ?? ''
  const name = user?.user_metadata?.name ?? email.split('@')[0]

  const [apifyToken, setApifyToken] = useState('')
  const [apifyTokenVisible, setApifyTokenVisible] = useState(false)
  const [apifyLoading, setApifyLoading] = useState(true)
  const [apifySaving, setApifySaving] = useState(false)
  const [apifyError, setApifyError] = useState<string | null>(null)
  const [apifySaved, setApifySaved] = useState(false)

  const [openaiKey, setOpenaiKey] = useState('')
  const [openaiKeyVisible, setOpenaiKeyVisible] = useState(false)
  const [modelo, setModelo] = useState(MODELO_PADRAO_AGENTE)
  const [modeloCustomizado, setModeloCustomizado] = useState('')
  const [prompt, setPrompt] = useState(PROMPT_PADRAO_AGENTE)
  const [agenteSaving, setAgenteSaving] = useState(false)
  const [agenteError, setAgenteError] = useState<string | null>(null)
  const [agenteSaved, setAgenteSaved] = useState(false)

  const modeloEhCustomizado = !MODELOS_OPENAI.some((m) => m.id === modelo)

  useEffect(() => {
    if (!user) return
    getConfiguracoes(user.id)
      .then((config) => {
        setApifyToken(config?.apify_api_token ?? '')
        setOpenaiKey(config?.openai_api_key ?? '')
        const modeloSalvo = config?.agente_modelo || MODELO_PADRAO_AGENTE
        if (MODELOS_OPENAI.some((m) => m.id === modeloSalvo)) {
          setModelo(modeloSalvo)
        } else {
          setModelo('outro')
          setModeloCustomizado(modeloSalvo)
        }
        setPrompt(config?.agente_prompt || PROMPT_PADRAO_AGENTE)
      })
      .catch((err) => setApifyError(getErrorMessage(err, 'Erro ao carregar configurações.')))
      .finally(() => setApifyLoading(false))
  }, [user])

  async function handleSalvarApifyToken() {
    if (!user) return
    setApifySaving(true)
    setApifyError(null)
    setApifySaved(false)
    try {
      await salvarApifyToken(user.id, apifyToken)
      setApifySaved(true)
    } catch (err) {
      setApifyError(getErrorMessage(err, 'Erro ao salvar chave.'))
    } finally {
      setApifySaving(false)
    }
  }

  async function handleSalvarAgente() {
    if (!user) return
    setAgenteSaving(true)
    setAgenteError(null)
    setAgenteSaved(false)
    try {
      await salvarConfigAgente(user.id, {
        openaiApiKey: openaiKey,
        modelo: modelo === 'outro' ? modeloCustomizado.trim() : modelo,
        prompt,
      })
      setAgenteSaved(true)
    } catch (err) {
      setAgenteError(getErrorMessage(err, 'Erro ao salvar configuração do agente.'))
    } finally {
      setAgenteSaving(false)
    }
  }

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

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setAvatarUploadError('Formato não suportado. Use PNG, JPG, SVG ou WEBP.')
      return
    }
    if (file.size > MAX_LOGO_SIZE) {
      setAvatarUploadError('Arquivo muito grande. Máximo 2MB.')
      return
    }

    setAvatarUploading(true)
    setAvatarUploadError(null)

    const ext = file.name.split('.').pop()
    const path = `${user!.id}/avatar.${ext}`

    const { error: storageError } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true, cacheControl: '3600' })

    if (storageError) {
      setAvatarUploadError('Erro ao fazer upload: ' + storageError.message)
      setAvatarUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)

    const { error: updateError } = await supabase.auth.updateUser({
      data: { avatar_url: urlData.publicUrl },
    })

    if (updateError) {
      setAvatarUploadError('Erro ao salvar foto: ' + updateError.message)
    }

    setAvatarUploading(false)
  }

  async function handleAvatarRemove() {
    setAvatarUploadError(null)
    await supabase.auth.updateUser({ data: { avatar_url: null } })
  }

  return (
    <div className="max-w-2xl flex flex-col gap-5">
      <Card className="p-5">
        <p className="text-sm font-semibold text-[#fafafa] mb-4">Perfil</p>
        <div className="flex items-center gap-4">
          <div className="relative shrink-0 group">
            <Avatar name={name} imageUrl={avatarUrl} size="lg" />
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <button
              onClick={() => avatarInputRef.current?.click()}
              title="Alterar foto de perfil"
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#22c55e] text-[#09090b] flex items-center justify-center border-2 border-[#111113] hover:bg-[#16a34a] transition-colors disabled:opacity-60"
              disabled={avatarUploading}
            >
              <Upload size={10} />
            </button>
          </div>
          <div>
            <p className="font-medium text-[#fafafa]">{name}</p>
            <p className="text-sm text-[#a1a1aa]">{email}</p>
            <div className="mt-1.5 flex items-center gap-3">
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="text-xs text-[#22c55e] hover:underline disabled:opacity-60"
              >
                {avatarUploading ? 'Enviando...' : avatarUrl ? 'Alterar foto' : 'Adicionar foto'}
              </button>
              {avatarUrl && (
                <button onClick={handleAvatarRemove} className="text-xs text-[#71717a] hover:text-[#ef4444] transition-colors">
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>
        {avatarUploadError && (
          <p className="text-xs text-[#ef4444] mt-3">{avatarUploadError}</p>
        )}
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
        <p className="text-sm font-semibold text-[#fafafa] mb-1 flex items-center gap-2">
          <KeyRound size={15} /> Busca de Leads
        </p>
        <p className="text-xs text-[#71717a] mb-4">
          Chave de API usada na busca automática de leads. Fica salva apenas para sua conta.
        </p>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                type={apifyTokenVisible ? 'text' : 'password'}
                placeholder="Cole sua chave de API..."
                value={apifyToken}
                disabled={apifyLoading}
                onChange={(e) => { setApifyToken(e.target.value); setApifySaved(false) }}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setApifyTokenVisible((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#fafafa] transition-colors"
                title={apifyTokenVisible ? 'Ocultar' : 'Mostrar'}
              >
                {apifyTokenVisible ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <Button variant="accent" size="md" loading={apifySaving} disabled={apifyLoading} onClick={handleSalvarApifyToken}>
              Salvar
            </Button>
          </div>
          {apifyError && <p className="text-xs text-[#ef4444]">{apifyError}</p>}
          {apifySaved && <p className="text-xs text-[#22c55e]">Chave salva com sucesso.</p>}
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-[#fafafa] mb-1 flex items-center gap-2">
          <Sparkles size={15} /> Agente de Análise de Leads
        </p>
        <p className="text-xs text-[#71717a] mb-4">
          Roda automaticamente em todo lead novo: lê o site, acha Instagram/Facebook linkados nele e gera um resumo de oportunidades + mensagem de abordagem.
        </p>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#a1a1aa]">Chave da API (OpenAI)</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={openaiKeyVisible ? 'text' : 'password'}
                  placeholder="Cole sua chave da OpenAI (sk-...)"
                  value={openaiKey}
                  disabled={apifyLoading}
                  onChange={(e) => { setOpenaiKey(e.target.value); setAgenteSaved(false) }}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setOpenaiKeyVisible((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#fafafa] transition-colors"
                  title={openaiKeyVisible ? 'Ocultar' : 'Mostrar'}
                >
                  {openaiKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#a1a1aa]">Modelo</label>
            <Select
              value={modelo}
              disabled={apifyLoading}
              onChange={(e) => { setModelo(e.target.value); setAgenteSaved(false) }}
            >
              {MODELOS_OPENAI.map((m) => (
                <option key={m.id} value={m.id}>{m.label} — {m.descricao}</option>
              ))}
              <option value="outro">Outro modelo (digitar ID)</option>
            </Select>
            {modeloEhCustomizado && (
              <Input
                placeholder="ID exato do modelo, ex: o3-mini"
                value={modeloCustomizado}
                onChange={(e) => { setModeloCustomizado(e.target.value); setAgenteSaved(false) }}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm text-[#a1a1aa]">Prompt do agente</label>
              <button
                type="button"
                onClick={() => { setPrompt(PROMPT_PADRAO_AGENTE); setAgenteSaved(false) }}
                className="flex items-center gap-1 text-xs text-[#71717a] hover:text-[#fafafa] transition-colors"
              >
                <RotateCcw size={12} /> Restaurar padrão
              </button>
            </div>
            <Textarea
              rows={12}
              value={prompt}
              disabled={apifyLoading}
              onChange={(e) => { setPrompt(e.target.value); setAgenteSaved(false) }}
              className="font-mono text-xs leading-relaxed"
            />
            <p className="text-xs text-[#52525b]">
              O modelo recebe esse texto como instrução, seguido dos dados coletados do lead (site, Instagram, Facebook). Peça sempre uma resposta em JSON — é o que a plataforma espera de volta.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="accent" size="md" loading={agenteSaving} disabled={apifyLoading} onClick={handleSalvarAgente}>
              Salvar
            </Button>
            {agenteError && <p className="text-xs text-[#ef4444]">{agenteError}</p>}
            {agenteSaved && <p className="text-xs text-[#22c55e]">Configuração salva com sucesso.</p>}
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
