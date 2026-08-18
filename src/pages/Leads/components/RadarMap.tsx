import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import { MapPin, Satellite, LocateFixed } from 'lucide-react'
import type { GeoPonto } from '../../../services/geocoding'
import 'leaflet/dist/leaflet.css'

const STATUS_MESSAGES = [
  'Consultando o Google Maps...',
  'Filtrando estabelecimentos dentro do raio...',
  'Validando telefones e sites...',
  'Organizando os resultados...',
]

// Tema escuro (Stadia Maps, precisa de chave gratuita — client.stadiamaps.com) com fallback
// automático pro tema claro (CARTO Voyager, sem chave) quando a variável não está configurada,
// pra nunca quebrar o mapa por falta de credencial.
const STADIA_API_KEY = import.meta.env.VITE_STADIA_MAPS_API_KEY as string | undefined
const usaStadia = !!STADIA_API_KEY

const tileUrl = usaStadia
  ? `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=${STADIA_API_KEY}`
  : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

const tileAttribution = usaStadia
  ? '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; OpenStreetMap'
  : '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap'

function zoomParaRaio(raioKm: number | null): number {
  if (!raioKm) return 13
  if (raioKm <= 1) return 15
  if (raioKm <= 3) return 14
  if (raioKm <= 5) return 13
  if (raioKm <= 10) return 12
  if (raioKm <= 20) return 11
  return 10
}

function FlyTo({ lat, lon, zoom }: { lat: number; lon: number; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lon], zoom, { duration: 1.1 })
  }, [lat, lon, zoom, map])
  return null
}

// Placeholder decorativo (nunca real, nunca fabrica pontos) mostrado enquanto não há localização
// geocodificada — comunica "aqui vai aparecer o mapa" sem fingir dados que ainda não existem.
function EstadoOcioso() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0d0d10] flex flex-col items-center justify-center gap-3 text-center px-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      <div className="relative w-12 h-12 rounded-full bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center">
        <MapPin size={20} className="text-[#3b82f6]" />
      </div>
      <p className="relative text-sm text-[#a1a1aa] max-w-[220px]">
        Informe a localização para posicionar o raio de busca no mapa
      </p>
    </div>
  )
}

function EstadoCarregando() {
  return (
    <div className="h-full w-full rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0d0d10] flex flex-col items-center justify-center gap-3">
      <LocateFixed size={20} className="text-[#3b82f6] animate-pulse" />
      <p className="text-sm text-[#71717a]">Localizando...</p>
    </div>
  )
}

// Metros por pixel na projeção Web Mercator (a que o Leaflet usa) para uma latitude e zoom dados.
// É o que permite converter o raio em km escolhido pelo usuário no tamanho exato, em pixels,
// do círculo desenhado na tela — pra varredura do radar não "vazar" para fora dele.
function metrosPorPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom)
}

interface CirculoTela {
  x: number
  y: number
  r: number
}

function calcularCirculoTela(map: L.Map, geo: GeoPonto, raioKm: number | null): CirculoTela {
  const centro = map.latLngToContainerPoint([geo.lat, geo.lon])
  // Sem raio escolhido, usa um raio decorativo pequeno e fixo em vez de cobrir o mapa inteiro.
  const raioMetros = raioKm && raioKm > 0 ? raioKm * 1000 : 350
  const r = Math.max(28, raioMetros / metrosPorPixel(geo.lat, map.getZoom()))
  return { x: centro.x, y: centro.y, r }
}

// Varredura de radar presa exatamente aos limites do círculo do raio de busca (não ao painel
// inteiro). Vive dentro do MapContainer pra ter acesso à instância do mapa via useMap() e
// recalcular a posição/tamanho em pixels sempre que o usuário arrasta ou dá zoom.
function VarreduraNoRaio({ geo, raioKm }: { geo: GeoPonto; raioKm: number | null }) {
  const map = useMap()
  const [circulo, setCirculo] = useState<CirculoTela>(() => calcularCirculoTela(map, geo, raioKm))

  useEffect(() => {
    function atualizar() { setCirculo(calcularCirculoTela(map, geo, raioKm)) }
    atualizar()
    map.on('move zoom viewreset resize', atualizar)
    return () => { map.off('move zoom viewreset resize', atualizar) }
  }, [map, geo, raioKm])

  const size = circulo.r * 2

  return (
    <>
      {/* Varredura girando, recortada exatamente no diâmetro do círculo */}
      <div
        className="absolute z-[450] pointer-events-none animate-radar-spin rounded-full overflow-hidden"
        style={{ left: circulo.x - circulo.r, top: circulo.y - circulo.r, width: size, height: size }}
      >
        <div
          className="absolute inset-0"
          style={{ background: 'conic-gradient(from 0deg, transparent 0deg, rgba(34,197,94,0.42) 25deg, transparent 70deg)' }}
        />
      </div>
      {/* Pulso saindo do centro, contido no mesmo raio */}
      <span
        className="absolute z-[450] pointer-events-none rounded-full bg-[#22c55e]/20 animate-ping"
        style={{
          left: circulo.x - circulo.r * 0.5,
          top: circulo.y - circulo.r * 0.5,
          width: circulo.r,
          height: circulo.r,
          animationDuration: '2.4s',
        }}
      />
    </>
  )
}

function StatusPill({ raioKm, encontrados, solicitados }: { raioKm: number | null; encontrados: number | null; solicitados: number }) {
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setMsgIndex((i) => (i + 1) % STATUS_MESSAGES.length), 1800)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="absolute inset-0 z-[500] flex items-end justify-center pb-4 pointer-events-none">
      <div className="relative flex items-center gap-2 bg-[#09090b]/85 backdrop-blur-sm border border-[rgba(255,255,255,0.1)] rounded-full pl-2.5 pr-3.5 py-1.5">
        <Satellite size={13} className="text-[#22c55e] shrink-0" />
        <span className="text-xs text-[#e4e4e7] font-mono transition-opacity duration-300">{STATUS_MESSAGES[msgIndex]}</span>
        {encontrados != null && (
          <>
            <span className="w-px h-3 bg-[rgba(255,255,255,0.15)]" />
            <span className="text-xs text-[#22c55e] font-mono tabular-nums">{encontrados}/{solicitados} leads</span>
          </>
        )}
      </div>

      {raioKm != null && (
        <div className="absolute top-3 right-3 pointer-events-none bg-[#09090b]/70 backdrop-blur-sm border border-[rgba(255,255,255,0.1)] rounded-[8px] px-2.5 py-1">
          <span className="text-[11px] font-mono text-[#a1a1aa]">raio {raioKm}km</span>
        </div>
      )}
    </div>
  )
}

interface RadarMapProps {
  geo: GeoPonto | null
  geoLoading: boolean
  raioKm: number | null
  searching: boolean
  encontrados?: number | null
  solicitados?: number
}

export function RadarMap({ geo, geoLoading, raioKm, searching, encontrados = null, solicitados = 0 }: RadarMapProps) {
  const pinIcon = useMemo(
    () =>
      L.divIcon({
        className: '',
        html: `
          <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
            <span style="position:absolute;inset:0;border-radius:9999px;background:rgba(34,197,94,0.35);animation:ping 2.4s cubic-bezier(0,0,0.2,1) infinite;"></span>
            <span style="position:relative;width:13px;height:13px;border-radius:9999px;background:#22c55e;box-shadow:0 0 0 3px #ffffff, 0 1px 4px rgba(0,0,0,0.35);"></span>
          </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
    []
  )

  if (geoLoading) return <EstadoCarregando />
  if (!geo) return <EstadoOcioso />

  return (
    <div className="relative h-full w-full rounded-[16px] overflow-hidden border border-[rgba(255,255,255,0.07)]">
      <MapContainer
        center={[geo.lat, geo.lon]}
        zoom={zoomParaRaio(raioKm)}
        scrollWheelZoom
        className="vertex-map h-full w-full"
        style={{ background: usaStadia ? '#15151f' : '#e5e3df' }}
      >
        <TileLayer
          url={tileUrl}
          attribution={tileAttribution}
          subdomains={usaStadia ? 'a' : 'abcd'}
          maxZoom={19}
        />
        <FlyTo lat={geo.lat} lon={geo.lon} zoom={zoomParaRaio(raioKm)} />
        {raioKm != null && (
          <Circle
            center={[geo.lat, geo.lon]}
            radius={raioKm * 1000}
            pathOptions={{ color: '#3b82f6', weight: 1.5, fillColor: '#3b82f6', fillOpacity: 0.1 }}
          />
        )}
        <Marker position={[geo.lat, geo.lon]} icon={pinIcon} />
        {searching && <VarreduraNoRaio geo={geo} raioKm={raioKm} />}
      </MapContainer>

      {searching && <StatusPill raioKm={raioKm} encontrados={encontrados} solicitados={solicitados} />}

      <div className="absolute bottom-3 left-3 z-[400] pointer-events-none bg-[#09090b]/70 backdrop-blur-sm border border-[rgba(255,255,255,0.1)] rounded-[8px] px-2.5 py-1">
        <span className="text-[11px] font-mono text-[#71717a] tabular-nums">
          {geo.lat.toFixed(4)}, {geo.lon.toFixed(4)}
        </span>
      </div>
    </div>
  )
}
