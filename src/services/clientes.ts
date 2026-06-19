import { supabase } from '../lib/supabase'
import type { Cliente, Parcela, ManutencaoRecorrente } from '../types/database'

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
