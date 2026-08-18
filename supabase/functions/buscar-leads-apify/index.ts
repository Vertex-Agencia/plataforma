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

// Estados de um run assíncrono do Apify que ainda não terminaram.
const APIFY_STATUS_EM_ANDAMENTO = new Set(['READY', 'RUNNING'])

// Tempo máximo acompanhando o run em background antes de desistir e marcar erro —
// evita que uma busca travada no Apify fique "pendente" pra sempre.
const POLL_INTERVALO_MS = 3000
const POLL_MAX_TENTATIVAS = 120 // ~6 minutos

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Acompanha o run do Apify em background: a cada poucos segundos consulta quantos itens já
// caíram no dataset e atualiza `quantidade_encontrada` na busca, pra o front mostrar a contagem
// subindo em tempo real. Quando o run termina, busca os itens completos, filtra/normaliza e
// grava o resultado final — igual ao fluxo síncrono de antes, só que sem bloquear a resposta.
async function acompanharBuscaEmBackground(params: {
  supabase: ReturnType<typeof createClient>
  buscaId: number
  apiToken: string
  runId: string
  datasetId: string
  filtroSite: 'ambos' | 'com' | 'sem'
  quantidade: number
}) {
  const { supabase, buscaId, apiToken, runId, datasetId, filtroSite, quantidade } = params

  try {
    let statusRun = 'READY'
    let tentativas = 0

    while (APIFY_STATUS_EM_ANDAMENTO.has(statusRun) && tentativas < POLL_MAX_TENTATIVAS) {
      await sleep(POLL_INTERVALO_MS)
      tentativas++

      const [runResp, datasetResp] = await Promise.all([
        fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`),
        fetch(`https://api.apify.com/v2/datasets/${datasetId}?token=${apiToken}`),
      ])

      if (runResp.ok) {
        const runBody = await runResp.json()
        statusRun = runBody?.data?.status ?? statusRun
      }

      if (datasetResp.ok) {
        const datasetBody = await datasetResp.json()
        const itemCount: number | undefined = datasetBody?.data?.itemCount
        if (typeof itemCount === 'number') {
          await supabase
            .from('lead_buscas')
            .update({ quantidade_encontrada: Math.min(itemCount, quantidade) })
            .eq('id', buscaId)
            .eq('status', 'pendente')
        }
      }
    }

    if (statusRun !== 'SUCCEEDED') {
      const mensagem =
        tentativas >= POLL_MAX_TENTATIVAS
          ? 'A busca demorou demais e foi interrompida.'
          : `A busca no Apify terminou com status ${statusRun}.`
      await supabase.from('lead_buscas').update({ status: 'erro', erro_mensagem: mensagem }).eq('id', buscaId)
      return
    }

    const itemsResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}&clean=true&format=json`
    )
    if (!itemsResponse.ok) {
      throw new Error(`Falha ao buscar os resultados (${itemsResponse.status}): ${await itemsResponse.text()}`)
    }
    const items: ApifyGoogleMapsItem[] = await itemsResponse.json()

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
        if (filtroSite === 'com') return !!item.site
        if (filtroSite === 'sem') return !item.site
        return true
      })
      .slice(0, quantidade)

    await supabase
      .from('lead_buscas')
      .update({ status: 'concluida', quantidade_encontrada: resultados.length, resultados })
      .eq('id', buscaId)
  } catch (err) {
    const mensagem =
      err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
        ? (err as { message: string }).message
        : 'Erro desconhecido ao acompanhar a busca.'
    console.error('Erro no acompanhamento em background:', mensagem)
    await supabase.from('lead_buscas').update({ status: 'erro', erro_mensagem: mensagem }).eq('id', buscaId)
  }
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
        quantidade_encontrada: 0,
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

    // Dispara o run de forma assíncrona (sem esperar terminar) pra poder responder rápido ao
    // front e acompanhar o progresso — em vez do endpoint run-sync-get-dataset-items, que só
    // devolve controle quando a raspagem inteira já terminou.
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actorInput),
      }
    )

    if (!runResponse.ok) {
      throw new Error(`Falha ao iniciar a busca (${runResponse.status}): ${await runResponse.text()}`)
    }

    const runBody = await runResponse.json()
    const runId: string | undefined = runBody?.data?.id
    const datasetId: string | undefined = runBody?.data?.defaultDatasetId
    if (!runId || !datasetId) throw new Error('Resposta inesperada do Apify ao iniciar a busca.')

    // Continua acompanhando o run e gravando o progresso mesmo depois da resposta HTTP ser
    // enviada — é isso que permite ao front ver `quantidade_encontrada` subindo em tempo real
    // enquanto a busca (que pode levar minutos) ainda está rodando no Apify.
    const tarefaBackground = acompanharBuscaEmBackground({
      supabase,
      buscaId,
      apiToken,
      runId,
      datasetId,
      filtroSite: filtro_site,
      quantidade,
    })
    // @ts-expect-error EdgeRuntime é global no runtime de Edge Functions do Supabase (Deno Deploy)
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(tarefaBackground)

    return new Response(JSON.stringify({ sucesso: true, busca_id: buscaId, iniciado: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
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
