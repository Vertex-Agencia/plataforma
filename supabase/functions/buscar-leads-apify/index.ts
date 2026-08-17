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

interface NominatimResult {
  lat: string
  lon: string
}

// Geocodifica um endereço/localização em texto livre para lat/lng usando o Nominatim (OpenStreetMap),
// serviço gratuito sem necessidade de chave de API. Retorna null se não encontrar nada (a busca
// então cai de volta para o comportamento antigo, por texto livre, sem raio).
async function geocodificarLocalizacao(localizacao: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(localizacao)}`
  const response = await fetch(url, {
    headers: { 'User-Agent': 'VertexPlataforma/1.0 (busca de leads por raio)' },
  })
  if (!response.ok) return null

  const results: NominatimResult[] = await response.json()
  if (!results[0]) return null

  const lat = Number(results[0].lat)
  const lon = Number(results[0].lon)
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null

  return { lat, lon }
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
    const { termo_busca, localizacao, quantidade, filtro_site = 'ambos', raio_km = null } = await req.json()

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
        raio_km,
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

    // Busca por raio: geocodifica a localização em texto livre para lat/lng e delimita
    // a busca do Apify a um círculo (customGeolocation). Se a geocodificação falhar, cai de
    // volta para a busca por texto livre de sempre (locationQuery) em vez de quebrar a busca.
    const geo = raio_km && Number(raio_km) > 0 ? await geocodificarLocalizacao(localizacao) : null

    const actorInput = geo
      ? {
          searchStringsArray: [termo_busca],
          customGeolocation: {
            type: 'Point',
            coordinates: [geo.lon, geo.lat],
            radiusKm: Number(raio_km),
          },
          maxCrawledPlacesPerSearch: quantidadeBruta,
          language: 'pt-BR',
        }
      : {
          searchStringsArray: [termo_busca],
          locationQuery: localizacao,
          maxCrawledPlacesPerSearch: quantidadeBruta,
          language: 'pt-BR',
        }

    const buscaResponse = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actorInput),
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
