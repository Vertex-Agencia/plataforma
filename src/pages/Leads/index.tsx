import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Settings2, Trash2, Phone, Globe, Star, ChevronUp, ChevronDown, History,
  Building2, MapPin, Sparkles, RefreshCw, Copy, Check, AlertTriangle,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import {
  getPipelineEtapas,
  getLeads,
  getHistoricoBuscas,
  createEtapa,
  updateEtapa,
  reorderEtapas,
  deleteEtapa,
  EtapaComLeadsError,
  moveLead,
  deleteLeads,
  updateLead,
  analisarLeadAgora,
} from '../../services/leads'
import type { Lead, PipelineEtapa, LeadBusca } from '../../types/database'
import { getErrorMessage } from '../../utils/format'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { TelefoneAcoes } from '../../components/ui/TelefoneAcoes'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { PageSpinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Badge } from '../../components/ui/Badge'

const CORES_PRESET = ['#22c55e', '#3b82f6', '#a78bfa', '#f59e0b', '#ef4444', '#71717a']

const buscaStatusConfig: Record<LeadBusca['status'], { label: string; variant: 'green' | 'amber' | 'red' }> = {
  concluida: { label: 'Concluída', variant: 'green' },
  pendente: { label: 'Pendente', variant: 'amber' },
  erro: { label: 'Erro', variant: 'red' },
}

export function Leads() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [pipelineModalOpen, setPipelineModalOpen] = useState(false)
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [dragOverEtapa, setDragOverEtapa] = useState<number | null>(null)
  const dragLeadId = useRef<number | null>(null)

  const [novaEtapaNome, setNovaEtapaNome] = useState('')
  const [novaEtapaCor, setNovaEtapaCor] = useState(CORES_PRESET[0])
  const [etapaParaExcluir, setEtapaParaExcluir] = useState<{ id: number; nome: string; quantidadeLeads: number } | null>(null)
  const [moverLeadsPara, setMoverLeadsPara] = useState('')
  const [pipelineErro, setPipelineErro] = useState<string | null>(null)
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null)
  const [observacaoRascunho, setObservacaoRascunho] = useState('')

  const [analiseModalOpen, setAnaliseModalOpen] = useState(false)
  const [analiseModo, setAnaliseModo] = useState<'lead' | 'etapa'>('lead')
  const [analiseLeadId, setAnaliseLeadId] = useState('')
  const [analiseEtapaId, setAnaliseEtapaId] = useState('')

  const { data: etapas, isLoading: etapasLoading } = useQuery<PipelineEtapa[]>({
    queryKey: ['pipeline-etapas', user?.id],
    queryFn: () => getPipelineEtapas(user!.id),
    enabled: !!user,
  })

  const { data: leads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ['leads', user?.id],
    queryFn: () => getLeads(user!.id),
    enabled: !!user,
    refetchInterval: (query) => (query.state.data ?? []).some((l) => l.analise_status === 'pendente') ? 3000 : false,
  })

  const { data: historico } = useQuery<LeadBusca[]>({
    queryKey: ['lead-buscas', user?.id],
    queryFn: () => getHistoricoBuscas(user!.id),
    enabled: !!user && historicoAberto,
  })

  const createEtapaMutation = useMutation({
    mutationFn: () => {
      const ordem = (etapas ?? []).length
      return createEtapa(user!.id, novaEtapaNome, novaEtapaCor, ordem)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-etapas', user?.id] })
      setNovaEtapaNome('')
      setNovaEtapaCor(CORES_PRESET[0])
      setPipelineErro(null)
    },
    onError: (err) => setPipelineErro(getErrorMessage(err, 'Erro ao criar etapa.')),
  })

  const reorderMutation = useMutation({
    mutationFn: (novaOrdem: { id: number; ordem: number }[]) => reorderEtapas(novaOrdem),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline-etapas', user?.id] }),
    onError: (err) => setPipelineErro(getErrorMessage(err, 'Erro ao reordenar etapas.')),
  })

  const deleteEtapaMutation = useMutation({
    mutationFn: ({ id, moverPara }: { id: number; moverPara?: number }) => deleteEtapa(id, moverPara),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-etapas', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['leads', user?.id] })
      setEtapaParaExcluir(null)
      setMoverLeadsPara('')
      setPipelineErro(null)
    },
    onError: (err, { id }) => {
      if (err instanceof EtapaComLeadsError) {
        const etapa = (etapas ?? []).find((e) => e.id === id)
        setEtapaParaExcluir({ id, nome: etapa?.nome ?? '', quantidadeLeads: err.quantidadeLeads })
      } else {
        setPipelineErro(getErrorMessage(err, 'Erro ao excluir etapa.'))
      }
    },
  })

  const moveLeadMutation = useMutation({
    mutationFn: ({ leadId, etapaId }: { leadId: number; etapaId: number }) => moveLead(leadId, etapaId),
    onMutate: async ({ leadId, etapaId }) => {
      await queryClient.cancelQueries({ queryKey: ['leads', user?.id] })
      const previous = queryClient.getQueryData<Lead[]>(['leads', user?.id])
      queryClient.setQueryData<Lead[]>(['leads', user?.id], (old) =>
        (old ?? []).map((l) => (l.id === leadId ? { ...l, etapa_id: etapaId } : l))
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['leads', user?.id], ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['leads', user?.id] }),
  })

  const deleteLeadMutation = useMutation({
    mutationFn: (id: number) => deleteLeads([id]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', user?.id] })
      setLeadSelecionado(null)
    },
  })

  const salvarObservacaoMutation = useMutation({
    mutationFn: ({ id, observacoes }: { id: number; observacoes: string }) => updateLead(id, { observacoes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads', user?.id] }),
  })

  const analisarMutation = useMutation({
    mutationFn: (leadId: number) => analisarLeadAgora(leadId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads', user?.id] }),
  })

  const analisarEmMassaMutation = useMutation({
    mutationFn: (leadIds: number[]) => Promise.allSettled(leadIds.map((id) => analisarLeadAgora(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', user?.id] })
      setAnaliseModalOpen(false)
      setAnaliseLeadId('')
      setAnaliseEtapaId('')
    },
  })

  function moverEtapa(index: number, direcao: -1 | 1) {
    if (!etapas) return
    const alvo = index + direcao
    if (alvo < 0 || alvo >= etapas.length) return
    const copia = [...etapas]
    const tmp = copia[index]
    copia[index] = copia[alvo]
    copia[alvo] = tmp
    reorderMutation.mutate(copia.map((e, i) => ({ id: e.id, ordem: i })))
  }

  function onDrop(etapaId: number) {
    if (dragLeadId.current == null) return
    const lead = (leads ?? []).find((l) => l.id === dragLeadId.current)
    if (lead && lead.etapa_id !== etapaId) {
      moveLeadMutation.mutate({ leadId: dragLeadId.current, etapaId })
    }
    dragLeadId.current = null
    setDragOverEtapa(null)
  }

  if (etapasLoading || leadsLoading) return <PageSpinner />

  const leadsPorEtapa = (etapaId: number) => (leads ?? []).filter((l) => l.etapa_id === etapaId)

  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex items-center justify-between shrink-0 flex-wrap gap-3">
        <p className="text-sm text-[#a1a1aa]">{leads?.length ?? 0} leads · {etapas?.length ?? 0} etapas</p>
        <div className="flex items-center gap-2">
          <Button variant="default" onClick={() => setAnaliseModalOpen(true)}>
            <Sparkles size={16} /> Rodar Análise
          </Button>
          <Button variant="default" onClick={() => setPipelineModalOpen(true)}>
            <Settings2 size={16} /> Gerenciar Pipeline
          </Button>
          <Button variant="accent" onClick={() => navigate('/leads/buscar')}>
            <Search size={16} /> Buscar Leads
          </Button>
        </div>
      </div>

      {!etapas || etapas.length === 0 ? (
        <EmptyState
          title="Nenhuma etapa no pipeline"
          description="Crie a primeira etapa para começar a organizar seus leads."
          icon={<Building2 size={40} strokeWidth={1} />}
          action={
            <Button variant="accent" onClick={() => setPipelineModalOpen(true)}>
              <Plus size={16} /> Criar primeira etapa
            </Button>
          }
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1" style={{ minHeight: 0 }}>
          {etapas.map((etapa) => {
            const cards = leadsPorEtapa(etapa.id)
            const isOver = dragOverEtapa === etapa.id
            return (
              <div
                key={etapa.id}
                className="flex flex-col gap-3 shrink-0 w-72"
                onDragOver={(e) => { e.preventDefault(); setDragOverEtapa(etapa.id) }}
                onDragLeave={() => setDragOverEtapa(null)}
                onDrop={() => onDrop(etapa.id)}
              >
                <div className="flex items-center gap-2 px-1">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: etapa.cor }} />
                  <span className="text-sm font-semibold text-[#fafafa] truncate">{etapa.nome}</span>
                  <span className="ml-auto text-xs text-[#52525b] font-medium bg-[#18181b] px-1.5 py-0.5 rounded-[6px]">
                    {cards.length}
                  </span>
                </div>

                <div
                  className={`flex flex-col gap-2 flex-1 min-h-[120px] rounded-[12px] p-2 transition-colors ${
                    isOver ? 'bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.12)]' : 'bg-[rgba(255,255,255,0.015)]'
                  }`}
                >
                  {cards.length === 0 && !isOver && (
                    <div className="flex items-center justify-center h-20 rounded-[8px] border border-dashed border-[rgba(255,255,255,0.06)]">
                      <p className="text-xs text-[#3f3f46]">Arraste aqui</p>
                    </div>
                  )}
                  {cards.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onDragStart={() => { dragLeadId.current = lead.id }}
                      onDelete={() => deleteLeadMutation.mutate(lead.id)}
                      onClick={() => { setObservacaoRascunho(lead.observacoes ?? ''); setLeadSelecionado(lead) }}
                      onAnalisar={() => analisarMutation.mutate(lead.id)}
                      analisando={analisarMutation.isPending && analisarMutation.variables === lead.id}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Histórico de buscas */}
      <div className="shrink-0 border-t border-[rgba(255,255,255,0.07)] pt-3">
        <button
          onClick={() => setHistoricoAberto((v) => !v)}
          className="flex items-center gap-2 text-sm text-[#a1a1aa] hover:text-[#fafafa] transition-colors"
        >
          <History size={14} />
          Histórico de buscas
          {historicoAberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {historicoAberto && (
          <div className="flex flex-col gap-2 mt-3">
            {(historico ?? []).length === 0 && <p className="text-xs text-[#52525b]">Nenhuma busca realizada ainda.</p>}
            {(historico ?? []).map((h) => (
              <div key={h.id} className="flex items-center gap-3 text-xs bg-[#111113] border border-[rgba(255,255,255,0.07)] rounded-[8px] px-3 py-2">
                <Badge variant={buscaStatusConfig[h.status].variant}>{buscaStatusConfig[h.status].label}</Badge>
                <span className="text-[#fafafa]">{h.termo_busca}</span>
                <span className="text-[#71717a]">em {h.localizacao}</span>
                <span className="ml-auto text-[#52525b]">
                  {h.quantidade_encontrada ?? 0}/{h.quantidade_solicitada} encontrados
                </span>
                {h.erro_mensagem && <span className="text-[#ef4444]">{h.erro_mensagem}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Gerenciar Pipeline */}
      <Modal
        open={pipelineModalOpen}
        onClose={() => { setPipelineModalOpen(false); setPipelineErro(null) }}
        title="Gerenciar Pipeline"
      >
        <div className="flex flex-col gap-4">
          {pipelineErro && <p className="text-sm text-[#ef4444]">{pipelineErro}</p>}
          <div className="flex flex-col gap-1">
            {(etapas ?? []).map((etapa, i) => (
              <div key={etapa.id} className="flex items-center gap-2 py-2 px-2 rounded-[8px] hover:bg-[#18181b]">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: etapa.cor }} />
                <input
                  defaultValue={etapa.nome}
                  onBlur={(e) => e.target.value !== etapa.nome && updateEtapa(etapa.id, { nome: e.target.value })
                    .then(() => queryClient.invalidateQueries({ queryKey: ['pipeline-etapas', user?.id] }))
                    .catch((err) => setPipelineErro(getErrorMessage(err, 'Erro ao renomear etapa.')))}
                  className="flex-1 bg-transparent text-sm text-[#fafafa] focus:outline-none focus:bg-[#111113] rounded-[6px] px-1.5 py-0.5"
                />
                <button onClick={() => moverEtapa(i, -1)} disabled={i === 0} className="p-1 text-[#71717a] hover:text-[#fafafa] disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => moverEtapa(i, 1)} disabled={i === (etapas?.length ?? 0) - 1} className="p-1 text-[#71717a] hover:text-[#fafafa] disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronDown size={14} />
                </button>
                <button
                  onClick={() => deleteEtapaMutation.mutate({ id: etapa.id })}
                  className="p-1.5 rounded-[6px] text-[#71717a] hover:text-[#ef4444] hover:bg-[#ef44441a] transition-colors"
                  title="Excluir etapa"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {(!etapas || etapas.length === 0) && <p className="text-xs text-[#52525b] px-2">Nenhuma etapa criada ainda.</p>}
          </div>

          <div className="flex flex-col gap-2 border-t border-[rgba(255,255,255,0.07)] pt-4">
            <Input
              label="Nova etapa"
              placeholder="Ex: Novo Lead, Contatado..."
              value={novaEtapaNome}
              onChange={(e) => setNovaEtapaNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && novaEtapaNome && createEtapaMutation.mutate()}
            />
            <div className="flex items-center gap-2">
              {CORES_PRESET.map((cor) => (
                <button
                  key={cor}
                  onClick={() => setNovaEtapaCor(cor)}
                  className={`w-6 h-6 rounded-full transition-transform ${novaEtapaCor === cor ? 'ring-2 ring-offset-2 ring-offset-[#111113] ring-[#fafafa] scale-105' : ''}`}
                  style={{ backgroundColor: cor }}
                />
              ))}
              <Button
                variant="accent"
                size="sm"
                className="ml-auto"
                disabled={!novaEtapaNome}
                loading={createEtapaMutation.isPending}
                onClick={() => createEtapaMutation.mutate()}
              >
                <Plus size={14} /> Adicionar
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal: confirmar exclusão de etapa com leads */}
      <Modal
        open={!!etapaParaExcluir}
        onClose={() => { setEtapaParaExcluir(null); setMoverLeadsPara('') }}
        title="Etapa com leads"
        size="sm"
        actions={
          <>
            <Button variant="ghost" onClick={() => { setEtapaParaExcluir(null); setMoverLeadsPara('') }}>Cancelar</Button>
            <Button
              variant="danger"
              disabled={!moverLeadsPara}
              loading={deleteEtapaMutation.isPending}
              onClick={() => etapaParaExcluir && deleteEtapaMutation.mutate({ id: etapaParaExcluir.id, moverPara: Number(moverLeadsPara) })}
            >
              Mover e excluir
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[#a1a1aa]">
            A etapa <span className="text-[#fafafa] font-medium">{etapaParaExcluir?.nome}</span> tem{' '}
            <span className="text-[#fafafa] font-medium">{etapaParaExcluir?.quantidadeLeads}</span> lead(s). Escolha para onde movê-los antes de excluir.
          </p>
          <Select label="Mover leads para" value={moverLeadsPara} onChange={(e) => setMoverLeadsPara(e.target.value)}>
            <option value="">Selecione</option>
            {(etapas ?? []).filter((e) => e.id !== etapaParaExcluir?.id).map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </Select>
        </div>
      </Modal>

      {/* Modal: detalhe do lead */}
      <Modal
        open={!!leadSelecionado}
        onClose={() => setLeadSelecionado(null)}
        title={leadSelecionado?.nome ?? ''}
        size="lg"
        actions={
          leadSelecionado && (
            <>
              <Button
                variant="ghost"
                onClick={() => deleteLeadMutation.mutate(leadSelecionado.id)}
                loading={deleteLeadMutation.isPending}
              >
                <Trash2 size={14} /> Remover lead
              </Button>
              <Button
                variant="accent"
                loading={salvarObservacaoMutation.isPending}
                onClick={() => salvarObservacaoMutation.mutate({ id: leadSelecionado.id, observacoes: observacaoRascunho })}
              >
                Salvar observação
              </Button>
            </>
          )
        }
      >
        {leadSelecionado && (() => {
          const leadAtual = (leads ?? []).find((l) => l.id === leadSelecionado.id) ?? leadSelecionado
          return (
            <div className="flex flex-col gap-4">
              {leadAtual.categoria && <p className="text-sm text-[#a1a1aa]">{leadAtual.categoria}</p>}

              <div className="grid sm:grid-cols-2 gap-3">
                {leadAtual.telefone && <TelefoneAcoes telefone={leadAtual.telefone} />}
                {leadAtual.site && (
                  <a
                    href={leadAtual.site.startsWith('http') ? leadAtual.site : `https://${leadAtual.site}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-[#3b82f6] bg-[#18181b] rounded-[8px] px-3 py-2 truncate hover:underline"
                  >
                    <Globe size={14} className="shrink-0" /> <span className="truncate">{leadAtual.site}</span>
                  </a>
                )}
                {leadAtual.endereco && (
                  <div className="flex items-center gap-2 text-sm text-[#fafafa] bg-[#18181b] rounded-[8px] px-3 py-2 sm:col-span-2">
                    <MapPin size={14} className="text-[#71717a] shrink-0" /> {leadAtual.endereco}
                  </div>
                )}
                {leadAtual.avaliacao != null && (
                  <div className="flex items-center gap-2 text-sm text-[#f59e0b] bg-[#18181b] rounded-[8px] px-3 py-2">
                    <Star size={14} fill="currentColor" className="shrink-0" />
                    {leadAtual.avaliacao} {leadAtual.total_avaliacoes != null && <span className="text-[#71717a]">({leadAtual.total_avaliacoes} avaliações)</span>}
                  </div>
                )}
              </div>

              <AnaliseIASection
                lead={leadAtual}
                onAnalisar={() => analisarMutation.mutate(leadAtual.id)}
                analisando={analisarMutation.isPending}
              />

              <Select
                label="Etapa"
                value={leadAtual.etapa_id}
                onChange={(e) => moveLeadMutation.mutate({ leadId: leadAtual.id, etapaId: Number(e.target.value) })}
              >
                {(etapas ?? []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </Select>

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

      {/* Modal: rodar análise em massa */}
      <Modal
        open={analiseModalOpen}
        onClose={() => setAnaliseModalOpen(false)}
        title="Rodar Análise com IA"
        size="sm"
        actions={
          <>
            <Button variant="ghost" onClick={() => setAnaliseModalOpen(false)}>Cancelar</Button>
            <Button
              variant="accent"
              loading={analisarEmMassaMutation.isPending}
              disabled={analiseModo === 'lead' ? !analiseLeadId : !analiseEtapaId}
              onClick={() => {
                const ids = analiseModo === 'lead'
                  ? [Number(analiseLeadId)]
                  : leadsPorEtapa(Number(analiseEtapaId)).map((l) => l.id)
                analisarEmMassaMutation.mutate(ids)
              }}
            >
              <Sparkles size={14} /> Rodar análise
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-1 bg-[#18181b] border border-[rgba(255,255,255,0.07)] rounded-[10px] p-1">
            <button
              onClick={() => setAnaliseModo('lead')}
              className={`flex-1 px-3 py-1.5 rounded-[8px] text-sm font-medium transition-colors ${analiseModo === 'lead' ? 'bg-[#27272a] text-[#fafafa]' : 'text-[#a1a1aa] hover:text-[#fafafa]'}`}
            >
              Um lead
            </button>
            <button
              onClick={() => setAnaliseModo('etapa')}
              className={`flex-1 px-3 py-1.5 rounded-[8px] text-sm font-medium transition-colors ${analiseModo === 'etapa' ? 'bg-[#27272a] text-[#fafafa]' : 'text-[#a1a1aa] hover:text-[#fafafa]'}`}
            >
              Coluna inteira
            </button>
          </div>

          {analiseModo === 'lead' ? (
            <Select label="Qual lead" value={analiseLeadId} onChange={(e) => setAnaliseLeadId(e.target.value)}>
              <option value="">Selecione um lead</option>
              {(leads ?? []).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </Select>
          ) : (
            <Select label="Qual coluna" value={analiseEtapaId} onChange={(e) => setAnaliseEtapaId(e.target.value)}>
              <option value="">Selecione uma etapa</option>
              {(etapas ?? []).map((e) => (
                <option key={e.id} value={e.id}>{e.nome} ({leadsPorEtapa(e.id).length} leads)</option>
              ))}
            </Select>
          )}

          {analiseModo === 'etapa' && analiseEtapaId && (
            <p className="text-xs text-[#71717a]">
              Isso dispara a análise pra {leadsPorEtapa(Number(analiseEtapaId)).length} lead(s) de uma vez — cada um consome créditos da OpenAI (e da Apify, se tiver Instagram/Facebook linkado no site).
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}

interface LeadCardProps {
  lead: Lead
  onDragStart: () => void
  onDelete: () => void
  onClick: () => void
  onAnalisar: () => void
  analisando: boolean
}

function LeadCard({ lead, onDragStart, onDelete, onClick, onAnalisar, analisando }: LeadCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="group bg-[#111113] border border-[rgba(255,255,255,0.07)] rounded-[10px] p-3.5 flex flex-col gap-2 cursor-pointer hover:border-[rgba(255,255,255,0.14)] hover:bg-[#18181b] transition-all select-none"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#fafafa] leading-snug truncate">{lead.nome}</p>
          {lead.categoria && <p className="text-xs text-[#71717a] mt-0.5 truncate">{lead.categoria}</p>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onAnalisar() }}
          disabled={analisando || lead.analise_status === 'pendente'}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-[6px] text-[#71717a] hover:text-[#22c55e] transition-all shrink-0 disabled:opacity-100 disabled:cursor-not-allowed"
          title="Analisar com IA"
        >
          <Sparkles size={13} className={analisando || lead.analise_status === 'pendente' ? 'animate-pulse text-[#f59e0b]' : ''} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-[6px] text-[#71717a] hover:text-[#ef4444] transition-all shrink-0"
          title="Remover lead"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {lead.telefone && (
          <div className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
            <Phone size={11} className="shrink-0" /> <span className="truncate">{lead.telefone}</span>
          </div>
        )}
        {lead.site && (
          <div className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
            <Globe size={11} className="shrink-0" /> <span className="truncate">{lead.site}</span>
          </div>
        )}
      </div>

      {lead.avaliacao != null && (
        <div className="flex items-center gap-1 text-[10px] font-medium text-[#f59e0b]">
          <Star size={10} fill="currentColor" />
          {lead.avaliacao} {lead.total_avaliacoes != null && <span className="text-[#71717a]">({lead.total_avaliacoes})</span>}
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {lead.origem === 'apify_google_maps' && <Badge variant="blue">Google Maps</Badge>}
        {lead.analise_status === 'pendente' && (
          <Badge variant="amber" className="flex items-center gap-1">
            <Sparkles size={10} className="animate-pulse" /> Analisando...
          </Badge>
        )}
        {lead.analise_status === 'concluida' && (
          <Badge variant="green" className="flex items-center gap-1">
            <Sparkles size={10} /> Análise pronta
          </Badge>
        )}
        {lead.analise_status === 'erro' && (
          <Badge variant="red" className="flex items-center gap-1">
            <AlertTriangle size={10} /> Falha na análise
          </Badge>
        )}
      </div>
    </div>
  )
}

// ─── Análise com IA ────────────────────────────────────────────────────────────
// Ícones de Instagram/Facebook inline: a versão do lucide-react instalada não traz
// ícones de marca (removidos do pacote deles), então desenhamos os glifos direto.

function IconeInstagram({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

function IconeFacebook({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}

function AnaliseIASection({ lead, onAnalisar, analisando }: { lead: Lead; onAnalisar: () => void; analisando: boolean }) {
  const [copiado, setCopiado] = useState(false)

  async function copiarMensagem() {
    if (!lead.analise_mensagem) return
    try {
      await navigator.clipboard.writeText(lead.analise_mensagem)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // Clipboard indisponível — ignora, sem crash.
    }
  }

  return (
    <div className="flex flex-col gap-2.5 bg-[#18181b] border border-[rgba(255,255,255,0.07)] rounded-[10px] p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[#fafafa] flex items-center gap-1.5">
          <Sparkles size={14} className="text-[#22c55e]" /> Análise com IA
        </p>
        {(lead.analise_status === 'concluida' || lead.analise_status === 'erro') && (
          <button
            onClick={onAnalisar}
            disabled={analisando}
            title="Analisar novamente"
            className="p-1 rounded-[6px] text-[#71717a] hover:text-[#fafafa] hover:bg-[#27272a] transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} className={analisando ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {(lead.instagram_url || lead.facebook_url) && (
        <div className="flex items-center gap-2 flex-wrap">
          {lead.instagram_url && (
            <a href={lead.instagram_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-[#a1a1aa] hover:text-[#fafafa] transition-colors">
              <IconeInstagram /> Instagram
            </a>
          )}
          {lead.facebook_url && (
            <a href={lead.facebook_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-[#a1a1aa] hover:text-[#fafafa] transition-colors">
              <IconeFacebook /> Facebook
            </a>
          )}
        </div>
      )}

      {!lead.analise_status && (
        <>
          <p className="text-xs text-[#71717a]">Esse lead ainda não foi analisado.</p>
          <Button variant="default" size="sm" loading={analisando} onClick={onAnalisar} className="w-fit">
            <Sparkles size={13} /> Analisar com IA
          </Button>
        </>
      )}

      {lead.analise_status === 'pendente' && (
        <p className="text-xs text-[#f59e0b] flex items-center gap-1.5">
          <span className="w-3 h-3 border-2 border-[#f59e0b] border-t-transparent rounded-full animate-spin shrink-0" />
          Lendo site e redes sociais...
        </p>
      )}

      {lead.analise_status === 'sem_site' && (
        <p className="text-xs text-[#71717a]">Sem site cadastrado — não deu pra analisar automaticamente.</p>
      )}

      {lead.analise_status === 'erro' && (
        <p className="text-xs text-[#ef4444]">{lead.analise_erro ?? 'Erro desconhecido na análise.'}</p>
      )}

      {lead.analise_status === 'concluida' && (
        <div className="flex flex-col gap-2.5">
          {lead.analise_resumo && (
            <p className="text-sm text-[#d4d4d8] whitespace-pre-line">{lead.analise_resumo}</p>
          )}
          {lead.analise_mensagem && (
            <div className="bg-[#111113] border border-[rgba(255,255,255,0.07)] rounded-[8px] p-2.5 flex items-start gap-2">
              <p className="text-sm text-[#fafafa] flex-1 whitespace-pre-line">{lead.analise_mensagem}</p>
              <button
                onClick={copiarMensagem}
                title={copiado ? 'Copiado!' : 'Copiar mensagem'}
                className="shrink-0 p-1 rounded-[6px] text-[#71717a] hover:text-[#fafafa] hover:bg-[#27272a] transition-colors"
              >
                {copiado ? <Check size={14} className="text-[#22c55e]" /> : <Copy size={14} />}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
