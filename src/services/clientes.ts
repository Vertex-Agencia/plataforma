import { supabase } from '../lib/supabase'
import type { Cliente, Parcela, ManutencaoRecorrente, OrigemParcela, StatusParcela } from '../types/database'

export async function getClientes(userId: string): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Cliente[]
}

export async function getClienteById(id: number): Promise<Cliente> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Cliente
}

export async function getParcelasByCliente(clienteId: number): Promise<Parcela[]> {
  const { data, error } = await supabase
    .from('parcelas')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('numero_parcela', { ascending: true })
  if (error) throw error
  return (data ?? []) as Parcela[]
}

export async function getManutencaoByCliente(clienteId: number): Promise<ManutencaoRecorrente | null> {
  const { data, error } = await supabase
    .from('manutencao_recorrente')
    .select('*')
    .eq('cliente_id', clienteId)
    .maybeSingle()
  if (error) throw error
  return data as ManutencaoRecorrente | null
}

interface ClienteInput {
  user_id: string
  nome_razao_social: string
  email_contato: string | null
  telefone_contato: string | null
  tipo_servico: 'implementacao' | 'manutencao'
  status: 'ativo' | 'inativo' | 'aguardando'
  forma_pagamento: 'pix' | 'boleto' | 'cartao' | 'transferencia'
  valor_total_acordado: number
  observacao: string | null
  contrato_url: string | null
}

export async function createCliente(
  cliente: ClienteInput,
  parcelamento: { quantidade: number; dataInicio: string }
): Promise<Cliente> {
  const { data, error } = await supabase.from('clientes').insert(cliente).select().single()
  if (error) throw error
  const created = data as Cliente

  const valorParcela = cliente.valor_total_acordado / parcelamento.quantidade
  const parcelas = Array.from({ length: parcelamento.quantidade }, (_, i) => {
    const dataVenc = new Date(parcelamento.dataInicio + 'T00:00:00')
    dataVenc.setMonth(dataVenc.getMonth() + i)
    return {
      user_id: cliente.user_id,
      cliente_id: created.id,
      manutencao_recorrente_id: null,
      origem: cliente.tipo_servico === 'implementacao' ? 'implementacao' : 'manutencao',
      numero_parcela: i + 1,
      total_parcelas: parcelamento.quantidade,
      valor_parcela: Math.round(valorParcela * 100) / 100,
      data_vencimento: dataVenc.toISOString().split('T')[0],
      status: 'pendente',
      data_pagamento: null,
    }
  })

  const { error: parcelaError } = await supabase.from('parcelas').insert(parcelas)
  if (parcelaError) throw parcelaError

  if (cliente.tipo_servico === 'manutencao') {
    const { error: manErr } = await supabase.from('manutencao_recorrente').insert({
      user_id: cliente.user_id,
      cliente_id: created.id,
      valor_mensal_acordado: valorParcela,
      data_inicio_contrato: parcelamento.dataInicio,
      duracao_meses: parcelamento.quantidade,
      data_vencimento_atual: parcelamento.dataInicio,
      status: 'ativo',
    })
    if (manErr) throw manErr
  }

  return created
}

export async function updateCliente(id: number, updates: Partial<Omit<Cliente, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) {
  const { error } = await supabase.from('clientes').update(updates).eq('id', id)
  if (error) throw error
}

export async function marcarParcelaPaga(parcelaId: number) {
  const { error } = await supabase
    .from('parcelas')
    .update({ status: 'pago', data_pagamento: new Date().toISOString() })
    .eq('id', parcelaId)
  if (error) throw error
}

export async function reverterParcelaPendente(parcelaId: number) {
  const { error } = await supabase
    .from('parcelas')
    .update({ status: 'pendente', data_pagamento: null })
    .eq('id', parcelaId)
  if (error) throw error
}

export async function registrarPagamentoParcela(
  parcelaId: number,
  valorPago: number,
  todasParcelas: Parcela[],
  valorTotalAcordado: number,
  dataPagamento?: string
) {
  const { error } = await supabase
    .from('parcelas')
    .update({ status: 'pago', data_pagamento: dataPagamento ?? new Date().toISOString(), valor_parcela: valorPago })
    .eq('id', parcelaId)
  if (error) throw error

  const totalJaPago =
    todasParcelas
      .filter((p) => p.status === 'pago' && p.id !== parcelaId)
      .reduce((s, p) => s + Number(p.valor_parcela), 0) + valorPago

  const saldoRestante = valorTotalAcordado - totalJaPago
  const pendentes = todasParcelas.filter((p) => p.status === 'pendente' && p.id !== parcelaId)

  if (pendentes.length === 0 || saldoRestante <= 0) return

  const base = Math.floor((saldoRestante / pendentes.length) * 100) / 100
  const ajuste = Math.round((saldoRestante - base * pendentes.length) * 100) / 100

  await Promise.all(
    pendentes.map((p, i) =>
      supabase
        .from('parcelas')
        .update({ valor_parcela: i === 0 ? base + ajuste : base })
        .eq('id', p.id)
    )
  )
}

export interface LinhaParcela {
  /** null = parcela nova (ainda não existe no banco) */
  id: number | null
  valor_parcela: number
  data_vencimento: string
  status: StatusParcela
  data_pagamento: string | null
}

// Salva o parcelamento inteiro de uma vez: atualiza valor/vencimento/status de cada parcela
// (paga ou pendente — edição total, inclusive corrigir uma já paga), insere as novas, remove as
// que o usuário tirou da lista (só permite excluir pendente, nunca uma já paga) e renumera tudo
// sequencialmente. O valor_total_acordado do cliente passa a ser sempre a soma das parcelas —
// única fonte de verdade, sem "redistribuição" separada pra confundir.
export async function salvarParcelamento(
  clienteId: number,
  userId: string,
  origem: OrigemParcela,
  idsOriginais: number[],
  linhas: LinhaParcela[]
) {
  const idsRestantes = new Set(linhas.filter((l) => l.id != null).map((l) => l.id))
  const idsRemover = idsOriginais.filter((id) => !idsRestantes.has(id))

  if (idsRemover.length > 0) {
    const { error } = await supabase.from('parcelas').delete().in('id', idsRemover).eq('status', 'pendente')
    if (error) throw error
  }

  const totalFinal = linhas.length

  await Promise.all(
    linhas.map((l, i) => {
      const payload = {
        valor_parcela: l.valor_parcela,
        data_vencimento: l.data_vencimento,
        status: l.status,
        data_pagamento: l.status === 'pago' ? l.data_pagamento : null,
        numero_parcela: i + 1,
        total_parcelas: totalFinal,
      }
      if (l.id != null) {
        return supabase.from('parcelas').update(payload).eq('id', l.id)
      }
      return supabase.from('parcelas').insert({
        ...payload,
        user_id: userId,
        cliente_id: clienteId,
        manutencao_recorrente_id: null,
        origem,
      })
    })
  )

  const novoValorTotal = linhas.reduce((s, l) => s + Number(l.valor_parcela), 0)
  const { error } = await supabase.from('clientes').update({ valor_total_acordado: novoValorTotal }).eq('id', clienteId)
  if (error) throw error
}

export async function deleteClientes(ids: number[]) {
  await supabase.from('manutencao_recorrente').delete().in('cliente_id', ids)
  await supabase.from('parcelas').delete().in('cliente_id', ids)
  const { error } = await supabase.from('clientes').delete().in('id', ids)
  if (error) throw error
}

export async function uploadContrato(clienteId: number, userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${userId}/${clienteId}/contrato.${ext}`
  const { error: uploadError } = await supabase.storage.from('contratos').upload(path, file, { upsert: true })
  if (uploadError) throw uploadError
  const { data } = supabase.storage.from('contratos').getPublicUrl(path)
  await updateCliente(clienteId, { contrato_url: data.publicUrl })
  return data.publicUrl
}
