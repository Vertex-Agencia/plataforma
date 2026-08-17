// Geocodificação client-side via Nominatim (OpenStreetMap) — gratuito, sem chave de API.
// Usado para posicionar o pino/raio no mapa da tela de busca de leads antes de disparar a busca.
// Espelha a mesma lógica usada na edge function `buscar-leads-apify`, mas roda no browser
// (não pode setar User-Agent customizado; o Referer da própria página identifica a origem).

export interface GeoPonto {
  lat: number
  lon: number
  nomeExibicao: string
}

export async function geocodificar(endereco: string, signal?: AbortSignal): Promise<GeoPonto | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(endereco)}`

  let response: Response
  try {
    response = await fetch(url, { signal })
  } catch (err) {
    // fetch rejeitado antes de qualquer resposta = bloqueio de rede/CSP/extensão do navegador,
    // não "endereço não encontrado". Repropaga com uma mensagem que dá pra diagnosticar.
    console.error('[geocodificar] fetch falhou (rede, CSP ou bloqueador):', err)
    throw new Error('Não foi possível conectar ao serviço de mapas (rede ou bloqueio do navegador).', { cause: err })
  }

  if (!response.ok) {
    console.error('[geocodificar] resposta não-ok do Nominatim:', response.status, response.statusText)
    throw new Error(`Serviço de mapas respondeu com erro (${response.status}).`)
  }

  const results: { lat: string; lon: string; display_name: string }[] = await response.json()
  const first = results[0]
  if (!first) return null

  const lat = Number(first.lat)
  const lon = Number(first.lon)
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null

  return { lat, lon, nomeExibicao: first.display_name }
}
