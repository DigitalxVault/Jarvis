'use client'

interface F16SilhouetteProps {
  className?: string
}

export function F16Silhouette({ className = '' }: F16SilhouetteProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      style={{ imageRendering: 'pixelated' }}
    >
      <defs>
        <linearGradient id="silhouetteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00ffff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* F-16 top-down silhouette */}
      <path
        d="
          M 100 30
          L 105 45
          L 120 55
          L 140 65
          L 170 75
          L 175 80
          L 160 85
          L 130 95
          L 115 100
          L 115 105
          L 125 110
          L 140 115
          L 145 125
          L 140 135
          L 130 145
          L 120 150
          L 110 155
          L 110 165
          L 105 175
          L 100 180
          L 95 175
          L 90 165
          L 90 155
          L 80 150
          L 70 145
          L 60 135
          L 55 125
          L 60 115
          L 75 110
          L 85 105
          L 85 100
          L 70 95
          L 40 85
          L 25 80
          L 30 75
          L 60 65
          L 80 55
          L 95 45
          Z
        "
        fill="url(#silhouetteGrad)"
        stroke="#00ffff"
        strokeWidth="1.5"
        strokeOpacity="0.6"
      />

      {/* Centerline */}
      <line x1="100" y1="35" x2="100" y2="175" stroke="#00d4ff" strokeWidth="0.5" strokeOpacity="0.3" strokeDasharray="4 2" />

      {/* Nose marker */}
      <circle cx="100" cy="30" r="3" fill="#00ffff" opacity="0.8" />

      {/* Wingtip markers */}
      <circle cx="175" cy="80" r="2" fill="#00ffff" opacity="0.5" />
      <circle cx="25" cy="80" r="2" fill="#00ffff" opacity="0.5" />

      {/* Tail markers */}
      <circle cx="105" cy="175" r="2" fill="#00ffff" opacity="0.5" />
      <circle cx="95" cy="175" r="2" fill="#00ffff" opacity="0.5" />
    </svg>
  )
}
