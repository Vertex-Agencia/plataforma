import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, CheckSquare, Square, ArrowLeft, GripVertical, CalendarClock, Layers, Trash2 } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { getProjetos, createProjeto, createEtapa, toggleEtapa, getProjetoById, updateProjetoStatus, deleteProjeto } from '../../services/projetos'
import type { ProjetoComRelacoes } from '../../services/projetos'
import { getClientes } from '../../services/clientes'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'

import { Modal } from '../../components/ui/Modal'
import { Input, Textarea, Select } from '../../components/ui/Input'
import { PageSpinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import type { StatusProjeto, EtapaProjeto, Cliente, TipoProjeto, NivelComplexidade } from '../../types/database'

const STATUS_COLUMNS: StatusProjeto[] = ['nao_iniciado', 'em_andamento', 'concluido', 'pausado']

const statusLabel: Record<StatusProjeto, string> = {
  nao_iniciado: 'Não iniciado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  pausado: 'Pausado',
}


const tipoLabel: Record<TipoProjeto, string> = {
  website: 'Website', aplicativo: 'Aplicativo', ecommerce: 'E-commerce',
  sistema: 'Sistema', landing_page: 'Landing Page', outro: 'Outro',
}

const complexidadeConfig: Record<NivelComplexidade, { label: string; color: string }> = {
  baixo: { label: 'Baixa', color: '#22c55e' },
  medio: { label: 'Média', color: '#f59e0b' },
  alto: { label: 'Alta', color: '#ef4444' },
}

const columnAccent: Record<StatusProjeto, string> = {
  nao_iniciado: '#52525b',
  em_andamento: '#3b82f6',
  concluido: '#22c55e',
  pausado: '#f59e0b',
}

export function Projetos() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({
    nome: '',
    cliente_id: '',
    status: 'nao_iniciado' as StatusProjeto,
    tipo_projeto: '' as TipoProjeto | '',
    data_inicio: '',
    data_limite: '',
    nivel_complexidade: '' as NivelComplexidade | '',
    observacoes: '',
  })
  const [dragOverCol, setDragOverCol] = useState<StatusProjeto | null>(null)
  const dragId = useRef<number | null>(null)

  const { data: projetos, isLoading } = useQuery<ProjetoComRelacoes[]>({
    queryKey: ['projetos', user?.id],
    queryFn: () => getProjetos(user!.id),
    enabled: !!user,
  })

  const { data: clientes } = useQuery<Cliente[]>({
    queryKey: ['clientes', user?.id],
    queryFn: () => getClientes(user!.id),
    enabled: !!user,
  })

  const createMutation = useMutation({
    mutationFn: () => createProjeto({
      user_id: user!.id,
      nome: form.nome,
      cliente_id: Number(form.cliente_id),
      status: form.status,
      tipo_projeto: (form.tipo_projeto as TipoProjeto) || null,
      data_inicio: form.data_inicio || null,
      data_limite: form.data_limite || null,
      nivel_complexidade: (form.nivel_complexidade as NivelComplexidade) || null,
      observacoes: form.observacoes || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projetos'] })
      setFormOpen(false)
      setForm({ nome: '', cliente_id: '', status: 'nao_iniciado', tipo_projeto: '', data_inicio: '', data_limite: '', nivel_complexidade: '', observacoes: '' })
    },
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: StatusProjeto }) => updateProjetoStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['projetos', user?.id] })
      const previous = queryClient.getQueryData<ProjetoComRelacoes[]>(['projetos', user?.id])
      queryClient.setQueryData<ProjetoComRelacoes[]>(['projetos', user?.id], (old) =>
        (old ?? []).map((p) => (p.id === id ? { ...p, status } : p))
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['projetos', user?.id], ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['projetos', user?.id] }),
  })

  function onDragStart(projetoId: number) {
    dragId.current = projetoId
  }

  function onDrop(status: StatusProjeto) {
    if (dragId.current == null) return
    const projeto = (projetos ?? []).find((p) => p.id === dragId.current)
    if (projeto && projeto.status !== status) {
      moveMutation.mutate({ id: dragId.current, status })
    }
    dragId.current = null
    setDragOverCol(null)
  }

  if (isLoading) return <PageSpinner />

  const byStatus = (status: StatusProjeto) => (projetos ?? []).filter((p) => p.status === status)

  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex items-center justify-between shrink-0">
        <p className="text-sm text-[#a1a1aa]">{projetos?.length ?? 0} projetos</p>
        <Button variant="accent" onClick={() => setFormOpen(true)}>
          <Plus size={16} /> Novo Projeto
        </Button>
      </div>

      {/* Kanban board — horizontal scroll */}
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1" style={{ minHeight: 0 }}>
        {STATUS_COLUMNS.map((col) => {
          const cards = byStatus(col)
          const isOver = dragOverCol === col
          return (
            <div
              key={col}
              className="flex flex-col gap-3 shrink-0 w-72"
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col) }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => onDrop(col)}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-1">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: columnAccent[col] }} />
                <span className="text-sm font-semibold text-[#fafafa]">{statusLabel[col]}</span>
                <span className="ml-auto text-xs text-[#52525b] font-medium bg-[#18181b] px-1.5 py-0.5 rounded-[6px]">
                  {cards.length}
                </span>
              </div>

              {/* Drop zone */}
              <div
                className={`flex flex-col gap-2 flex-1 min-h-[120px] rounded-[12px] p-2 transition-colors ${
                  isOver
                    ? 'bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.12)]'
                    : 'bg-[rgba(255,255,255,0.015)]'
                }`}
              >
                {cards.length === 0 && !isOver && (
                  <div className="flex items-center justify-center h-20 rounded-[8px] border border-dashed border-[rgba(255,255,255,0.06)]">
                    <p className="text-xs text-[#3f3f46]">Arraste aqui</p>
                  </div>
                )}
                {cards.map((p) => (
                  <KanbanCard
                    key={p.id}
                    projeto={p}
                    onClick={() => navigate(`/projetos/${p.id}`)}
                    onDragStart={() => onDragStart(p.id)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Novo Projeto"
        actions={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button variant="accent" loading={createMutation.isPending} onClick={() => createMutation.mutate()}>Salvar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Nome do Projeto *" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
          <Select label="Cliente *" value={form.cliente_id} onChange={(e) => setForm((f) => ({ ...f, cliente_id: e.target.value }))}>
            <option value="">Selecione um cliente</option>
            {(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome_razao_social}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Tipo de Projeto" placeholder="Ex: Website, App..." value={form.tipo_projeto} onChange={(e) => setForm((f) => ({ ...f, tipo_projeto: e.target.value as TipoProjeto | '' }))} />
            <Select label="Complexidade" value={form.nivel_complexidade} onChange={(e) => setForm((f) => ({ ...f, nivel_complexidade: e.target.value as NivelComplexidade | '' }))}>
              <option value="">Selecione</option>
              <option value="baixo">Baixa</option>
              <option value="medio">Média</option>
              <option value="alto">Alta</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data de Início" type="date" value={form.data_inicio} onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))} />
            <Input label="Data Limite de Entrega" type="date" value={form.data_limite} onChange={(e) => setForm((f) => ({ ...f, data_limite: e.target.value }))} />
          </div>
          <Select label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as StatusProjeto }))}>
            <option value="nao_iniciado">Não iniciado</option>
            <option value="em_andamento">Em andamento</option>
            <option value="concluido">Concluído</option>
            <option value="pausado">Pausado</option>
          </Select>
          <Textarea label="Observações" value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} rows={2} />
        </div>
      </Modal>
    </div>
  )
}

interface KanbanCardProps {
  projeto: ProjetoComRelacoes
  onClick: () => void
  onDragStart: () => void
}

function KanbanCard({ projeto, onClick, onDragStart }: KanbanCardProps) {
  const etapas = projeto.etapas_projeto ?? []
  const total = etapas.length
  const concluidas = etapas.filter((e) => e.status === 'concluido').length
  const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0
  const complexidade = projeto.nivel_complexidade ? complexidadeConfig[projeto.nivel_complexidade] : null
  const isOverdue = projeto.data_limite && new Date(projeto.data_limite + 'T00:00:00') < new Date() && projeto.status !== 'concluido'

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="group bg-[#111113] border border-[rgba(255,255,255,0.07)] rounded-[10px] p-3.5 flex flex-col gap-3 cursor-pointer hover:border-[rgba(255,255,255,0.14)] hover:bg-[#18181b] transition-all select-none"
    >
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="text-[#3f3f46] group-hover:text-[#52525b] mt-0.5 shrink-0 transition-colors" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#fafafa] leading-snug truncate">{projeto.nome}</p>
          {projeto.clientes && (
            <p className="text-xs text-[#71717a] mt-0.5 truncate">{projeto.clientes.nome_razao_social}</p>
          )}
        </div>
      </div>

      {/* Tags: tipo + complexidade */}
      {(projeto.tipo_projeto || complexidade) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {projeto.tipo_projeto && (
            <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-[5px] bg-[#27272a] text-[#a1a1aa]">
              <Layers size={9} />
              {tipoLabel[projeto.tipo_projeto]}
            </span>
          )}
          {complexidade && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[5px]" style={{ backgroundColor: complexidade.color + '1a', color: complexidade.color }}>
              {complexidade.label}
            </span>
          )}
        </div>
      )}

      {/* Data limite */}
      {projeto.data_limite && (
        <div className={`flex items-center gap-1 text-[10px] font-medium ${isOverdue ? 'text-[#ef4444]' : 'text-[#71717a]'}`}>
          <CalendarClock size={10} />
          Entrega: {new Intl.DateTimeFormat('pt-BR').format(new Date(projeto.data_limite + 'T00:00:00'))}
          {isOverdue && <span className="ml-0.5 text-[#ef4444]">· Atrasado</span>}
        </div>
      )}

      {total > 0 && (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 bg-[#27272a] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                backgroundColor: pct === 100 ? '#22c55e' : '#3b82f6',
              }}
            />
          </div>
          <p className="text-[10px] text-[#52525b]">{concluidas}/{total} etapas</p>
        </div>
      )}
    </div>
  )
}

// ─── ProjetoPerfil ───────────────────────────────────────────────────────────

export function ProjetoPerfil() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const projetoId = Number(id)
  const [novaEtapa, setNovaEtapa] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: projeto, isLoading, isError } = useQuery<ProjetoComRelacoes>({
    queryKey: ['projeto', user?.id, projetoId],
    queryFn: () => getProjetoById(projetoId),
    enabled: !!user && !isNaN(projetoId),
  })

  const etapaMutation = useMutation({
    mutationFn: () => createEtapa({ user_id: user!.id, projeto_id: projetoId, nome: novaEtapa, status: 'pendente' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projeto', user?.id, projetoId] }); setNovaEtapa('') },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ etapaId, status }: { etapaId: number; status: 'pendente' | 'concluido' }) => toggleEtapa(etapaId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projeto', user?.id, projetoId] }),
  })

  const statusMutation = useMutation({
    mutationFn: (status: StatusProjeto) => updateProjetoStatus(projetoId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projeto', user?.id, projetoId] })
      queryClient.invalidateQueries({ queryKey: ['projetos', user?.id] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteProjeto(projetoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projetos', user?.id] })
      navigate('/projetos')
    },
  })

  if (isLoading) return <PageSpinner />
  if (isError) return (
    <div className="flex flex-col gap-3">
      <button onClick={() => navigate('/projetos')} className="flex items-center gap-2 text-[#a1a1aa] hover:text-[#fafafa] text-sm transition-colors w-fit">
        <ArrowLeft size={16} /> Voltar para Projetos
      </button>
      <p className="text-[#ef4444]">Erro ao carregar o projeto.</p>
    </div>
  )
  if (!projeto) return (
    <div className="flex flex-col gap-3">
      <button onClick={() => navigate('/projetos')} className="flex items-center gap-2 text-[#a1a1aa] hover:text-[#fafafa] text-sm transition-colors w-fit">
        <ArrowLeft size={16} /> Voltar para Projetos
      </button>
      <p className="text-[#a1a1aa]">Projeto não encontrado.</p>
    </div>
  )

  const etapas: EtapaProjeto[] = projeto.etapas_projeto ?? []
  const total = etapas.length
  const concluidas = etapas.filter((e) => e.status === 'concluido').length
  const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => navigate('/projetos')} className="flex items-center gap-2 text-[#a1a1aa] hover:text-[#fafafa] text-sm transition-colors w-fit">
        <ArrowLeft size={16} /> Voltar para Projetos
      </button>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-[#fafafa]">{projeto.nome}</h2>
            <p className="text-sm text-[#a1a1aa] mt-0.5">{projeto.clientes?.nome_razao_social ?? '—'}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status selector inline */}
            <div className="flex gap-1 bg-[#111113] border border-[rgba(255,255,255,0.07)] rounded-[10px] p-1 flex-wrap">
              {STATUS_COLUMNS.map((s) => (
                <button
                  key={s}
                  onClick={() => projeto.status !== s && statusMutation.mutate(s)}
                  disabled={statusMutation.isPending}
                  className={`px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors ${
                    projeto.status === s
                      ? 'bg-[#18181b] text-[#fafafa]'
                      : 'text-[#a1a1aa] hover:text-[#fafafa]'
                  }`}
                >
                  {statusLabel[s]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-2 rounded-[8px] text-[#71717a] hover:text-[#ef4444] hover:bg-[#ef44441a] transition-colors"
              title="Excluir projeto"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        {projeto.observacoes && <p className="text-sm text-[#a1a1aa] mt-3">{projeto.observacoes}</p>}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-[#a1a1aa] mb-1">
            <span>Progresso</span><span>{concluidas}/{total} etapas</span>
          </div>
          <div className="h-2 bg-[#27272a] rounded-full overflow-hidden">
            <div className="h-full bg-[#22c55e] rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </Card>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir projeto"
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>Excluir</Button>
          </>
        }
      >
        <p className="text-sm text-[#a1a1aa]">Tem certeza que deseja excluir o projeto <span className="text-[#fafafa] font-medium">{projeto.nome}</span>? Todas as etapas serão removidas permanentemente.</p>
      </Modal>

      <Card className="p-5">
        <p className="text-sm font-semibold text-[#fafafa] mb-4">Etapas</p>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Nome da nova etapa..."
            value={novaEtapa}
            onChange={(e) => setNovaEtapa(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && novaEtapa && etapaMutation.mutate()}
            className="flex-1 bg-[#18181b] border border-[rgba(255,255,255,0.07)] rounded-[8px] px-3 py-2 text-sm text-[#fafafa] placeholder-[#52525b] focus:outline-none focus:border-[#3b82f6]"
          />
          <Button variant="accent" size="sm" onClick={() => novaEtapa && etapaMutation.mutate()} loading={etapaMutation.isPending}>
            <Plus size={14} /> Adicionar
          </Button>
        </div>
        {etapas.length === 0 ? (
          <EmptyState title="Nenhuma etapa" description="Adicione etapas ao projeto." />
        ) : (
          <div className="flex flex-col gap-1">
            {etapas.map((e) => (
              <button
                key={e.id}
                onClick={() => toggleMutation.mutate({ etapaId: e.id, status: e.status === 'concluido' ? 'pendente' : 'concluido' })}
                className="flex items-center gap-3 py-2.5 px-2 rounded-[8px] hover:bg-[#18181b] transition-colors text-left"
              >
                {e.status === 'concluido'
                  ? <CheckSquare size={16} className="text-[#22c55e] shrink-0" />
                  : <Square size={16} className="text-[#52525b] shrink-0" />
                }
                <span className={`text-sm ${e.status === 'concluido' ? 'line-through text-[#52525b]' : 'text-[#fafafa]'}`}>{e.nome}</span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
