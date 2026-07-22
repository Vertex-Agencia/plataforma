import { supabase } from '../lib/supabase'
import type { Lead, PipelineEtapa, LeadBusca, LeadBuscaResultadoItem } from '../types/database'

const ETAPA_PROSPECCAO_NOME = 'Prospecção'

export async function getPipelineEtapas(userId: string): Promise<PipelineEtapa[]> {
  const { data, error } = await supabase
    .from('pipeline_etapas')
    .select('*')
    .eq('user_id', userId)
    .order('ordem', { ascending: true })
  if (error) throw error
  return (data ?? []) as PipelineEtapa[]
}

export async function getLeads(userId: string): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Lead[]
}

export async function getHistoricoBuscas(userId: string): Promise<LeadBusca[]> {
  const { data, error } = await supabase
    .from('lead_buscas')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as LeadBusca[]
}

export async function createEtapa(userId: string, nome: string, cor: string, ordem: number): Promise<PipelineEtapa> {
  const { data, error } = await supabase
    .from('pipeline_etapas')
    .insert({ user_id: userId, nome, cor, ordem })
    .select()
    .single()
  if (error) throw error
  return data as PipelineEtapa
}

export async function updateEtapa(id: number, updates: { nome?: string; cor?: string }) {
  const { error } = await supabase.from('pipeline_etapas').update(updates).eq('id', id)
  if (error) throw error
}

export async function reorderEtapas(etapas: { id: number; ordem: number }[]) {
  await Promise.all(
    etapas.map((e) => supabase.from('pipeline_etapas').update({ ordem: e.ordem }).eq('id', e.id))
  )
}

export class EtapaComLeadsError extends Error {
  quantidadeLeads: number

  constructor(quantidadeLeads: number) {
    super(`Esta etapa tem ${quantidadeLeads} lead(s). Escolha uma etapa de destino antes de excluir.`)
    this.name = 'EtapaComLeadsError'
    this.quantidadeLeads = quantidadeLeads
  }
}

export async function deleteEtapa(id: number, moverLeadsParaEtapaId?: number) {
  const { count, error: countError } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('etapa_id', id)
  if (countError) throw countError

  if (count && count > 0) {
    if (!moverLeadsParaEtapaId) {
      throw new EtapaComLeadsError(count)
    }
    const { error: moveError } = await supabase
      .from('leads')
      .update({ etapa_id: moverLeadsParaEtapaId })
      .eq('etapa_id', id)
    if (moveError) throw moveError
  }

  const { error } = await supabase.from('pipeline_etapas').delete().eq('id', id)
  if (error) throw error
}

export async function moveLead(leadId: number, etapaId: number) {
  const { error } = await supabase.from('leads').update({ etapa_id: etapaId }).eq('id', leadId)
  if (error) throw error
}

export async function updateLead(id: number, updates: Partial<Omit<Lead, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) {
  const { error } = await supabase.from('leads').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteLeads(ids: number[]) {
  const { error } = await supabase.from('leads').delete().in('id', ids)
  if (error) throw error
}

export type FiltroSite = 'ambos' | 'com' | 'sem'

interface BuscarLeadsParams {
  termo_busca: string
  localizacao: string
  quantidade: number
  filtro_site: FiltroSite
}

interface BuscarLeadsResultado {
  sucesso: boolean
  busca_id: number
  encontrados: number
  resultados: LeadBuscaResultadoItem[]
}

export async function buscarLeadsApify(params: BuscarLeadsParams): Promise<BuscarLeadsResultado> {
  const { data, error } = await supabase.functions.invoke<BuscarLeadsResultado>('buscar-leads-apify', {
    body: params,
  })
  if (error) {
    const response: Response | undefined = (error as { context?: Response }).context
    let mensagem: string | undefined
    if (response) {
      try {
        const body = await response.clone().json()
        mensagem = body.detalhe || body.error
      } catch {
        // corpo não era JSON — segue com a mensagem genérica
      }
    }
    throw new Error(mensagem || error.message)
  }
  if (!data) throw new Error('Resposta vazia da busca de leads.')
  return data
}

export async function deleteBusca(id: number) {
  const { error } = await supabase.from('lead_buscas').delete().eq('id', id)
  if (error) throw error
}

export async function atualizarObservacaoResultado(
  buscaId: number,
  index: number,
  observacoes: string,
  resultadosAtuais: LeadBuscaResultadoItem[]
) {
  const novosResultados = resultadosAtuais.map((item, i) => (i === index ? { ...item, observacoes } : item))
  const { error } = await supabase.from('lead_buscas').update({ resultados: novosResultados }).eq('id', buscaId)
  if (error) throw error
}

interface EnviarBuscaResultado {
  novos: number
  duplicados: number
}

export async function enviarBuscaParaPipeline(userId: string, busca: LeadBusca): Promise<EnviarBuscaResultado> {
  const resultados = busca.resultados ?? []

  if (resultados.length === 0) {
    await supabase.from('lead_buscas').update({ enviado_pipeline: true }).eq('id', busca.id)
    return { novos: 0, duplicados: 0 }
  }

  const { data: etapaExistente, error: etapaFetchError } = await supabase
    .from('pipeline_etapas')
    .select('id')
    .eq('user_id', userId)
    .eq('nome', ETAPA_PROSPECCAO_NOME)
    .maybeSingle()
  if (etapaFetchError) throw etapaFetchError

  let etapaId: number
  if (etapaExistente) {
    etapaId = etapaExistente.id
  } else {
    const { data: menorOrdem } = await supabase
      .from('pipeline_etapas')
      .select('ordem')
      .eq('user_id', userId)
      .order('ordem', { ascending: true })
      .limit(1)
      .maybeSingle()
    const novaOrdem = menorOrdem ? menorOrdem.ordem - 1 : 0

    const { data: etapaCriada, error: etapaCreateError } = await supabase
      .from('pipeline_etapas')
      .insert({ user_id: userId, nome: ETAPA_PROSPECCAO_NOME, cor: '#22c55e', ordem: novaOrdem })
      .select('id')
      .single()
    if (etapaCreateError) throw etapaCreateError
    etapaId = etapaCriada.id
  }

  const leadsParaInserir = resultados.map((item) => ({
    user_id: userId,
    etapa_id: etapaId,
    busca_id: busca.id,
    nome: item.nome,
    telefone: item.telefone,
    email: null,
    endereco: item.endereco,
    site: item.site,
    categoria: item.categoria,
    avaliacao: item.avaliacao,
    total_avaliacoes: item.total_avaliacoes,
    place_id: item.place_id,
    origem: 'apify_google_maps' as const,
    observacoes: item.observacoes ?? null,
  }))

  const { data: inseridos, error: insertError } = await supabase
    .from('leads')
    .upsert(leadsParaInserir, { onConflict: 'user_id,place_id', ignoreDuplicates: true })
    .select()
  if (insertError) throw insertError

  const novos = inseridos?.length ?? 0

  await supabase.from('lead_buscas').update({ enviado_pipeline: true }).eq('id', busca.id)

  return { novos, duplicados: leadsParaInserir.length - novos }
}
