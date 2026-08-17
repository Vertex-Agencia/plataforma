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
  const response = await fetch(url, { signal })
  if (!response.ok) return null

  const results: { lat: string; lon: string; display_name: string }[] = await response.json()
  const first = results[0]
  if (!first) return null

  const lat = Number(first.lat)
  const lon = Number(first.lon)
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null

  return { lat, lon, nomeExibicao: first.display_name }
}
