import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, CheckCircle, XCircle } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { getReunioes, createReuniao, updateReuniaoStatus } from '../../services/reunioes'
import type { ReuniaoComCliente } from '../../services/reunioes'
import { getClientes } from '../../services/clientes'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Input, Textarea, Select } from '../../components/ui/Input'
import { PageSpinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatDateTime } from '../../utils/format'
import type { StatusReuniao, Cliente } from '../../types/database'

const statusVariant: Record<StatusReuniao, 'blue' | 'green' | 'red'> = {
  agendada: 'blue', realizada: 'green', cancelada: 'red',
}
const statusLabel: Record<StatusReuniao, string> = {
  agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada',
}

export function Reunioes() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ titulo: '', data_hora: '', descricao_pauta: '', cliente_id: '' })

  const { data: reunioes, isLoading } = useQuery<ReuniaoComCliente[]>({
    queryKey: ['reunioes', user?.id],
    queryFn: () => getReunioes(user!.id),
    enabled: !!user,
  })

  const { data: clientes } = useQuery<Cliente[]>({
    queryKey: ['clientes', user?.id],
    queryFn: () => getClientes(user!.id),
    enabled: !!user,
  })

  const createMutation = useMutation({
    mutationFn: () => createReuniao({
      user_id: user!.id,
      titulo: form.titulo,
      data_hora: new Date(form.data_hora).toISOString(),
      descricao_pauta: form.descricao_pauta || null,
      cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
      status: 'agendada',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reunioes'] })
      setFormOpen(false)
      setForm({ titulo: '', data_hora: '', descricao_pauta: '', cliente_id: '' })
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: StatusReuniao }) => updateReuniaoStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reunioes'] }),
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  if (isLoading) return <PageSpinner />

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <Button variant="accent" onClick={() => setFormOpen(true)}>
          <Plus size={16} /> Agendar Reunião
        </Button>
      </div>

      {(reunioes ?? []).length === 0 ? (
        <EmptyState title="Nenhuma reunião" description="Agende sua primeira reunião." />
      ) : (
        <div className="flex flex-col gap-3">
          {(reunioes ?? []).map((r) => {
            const d = new Date(r.data_hora)
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="bg-[#18181b] border border-[rgba(255,255,255,0.07)] rounded-[10px] px-3 py-2 text-center min-w-[56px] shrink-0">
                    <p className="text-xl font-bold text-[#fafafa]">{d.getDate()}</p>
                    <p className="text-xs text-[#a1a1aa] uppercase">{d.toLocaleDateString('pt-BR', { month: 'short' })}</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-[#fafafa]">{r.titulo}</p>
                      <Badge variant={statusVariant[r.status]}>{statusLabel[r.status]}</Badge>
                    </div>
                    <p className="text-xs text-[#a1a1aa] mt-0.5">{formatDateTime(r.data_hora)}</p>
                    {r.clientes && <p className="text-xs text-[#a1a1aa]">{r.clientes.nome_razao_social}</p>}
                    {r.descricao_pauta && <p className="text-sm text-[#a1a1aa] mt-2">{r.descricao_pauta}</p>}
                  </div>
                  {r.status === 'agendada' && (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="accent" onClick={() => statusMutation.mutate({ id: r.id, status: 'realizada' })}>
                        <CheckCircle size={14} /> Realizada
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => statusMutation.mutate({ id: r.id, status: 'cancelada' })}>
                        <XCircle size={14} /> Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Agendar Reunião"
        actions={<><Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button><Button variant="accent" loading={createMutation.isPending} onClick={() => createMutation.mutate()}>Agendar</Button></>}>
        <div className="flex flex-col gap-4">
          <Input label="Título *" value={form.titulo} onChange={set('titulo')} required />
          <Input label="Data e Hora *" type="datetime-local" value={form.data_hora} onChange={set('data_hora')} required />
          <Select label="Cliente (opcional)" value={form.cliente_id} onChange={set('cliente_id')}>
            <option value="">Sem cliente vinculado</option>
            {(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome_razao_social}</option>)}
          </Select>
          <Textarea label="Pauta / Descrição" value={form.descricao_pauta} onChange={set('descricao_pauta')} rows={4} />
        </div>
      </Modal>
    </div>
  )
}
