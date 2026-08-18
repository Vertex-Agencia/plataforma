import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, Upload, CheckCircle, RotateCcw, Pencil } from 'lucide-react'
import {
  getClienteById,
  getParcelasByCliente,
  registrarPagamentoParcela,
  reverterParcelaPendente,
  editarParcelaPendente,
  uploadContrato,
  getManutencaoByCliente,
} from '../../services/clientes'
import { useAuthStore } from '../../store/authStore'
import { useValoresOcultosStore } from '../../store/valoresOcultosStore'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { PageSpinner } from '../../components/ui/Spinner'
import { formatCurrency, formatDate } from '../../utils/format'
import type { StatusCliente, TipoServico, StatusParcela, Cliente, Parcela, ManutencaoRecorrente } from '../../types/database'

const statusVariant: Record<StatusCliente, 'green' | 'amber' | 'gray'> = {
  ativo: 'green', aguardando: 'amber', inativo: 'gray',
}
const tipoLabel: Record<TipoServico, string> = {
  implementacao: 'Implementação', manutencao: 'Manutenção',
}
const parcelaVariant: Record<StatusParcela, 'green' | 'amber'> = {
  pago: 'green', pendente: 'amber',
}

export function ClientePerfil() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const clienteId = Number(id)

  const [pagandoParcela, setPagandoParcela] = useState<Parcela | null>(null)
  const [valorDigitado, setValorDigitado] = useState('')
  const [dataPagamentoDigitada, setDataPagamentoDigitada] = useState('')
  const [revertendoId, setRevertendoId] = useState<number | null>(null)

  // Editar uma parcela ainda pendente (valor e/ou vencimento) sem marcá-la como paga.
  const [editandoParcela, setEditandoParcela] = useState<Parcela | null>(null)
  const [valorEditado, setValorEditado] = useState('')
  const [vencimentoEditado, setVencimentoEditado] = useState('')
  const [recalcularDemais, setRecalcularDemais] = useState(false)

  // Preferência global de ocultar valores (compartilhada com Dashboard e Financeiro via
  // useValoresOcultosStore, alternada pelo olho na barra superior).
  const { ocultos: valoresOcultos } = useValoresOcultosStore()

  function exibir(valor: number): string {
    return valoresOcultos ? '••••••' : formatCurrency(valor)
  }

  const { data: cliente, isLoading, isError } = useQuery<Cliente>({
    queryKey: ['cliente', user?.id, clienteId],
    queryFn: () => getClienteById(clienteId),
    enabled: !!user && !isNaN(clienteId),
  })

  const { data: parcelas } = useQuery<Parcela[]>({
    queryKey: ['parcelas', user?.id, clienteId],
    queryFn: () => getParcelasByCliente(clienteId),
    enabled: !!user && !isNaN(clienteId),
  })

  const { data: manutencao } = useQuery<ManutencaoRecorrente | null>({
    queryKey: ['manutencao', user?.id, clienteId],
    queryFn: () => getManutencaoByCliente(clienteId),
    enabled: !!user && !isNaN(clienteId),
  })

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['parcelas', user?.id, clienteId] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-metrics', user?.id] })
  }

  const pagarMutation = useMutation({
    mutationFn: () => {
      const valor = parseFloat(valorDigitado.replace(',', '.'))
      return registrarPagamentoParcela(
        pagandoParcela!.id,
        valor,
        parcelas ?? [],
        Number(cliente!.valor_total_acordado),
        dataPagamentoDigitada ? new Date(`${dataPagamentoDigitada}T12:00:00`).toISOString() : undefined
      )
    },
    onSuccess: () => {
      invalidar()
      setPagandoParcela(null)
      setValorDigitado('')
      setDataPagamentoDigitada('')
    },
  })

  const reverterMutation = useMutation({
    mutationFn: (parcelaId: number) => reverterParcelaPendente(parcelaId),
    onSuccess: () => {
      invalidar()
      setRevertendoId(null)
    },
  })

  const editarParcelaMutation = useMutation({
    mutationFn: () => {
      const valor = parseFloat(valorEditado.replace(',', '.'))
      return editarParcelaPendente(
        editandoParcela!.id,
        valor,
        vencimentoEditado,
        recalcularDemais,
        parcelas ?? [],
        Number(cliente!.valor_total_acordado)
      )
    },
    onSuccess: () => {
      invalidar()
      setEditandoParcela(null)
      setValorEditado('')
      setVencimentoEditado('')
      setRecalcularDemais(false)
    },
  })

  function abrirModalEdicao(parcela: Parcela) {
    setEditandoParcela(parcela)
    setValorEditado(Number(parcela.valor_parcela).toFixed(2).replace('.', ','))
    setVencimentoEditado(parcela.data_vencimento.split('T')[0])
    setRecalcularDemais(false)
  }

  function valorEditadoValido() {
    const v = parseFloat(valorEditado.replace(',', '.'))
    return !isNaN(v) && v > 0 && !!vencimentoEditado
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadContrato(clienteId, user!.id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cliente', user?.id, clienteId] }),
  })

  function abrirModalPagamento(parcela: Parcela) {
    setPagandoParcela(parcela)
    setValorDigitado(Number(parcela.valor_parcela).toFixed(2).replace('.', ','))
    setDataPagamentoDigitada(parcela.data_pagamento ? parcela.data_pagamento.split('T')[0] : new Date().toISOString().split('T')[0])
  }

  function valorValido() {
    const v = parseFloat(valorDigitado.replace(',', '.'))
    return !isNaN(v) && v > 0
  }

  if (isLoading) return <PageSpinner />
  if (isError) return (
    <div className="flex flex-col gap-3">
      <button onClick={() => navigate('/clientes')} className="flex items-center gap-2 text-[#a1a1aa] hover:text-[#fafafa] text-sm transition-colors w-fit">
        <ArrowLeft size={16} /> Voltar para Clientes
      </button>
      <p className="text-[#ef4444]">Erro ao carregar o perfil do cliente.</p>
    </div>
  )
  if (!cliente) return (
    <div className="flex flex-col gap-3">
      <button onClick={() => navigate('/clientes')} className="flex items-center gap-2 text-[#a1a1aa] hover:text-[#fafafa] text-sm transition-colors w-fit">
        <ArrowLeft size={16} /> Voltar para Clientes
      </button>
      <p className="text-[#a1a1aa]">Cliente não encontrado.</p>
    </div>
  )

  const totalPago = (parcelas ?? []).filter((p) => p.status === 'pago').reduce((s, p) => s + Number(p.valor_parcela), 0)
  const totalPendente = (parcelas ?? []).filter((p) => p.status === 'pendente').reduce((s, p) => s + Number(p.valor_parcela), 0)

  const valorPagamento = parseFloat(valorDigitado.replace(',', '.'))
  const valorOriginal = pagandoParcela ? Number(pagandoParcela.valor_parcela) : 0
  const temDiferenca = valorValido() && Math.abs(valorPagamento - valorOriginal) > 0.001
  const pendentesRestantes = (parcelas ?? []).filter(
    (p) => p.status === 'pendente' && p.id !== pagandoParcela?.id
  ).length

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => navigate('/clientes')} className="flex items-center gap-2 text-[#a1a1aa] hover:text-[#fafafa] text-sm transition-colors w-fit">
        <ArrowLeft size={16} /> Voltar para Clientes
      </button>

      {/* Header */}
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <Avatar name={cliente.nome_razao_social} size="lg" />
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-semibold text-[#fafafa]">{cliente.nome_razao_social}</h2>
              <Badge variant={statusVariant[cliente.status]}>{cliente.status}</Badge>
              <Badge variant={cliente.tipo_servico === 'implementacao' ? 'blue' : 'purple'}>
                {tipoLabel[cliente.tipo_servico]}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#a1a1aa]">
              {cliente.email_contato && <span>{cliente.email_contato}</span>}
              {cliente.telefone_contato && <span>{cliente.telefone_contato}</span>}
              <span>Pagamento: {cliente.forma_pagamento}</span>
              <span>Desde {formatDate(cliente.created_at)}</span>
            </div>
            {cliente.observacao && <p className="mt-2 text-sm text-[#a1a1aa]">{cliente.observacao}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-semibold text-[#fafafa]">{exibir(Number(cliente.valor_total_acordado))}</p>
            <p className="text-xs text-[#a1a1aa]">valor total</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-[rgba(255,255,255,0.07)]">
          <div>
            <p className="text-xs text-[#a1a1aa] uppercase tracking-wider">Pago</p>
            <p className="text-lg font-semibold text-[#22c55e] mt-0.5">{exibir(totalPago)}</p>
          </div>
          <div>
            <p className="text-xs text-[#a1a1aa] uppercase tracking-wider">Pendente</p>
            <p className="text-lg font-semibold text-[#f59e0b] mt-0.5">{exibir(totalPendente)}</p>
          </div>
          <div>
            <p className="text-xs text-[#a1a1aa] uppercase tracking-wider">Parcelas</p>
            <p className="text-lg font-semibold text-[#fafafa] mt-0.5">{(parcelas ?? []).filter((p) => p.status === 'pago').length}/{parcelas?.length ?? 0}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Parcelas */}
        <Card className="xl:col-span-2 p-5">
          <p className="text-sm font-semibold text-[#fafafa] mb-4">Parcelas</p>
          <div className="flex flex-col gap-2">
            {(parcelas ?? []).map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                <div className="w-8 h-8 rounded-full bg-[#27272a] flex items-center justify-center text-xs font-medium text-[#a1a1aa] shrink-0">
                  {p.numero_parcela}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-[#fafafa]">{exibir(Number(p.valor_parcela))}</p>
                  <p className="text-xs text-[#a1a1aa]">
                    Vence {formatDate(p.data_vencimento)}
                    {p.data_pagamento && ` · Pago em ${formatDate(p.data_pagamento)}`}
                  </p>
                </div>
                <Badge variant={parcelaVariant[p.status]}>{p.status}</Badge>
                {p.status === 'pendente' ? (
                  <>
                    <button
                      title="Editar valor/vencimento"
                      onClick={() => abrirModalEdicao(p)}
                      className="p-1.5 rounded-[6px] text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#27272a] transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <Button
                      size="sm"
                      variant="accent"
                      onClick={() => abrirModalPagamento(p)}
                    >
                      <CheckCircle size={14} /> Pago
                    </Button>
                  </>
                ) : (
                  <button
                    title="Reverter para pendente"
                    onClick={() => setRevertendoId(p.id)}
                    className="p-1.5 rounded-[6px] text-[#52525b] hover:text-[#f59e0b] hover:bg-[#f59e0b1a] transition-colors"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <p className="text-sm font-semibold text-[#fafafa] mb-3">Contrato</p>
            {cliente.contrato_url ? (
              <a href={cliente.contrato_url} target="_blank" rel="noreferrer">
                <Button size="sm" className="w-full justify-center">
                  <Download size={14} /> Download
                </Button>
              </a>
            ) : (
              <p className="text-sm text-[#a1a1aa] mb-3">Nenhum contrato anexado.</p>
            )}
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) uploadMutation.mutate(file)
            }} />
            <Button size="sm" variant="ghost" loading={uploadMutation.isPending} className="w-full justify-center mt-2" onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> {cliente.contrato_url ? 'Substituir' : 'Anexar contrato'}
            </Button>
          </Card>

          {manutencao && (
            <Card className="p-5" accentColor="#a78bfa">
              <p className="text-sm font-semibold text-[#fafafa] mb-3">Manutenção Recorrente</p>
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#a1a1aa]">Valor mensal</span>
                  <span className="text-[#fafafa]">{exibir(Number(manutencao.valor_mensal_acordado))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a1a1aa]">Início</span>
                  <span className="text-[#fafafa]">{formatDate(manutencao.data_inicio_contrato)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a1a1aa]">Próx. vencimento</span>
                  <span className="text-[#fafafa]">{formatDate(manutencao.data_vencimento_atual)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a1a1aa]">Status</span>
                  <Badge variant={manutencao.status === 'ativo' ? 'green' : 'gray'}>{manutencao.status}</Badge>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Modal: registrar pagamento */}
      <Modal
        open={!!pagandoParcela}
        onClose={() => { setPagandoParcela(null); setValorDigitado(''); setDataPagamentoDigitada('') }}
        title={`Parcela ${pagandoParcela?.numero_parcela} — Registrar pagamento`}
        actions={
          <>
            <Button variant="ghost" onClick={() => { setPagandoParcela(null); setValorDigitado(''); setDataPagamentoDigitada('') }}>Cancelar</Button>
            <Button
              variant="accent"
              loading={pagarMutation.isPending}
              onClick={() => pagarMutation.mutate()}
              disabled={!valorValido()}
            >
              <CheckCircle size={14} /> Confirmar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex justify-between text-sm">
            <span className="text-[#a1a1aa]">Valor da parcela</span>
            <span className="text-[#fafafa] font-medium">{formatCurrency(valorOriginal)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Valor recebido (R$)"
              value={valorDigitado}
              onChange={(e) => setValorDigitado(e.target.value)}
              placeholder="0,00"
              autoFocus
            />
            <Input
              label="Data do pagamento"
              type="date"
              value={dataPagamentoDigitada}
              onChange={(e) => setDataPagamentoDigitada(e.target.value)}
            />
          </div>
          {temDiferenca && pendentesRestantes > 0 && (
            <div className="rounded-[8px] bg-[#f59e0b1a] border border-[#f59e0b33] px-3 py-2.5">
              <p className="text-xs text-[#f59e0b]">
                O valor difere da parcela original. As {pendentesRestantes} parcela{pendentesRestantes > 1 ? 's' : ''} pendente{pendentesRestantes > 1 ? 's' : ''} restante{pendentesRestantes > 1 ? 's' : ''} serão recalculadas automaticamente com o saldo devedor.
              </p>
            </div>
          )}
          {temDiferenca && pendentesRestantes === 0 && (
            <div className="rounded-[8px] bg-[#ef44441a] border border-[#ef444433] px-3 py-2.5">
              <p className="text-xs text-[#ef4444]">
                Não há parcelas pendentes para redistribuir o saldo. Apenas o valor informado será registrado.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: confirmar reversão */}
      <Modal
        open={revertendoId !== null}
        onClose={() => setRevertendoId(null)}
        title="Reverter pagamento"
        actions={
          <>
            <Button variant="ghost" onClick={() => setRevertendoId(null)}>Cancelar</Button>
            <Button
              variant="danger"
              loading={reverterMutation.isPending}
              onClick={() => reverterMutation.mutate(revertendoId!)}
            >
              Reverter para pendente
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#a1a1aa]">
          Tem certeza que deseja marcar esta parcela como <span className="text-[#fafafa] font-medium">pendente</span> novamente? O valor da parcela será mantido.
        </p>
      </Modal>

      {/* Modal: editar parcela pendente (sem marcar como paga) */}
      <Modal
        open={!!editandoParcela}
        onClose={() => { setEditandoParcela(null); setValorEditado(''); setVencimentoEditado(''); setRecalcularDemais(false) }}
        title={`Parcela ${editandoParcela?.numero_parcela} — Editar`}
        actions={
          <>
            <Button variant="ghost" onClick={() => { setEditandoParcela(null); setValorEditado(''); setVencimentoEditado(''); setRecalcularDemais(false) }}>Cancelar</Button>
            <Button
              variant="accent"
              loading={editarParcelaMutation.isPending}
              onClick={() => editarParcelaMutation.mutate()}
              disabled={!valorEditadoValido()}
            >
              Salvar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Valor (R$)"
              value={valorEditado}
              onChange={(e) => setValorEditado(e.target.value)}
              placeholder="0,00"
              autoFocus
            />
            <Input
              label="Vencimento"
              type="date"
              value={vencimentoEditado}
              onChange={(e) => setVencimentoEditado(e.target.value)}
            />
          </div>
          <p className="text-xs text-[#71717a]">
            A parcela continua pendente — isso só ajusta o valor e a data de vencimento dela.
          </p>

          {(() => {
            const outrasPendentes = (parcelas ?? []).filter((p) => p.status === 'pendente' && p.id !== editandoParcela?.id)
            const valorEditadoNum = parseFloat(valorEditado.replace(',', '.'))
            const valorValidoLocal = !isNaN(valorEditadoNum) && valorEditadoNum > 0
            const saldoRestante = Number(cliente?.valor_total_acordado ?? 0) - totalPago - (valorValidoLocal ? valorEditadoNum : 0)
            const valorPorParcela = outrasPendentes.length > 0 ? saldoRestante / outrasPendentes.length : 0

            if (outrasPendentes.length === 0) return null

            return (
              <div className="rounded-[8px] bg-[#18181b] border border-[rgba(255,255,255,0.07)] p-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recalcularDemais}
                    onChange={(e) => setRecalcularDemais(e.target.checked)}
                    className="mt-0.5 shrink-0 accent-[#22c55e]"
                  />
                  <span className="text-sm text-[#fafafa]">
                    Ajustar as demais parcelas pendentes com base no valor total do contrato
                  </span>
                </label>
                {recalcularDemais && valorValidoLocal && (
                  <p className="text-xs text-[#a1a1aa] mt-2 pl-6">
                    Já pago: <span className="text-[#22c55e]">{formatCurrency(totalPago)}</span> · Restante após esta parcela: <span className="text-[#fafafa]">{formatCurrency(Math.max(saldoRestante, 0))}</span> ÷ {outrasPendentes.length} parcela{outrasPendentes.length > 1 ? 's' : ''} ={' '}
                    <span className="text-[#fafafa] font-medium">{formatCurrency(Math.max(valorPorParcela, 0))}</span> cada.
                    {saldoRestante < 0 && (
                      <span className="block text-[#ef4444] mt-1">O valor informado já ultrapassa o total do contrato — as demais não serão reduzidas abaixo de zero.</span>
                    )}
                  </p>
                )}
              </div>
            )
          })()}
        </div>
      </Modal>
    </div>
  )
}
