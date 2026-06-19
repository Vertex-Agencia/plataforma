import { supabase } from '../lib/supabase'
import type { Reuniao, StatusReuniao } from '../types/database'

export interface ReuniaoComCliente extends Reuniao {
  clientes: { nome_razao_social: string } | null
}

export async function getReunioes(userId: string): Promise<ReuniaoComCliente[]> {
  const { data, error } = await supabase
    .from('reunioes')
    .select('*, clientes(nome_razao_social)')
    .eq('user_id', userId)
    .order('data_hora', { ascending: true })
  if (error) throw error
  return (data ?? []) as ReuniaoComCliente[]
}

interface ReuniaoInput {
  user_id: string
  titulo: string
  data_hora: string
  descricao_pauta: string | null
  cliente_id: number | null
  status: StatusReuniao
}

export async function createReuniao(reuniao: ReuniaoInput) {
  const { error } = await supabase.from('reunioes').insert(reuniao)
  if (error) throw error
}

export async function updateReuniaoStatus(id: number, status: StatusReuniao) {
  const { error } = await supabase.from('reunioes').update({ status }).eq('id', id)
  if (error) throw error
}
