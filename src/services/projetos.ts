import { supabase } from '../lib/supabase'
import type { Projeto, EtapaProjeto, StatusProjeto, StatusEtapaProjeto, TipoProjeto, NivelComplexidade } from '../types/database'

export interface ProjetoComRelacoes extends Projeto {
  clientes: { nome_razao_social: string } | null
  etapas_projeto: EtapaProjeto[]
}

export async function getProjetos(userId: string): Promise<ProjetoComRelacoes[]> {
  const { data, error } = await supabase
    .from('projetos')
    .select('*, clientes(nome_razao_social), etapas_projeto(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ProjetoComRelacoes[]
}

export async function getProjetoById(id: number): Promise<ProjetoComRelacoes> {
  const { data, error } = await supabase
    .from('projetos')
    .select('*, clientes(nome_razao_social), etapas_projeto(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as ProjetoComRelacoes
}

interface ProjetoInput {
  user_id: string
  nome: string
  cliente_id: number
  status: StatusProjeto
  tipo_projeto: TipoProjeto | null
  data_inicio: string | null
  data_limite: string | null
  nivel_complexidade: NivelComplexidade | null
  observacoes: string | null
}

export async function createProjeto(projeto: ProjetoInput): Promise<Projeto> {
  const { data, error } = await supabase.from('projetos').insert(projeto).select().single()
  if (error) throw error
  return data as Projeto
}

export async function updateProjetoStatus(id: number, status: StatusProjeto) {
  const { error } = await supabase.from('projetos').update({ status }).eq('id', id)
  if (error) throw error
}

interface EtapaInput {
  user_id: string
  projeto_id: number
  nome: string
  status: StatusEtapaProjeto
}

export async function createEtapa(etapa: EtapaInput) {
  const { error } = await supabase.from('etapas_projeto').insert(etapa)
  if (error) throw error
}

export async function toggleEtapa(id: number, status: StatusEtapaProjeto) {
  const { error } = await supabase.from('etapas_projeto').update({ status }).eq('id', id)
  if (error) throw error
}
