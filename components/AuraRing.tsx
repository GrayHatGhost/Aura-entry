'use client'

import { motion } from 'framer-motion'

interface AuraRingProps {
  isExpanded: boolean
  onClick: () => void
}

export default function AuraRing({ isExpanded, onClick }: AuraRingProps) {
  return (
    <motion.div
      className="relative flex items-center justify-center select-none"
      onClick={onClick}
      animate={isExpanded ? { scale: 0.55, opacity: 0.65 } : { scale: 1, opacity: 1 }}
      transition={{ duration: 1.4, ease: [0.76, 0, 0.24, 1] }}
    >
      <motion.div
        className="absolute z-0 pointer-events-none"
        animate={{ opacity: [0.40, 0.60, 0.40] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: 140, height: 140 }}
      >
        <svg viewBox="0 0 200 220" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="wingL" cx="35%" cy="45%" r="65%">
              <stop offset="0%"   stopColor="rgba(195,172,255,0.52)" />
              <stop offset="55%"  stopColor="rgba(130,100,210,0.18)" />
              <stop offset="100%" stopColor="rgba(80,50,160,0)" />
            </radialGradient>
            <radialGradient id="wingR" cx="65%" cy="45%" r="65%">
              <stop offset="0%"   stopColor="rgba(195,172,255,0.52)" />
              <stop offset="55%"  stopColor="rgba(130,100,210,0.18)" />
              <stop offset="100%" stopColor="rgba(80,50,160,0)" />
            </radialGradient>
            <radialGradient id="bodyG" cx="50%" cy="40%" r="55%">
              <stop offset="0%"   stopColor="rgba(215,200,255,0.70)" />
              <stop offset="60%"  stopColor="rgba(150,118,230,0.20)" />
              <stop offset="100%" stopColor="rgba(90,60,180,0)" />
            </radialGradient>
            <filter id="softBlur" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5.5" />
            </filter>
            <filter id="coreBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>

          {/* Left wing — large feathery blob */}
          <motion.path
            d="M 100 80 C 70 50, 20 55, 10 100 C 4 130, 28 165, 68 178 C 52 145, 72 110, 100 80 Z"
            fill="url(#wingL)"
            filter="url(#softBlur)"
            animate={{ d: [
              'M 100 80 C 70 50, 20 55, 10 100 C 4 130, 28 165, 68 178 C 52 145, 72 110, 100 80 Z',
              'M 100 78 C 68 48, 16 56, 8 102 C 2 134, 30 168, 70 180 C 54 146, 74 112, 100 78 Z',
              'M 100 80 C 70 50, 20 55, 10 100 C 4 130, 28 165, 68 178 C 52 145, 72 110, 100 80 Z',
            ]}}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Right wing — mirror */}
          <motion.path
            d="M 100 80 C 130 50, 180 55, 190 100 C 196 130, 172 165, 132 178 C 148 145, 128 110, 100 80 Z"
            fill="url(#wingR)"
            filter="url(#softBlur)"
            animate={{ d: [
              'M 100 80 C 130 50, 180 55, 190 100 C 196 130, 172 165, 132 178 C 148 145, 128 110, 100 80 Z',
              'M 100 78 C 132 48, 184 56, 192 102 C 198 134, 170 168, 130 180 C 146 146, 126 112, 100 78 Z',
              'M 100 80 C 130 50, 180 55, 190 100 C 196 130, 172 165, 132 178 C 148 145, 128 110, 100 80 Z',
            ]}}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Body — central soft column */}
          <ellipse
            cx="100" cy="130" rx="16" ry="52"
            fill="url(#bodyG)"
            filter="url(#coreBlur)"
            opacity="0.75"
          />

          {/* Head — tiny bright orb */}
          <motion.ellipse
            cx="100" cy="62" rx="9" ry="10"
            fill="rgba(220,205,255,0.82)"
            filter="url(#coreBlur)"
            animate={{ ry: [10, 11, 9, 10], cy: [62, 60, 63, 62] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Halo — thin soft arc above head */}
          <motion.ellipse
            cx="100" cy="44" rx="20" ry="5.5"
            fill="none"
            stroke="rgba(185,160,255,0.38)"
            strokeWidth="1.2"
            animate={{ rx: [20, 22, 18, 20], opacity: [0.38, 0.55, 0.38] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          />
        </svg>
      </motion.div>

      {/* Slow rotating ring */}
      <motion.div
        className="relative rounded-full z-10 pointer-events-none"
        animate={{ rotateZ: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        style={{
          width: 138,
          height: 138,
          borderRadius: '50%',
          border: '1.5px solid rgba(155,120,255,0.28)',
          borderTopColor: 'rgba(195,170,255,0.60)',
          borderBottomColor: 'rgba(100,70,200,0.10)',
          transform: 'rotateX(62deg)',
          transformOrigin: 'center center',
          background: 'transparent',
        }}
      />
    </motion.div>
  )
}
