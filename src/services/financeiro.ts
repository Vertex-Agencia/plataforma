import { supabase } from '../lib/supabase'
import type { EntradaSaida, DespesaRecorrente, PeriodicidadeDespesa, TipoTransacao } from '../types/database'

export async function getEntradas(userId: string, start?: string, end?: string): Promise<EntradaSaida[]> {
  let query = supabase.from('entradas_saidas').select('*').eq('user_id', userId).order('data_transacao', { ascending: false })
  if (start) query = query.gte('data_transacao', start)
  if (end) query = query.lte('data_transacao', end)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as EntradaSaida[]
}

interface EntradaInput {
  user_id: string
  descricao: string
  valor: number
  tipo: TipoTransacao
  data_transacao: string
  emitido_nota_fiscal: boolean
  cliente_id: number | null
}

export async function createEntrada(entrada: EntradaInput) {
  const { error } = await supabase.from('entradas_saidas').insert(entrada)
  if (error) throw error
}

export async function getDespesasRecorrentes(userId: string): Promise<DespesaRecorrente[]> {
  const { data, error } = await supabase
    .from('despesas_recorrentes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DespesaRecorrente[]
}

interface DespesaInput {
  user_id: string
  nome: string
  valor: number
  periodicidade: PeriodicidadeDespesa
  data_inicio: string
  ativo: boolean
}

export async function createDespesaRecorrente(despesa: DespesaInput) {
  const { error } = await supabase.from('despesas_recorrentes').insert(despesa)
  if (error) throw error
}

export async function toggleDespesaAtivo(id: number, ativo: boolean) {
  const { error } = await supabase.from('despesas_recorrentes').update({ ativo }).eq('id', id)
  if (error) throw error
}

export interface ParcelaPaga {
  id: number
  cliente_id: number
  cliente_nome: string
  numero_parcela: number
  total_parcelas: number
  valor_parcela: number
  data_pagamento: string
  origem: string
}

export async function getParcelasPagas(userId: string): Promise<ParcelaPaga[]> {
  const { data, error } = await supabase
    .from('parcelas')
    .select('id, cliente_id, numero_parcela, total_parcelas, valor_parcela, data_pagamento, origem, clientes(nome_razao_social)')
    .eq('user_id', userId)
    .eq('status', 'pago')
    .not('data_pagamento', 'is', null)
    .order('data_pagamento', { ascending: false })
  if (error) throw error
  return (data ?? []).map((p: any) => ({
    id: p.id,
    cliente_id: p.cliente_id,
    cliente_nome: p.clientes?.nome_razao_social ?? 'Cliente',
    numero_parcela: p.numero_parcela,
    total_parcelas: p.total_parcelas,
    valor_parcela: Number(p.valor_parcela),
    data_pagamento: p.data_pagamento,
    origem: p.origem,
  }))
}
