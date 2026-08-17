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

function SweepOverlay({ raioKm }: { raioKm: number | null }) {
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setMsgIndex((i) => (i + 1) % STATUS_MESSAGES.length), 1800)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="absolute inset-0 z-[500] flex items-end justify-center pb-4 pointer-events-none">
      {/* Varredura de radar girando sobre o mapa */}
      <div
        className="absolute inset-0 animate-radar-spin"
        style={{
          background: 'conic-gradient(from 0deg, transparent 0deg, rgba(34,197,94,0.28) 25deg, transparent 70deg)',
          maskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)',
        }}
      />
      {/* Pulsos concêntricos saindo do pino */}
      <span className="absolute inline-flex h-16 w-16 rounded-full bg-[#22c55e]/20 animate-ping" style={{ animationDuration: '2.4s' }} />
      <span className="absolute inline-flex h-28 w-28 rounded-full bg-[#22c55e]/10 animate-ping" style={{ animationDuration: '2.4s', animationDelay: '0.6s' }} />

      <div className="relative flex items-center gap-2 bg-[#09090b]/85 backdrop-blur-sm border border-[rgba(255,255,255,0.1)] rounded-full pl-2.5 pr-3.5 py-1.5">
        <Satellite size={13} className="text-[#22c55e] shrink-0" />
        <span className="text-xs text-[#e4e4e7] font-mono transition-opacity duration-300">{STATUS_MESSAGES[msgIndex]}</span>
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
}

export function RadarMap({ geo, geoLoading, raioKm, searching }: RadarMapProps) {
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
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap'
          subdomains="abcd"
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
      </MapContainer>

      {searching && <SweepOverlay raioKm={raioKm} />}

      <div className="absolute bottom-3 left-3 z-[400] pointer-events-none bg-[#09090b]/70 backdrop-blur-sm border border-[rgba(255,255,255,0.1)] rounded-[8px] px-2.5 py-1">
        <span className="text-[11px] font-mono text-[#71717a] tabular-nums">
          {geo.lat.toFixed(4)}, {geo.lon.toFixed(4)}
        </span>
      </div>
    </div>
  )
}
