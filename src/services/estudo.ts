import { supabase } from '../lib/supabase'
import type { AreaEstudo, Insight, StatusLeitura } from '../types/database'

export interface AreaEstudoComInsights extends AreaEstudo {
  insights: { count: number }[]
}

export async function getEstudos(userId: string): Promise<AreaEstudoComInsights[]> {
  const { data, error } = await supabase
    .from('area_estudo')
    .select('*, insights(count)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AreaEstudoComInsights[]
}

export async function getInsightsByEstudo(estudoId: number): Promise<Insight[]> {
  const { data, error } = await supabase
    .from('insights')
    .select('*')
    .eq('area_estudo_id', estudoId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Insight[]
}

interface EstudoInput {
  user_id: string
  url_link: string
  titulo: string
  descricao: string | null
  categoria: string | null
  status_leitura: StatusLeitura
}

export async function createEstudo(estudo: EstudoInput) {
  const { error } = await supabase.from('area_estudo').insert(estudo)
  if (error) throw error
}

export async function updateEstudoStatus(id: number, status: StatusLeitura) {
  const { error } = await supabase.from('area_estudo').update({ status_leitura: status }).eq('id', id)
  if (error) throw error
}

interface InsightInput {
  user_id: string
  area_estudo_id: number
  nota_insight: string
}

export async function createInsight(insight: InsightInput) {
  const { error } = await supabase.from('insights').insert(insight)
  if (error) throw error
}
