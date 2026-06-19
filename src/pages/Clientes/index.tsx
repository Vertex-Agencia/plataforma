import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, LayoutList, LayoutGrid, Trash2, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { getClientes, deleteClientes } from '../../services/clientes'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Avatar } from '../../components/ui/Avatar'
import { Modal } from '../../components/ui/Modal'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import { PageSpinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { ClienteForm } from './ClienteForm'
import { formatCurrency } from '../../utils/format'
import type { StatusCliente, TipoServico, Cliente } from '../../types/database'

const statusVariant: Record<StatusCliente, 'green' | 'amber' | 'gray'> = {
  ativo: 'green', aguardando: 'amber', inativo: 'gray',
}
const statusLabel: Record<StatusCliente, string> = {
  ativo: 'Ativo', aguardando: 'Aguardando', inativo: 'Inativo',
}
const tipoLabel: Record<TipoServico, string> = {
  implementacao: 'Implementação', manutencao: 'Manutenção',
}

type ViewMode = 'list' | 'grid'

export function Clientes() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<StatusCliente | 'all'>('all')
  const [filterTipo, setFilterTipo] = useState<TipoServico | 'all'>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const { data: clientes, isLoading } = useQuery<Cliente[]>({
    queryKey: ['clientes', user?.id],
    queryFn: () => getClientes(user!.id),
    enabled: !!user,
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteClientes(Array.from(selected)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics', user?.id] })
      setSelected(new Set())
      setDeleteOpen(false)
      setConfirmText('')
    },
  })

  const filtered = (clientes ?? []).filter((c) => {
    const matchSearch = c.nome_razao_social.toLowerCase().includes(search.toLowerCase()) ||
      (c.email_contato ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    const matchTipo = filterTipo === 'all' || c.tipo_servico === filterTipo
    return matchSearch && matchStatus && matchTipo
  })

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((c) => c.id)))
    }
  }

  function openDelete() {
    setConfirmText('')
    setDeleteOpen(true)
  }

  const allSelected = filtered.length > 0 && selected.size === filtered.length
  const someSelected = selected.size > 0

  if (isLoading) return <PageSpinner />

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#a1a1aa]">{clientes?.length ?? 0} clientes cadastrados</p>
        <div className="flex items-center gap-2">
          {someSelected && (
            <Button variant="ghost" onClick={openDelete} className="text-[#ef4444] hover:text-[#ef4444] hover:bg-[#ef4444]/10 border border-[#ef4444]/20">
              <Trash2 size={15} />
              Excluir {selected.size > 1 ? `${selected.size} clientes` : '1 cliente'}
            </Button>
          )}
          <Button variant="accent" onClick={() => setFormOpen(true)}>
            <Plus size={16} /> Novo Cliente
          </Button>
        </div>
      </div>

      {/* Filters + View Toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b]" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#18181b] border border-[rgba(255,255,255,0.07)] rounded-[8px] pl-8 pr-3 py-2 text-sm text-[#fafafa] placeholder-[#52525b] focus:outline-none focus:border-[#3b82f6]"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as StatusCliente | 'all')}
          className="bg-[#18181b] border border-[rgba(255,255,255,0.07)] rounded-[8px] px-3 py-2 text-sm text-[#fafafa] focus:outline-none"
        >
          <option value="all">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="aguardando">Aguardando</option>
          <option value="inativo">Inativo</option>
        </select>
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value as TipoServico | 'all')}
          className="bg-[#18181b] border border-[rgba(255,255,255,0.07)] rounded-[8px] px-3 py-2 text-sm text-[#fafafa] focus:outline-none"
        >
          <option value="all">Todos os tipos</option>
          <option value="implementacao">Implementação</option>
          <option value="manutencao">Manutenção</option>
        </select>

        {/* View toggle */}
        <div className="ml-auto flex items-center gap-1 bg-[#18181b] border border-[rgba(255,255,255,0.07)] rounded-[8px] p-1">
          <button
            onClick={() => setViewMode('list')}
            title="Visualização em lista"
            className={`p-1.5 rounded-[6px] transition-colors ${viewMode === 'list' ? 'bg-[#27272a] text-[#fafafa]' : 'text-[#52525b] hover:text-[#a1a1aa]'}`}
          >
            <LayoutList size={16} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            title="Visualização em grade"
            className={`p-1.5 rounded-[6px] transition-colors ${viewMode === 'grid' ? 'bg-[#27272a] text-[#fafafa]' : 'text-[#52525b] hover:text-[#a1a1aa]'}`}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState title="Nenhum cliente encontrado" description="Cadastre seu primeiro cliente clicando em Novo Cliente." />
        </Card>
      ) : viewMode === 'list' ? (
        <ListView
          clientes={filtered}
          selected={selected}
          allSelected={allSelected}
          onSelect={toggleSelect}
          onSelectAll={toggleSelectAll}
          onNavigate={(id) => navigate(`/clientes/${id}`)}
        />
      ) : (
        <GridView
          clientes={filtered}
          selected={selected}
          onSelect={toggleSelect}
          onNavigate={(id) => navigate(`/clientes/${id}`)}
        />
      )}

      <ClienteForm open={formOpen} onClose={() => setFormOpen(false)} />

      {/* Delete confirmation modal */}
      <Modal
        open={deleteOpen}
        onClose={() => { setDeleteOpen(false); setConfirmText('') }}
        title="Excluir clientes"
        actions={
          <>
            <Button variant="ghost" onClick={() => { setDeleteOpen(false); setConfirmText('') }}>
              Cancelar
            </Button>
            <Button
              variant="ghost"
              loading={deleteMutation.isPending}
              disabled={confirmText !== 'EXCLUIR'}
              onClick={() => deleteMutation.mutate()}
              className="text-[#ef4444] hover:text-[#ef4444] hover:bg-[#ef4444]/10 border border-[#ef4444]/20 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 size={15} /> Excluir definitivamente
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-[10px] p-4">
            <AlertTriangle size={18} className="text-[#ef4444] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#ef4444]">
                {selected.size === 1 ? 'Este cliente será excluído permanentemente.' : `${selected.size} clientes serão excluídos permanentemente.`}
              </p>
              <p className="text-xs text-[#a1a1aa] mt-1">
                Todas as parcelas e registros de manutenção vinculados também serão removidos. Esta ação não pode ser desfeita.
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-[#a1a1aa] mb-2">
              Digite <span className="font-semibold text-[#fafafa]">EXCLUIR</span> para confirmar:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="EXCLUIR"
              autoFocus
              className="w-full bg-[#18181b] border border-[rgba(255,255,255,0.07)] rounded-[8px] px-3 py-2 text-sm text-[#fafafa] placeholder-[#3f3f46] focus:outline-none focus:border-[#ef4444] transition-colors"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── ListView ────────────────────────────────────────────────────────────────

interface ListViewProps {
  clientes: Cliente[]
  selected: Set<number>
  allSelected: boolean
  onSelect: (id: number) => void
  onSelectAll: () => void
  onNavigate: (id: number) => void
}

function ListView({ clientes, selected, allSelected, onSelect, onSelectAll, onNavigate }: ListViewProps) {
  return (
    <Card>
      <Table>
        <Thead>
          <tr>
            <Th className="w-10">
              <Checkbox checked={allSelected} indeterminate={selected.size > 0 && !allSelected} onChange={onSelectAll} />
            </Th>
            <Th>Cliente</Th>
            <Th>Serviço</Th>
            <Th>Status</Th>
            <Th>Pagamento</Th>
            <Th>Valor Total</Th>
          </tr>
        </Thead>
        <Tbody>
          {clientes.map((c) => (
            <Tr key={c.id} onClick={() => onNavigate(c.id)} className={selected.has(c.id) ? 'bg-[#18181b]' : ''}>
              <Td onClick={(e) => { e.stopPropagation(); onSelect(c.id) }} className="w-10">
                <Checkbox checked={selected.has(c.id)} onChange={() => onSelect(c.id)} />
              </Td>
              <Td>
                <div className="flex items-center gap-3">
                  <Avatar name={c.nome_razao_social} size="sm" />
                  <div>
                    <p className="font-medium">{c.nome_razao_social}</p>
                    {c.email_contato && <p className="text-xs text-[#a1a1aa]">{c.email_contato}</p>}
                  </div>
                </div>
              </Td>
              <Td>
                <Badge variant={c.tipo_servico === 'implementacao' ? 'blue' : 'purple'}>
                  {tipoLabel[c.tipo_servico]}
                </Badge>
              </Td>
              <Td><Badge variant={statusVariant[c.status]}>{statusLabel[c.status]}</Badge></Td>
              <Td className="capitalize">{c.forma_pagamento}</Td>
              <Td className="font-medium">{formatCurrency(Number(c.valor_total_acordado))}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Card>
  )
}

// ─── GridView ────────────────────────────────────────────────────────────────

interface GridViewProps {
  clientes: Cliente[]
  selected: Set<number>
  onSelect: (id: number) => void
  onNavigate: (id: number) => void
}

function GridView({ clientes, selected, onSelect, onNavigate }: GridViewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {clientes.map((c) => {
        const isSelected = selected.has(c.id)
        return (
          <Card
            key={c.id}
            onClick={() => onNavigate(c.id)}
            accentColor={c.status === 'ativo' ? '#22c55e' : c.status === 'aguardando' ? '#f59e0b' : '#52525b'}
            className={`p-5 flex flex-col gap-4 relative transition-all ${isSelected ? 'ring-2 ring-[#ef4444]/60 bg-[#18181b]' : ''}`}
          >
            {/* Checkbox overlay */}
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(c.id) }}
              className="absolute top-3 right-3 z-10"
            >
              <Checkbox checked={isSelected} onChange={() => onSelect(c.id)} />
            </button>

            <div className="flex items-start gap-3 pr-6">
              <Avatar name={c.nome_razao_social} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#fafafa] truncate">{c.nome_razao_social}</p>
                {c.email_contato && <p className="text-xs text-[#a1a1aa] truncate mt-0.5">{c.email_contato}</p>}
                {c.telefone_contato && <p className="text-xs text-[#71717a] truncate">{c.telefone_contato}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={statusVariant[c.status]}>{statusLabel[c.status]}</Badge>
              <Badge variant={c.tipo_servico === 'implementacao' ? 'blue' : 'purple'}>
                {tipoLabel[c.tipo_servico]}
              </Badge>
            </div>

            <div className="border-t border-[rgba(255,255,255,0.07)] pt-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#71717a] uppercase tracking-wider">Valor total</p>
                <p className="text-base font-semibold text-[#fafafa] mt-0.5">
                  {formatCurrency(Number(c.valor_total_acordado))}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#71717a] uppercase tracking-wider">Pagamento</p>
                <p className="text-sm text-[#a1a1aa] mt-0.5 capitalize">{c.forma_pagamento}</p>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ─── Checkbox ────────────────────────────────────────────────────────────────

function Checkbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate?: boolean; onChange: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange() }}
      className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all shrink-0 ${
        checked || indeterminate
          ? 'bg-[#ef4444] border-[#ef4444]'
          : 'border-[rgba(255,255,255,0.2)] hover:border-[rgba(255,255,255,0.4)]'
      }`}
    >
      {indeterminate && !checked && (
        <span className="w-2 h-0.5 bg-white rounded-full block" />
      )}
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}
