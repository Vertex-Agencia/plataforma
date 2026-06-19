import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ExternalLink, BookOpen, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { getEstudos, createEstudo, updateEstudoStatus, createInsight, getInsightsByEstudo } from '../../services/estudo'
import type { AreaEstudoComInsights } from '../../services/estudo'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Input, Textarea, Select } from '../../components/ui/Input'
import { PageSpinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import type { StatusLeitura, Insight } from '../../types/database'

export function EstudoArea() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<StatusLeitura | 'all'>('all')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [form, setForm] = useState({ url_link: '', titulo: '', descricao: '', categoria: '', status_leitura: 'nao_lido' as StatusLeitura })

  const { data: estudos, isLoading } = useQuery<AreaEstudoComInsights[]>({
    queryKey: ['estudos', user?.id],
    queryFn: () => getEstudos(user!.id),
    enabled: !!user,
  })

  const createMutation = useMutation({
    mutationFn: () => createEstudo({
      user_id: user!.id,
      url_link: form.url_link,
      titulo: form.titulo,
      descricao: form.descricao || null,
      categoria: form.categoria || null,
      status_leitura: form.status_leitura,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estudos'] })
      setFormOpen(false)
      setForm({ url_link: '', titulo: '', descricao: '', categoria: '', status_leitura: 'nao_lido' })
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: StatusLeitura }) => updateEstudoStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['estudos'] }),
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const categorias = [...new Set((estudos ?? []).map((e) => e.categoria).filter((c): c is string => !!c))]

  const filtered = (estudos ?? []).filter((e) => {
    const matchStatus = filterStatus === 'all' || e.status_leitura === filterStatus
    const matchCat = !filterCategoria || e.categoria === filterCategoria
    return matchStatus && matchCat
  })

  if (isLoading) return <PageSpinner />

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'nao_lido', 'lido'] as (StatusLeitura | 'all')[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-[8px] text-sm font-medium transition-colors ${filterStatus === s ? 'bg-[#22c55e] text-[#09090b]' : 'bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa]'}`}
            >
              {s === 'all' ? 'Todos' : s === 'nao_lido' ? 'Não lido' : 'Lido'}
            </button>
          ))}
          {categorias.length > 0 && (
            <select
              value={filterCategoria}
              onChange={(e) => setFilterCategoria(e.target.value)}
              className="bg-[#18181b] border border-[rgba(255,255,255,0.07)] rounded-[8px] px-3 py-1.5 text-sm text-[#fafafa] focus:outline-none"
            >
              <option value="">Todas as categorias</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
        <Button variant="accent" onClick={() => setFormOpen(true)}>
          <Plus size={16} /> Novo Link
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nenhum conteúdo" description="Salve links e artigos para estudar depois." icon={<BookOpen size={40} strokeWidth={1} />} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((e) => {
            const isExpanded = expandedId === e.id
            const insightCount = e.insights?.[0]?.count ?? 0
            return (
              <Card key={e.id} accentColor={e.status_leitura === 'lido' ? '#22c55e' : '#f59e0b'}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#fafafa] truncate">{e.titulo}</p>
                      <a href={e.url_link} target="_blank" rel="noreferrer" className="text-xs text-[#3b82f6] hover:underline flex items-center gap-1 mt-0.5" onClick={(ev) => ev.stopPropagation()}>
                        <ExternalLink size={10} /> {e.url_link}
                      </a>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {e.categoria && <Badge variant="gray">{e.categoria}</Badge>}
                      <Badge variant={e.status_leitura === 'lido' ? 'green' : 'amber'}>
                        {e.status_leitura === 'lido' ? 'Lido' : 'Não lido'}
                      </Badge>
                    </div>
                  </div>
                  {e.descricao && <p className="text-sm text-[#a1a1aa] mt-2 line-clamp-2">{e.descricao}</p>}
                  <div className="flex items-center justify-between mt-3">
                    <button
                      onClick={() => statusMutation.mutate({ id: e.id, status: e.status_leitura === 'lido' ? 'nao_lido' : 'lido' })}
                      className="text-xs text-[#a1a1aa] hover:text-[#fafafa] transition-colors"
                    >
                      {e.status_leitura === 'lido' ? 'Marcar como não lido' : 'Marcar como lido'}
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : e.id)}
                      className="flex items-center gap-1 text-xs text-[#a1a1aa] hover:text-[#fafafa] transition-colors"
                    >
                      <MessageSquare size={12} />
                      {insightCount} insight{insightCount !== 1 ? 's' : ''}
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                </div>
                {isExpanded && <InsightsPanel estudoId={e.id} userId={user!.id} />}
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Novo Link"
        actions={<><Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button><Button variant="accent" loading={createMutation.isPending} onClick={() => createMutation.mutate()}>Salvar</Button></>}>
        <div className="flex flex-col gap-4">
          <Input label="URL *" type="url" value={form.url_link} onChange={set('url_link')} placeholder="https://..." required />
          <Input label="Título *" value={form.titulo} onChange={set('titulo')} required />
          <Textarea label="Descrição" value={form.descricao} onChange={set('descricao')} rows={3} />
          <Input label="Categoria" value={form.categoria} onChange={set('categoria')} placeholder="Ex: React, IA, Marketing" />
          <Select label="Status" value={form.status_leitura} onChange={set('status_leitura')}>
            <option value="nao_lido">Não lido</option>
            <option value="lido">Lido</option>
          </Select>
        </div>
      </Modal>
    </div>
  )
}

function InsightsPanel({ estudoId, userId }: { estudoId: number; userId: string }) {
  const queryClient = useQueryClient()
  const [nota, setNota] = useState('')

  const { data: insights } = useQuery<Insight[]>({
    queryKey: ['insights', estudoId],
    queryFn: () => getInsightsByEstudo(estudoId),
  })

  const mutation = useMutation({
    mutationFn: () => createInsight({ user_id: userId, area_estudo_id: estudoId, nota_insight: nota }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights', estudoId] })
      queryClient.invalidateQueries({ queryKey: ['estudos'] })
      setNota('')
    },
  })

  return (
    <div className="border-t border-[rgba(255,255,255,0.07)] p-4 bg-[#0d0d0f]">
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="Adicionar insight ou nota..."
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && nota && mutation.mutate()}
          className="flex-1 bg-[#18181b] border border-[rgba(255,255,255,0.07)] rounded-[8px] px-3 py-1.5 text-sm text-[#fafafa] placeholder-[#52525b] focus:outline-none focus:border-[#3b82f6]"
        />
        <Button size="sm" variant="accent" onClick={() => nota && mutation.mutate()} loading={mutation.isPending}>
          <Plus size={14} />
        </Button>
      </div>
      {(insights ?? []).length === 0 ? (
        <p className="text-xs text-[#52525b]">Nenhum insight ainda.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {(insights ?? []).map((i) => (
            <p key={i.id} className="text-sm text-[#a1a1aa] bg-[#18181b] rounded-[8px] px-3 py-2">{i.nota_insight}</p>
          ))}
        </div>
      )}
    </div>
  )
}
