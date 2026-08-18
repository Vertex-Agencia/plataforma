import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TrendingUp, Users, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useValoresOcultosStore } from '../../store/valoresOcultosStore'
import { getDashboardMetrics, getChartData } from '../../services/dashboard'
import { getClienteById, getParcelasByCliente, registrarPagamentoParcela } from '../../services/clientes'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { PageSpinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatCurrency, formatDate, getErrorMessage } from '../../utils/format'
import type { ElementType } from 'react'
import type { ParcelaComCliente } from '../../services/dashboard'

type Period = '1m' | '6m' | '12m' | 'all'

function getPeriodDates(period: Period): { start?: string; end?: string } {
  const now = new Date()
  if (period === 'all') return {}
  if (period === '1m') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
    }
  }
  const months = period === '6m' ? 6 : 12
  return {
    start: new Date(now.getFullYear(), now.getMonth() - months + 1, 1).toISOString().split('T')[0],
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
  }
}

function MetricCard({ title, value, icon: Icon, accentColor }: {
  title: string; value: string; icon: ElementType; accentColor: string
}) {
  return (
    <Card accentColor={accentColor} className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#a1a1aa] font-medium uppercase tracking-wider">{title}</p>
          <p className="font-display text-2xl font-semibold text-[#fafafa] mt-1.5 tabular-nums truncate">{value}</p>
        </div>
        <div className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0" style={{ backgroundColor: accentColor + '15' }}>
          <Icon size={18} style={{ color: accentColor }} />
        </div>
      </div>
    </Card>
  )
}

const MRR_META = 10000

export function Dashboard() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState<Period>('1m')
  const { ocultos } = useValoresOcultosStore()

  function exibir(valor: number): string {
    return ocultos ? '••••••' : formatCurrency(valor)
  }

  // Registrar pagamento direto pelo Dashboard: o valor recebido é editável (pode diferir da
  // parcela original) e as parcelas pendentes restantes do mesmo cliente são recalculadas com
  // base no valor total acordado — mesma lógica usada no perfil do cliente.
  const [pagandoParcela, setPagandoParcela] = useState<ParcelaComCliente | null>(null)
  const [valorDigitado, setValorDigitado] = useState('')

  const pagarParcelaMutation = useMutation({
    mutationFn: async () => {
      const valor = parseFloat(valorDigitado.replace(',', '.'))
      const [cliente, todasParcelas] = await Promise.all([
        getClienteById(pagandoParcela!.cliente_id),
        getParcelasByCliente(pagandoParcela!.cliente_id),
      ])
      return registrarPagamentoParcela(pagandoParcela!.id, valor, todasParcelas, Number(cliente.valor_total_acordado))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['parcelas-pagas', user?.id] })
      setPagandoParcela(null)
      setValorDigitado('')
    },
  })

  function abrirModalPagamento(p: ParcelaComCliente) {
    setPagandoParcela(p)
    setValorDigitado(Number(p.valor_parcela).toFixed(2).replace('.', ','))
  }

  function valorValido() {
    const v = parseFloat(valorDigitado.replace(',', '.'))
    return !isNaN(v) && v > 0
  }

  const { start, end } = getPeriodDates(period)

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard-metrics', user?.id, period],
    queryFn: () => getDashboardMetrics(user!.id, start, end),
    enabled: !!user,
    refetchInterval: 30000,
  })

  const { data: chartData } = useQuery({
    queryKey: ['dashboard-chart', user?.id],
    queryFn: () => getChartData(user!.id),
    enabled: !!user,
  })

  useEffect(() => {
    if (!user) return

    function invalidateAll() {
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics', user!.id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-chart', user!.id] })
      queryClient.invalidateQueries({ queryKey: ['clientes', user!.id] })
      queryClient.invalidateQueries({ queryKey: ['parcelas-pagas', user!.id] })
      queryClient.invalidateQueries({ queryKey: ['entradas', user!.id] })
    }

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parcelas', filter: `user_id=eq.${user.id}` }, invalidateAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes', filter: `user_id=eq.${user.id}` }, invalidateAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entradas_saidas', filter: `user_id=eq.${user.id}` }, invalidateAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manutencao_recorrente', filter: `user_id=eq.${user.id}` }, invalidateAll)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, queryClient])

  if (metricsLoading) return <PageSpinner />

  const donutData = chartData
    ? [
        { name: 'Implementação', value: chartData.reduce((s, d) => s + d.implementacao, 0) },
        { name: 'Manutenção', value: chartData.reduce((s, d) => s + d.manutencao, 0) },
      ]
    : []

  const mrrAtual = metrics?.receita ?? 0
  const mrrProgress = Math.min((mrrAtual / MRR_META) * 100, 100)

  const today = new Date()
  const alertaDias = 5
  const manutencoesAlerta = (metrics?.manutencoes ?? []).filter((m) => {
    const venc = new Date(m.data_vencimento_atual)
    const diff = Math.ceil((venc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff <= alertaDias
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipFormatter = (value: any) => exibir(Number(value))
  const axisFormatter = (v: number) => (ocultos ? '•••' : `R$${(Number(v) / 1000).toFixed(0)}k`)

  return (
    <div className="flex flex-col gap-6">
      {/* Period filter */}
      <div className="flex items-center gap-2">
        {(['1m', '6m', '12m', 'all'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-[8px] text-sm font-medium transition-colors ${
              period === p ? 'bg-[#22c55e] text-[#09090b]' : 'bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa]'
            }`}
          >
            {p === '1m' ? '1 mês' : p === '6m' ? '6 meses' : p === '12m' ? '12 meses' : 'Tudo'}
          </button>
        ))}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Receita" value={exibir(metrics?.receita ?? 0)} icon={TrendingUp} accentColor="#22c55e" />
        <MetricCard title="Lucro Líquido" value={exibir(metrics?.lucro ?? 0)} icon={TrendingUp} accentColor="#3b82f6" />
        <MetricCard title="Clientes Ativos" value={String(metrics?.clientesAtivos ?? 0)} icon={Users} accentColor="#a78bfa" />
        <MetricCard title="Aguardando Pagamento" value={String(metrics?.parcelas_pendentes?.length ?? 0)} icon={Clock} accentColor="#f59e0b" />
      </div>

      {/* MRR Meta */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-display text-sm font-medium text-[#fafafa]">Meta MRR</p>
          <span className="font-mono text-sm text-[#a1a1aa] tabular-nums">{exibir(mrrAtual)} / {exibir(MRR_META)}</span>
        </div>
        <div className="h-2 bg-[#27272a] rounded-full overflow-hidden">
          <div className="h-full bg-[#22c55e] rounded-full transition-all duration-500" style={{ width: `${mrrProgress}%` }} />
        </div>
        <p className="font-mono text-xs text-[#a1a1aa] mt-2 tabular-nums">{mrrProgress.toFixed(1)}% da meta atingida</p>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="p-5 xl:col-span-2">
          <p className="font-display font-display text-sm font-medium text-[#fafafa] mb-4">Receita vs Lucro (6 meses)</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="mes" tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={axisFormatter} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', color: '#fafafa' }}
                formatter={tooltipFormatter}
              />
              <Line type="monotone" dataKey="receita" stroke="#22c55e" strokeWidth={2} dot={false} name="Receita" />
              <Line type="monotone" dataKey="lucro" stroke="#3b82f6" strokeWidth={2} dot={false} name="Lucro" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <p className="font-display text-sm font-medium text-[#fafafa] mb-4">Receita por Tipo</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                <Cell fill="#3b82f6" />
                <Cell fill="#a78bfa" />
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', color: '#fafafa' }}
                formatter={tooltipFormatter}
              />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Parcelas pendentes */}
        <Card className="p-5">
          <p className="font-display text-sm font-medium text-[#fafafa] mb-4">Receita a Entrar — Próximo Mês</p>
          {(metrics?.parcelas_pendentes ?? []).length === 0 ? (
            <EmptyState title="Nenhuma parcela prevista" description="Nenhuma parcela com vencimento no próximo mês." />
          ) : (
            <div className="flex flex-col gap-2">
              {(metrics?.parcelas_pendentes ?? []).slice(0, 6).map((p) => {
                const nome = p.clientes?.nome_razao_social ?? 'Cliente'
                const venc = new Date(p.data_vencimento)
                const atrasado = venc < today
                return (
                  <div key={p.id} className="flex items-center gap-3 py-2 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                    <Avatar name={nome} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#fafafa] truncate">{nome}</p>
                      <p className="font-mono text-xs text-[#a1a1aa] tabular-nums">{p.numero_parcela}/{p.total_parcelas} · Vence {formatDate(p.data_vencimento)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm font-medium text-[#fafafa] tabular-nums">{exibir(Number(p.valor_parcela))}</p>
                      <Badge variant={atrasado ? 'red' : 'amber'}>{atrasado ? 'Atrasado' : 'Pendente'}</Badge>
                    </div>
                    <button
                      title="Registrar pagamento"
                      onClick={() => abrirModalPagamento(p)}
                      className="p-1.5 rounded-[6px] text-[#52525b] hover:text-[#22c55e] hover:bg-[#22c55e1a] transition-colors shrink-0"
                    >
                      <CheckCircle size={16} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Alertas manutenção */}
        <Card className="p-5">
          <p className="font-display text-sm font-medium text-[#fafafa] mb-4">Alertas de Manutenção</p>
          {manutencoesAlerta.length === 0 ? (
            <EmptyState title="Nenhum alerta" description="Nenhuma manutenção vencendo nos próximos 5 dias." />
          ) : (
            <div className="flex flex-col gap-2">
              {manutencoesAlerta.map((m) => {
                const nome = m.clientes?.nome_razao_social ?? 'Cliente'
                const venc = new Date(m.data_vencimento_atual)
                const diff = Math.ceil((venc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                const urgente = diff <= 1
                return (
                  <div key={m.id} className="flex items-center gap-3 py-2 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                    <div className="relative flex shrink-0">
                      <span className={`w-2 h-2 rounded-full ${urgente ? 'bg-[#ef4444]' : 'bg-[#f59e0b]'}`} />
                      {urgente && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ef4444] opacity-75" />}
                    </div>
                    <Avatar name={nome} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#fafafa] truncate">{nome}</p>
                      <p className="font-mono text-xs text-[#a1a1aa] tabular-nums">Vence {formatDate(m.data_vencimento_atual)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <AlertTriangle size={14} className={urgente ? 'text-[#ef4444]' : 'text-[#f59e0b]'} />
                      <Badge variant={urgente ? 'red' : 'amber'}>{diff <= 0 ? 'Hoje' : `${diff}d`}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Modal: registrar pagamento */}
      <Modal
        open={!!pagandoParcela}
        onClose={() => { setPagandoParcela(null); setValorDigitado('') }}
        title={`Parcela ${pagandoParcela?.numero_parcela} — Registrar pagamento`}
        actions={
          <>
            <Button variant="ghost" onClick={() => { setPagandoParcela(null); setValorDigitado('') }}>Cancelar</Button>
            <Button
              variant="accent"
              loading={pagarParcelaMutation.isPending}
              onClick={() => pagarParcelaMutation.mutate()}
              disabled={!valorValido()}
            >
              <CheckCircle size={14} /> Confirmar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex justify-between text-sm">
            <span className="text-[#a1a1aa]">Cliente</span>
            <span className="text-[#fafafa] font-medium">{pagandoParcela?.clientes?.nome_razao_social ?? 'Cliente'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#a1a1aa]">Valor da parcela</span>
            <span className="text-[#fafafa] font-medium">{exibir(Number(pagandoParcela?.valor_parcela ?? 0))}</span>
          </div>
          <Input
            label="Valor recebido (R$)"
            value={valorDigitado}
            onChange={(e) => setValorDigitado(e.target.value)}
            placeholder="0,00"
            autoFocus
          />
          <p className="text-xs text-[#71717a]">
            Se o valor recebido for diferente do previsto, as demais parcelas pendentes desse cliente serão recalculadas automaticamente com base no valor total acordado.
          </p>
          {pagarParcelaMutation.isError && (
            <p className="text-xs text-[#ef4444]">{getErrorMessage(pagarParcelaMutation.error, 'Erro ao registrar pagamento.')}</p>
          )}
        </div>
      </Modal>
    </div>
  )
}
