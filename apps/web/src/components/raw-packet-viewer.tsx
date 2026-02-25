'use client'

import { useState } from 'react'
import type { TelemetryPacket } from '@jarvis-dcs/shared'

interface RawPacketViewerProps {
  packets: TelemetryPacket[]
}

export function RawPacketViewer({ packets }: RawPacketViewerProps) {
  const [expanded, setExpanded] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  return (
    <div className="jarvis-panel">
      <button
        onClick={() => setExpanded(!expanded)}
        className="panel-title cursor-pointer w-full text-left flex items-center gap-2"
      >
        <span>{expanded ? '▾' : '▸'} RAW PACKETS ({packets.length})</span>
      </button>

      {expanded && (
        <div className="mt-2 max-h-[200px] overflow-y-auto text-[11px] flex flex-col gap-1">
          {packets.length === 0 && (
            <div className="opacity-30">No packets received yet...</div>
          )}
          {[...packets].reverse().map((pkt, i) => (
            <div key={i}>
              <button
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                className="w-full text-left opacity-60 hover:opacity-100 cursor-pointer py-0.5"
              >
                <span className="text-jarvis-accent">t={pkt.t_model.toFixed(1)}</span>
                {' '}ias={pkt.spd.ias_mps.toFixed(0)} alt={pkt.pos.alt_m.toFixed(0)}
              </button>
              {expandedIdx === i && (
                <pre className="text-[10px] opacity-40 pl-2 whitespace-pre-wrap break-all">
                  {JSON.stringify(pkt, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
