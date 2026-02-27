'use client'

import type { TacticalPacket } from '@jarvis-dcs/shared'

interface WeaponsPanelProps {
  tactical: TacticalPacket | null
}

export function WeaponsPanel({ tactical }: WeaponsPanelProps) {
  const weapons = tactical?.weapons
  const cm = tactical?.countermeasures

  const stations = weapons?.stations ?? []
  const currentStation = weapons?.current_station ?? 0
  const gunRounds = weapons?.gun_rounds ?? 0
  const chaff = cm?.chaff ?? 0
  const flare = cm?.flare ?? 0

  return (
    <div className="bg-jarvis-bar/60 border-t border-jarvis-border px-4 py-2">
      <div className="flex items-center gap-4">
        {/* Gun */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] opacity-40" style={{ letterSpacing: '1px' }}>GUN</span>
          <span className={`text-[13px] font-bold tabular-nums ${
            gunRounds > 0 ? 'text-jarvis-accent' : 'text-jarvis-muted'
          }`}>
            {gunRounds}
          </span>
        </div>

        {/* Separator */}
        <div className="w-px h-4 bg-jarvis-border" />

        {/* Stations */}
        <div className="flex-1 flex items-center gap-1 overflow-x-auto">
          {stations.length > 0 ? (
            stations.map((stn) => (
              <StationBadge
                key={stn.idx}
                idx={stn.idx}
                name={stn.name}
                count={stn.count}
                isSelected={stn.idx === currentStation}
              />
            ))
          ) : (
            <span className="text-[10px] opacity-30" style={{ letterSpacing: '1px' }}>
              NO STORES DATA
            </span>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-4 bg-jarvis-border" />

        {/* Countermeasures */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-[9px] opacity-40" style={{ letterSpacing: '1px' }}>CH</span>
            <span className={`text-[12px] font-bold tabular-nums ${
              chaff > 10 ? 'text-jarvis-accent' : chaff > 0 ? 'text-jarvis-warning' : 'text-jarvis-danger'
            }`}>
              {chaff}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] opacity-40" style={{ letterSpacing: '1px' }}>FL</span>
            <span className={`text-[12px] font-bold tabular-nums ${
              flare > 10 ? 'text-jarvis-accent' : flare > 0 ? 'text-jarvis-warning' : 'text-jarvis-danger'
            }`}>
              {flare}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function StationBadge({
  idx, name, count, isSelected,
}: {
  idx: number
  name: string
  count: number
  isSelected: boolean
}) {
  // Shorten weapon names for display
  const shortName = name
    .replace(/^Pylon\s*/i, '')
    .replace(/\s+\d+$/, '')
    .slice(0, 12) || `STN ${idx}`

  return (
    <div
      className={`flex items-center gap-1 px-1.5 py-0.5 border text-[10px] ${
        isSelected
          ? 'border-jarvis-accent text-jarvis-accent bg-jarvis-accent/10'
          : count > 0
            ? 'border-jarvis-border text-jarvis-primary'
            : 'border-jarvis-border/30 text-jarvis-muted/50'
      }`}
    >
      <span className="opacity-50">{idx}</span>
      <span className="font-bold" style={{ letterSpacing: '0.5px' }}>
        {shortName}
      </span>
      <span className="tabular-nums">×{count}</span>
    </div>
  )
}
