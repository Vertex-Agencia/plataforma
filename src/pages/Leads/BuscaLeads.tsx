import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MapPin, Building2, Users, Sparkles, Radar,
  CheckCircle2, XCircle, Clock, History, KanbanSquare,
  Trash2, Phone, Globe, Star, Send, Eye,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { buscarLeadsApify, getHistoricoBuscas, deleteBusca, enviarBuscaParaPipeline, atualizarObservacaoResultado } from '../../services/leads'
import type { FiltroSite } from '../../services/leads'
import type { LeadBusca } from '../../types/database'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { Textarea } from '../../components/ui/Input'
import { getErrorMessage, formatDateTime } from '../../utils/format'

const QUANTIDADES_PRESET = [10, 20, 50, 100]

const FILTRO_SITE_OPTIONS: { value: FiltroSite; label: string }[] = [
  { value: 'ambos', label: 'Ambos' },
  { value: 'com', label: 'Com site' },
  { value: 'sem', label: 'Sem site' },
]

const buscaStatusConfig: Record<LeadBusca['status'], { label: string; variant: 'green' | 'amber' | 'red'; icon: typeof CheckCircle2 }> = {
  concluida: { label: 'Concluída', variant: 'green', icon: CheckCircle2 },
  pendente: { label: 'Em andamento', variant: 'amber', icon: Clock },
  erro: { label: 'Erro', variant: 'red', icon: XCircle },
}

export function BuscaLeads() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [termoBusca, setTermoBusca] = useState('')
  const [localizacao, setLocalizacao] = useState('')
  const [quantidade, setQuantidade] = useState(20)
  const [filtroSite, setFiltroSite] = useState<FiltroSite>('ambos')
  const [erro, setErro] = useState<string | null>(null)
  const [buscaSelecionada, setBuscaSelecionada] = useState<LeadBusca | null>(null)
  const [envioResultado, setEnvioResultado] = useState<{ novos: number; duplicados: number } | null>(null)
  const [itemDetalheIndex, setItemDetalheIndex] = useState<number | null>(null)
  const [observacaoRascunho, setObservacaoRascunho] = useState('')

  const { data: historico, refetch: refetchHistorico } = useQuery<LeadBusca[]>({
    queryKey: ['lead-buscas', user?.id],
    queryFn: () => getHistoricoBuscas(user!.id),
    enabled: !!user,
    refetchInterval: (query) => (query.state.data ?? []).some((h) => h.status === 'pendente') ? 3000 : false,
  })

  const buscarMutation = useMutation({
    mutationFn: () => buscarLeadsApify({ termo_busca: termoBusca, localizacao, quantidade, filtro_site: filtroSite }),
    onMutate: () => setErro(null),
    onSuccess: async (data) => {
      const { data: novoHistorico } = await refetchHistorico()
      const busca = novoHistorico?.find((h) => h.id === data.busca_id)
      if (busca) {
        setEnvioResultado(null)
        setBuscaSelecionada(busca)
      }
      setTermoBusca('')
      setLocalizacao('')
    },
    onError: (err) => setErro(getErrorMessage(err, 'Erro ao buscar leads.')),
  })

  const deleteBuscaMutation = useMutation({
    mutationFn: (id: number) => deleteBusca(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-buscas', user?.id] })
      setBuscaSelecionada(null)
    },
  })

  const enviarPipelineMutation = useMutation({
    mutationFn: (busca: LeadBusca) => enviarBuscaParaPipeline(user!.id, busca),
    onSuccess: (data) => {
      setEnvioResultado(data)
      queryClient.invalidateQueries({ queryKey: ['leads', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-etapas', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['lead-buscas', user?.id] })
    },
  })

  const salvarObservacaoMutation = useMutation({
    mutationFn: async ({ index, observacoes }: { index: number; observacoes: string }) => {
      if (!buscaSelecionada) return
      await atualizarObservacaoResultado(buscaSelecionada.id, index, observacoes, buscaSelecionada.resultados ?? [])
    },
    onSuccess: async () => {
      const { data: novoHistorico } = await refetchHistorico()
      const atualizada = novoHistorico?.find((h) => h.id === buscaSelecionada?.id)
      if (atualizada) setBuscaSelecionada(atualizada)
      setItemDetalheIndex(null)
    },
  })

  const podeBuscar = termoBusca.trim().length > 0 && localizacao.trim().length > 0 && !buscarMutation.isPending

  function abrirBusca(busca: LeadBusca) {
    setEnvioResultado(null)
    setBuscaSelecionada(busca)
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/leads')}
        className="flex items-center gap-2 text-[#a1a1aa] hover:text-[#fafafa] text-sm transition-colors w-fit"
      >
        <ArrowLeft size={16} /> Voltar para o Pipeline
      </button>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#111113] p-8">
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, #22c55e, transparent 70%)' }}
        />
        <div className="relative flex items-start gap-4">
          <div className={`w-12 h-12 rounded-[12px] bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center shrink-0 transition-shadow ${buscarMutation.isPending ? 'shadow-[0_0_0_6px_rgba(34,197,94,0.08)]' : ''}`}>
            <Radar size={22} className={`text-[#22c55e] ${buscarMutation.isPending ? 'animate-spin' : ''}`} style={buscarMutation.isPending ? { animationDuration: '2s' } : undefined} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#fafafa]">Buscar Leads</h1>
          </div>
        </div>

        {/* Form */}
        <div className="relative flex flex-col gap-4 mt-7">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-[#a1a1aa] flex items-center gap-1.5">
                <Building2 size={13} /> Nicho / termo de busca
              </label>
              <input
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                placeholder="Ex: clínicas odontológicas"
                className="w-full bg-[#18181b] border border-[rgba(255,255,255,0.07)] rounded-[10px] px-3.5 py-2.5 text-[#fafafa] text-sm placeholder-[#52525b] focus:outline-none focus:border-[#22c55e] transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-[#a1a1aa] flex items-center gap-1.5">
                <MapPin size={13} /> Localização
              </label>
              <input
                value={localizacao}
                onChange={(e) => setLocalizacao(e.target.value)}
                placeholder="Ex: São Paulo, SP"
                className="w-full bg-[#18181b] border border-[rgba(255,255,255,0.07)] rounded-[10px] px-3.5 py-2.5 text-[#fafafa] text-sm placeholder-[#52525b] focus:outline-none focus:border-[#22c55e] transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#a1a1aa] flex items-center gap-1.5">
              <Users size={13} /> Quantidade de leads
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {QUANTIDADES_PRESET.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuantidade(q)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    quantidade === q
                      ? 'bg-[#22c55e] text-[#09090b]'
                      : 'bg-[#18181b] text-[#a1a1aa] border border-[rgba(255,255,255,0.07)] hover:text-[#fafafa]'
                  }`}
                >
                  {q}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={500}
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
                className="w-24 bg-[#18181b] border border-[rgba(255,255,255,0.07)] rounded-[10px] px-3 py-1.5 text-[#fafafa] text-sm focus:outline-none focus:border-[#22c55e] transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#a1a1aa] flex items-center gap-1.5">
              <Globe size={13} /> Site
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {FILTRO_SITE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFiltroSite(opt.value)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filtroSite === opt.value
                      ? 'bg-[#22c55e] text-[#09090b]'
                      : 'bg-[#18181b] text-[#a1a1aa] border border-[rgba(255,255,255,0.07)] hover:text-[#fafafa]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="accent"
            size="lg"
            className="mt-2 w-fit"
            disabled={!podeBuscar}
            loading={buscarMutation.isPending}
            onClick={() => buscarMutation.mutate()}
          >
            <Sparkles size={16} /> {buscarMutation.isPending ? 'Buscando...' : 'Buscar Leads'}
          </Button>

          {buscarMutation.isPending && (
            <div className="h-1.5 w-full max-w-xs bg-[#27272a] rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-[#22c55e] rounded-full animate-progress-indeterminate" />
            </div>
          )}

          <p className="text-xs text-[#52525b]">Os leads encontrados ficam disponíveis para revisão antes de entrar no pipeline.</p>

          {erro && (
            <div className="flex items-center gap-2 text-sm text-[#ef4444] bg-[#ef44441a] border border-[#ef444433] rounded-[10px] px-3.5 py-2.5">
              <XCircle size={15} className="shrink-0" /> {erro}
            </div>
          )}
        </div>
      </div>

      {/* Histórico */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-[#a1a1aa] flex items-center gap-2">
          <History size={14} /> Histórico de buscas
        </p>
        {(historico ?? []).length === 0 ? (
          <p className="text-xs text-[#52525b]">Nenhuma busca realizada ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {(historico ?? []).map((h) => {
              const config = buscaStatusConfig[h.status]
              const Icon = config.icon
              return (
                <div
                  key={h.id}
                  className="flex items-center gap-3 bg-[#111113] border border-[rgba(255,255,255,0.07)] rounded-[10px] px-4 py-3 flex-wrap"
                >
                  <Icon size={15} className={
                    h.status === 'concluida' ? 'text-[#22c55e]' : h.status === 'erro' ? 'text-[#ef4444]' : 'text-[#f59e0b]'
                  } />
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm text-[#fafafa]">{h.termo_busca}</p>
                    <p className="text-xs text-[#71717a]">{h.localizacao} · {formatDateTime(h.created_at)}</p>
                  </div>
                  <Badge variant={config.variant}>{config.label}</Badge>
                  {h.status === 'concluida' && h.enviado_pipeline && <Badge variant="blue">No pipeline</Badge>}
                  <span className="text-xs text-[#52525b] w-28 text-right shrink-0">
                    {h.quantidade_encontrada ?? 0}/{h.quantidade_solicitada} encontrados
                  </span>
                  {h.status === 'concluida' && (
                    <button
                      onClick={() => abrirBusca(h)}
                      className="p-1.5 rounded-[6px] text-[#71717a] hover:text-[#fafafa] hover:bg-[#18181b] transition-colors"
                      title="Ver leads encontrados"
                    >
                      <Eye size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteBuscaMutation.mutate(h.id)}
                    className="p-1.5 rounded-[6px] text-[#71717a] hover:text-[#ef4444] hover:bg-[#ef44441a] transition-colors"
                    title="Excluir do histórico"
                  >
                    <Trash2 size={14} />
                  </button>
                  {h.status === 'pendente' && (
                    <div className="w-full h-1 bg-[#27272a] rounded-full overflow-hidden mt-1">
                      <div className="h-full w-1/4 bg-[#f59e0b] rounded-full animate-progress-indeterminate" />
                    </div>
                  )}
                  {h.erro_mensagem && (
                    <p className="w-full text-xs text-[#ef4444] mt-1">{h.erro_mensagem}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal: preview dos leads encontrados */}
      <Modal
        open={!!buscaSelecionada}
        onClose={() => setBuscaSelecionada(null)}
        title={buscaSelecionada ? `Leads encontrados · ${buscaSelecionada.termo_busca}` : ''}
        size="lg"
        actions={
          buscaSelecionada && (
            <>
              <Button
                variant="ghost"
                onClick={() => deleteBuscaMutation.mutate(buscaSelecionada.id)}
                loading={deleteBuscaMutation.isPending}
              >
                <Trash2 size={14} /> Excluir lista
              </Button>
              {buscaSelecionada.enviado_pipeline || envioResultado ? (
                <Button variant="default" onClick={() => navigate('/leads')}>
                  <KanbanSquare size={15} /> Ver no Pipeline
                </Button>
              ) : (
                <Button
                  variant="accent"
                  loading={enviarPipelineMutation.isPending}
                  disabled={!buscaSelecionada.resultados || buscaSelecionada.resultados.length === 0}
                  onClick={() => enviarPipelineMutation.mutate(buscaSelecionada)}
                >
                  <Send size={14} /> Enviar para o Pipeline
                </Button>
              )}
            </>
          )
        }
      >
        {buscaSelecionada && (
          <div className="flex flex-col gap-3">
            {envioResultado ? (
              <div className="flex items-center gap-2 text-sm text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-[10px] px-3.5 py-2.5">
                <CheckCircle2 size={15} className="shrink-0" />
                {envioResultado.novos} lead(s) enviados para a etapa Prospecção
                {envioResultado.duplicados > 0 && ` · ${envioResultado.duplicados} já existiam e foram ignorados`}
              </div>
            ) : buscaSelecionada.enviado_pipeline ? (
              <div className="flex items-center gap-2 text-sm text-[#a1a1aa] bg-[#18181b] rounded-[10px] px-3.5 py-2.5">
                <CheckCircle2 size={15} className="shrink-0 text-[#22c55e]" /> Esses leads já foram enviados ao pipeline.
              </div>
            ) : null}

            <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
              {(buscaSelecionada.resultados ?? []).map((item, i) => (
                <button
                  key={i}
                  onClick={() => { setObservacaoRascunho(item.observacoes ?? ''); setItemDetalheIndex(i) }}
                  className="flex items-center gap-3 bg-[#18181b] rounded-[10px] px-3.5 py-2.5 text-left hover:bg-[#212124] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#fafafa] truncate">{item.nome}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {item.telefone && (
                        <span className="flex items-center gap-1 text-xs text-[#71717a]"><Phone size={10} /> {item.telefone}</span>
                      )}
                      {item.site && (
                        <span className="flex items-center gap-1 text-xs text-[#71717a] truncate"><Globe size={10} /> {item.site}</span>
                      )}
                    </div>
                  </div>
                  {item.observacoes && (
                    <Badge variant="blue" className="shrink-0">Nota</Badge>
                  )}
                  {item.avaliacao != null && (
                    <div className="flex items-center gap-1 text-xs font-medium text-[#f59e0b] shrink-0">
                      <Star size={11} fill="currentColor" /> {item.avaliacao}
                    </div>
                  )}
                </button>
              ))}
              {(buscaSelecionada.resultados ?? []).length === 0 && (
                <p className="text-sm text-[#52525b]">Nenhum lead encontrado nessa busca.</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: detalhe do lead na prévia */}
      <Modal
        open={itemDetalheIndex !== null}
        onClose={() => setItemDetalheIndex(null)}
        title={itemDetalheIndex !== null ? buscaSelecionada?.resultados?.[itemDetalheIndex]?.nome ?? '' : ''}
        actions={
          itemDetalheIndex !== null && (
            <Button
              variant="accent"
              loading={salvarObservacaoMutation.isPending}
              onClick={() => salvarObservacaoMutation.mutate({ index: itemDetalheIndex, observacoes: observacaoRascunho })}
            >
              Salvar observação
            </Button>
          )
        }
      >
        {itemDetalheIndex !== null && buscaSelecionada?.resultados?.[itemDetalheIndex] && (() => {
          const item = buscaSelecionada.resultados![itemDetalheIndex]
          return (
            <div className="flex flex-col gap-4">
              {item.categoria && <p className="text-sm text-[#a1a1aa]">{item.categoria}</p>}
              <div className="grid sm:grid-cols-2 gap-3">
                {item.telefone && (
                  <div className="flex items-center gap-2 text-sm text-[#fafafa] bg-[#18181b] rounded-[8px] px-3 py-2">
                    <Phone size={14} className="text-[#71717a] shrink-0" /> {item.telefone}
                  </div>
                )}
                {item.site && (
                  <a
                    href={item.site.startsWith('http') ? item.site : `https://${item.site}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-[#3b82f6] bg-[#18181b] rounded-[8px] px-3 py-2 truncate hover:underline"
                  >
                    <Globe size={14} className="shrink-0" /> <span className="truncate">{item.site}</span>
                  </a>
                )}
                {item.endereco && (
                  <div className="flex items-center gap-2 text-sm text-[#fafafa] bg-[#18181b] rounded-[8px] px-3 py-2 sm:col-span-2">
                    <MapPin size={14} className="text-[#71717a] shrink-0" /> {item.endereco}
                  </div>
                )}
                {item.avaliacao != null && (
                  <div className="flex items-center gap-2 text-sm text-[#f59e0b] bg-[#18181b] rounded-[8px] px-3 py-2">
                    <Star size={14} fill="currentColor" className="shrink-0" />
                    {item.avaliacao} {item.total_avaliacoes != null && <span className="text-[#71717a]">({item.total_avaliacoes} avaliações)</span>}
                  </div>
                )}
              </div>
              <Textarea
                label="Observação"
                placeholder="Anote informações importantes sobre esse lead..."
                rows={4}
                value={observacaoRascunho}
                onChange={(e) => setObservacaoRascunho(e.target.value)}
              />
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
