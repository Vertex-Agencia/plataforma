import { supabase } from '../lib/supabase'

interface ParcelaRow { valor_parcela: number; data_pagamento: string | null; origem: string }
interface DespesaRow { valor: number }
interface ManutencaoRow { id: number; data_vencimento_atual: string; clientes: { nome_razao_social: string } | null }
interface ParcelaComCliente {
  id: number
  numero_parcela: number
  total_parcelas: number
  valor_parcela: number
  data_vencimento: string
  status: string
  clientes: { nome_razao_social: string } | null
}

export async function getDashboardMetrics(userId: string, startDate?: string, endDate?: string) {
  const now = new Date()
  const start = startDate ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const end = endDate ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const [parcelasRes, despesasRes, clientesRes, pendentesRes, manutencaoRes] = await Promise.all([
    supabase.from('parcelas').select('valor_parcela, data_pagamento, origem').eq('user_id', userId).eq('status', 'pago').gte('data_pagamento', start).lte('data_pagamento', end + 'T23:59:59'),
    supabase.from('entradas_saidas').select('valor').eq('user_id', userId).eq('tipo', 'saida').gte('data_transacao', start).lte('data_transacao', end),
    supabase.from('clientes').select('id').eq('user_id', userId).eq('status', 'ativo'),
    supabase.from('parcelas').select('id, numero_parcela, total_parcelas, valor_parcela, data_vencimento, status, clientes(nome_razao_social)').eq('user_id', userId).eq('status', 'pendente').order('data_vencimento', { ascending: true }).limit(10),
    supabase.from('manutencao_recorrente').select('id, data_vencimento_atual, clientes(nome_razao_social)').eq('user_id', userId).eq('status', 'ativo'),
  ])

  const parcelas = (parcelasRes.data ?? []) as ParcelaRow[]
  const despesas = (despesasRes.data ?? []) as DespesaRow[]
  const receita = parcelas.reduce((s, p) => s + Number(p.valor_parcela), 0)
  const despesasTotal = despesas.reduce((s, d) => s + Number(d.valor), 0)

  return {
    receita,
    despesas: despesasTotal,
    lucro: receita - despesasTotal,
    clientesAtivos: clientesRes.data?.length ?? 0,
    parcelas_pendentes: (pendentesRes.data ?? []) as unknown as ParcelaComCliente[],
    manutencoes: (manutencaoRes.data ?? []) as unknown as ManutencaoRow[],
  }
}

export async function getChartData(userId: string) {
  const months: { start: string; end: string; label: string }[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0],
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0],
      label: d.toLocaleDateString('pt-BR', { month: 'short' }),
    })
  }

  const results = await Promise.all(
    months.map(async (m) => {
      const [parcelasRes, despesasRes] = await Promise.all([
        supabase.from('parcelas').select('valor_parcela, origem').eq('user_id', userId).eq('status', 'pago').gte('data_pagamento', m.start).lte('data_pagamento', m.end + 'T23:59:59'),
        supabase.from('entradas_saidas').select('valor').eq('user_id', userId).eq('tipo', 'saida').gte('data_transacao', m.start).lte('data_transacao', m.end),
      ])
      const ps = (parcelasRes.data ?? []) as ParcelaRow[]
      const ds = (despesasRes.data ?? []) as DespesaRow[]
      const receita = ps.reduce((s, p) => s + Number(p.valor_parcela), 0)
      const despesasTotal = ds.reduce((s, d) => s + Number(d.valor), 0)
      const implementacao = ps.filter((p) => p.origem === 'implementacao').reduce((s, p) => s + Number(p.valor_parcela), 0)
      const manutencao = ps.filter((p) => p.origem === 'manutencao').reduce((s, p) => s + Number(p.valor_parcela), 0)
      return { mes: m.label, receita, lucro: receita - despesasTotal, implementacao, manutencao }
    })
  )

  return results
}
