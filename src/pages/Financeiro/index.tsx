import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, TrendingUp, TrendingDown, ToggleLeft, ToggleRight, Users } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import {
  getEntradas, createEntrada,
  getDespesasRecorrentes, createDespesaRecorrente, toggleDespesaAtivo,
  getParcelasPagas,
} from '../../services/financeiro'
import type { ParcelaPaga } from '../../services/financeiro'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Input'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import { PageSpinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatCurrency, formatDate } from '../../utils/format'
import type { EntradaSaida, DespesaRecorrente, TipoTransacao } from '../../types/database'

type Tab = 'lancamentos' | 'despesas'
type FiltroLancamento = 'all' | 'entrada' | 'saida' | 'parcela'

export function Financeiro() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('lancamentos')
  const [modalOpen, setModalOpen] = useState(false)
  const [despesaModalOpen, setDespesaModalOpen] = useState(false)
  const [filtro, setFiltro] = useState<FiltroLancamento>('all')

  const { data: entradas, isLoading: loadingEntradas } = useQuery<EntradaSaida[]>({
    queryKey: ['entradas', user?.id],
    queryFn: () => getEntradas(user!.id),
    enabled: !!user,
  })

  const { data: parcelasPagas, isLoading: loadingParcelas } = useQuery<ParcelaPaga[]>({
    queryKey: ['parcelas-pagas', user?.id],
    queryFn: () => getParcelasPagas(user!.id),
    enabled: !!user,
  })

  const { data: despesas } = useQuery<DespesaRecorrente[]>({
    queryKey: ['despesas-recorrentes', user?.id],
    queryFn: () => getDespesasRecorrentes(user!.id),
    enabled: !!user,
  })

  useEffect(() => {
    if (!user) return
    function invalidate() {
      queryClient.invalidateQueries({ queryKey: ['entradas', user!.id] })
      queryClient.invalidateQueries({ queryKey: ['parcelas-pagas', user!.id] })
      queryClient.invalidateQueries({ queryKey: ['despesas-recorrentes', user!.id] })
    }
    const channel = supabase
      .channel('financeiro-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parcelas', filter: `user_id=eq.${user.id}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entradas_saidas', filter: `user_id=eq.${user.id}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'despesas_recorrentes', filter: `user_id=eq.${user.id}` }, invalidate)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, queryClient])

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) => toggleDespesaAtivo(id, ativo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['despesas-recorrentes', user?.id] }),
  })

  const receitaManual = (entradas ?? []).filter((e) => e.tipo === 'entrada').reduce((s, e) => s + Number(e.valor), 0)
  const receitaParcelas = (parcelasPagas ?? []).reduce((s, p) => s + p.valor_parcela, 0)
  const receita = receitaManual + receitaParcelas
  const despesasTotal = (entradas ?? []).filter((e) => e.tipo === 'saida').reduce((s, e) => s + Number(e.valor), 0)

  // Unified list sorted by date
  type ItemUnificado =
    | { kind: 'entrada'; data: EntradaSaida }
    | { kind: 'parcela'; data: ParcelaPaga }

  const itensUnificados: ItemUnificado[] = [
    ...(entradas ?? []).map((e): ItemUnificado => ({ kind: 'entrada', data: e })),
    ...(parcelasPagas ?? []).map((p): ItemUnificado => ({ kind: 'parcela', data: p })),
  ].sort((a, b) => {
    const dateA = a.kind === 'entrada' ? a.data.data_transacao : a.data.data_pagamento
    const dateB = b.kind === 'entrada' ? b.data.data_transacao : b.data.data_pagamento
    return dateB.localeCompare(dateA)
  })

  const filtered = itensUnificados.filter((item) => {
    if (filtro === 'all') return true
    if (filtro === 'parcela') return item.kind === 'parcela'
    if (filtro === 'entrada') return item.kind === 'entrada' && (item.data as EntradaSaida).tipo === 'entrada'
    if (filtro === 'saida') return item.kind === 'entrada' && (item.data as EntradaSaida).tipo === 'saida'
    return true
  })

  const isLoading = loadingEntradas || loadingParcelas
  if (isLoading) return <PageSpinner />

  return (
    <div className="flex flex-col gap-5">
      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <Card accentColor="#22c55e" className="p-5">
          <p className="text-xs text-[#a1a1aa] uppercase tracking-wider">Receita Total</p>
          <p className="text-2xl font-semibold text-[#fafafa] mt-1.5">{formatCurrency(receita)}</p>
          <div className="mt-2 flex flex-col gap-0.5">
            <p className="text-[11px] text-[#71717a]">Parcelas recebidas: <span className="text-[#a1a1aa]">{formatCurrency(receitaParcelas)}</span></p>
            <p className="text-[11px] text-[#71717a]">Lançamentos manuais: <span className="text-[#a1a1aa]">{formatCurrency(receitaManual)}</span></p>
          </div>
        </Card>
        <Card accentColor="#ef4444" className="p-5">
          <p className="text-xs text-[#a1a1aa] uppercase tracking-wider">Despesas</p>
          <p className="text-2xl font-semibold text-[#fafafa] mt-1.5">{formatCurrency(despesasTotal)}</p>
        </Card>
        <Card accentColor="#3b82f6" className="p-5">
          <p className="text-xs text-[#a1a1aa] uppercase tracking-wider">Lucro Líquido</p>
          <p className={`text-2xl font-semibold mt-1.5 ${receita - despesasTotal >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {formatCurrency(receita - despesasTotal)}
          </p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-[#111113] border border-[rgba(255,255,255,0.07)] rounded-[10px] p-1">
          {(['lancamentos', 'despesas'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-[8px] text-sm font-medium transition-colors ${tab === t ? 'bg-[#18181b] text-[#fafafa]' : 'text-[#a1a1aa] hover:text-[#fafafa]'}`}
            >
              {t === 'lancamentos' ? 'Lançamentos' : 'Despesas Recorrentes'}
            </button>
          ))}
        </div>
        <Button variant="accent" onClick={() => tab === 'lancamentos' ? setModalOpen(true) : setDespesaModalOpen(true)}>
          <Plus size={16} /> Novo {tab === 'lancamentos' ? 'Lançamento' : 'Despesa'}
        </Button>
      </div>

      {tab === 'lancamentos' ? (
        <Card>
          <div className="p-4 border-b border-[rgba(255,255,255,0.07)]">
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as FiltroLancamento)}
              className="bg-[#18181b] border border-[rgba(255,255,255,0.07)] rounded-[8px] px-3 py-1.5 text-sm text-[#fafafa] focus:outline-none"
            >
              <option value="all">Todos</option>
              <option value="parcela">Recebimentos de clientes</option>
              <option value="entrada">Entradas manuais</option>
              <option value="saida">Saídas</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="Nenhum lançamento" description="Registre uma entrada ou saída." />
          ) : (
            <Table>
              <Thead>
                <tr><Th>Descrição</Th><Th>Tipo</Th><Th>Data</Th><Th>NF</Th><Th>Valor</Th></tr>
              </Thead>
              <Tbody>
                {filtered.map((item, i) => {
                  if (item.kind === 'parcela') {
                    const p = item.data as ParcelaPaga
                    return (
                      <Tr key={`p-${p.id}`}>
                        <Td>
                          <div className="flex items-center gap-2">
                            <Users size={13} className="text-[#a78bfa] shrink-0" />
                            <div>
                              <p className="text-sm text-[#fafafa]">{p.cliente_nome}</p>
                              <p className="text-xs text-[#71717a]">Parcela {p.numero_parcela}/{p.total_parcelas}</p>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1.5">
                            <TrendingUp size={14} className="text-[#22c55e]" />
                            <Badge variant="purple">Recebimento</Badge>
                          </div>
                        </Td>
                        <Td>{formatDate(p.data_pagamento)}</Td>
                        <Td><Badge variant="gray">—</Badge></Td>
                        <Td className="font-medium text-[#22c55e]">+{formatCurrency(p.valor_parcela)}</Td>
                      </Tr>
                    )
                  }

                  const e = item.data as EntradaSaida
                  return (
                    <Tr key={`e-${e.id}-${i}`}>
                      <Td>{e.descricao}</Td>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          {e.tipo === 'entrada' ? <TrendingUp size={14} className="text-[#22c55e]" /> : <TrendingDown size={14} className="text-[#ef4444]" />}
                          <Badge variant={e.tipo === 'entrada' ? 'green' : 'red'}>{e.tipo === 'entrada' ? 'Entrada' : 'Saída'}</Badge>
                        </div>
                      </Td>
                      <Td>{formatDate(e.data_transacao)}</Td>
                      <Td>{e.emitido_nota_fiscal ? <Badge variant="green">Sim</Badge> : <Badge variant="gray">Não</Badge>}</Td>
                      <Td className={`font-medium ${e.tipo === 'entrada' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                        {e.tipo === 'entrada' ? '+' : '-'}{formatCurrency(Number(e.valor))}
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          )}
        </Card>
      ) : (
        <Card>
          {(despesas ?? []).length === 0 ? (
            <EmptyState title="Nenhuma despesa recorrente" description="Cadastre suas despesas fixas." />
          ) : (
            <Table>
              <Thead>
                <tr><Th>Nome</Th><Th>Valor</Th><Th>Periodicidade</Th><Th>Início</Th><Th>Status</Th><Th>{''}</Th></tr>
              </Thead>
              <Tbody>
                {(despesas ?? []).map((d) => (
                  <Tr key={d.id}>
                    <Td>{d.nome}</Td>
                    <Td className="font-medium">{formatCurrency(Number(d.valor))}</Td>
                    <Td className="capitalize">{d.periodicidade}</Td>
                    <Td>{formatDate(d.data_inicio)}</Td>
                    <Td><Badge variant={d.ativo ? 'green' : 'gray'}>{d.ativo ? 'Ativa' : 'Pausada'}</Badge></Td>
                    <Td>
                      <button onClick={() => toggleMutation.mutate({ id: d.id, ativo: !d.ativo })} className="text-[#a1a1aa] hover:text-[#fafafa] transition-colors">
                        {d.ativo ? <ToggleRight size={20} className="text-[#22c55e]" /> : <ToggleLeft size={20} />}
                      </button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Card>
      )}

      <LancamentoModal open={modalOpen} onClose={() => setModalOpen(false)} userId={user!.id} />
      <DespesaModal open={despesaModalOpen} onClose={() => setDespesaModalOpen(false)} userId={user!.id} />
    </div>
  )
}

function LancamentoModal({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [form, setForm] = useState({ descricao: '', valor: '', tipo: 'entrada' as TipoTransacao, data_transacao: new Date().toISOString().split('T')[0], emitido_nota_fiscal: false })
  const mutation = useMutation({
    mutationFn: () => createEntrada({ user_id: userId, descricao: form.descricao, valor: Number(form.valor), tipo: form.tipo, data_transacao: form.data_transacao, emitido_nota_fiscal: form.emitido_nota_fiscal, cliente_id: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entradas', user?.id] })
      onClose()
    },
  })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  return (
    <Modal open={open} onClose={onClose} title="Novo Lançamento"
      actions={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="accent" loading={mutation.isPending} onClick={() => mutation.mutate()}>Salvar</Button></>}>
      <div className="flex flex-col gap-4">
        <Input label="Descrição *" value={form.descricao} onChange={set('descricao')} required />
        <Input label="Valor (R$) *" type="number" step="0.01" min="0" value={form.valor} onChange={set('valor')} required />
        <Select label="Tipo *" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoTransacao }))}>
          <option value="entrada">Entrada</option>
          <option value="saida">Saída</option>
        </Select>
        <Input label="Data *" type="date" value={form.data_transacao} onChange={set('data_transacao')} />
        <label className="flex items-center gap-2 text-sm text-[#a1a1aa] cursor-pointer">
          <input type="checkbox" checked={form.emitido_nota_fiscal} onChange={(e) => setForm((f) => ({ ...f, emitido_nota_fiscal: e.target.checked }))} className="rounded" />
          Nota fiscal emitida
        </label>
      </div>
    </Modal>
  )
}

function DespesaModal({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [form, setForm] = useState({ nome: '', valor: '', periodicidade: 'mensal', data_inicio: new Date().toISOString().split('T')[0] })
  const mutation = useMutation({
    mutationFn: () => createDespesaRecorrente({ user_id: userId, nome: form.nome, valor: Number(form.valor), periodicidade: form.periodicidade as 'mensal', data_inicio: form.data_inicio, ativo: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['despesas-recorrentes', user?.id] })
      onClose()
    },
  })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  return (
    <Modal open={open} onClose={onClose} title="Nova Despesa Recorrente"
      actions={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="accent" loading={mutation.isPending} onClick={() => mutation.mutate()}>Salvar</Button></>}>
      <div className="flex flex-col gap-4">
        <Input label="Nome *" value={form.nome} onChange={set('nome')} required />
        <Input label="Valor (R$) *" type="number" step="0.01" min="0" value={form.valor} onChange={set('valor')} required />
        <Select label="Periodicidade *" value={form.periodicidade} onChange={(e) => setForm((f) => ({ ...f, periodicidade: e.target.value }))}>
          <option value="semanal">Semanal</option>
          <option value="mensal">Mensal</option>
          <option value="trimestral">Trimestral</option>
          <option value="anual">Anual</option>
        </Select>
        <Input label="Data de Início *" type="date" value={form.data_inicio} onChange={set('data_inicio')} />
      </div>
    </Modal>
  )
}
