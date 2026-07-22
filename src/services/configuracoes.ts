import { supabase } from '../lib/supabase'
import type { Configuracao } from '../types/database'

export async function getConfiguracoes(userId: string): Promise<Configuracao | null> {
  const { data, error } = await supabase
    .from('configuracoes')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data as Configuracao | null
}

export async function salvarApifyToken(userId: string, apifyApiToken: string): Promise<void> {
  const { error } = await supabase
    .from('configuracoes')
    .upsert({ user_id: userId, apify_api_token: apifyApiToken }, { onConflict: 'user_id' })
  if (error) throw error
}
