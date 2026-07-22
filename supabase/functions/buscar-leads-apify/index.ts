import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ApifyGoogleMapsItem {
  title?: string
  phone?: string
  address?: string
  website?: string
  categoryName?: string
  totalScore?: number
  reviewsCount?: number
  placeId?: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization') ?? ''

  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser()
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Não autenticado.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const userId = userData.user.id

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  let buscaId: number | null = null

  try {
    const { termo_busca, localizacao, quantidade, filtro_site = 'ambos' } = await req.json()

    if (!termo_busca || !localizacao || !quantidade) {
      return new Response(JSON.stringify({ error: 'Parâmetros obrigatórios ausentes.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: busca, error: buscaError } = await supabase
      .from('lead_buscas')
      .insert({
        user_id: userId,
        termo_busca,
        localizacao,
        quantidade_solicitada: quantidade,
        status: 'pendente',
      })
      .select()
      .single()

    if (buscaError) throw buscaError
    buscaId = busca.id

    const { data: config, error: configError } = await supabase
      .from('configuracoes')
      .select('apify_api_token')
      .eq('user_id', userId)
      .maybeSingle()
    if (configError) throw configError

    const apiToken = config?.apify_api_token
    if (!apiToken) throw new Error('Configure sua chave de API em Configurações antes de buscar leads.')

    // Quando filtrando por presença/ausência de site, raspa mais itens do que o pedido
    // para compensar os que serão descartados no filtro e ainda assim tentar atingir "quantidade".
    const quantidadeBruta = filtro_site === 'ambos' ? quantidade : Math.min(quantidade * 3, 500)

    const buscaResponse = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchStringsArray: [termo_busca],
          locationQuery: localizacao,
          maxCrawledPlacesPerSearch: quantidadeBruta,
          language: 'pt-BR',
        }),
      }
    )

    if (!buscaResponse.ok) {
      throw new Error(`Falha na busca (${buscaResponse.status}): ${await buscaResponse.text()}`)
    }

    const items: ApifyGoogleMapsItem[] = await buscaResponse.json()

    console.log(
      `Itens recebidos: ${Array.isArray(items) ? items.length : 'NÃO É ARRAY: ' + JSON.stringify(items).slice(0, 300)}`
    )
    if (Array.isArray(items) && items.length > 0) {
      console.log('Exemplo do primeiro item:', JSON.stringify(items[0]).slice(0, 500))
    }

    const resultados = (Array.isArray(items) ? items : [])
      .filter((item) => item.title)
      .map((item) => ({
        nome: item.title,
        telefone: item.phone ?? null,
        endereco: item.address ?? null,
        site: item.website ?? null,
        categoria: item.categoryName ?? null,
        avaliacao: item.totalScore ?? null,
        total_avaliacoes: item.reviewsCount ?? null,
        place_id: item.placeId ?? null,
      }))
      .filter((item) => {
        if (filtro_site === 'com') return !!item.site
        if (filtro_site === 'sem') return !item.site
        return true
      })
      .slice(0, quantidade)

    const { error: updateError } = await supabase
      .from('lead_buscas')
      .update({ status: 'concluida', quantidade_encontrada: resultados.length, resultados })
      .eq('id', buscaId)
    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ sucesso: true, busca_id: buscaId, encontrados: resultados.length, resultados }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const mensagem = err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
      ? (err as { message: string }).message
      : 'Erro desconhecido.'
    console.error('Erro:', mensagem)

    if (buscaId) {
      await supabase
        .from('lead_buscas')
        .update({ status: 'erro', erro_mensagem: mensagem })
        .eq('id', buscaId)
    }

    return new Response(JSON.stringify({ error: 'Erro ao buscar leads.', detalhe: mensagem }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
