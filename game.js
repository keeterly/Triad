// Triad — prototype v0.2 (queue rebuild + variable ATB)
// Each turn the player spends a 3-point ATB budget on a queue of actions,
// then commits with Fight. Costs: Attack 1 ATB, Special 2 ATB + 1 Resolve,
// Move 1 ATB. Team Special consumes full ATB + 3 Resolve and varies by
// formation. Actions resolve top-to-bottom against live state, so moves
// mid-queue change what later actions do (a character's contextual tech
// reflects their slot at the moment the action fires). Enemies still
// telegraph slots — positioning is the puzzle, the queue is the brush.

// ============================================================================
// SVG PORTRAITS
// ============================================================================

const PORTRAITS = {
  cassia: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="cassia-bg" cx="65%" cy="35%" r="85%">
      <stop offset="0" stop-color="#8a5430"/><stop offset="0.5" stop-color="#3a2014"/><stop offset="1" stop-color="#080403"/>
    </radialGradient>
    <linearGradient id="cassia-gold" x1="20%" y1="0%" x2="85%" y2="100%">
      <stop offset="0" stop-color="#f0d488"/><stop offset="0.45" stop-color="#a87838"/><stop offset="1" stop-color="#2a1808"/>
    </linearGradient>
    <linearGradient id="cassia-shadow" x1="0%" x2="100%">
      <stop offset="0" stop-color="#050200" stop-opacity="0.75"/><stop offset="0.55" stop-color="#050200" stop-opacity="0"/><stop offset="1" stop-color="#050200" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="100" height="130" fill="url(#cassia-bg)"/>
  <ellipse cx="55" cy="115" rx="48" ry="14" fill="#180a04" opacity="0.85"/>
  <path d="M 8 130 L 14 96 Q 30 78 50 76 Q 70 78 86 96 L 92 130 Z" fill="#3a1f10" stroke="#0a0402" stroke-width="0.8"/>
  <path d="M 20 110 Q 30 92 50 88 Q 70 92 80 110 L 78 130 L 22 130 Z" fill="#5a2818" opacity="0.7"/>
  <path d="M 30 92 Q 50 84 70 92 L 68 130 L 32 130 Z" fill="url(#cassia-gold)" stroke="#1a0e04" stroke-width="0.6"/>
  <path d="M 30 92 L 36 130 L 32 130 Z" fill="#0a0402" opacity="0.5"/>
  <path d="M 46 100 Q 50 96 54 100 L 54 116 Q 50 120 46 116 Z" fill="#6a2818" stroke="#2a0e04" stroke-width="0.5"/>
  <line x1="50" y1="100" x2="50" y2="116" stroke="#a04030" stroke-width="0.4"/>
  <path d="M 47 103 Q 50 105 53 103 Q 50 107 47 103" fill="#a87838"/>
  <path d="M 12 96 Q 18 84 30 82 L 32 94 Q 22 96 14 104 Z" fill="url(#cassia-gold)" stroke="#0a0402" stroke-width="0.6"/>
  <path d="M 88 96 Q 82 84 70 82 L 68 94 Q 78 96 86 104 Z" fill="url(#cassia-gold)" stroke="#0a0402" stroke-width="0.6"/>
  <path d="M 12 96 Q 18 88 24 86 L 22 94 Q 16 100 14 102 Z" fill="#1a0e04" opacity="0.5"/>
  <rect x="42" y="70" width="16" height="10" fill="#1a0e04"/>
  <rect x="44" y="72" width="12" height="2" fill="#3a2010" opacity="0.7"/>
  <path d="M 34 28 Q 34 16 50 14 Q 66 16 66 28 L 68 60 Q 66 76 50 78 Q 34 76 32 60 Z" fill="url(#cassia-gold)" stroke="#0a0402" stroke-width="0.8"/>
  <path d="M 34 28 Q 34 16 50 14 L 50 78 Q 34 76 32 60 Z" fill="#0a0402" opacity="0.4"/>
  <rect x="34" y="44" width="32" height="4" fill="#050200"/>
  <rect x="34" y="48" width="32" height="1.2" fill="#1a0a04" opacity="0.7"/>
  <rect x="48" y="44" width="4" height="24" fill="#050200"/>
  <path d="M 38 26 Q 50 22 62 26" stroke="#f0d488" stroke-width="0.5" fill="none" opacity="0.8"/>
  <path d="M 38 32 Q 50 28 62 32" stroke="#a87838" stroke-width="0.3" fill="none" opacity="0.5"/>
  <path d="M 64 26 Q 67 36 68 60 Q 67 70 60 76" stroke="#f0d488" stroke-width="0.7" fill="none" opacity="0.55"/>
  <path d="M 47 14 L 50 2 L 53 14 Z" fill="#f0d488" stroke="#2a1808" stroke-width="0.5"/>
  <path d="M 50 2 Q 56 6 58 14 Q 53 11 50 14" fill="#8b2e2e"/>
  <path d="M 50 2 Q 60 4 64 10 Q 58 8 53 14" fill="#a83838" opacity="0.7"/>
  <rect width="100" height="130" fill="url(#cassia-shadow)" opacity="0.55"/>
</svg>`,
  elin: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="elin-bg" cx="50%" cy="30%" r="85%">
      <stop offset="0" stop-color="#506a90"/><stop offset="0.5" stop-color="#1a2538"/><stop offset="1" stop-color="#050810"/>
    </radialGradient>
    <radialGradient id="elin-halo" cx="50%" cy="40%" r="35%">
      <stop offset="0" stop-color="#f0e0a0" stop-opacity="0.4"/><stop offset="0.5" stop-color="#88a8d0" stop-opacity="0.15"/><stop offset="1" stop-color="#88a8d0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="elin-robe" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0" stop-color="#3a4868"/><stop offset="0.5" stop-color="#222a3a"/><stop offset="1" stop-color="#0a0e1a"/>
    </linearGradient>
    <linearGradient id="elin-shadow" x1="100%" x2="0%">
      <stop offset="0" stop-color="#050810" stop-opacity="0.7"/><stop offset="0.55" stop-color="#050810" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="100" height="130" fill="url(#elin-bg)"/>
  <rect x="0" y="0" width="100" height="80" fill="url(#elin-halo)"/>
  <circle cx="50" cy="42" r="28" fill="none" stroke="#e8dcc4" stroke-width="0.6" opacity="0.35"/>
  <circle cx="50" cy="42" r="20" fill="none" stroke="#f0e8c0" stroke-width="0.4" opacity="0.4"/>
  <circle cx="50" cy="42" r="13" fill="none" stroke="#f0e0a0" stroke-width="0.3" opacity="0.5"/>
  <ellipse cx="55" cy="115" rx="48" ry="14" fill="#080a14" opacity="0.85"/>
  <path d="M 50 22 Q 22 22 22 56 L 20 130 L 80 130 L 78 56 Q 78 22 50 22 Z" fill="url(#elin-robe)" stroke="#080a14" stroke-width="0.8"/>
  <path d="M 50 22 Q 22 22 22 56 L 20 130 L 50 130 Z" fill="#0a0e1a" opacity="0.35"/>
  <path d="M 30 50 Q 32 54 30 88 Q 28 110 26 130 L 22 130 L 22 56 Q 24 50 30 50 Z" fill="#4a587a" opacity="0.45"/>
  <path d="M 50 22 Q 30 22 30 38 Q 32 28 50 28 Q 68 28 70 38 Q 70 22 50 22" fill="#1a2438"/>
  <ellipse cx="50" cy="56" rx="16" ry="22" fill="#050810"/>
  <ellipse cx="50" cy="50" rx="14" ry="20" fill="#0a0e18"/>
  <circle cx="44" cy="56" r="1.4" fill="#e8dcc4"/>
  <circle cx="56" cy="56" r="1.4" fill="#e8dcc4"/>
  <circle cx="44" cy="56" r="0.6" fill="#f0e8c0" opacity="0.9"/>
  <circle cx="56" cy="56" r="0.6" fill="#f0e8c0" opacity="0.9"/>
  <path d="M 44 64 Q 50 66 56 64" stroke="#3a4868" stroke-width="0.4" fill="none"/>
  <path d="M 46 100 L 54 100 L 54 110 L 60 110 L 60 114 L 54 114 L 54 126 L 46 126 L 46 114 L 40 114 L 40 110 L 46 110 Z" fill="#e8dcc4" opacity="0.55"/>
  <path d="M 46 100 L 54 100 L 54 110 L 60 110 L 60 114 L 54 114 L 54 126 L 46 126 L 46 114 L 40 114 L 40 110 L 46 110 Z" fill="none" stroke="#f0e0a0" stroke-width="0.3" opacity="0.7"/>
  <rect width="100" height="130" fill="url(#elin-shadow)" opacity="0.45"/>
</svg>`,
  branwen: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="branwen-bg" cx="45%" cy="35%" r="85%">
      <stop offset="0" stop-color="#506838"/><stop offset="0.5" stop-color="#1c2614"/><stop offset="1" stop-color="#060a04"/>
    </radialGradient>
    <linearGradient id="branwen-cloak" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0" stop-color="#4a5828"/><stop offset="0.5" stop-color="#283010"/><stop offset="1" stop-color="#0a1004"/>
    </linearGradient>
    <linearGradient id="branwen-shadow" x1="100%" x2="0%">
      <stop offset="0" stop-color="#060a04" stop-opacity="0.7"/><stop offset="0.55" stop-color="#060a04" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="100" height="130" fill="url(#branwen-bg)"/>
  <path d="M 10 60 Q 14 52 18 60 Q 22 52 26 60" stroke="#3a4820" stroke-width="0.5" fill="none" opacity="0.6"/>
  <path d="M 74 50 Q 78 42 82 50 Q 86 42 90 50" stroke="#3a4820" stroke-width="0.4" fill="none" opacity="0.5"/>
  <ellipse cx="55" cy="115" rx="48" ry="14" fill="#0a0a04" opacity="0.85"/>
  <path d="M 50 22 Q 26 24 26 50 L 22 130 L 78 130 L 74 50 Q 74 22 50 22 Z" fill="url(#branwen-cloak)" stroke="#0a0a04" stroke-width="0.8"/>
  <path d="M 50 22 Q 26 24 26 50 L 22 130 L 50 130 Z" fill="#0a1004" opacity="0.4"/>
  <path d="M 28 28 Q 28 18 50 16 Q 72 18 72 28 L 74 50 Q 60 38 50 38 Q 40 38 26 50 Z" fill="#1a200a" stroke="#080804" stroke-width="0.5"/>
  <path d="M 30 30 Q 32 22 38 20 Q 28 22 28 32 Z" fill="#3a4820" opacity="0.6"/>
  <path d="M 70 30 Q 68 22 62 20 Q 72 22 72 32 Z" fill="#080804"/>
  <ellipse cx="50" cy="60" rx="14" ry="18" fill="#1a0e08"/>
  <ellipse cx="50" cy="55" rx="13" ry="17" fill="#382818"/>
  <path d="M 38 52 Q 50 50 62 52" stroke="#2a1808" stroke-width="0.5" fill="none"/>
  <circle cx="45" cy="58" r="1.2" fill="#f0d488"/>
  <circle cx="55" cy="58" r="1.2" fill="#f0d488"/>
  <path d="M 38 50 L 62 50" stroke="#8b2e2e" stroke-width="2.5" opacity="0.6"/>
  <path d="M 38 50 L 62 50" stroke="#c44040" stroke-width="1.5" opacity="0.9"/>
  <path d="M 46 64 Q 50 66 54 64" stroke="#1a1004" stroke-width="0.4" fill="none"/>
  <rect x="48" y="64" width="1.5" height="6" fill="#c44040" opacity="0.5"/>
  <path d="M 78 18 Q 70 60 84 110" stroke="#3a2810" stroke-width="2.5" fill="none"/>
  <path d="M 78 18 Q 70 60 84 110" stroke="#5a3820" stroke-width="0.8" fill="none"/>
  <line x1="78" y1="18" x2="86" y2="110" stroke="#1a0e08" stroke-width="0.4"/>
  <polygon points="76,16 80,16 78,8" fill="#f0d488" stroke="#3a2010" stroke-width="0.3"/>
  <line x1="22" y1="60" x2="26" y2="100" stroke="#5a3820" stroke-width="1.2"/>
  <rect x="20" y="95" width="6" height="14" fill="#3a2810" stroke="#0a0402" stroke-width="0.3"/>
  <line x1="22" y1="98" x2="24" y2="98" stroke="#a87838" stroke-width="0.4"/>
  <line x1="22" y1="102" x2="24" y2="102" stroke="#a87838" stroke-width="0.4"/>
  <line x1="22" y1="106" x2="24" y2="106" stroke="#a87838" stroke-width="0.4"/>
  <rect width="100" height="130" fill="url(#branwen-shadow)" opacity="0.5"/>
</svg>`,
  ghoul: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="ghoul-bg" cx="40%" cy="40%" r="85%">
      <stop offset="0" stop-color="#6a4a30"/><stop offset="0.5" stop-color="#241810"/><stop offset="1" stop-color="#070302"/>
    </radialGradient>
    <radialGradient id="ghoul-skin" cx="40%" cy="35%" r="80%">
      <stop offset="0" stop-color="#9c8868"/><stop offset="0.6" stop-color="#5a4838"/><stop offset="1" stop-color="#1a1208"/>
    </radialGradient>
    <linearGradient id="ghoul-shadow" x1="0%" x2="100%">
      <stop offset="0" stop-color="#050200" stop-opacity="0"/><stop offset="0.55" stop-color="#050200" stop-opacity="0"/><stop offset="1" stop-color="#050200" stop-opacity="0.7"/>
    </linearGradient>
  </defs>
  <rect width="100" height="130" fill="url(#ghoul-bg)"/>
  <path d="M 0 100 Q 30 88 50 92 Q 70 96 100 102 L 100 130 L 0 130 Z" fill="#1a0e08" opacity="0.7"/>
  <path d="M 20 130 Q 24 100 30 92 L 70 92 Q 76 100 80 130 Z" fill="#3a2818" stroke="#0a0604" stroke-width="0.6"/>
  <path d="M 30 92 L 28 124 L 70 124 L 72 92 Z" fill="#1a1008" opacity="0.6"/>
  <path d="M 25 95 L 22 130 L 18 130 Z M 75 95 L 78 130 L 82 130 Z" fill="#5a3a20" opacity="0.4"/>
  <ellipse cx="50" cy="60" rx="32" ry="38" fill="url(#ghoul-skin)" stroke="#1a0e08" stroke-width="0.8"/>
  <path d="M 18 60 Q 16 80 22 92 Q 26 78 28 60 Z" fill="#1a0e08" opacity="0.45"/>
  <path d="M 50 24 Q 36 26 32 36 Q 40 30 50 30 Q 60 30 68 36 Q 64 26 50 24" fill="#0a0604"/>
  <ellipse cx="50" cy="56" rx="22" ry="6" fill="#1a0e08" opacity="0.5"/>
  <ellipse cx="38" cy="56" rx="6" ry="7" fill="#0a0402"/>
  <ellipse cx="62" cy="56" rx="6" ry="7" fill="#0a0402"/>
  <circle cx="38" cy="56" r="2.4" fill="#c44040"/>
  <circle cx="62" cy="56" r="2.4" fill="#c44040"/>
  <circle cx="38" cy="56" r="0.8" fill="#f0a0a0"/>
  <circle cx="62" cy="56" r="0.8" fill="#f0a0a0"/>
  <ellipse cx="38" cy="56" r="3.4" fill="none" stroke="#8b2e2e" stroke-width="0.4" opacity="0.6"/>
  <ellipse cx="62" cy="56" r="3.4" fill="none" stroke="#8b2e2e" stroke-width="0.4" opacity="0.6"/>
  <path d="M 32 78 Q 50 96 68 78 Q 66 84 50 92 Q 34 84 32 78" fill="#0a0402"/>
  <path d="M 34 80 L 36 90 L 38 80 Z M 42 80 L 44 92 L 46 80 Z M 50 80 L 52 92 L 54 80 Z M 56 80 L 58 92 L 60 80 Z M 62 80 L 64 90 L 66 80 Z" fill="#e8dcc4"/>
  <path d="M 36 82 L 38 84 L 40 82 Z M 60 82 L 62 84 L 64 82 Z" fill="#e8dcc4"/>
  <line x1="44" y1="40" x2="48" y2="46" stroke="#1a0a04" stroke-width="0.6"/>
  <line x1="56" y1="42" x2="54" y2="48" stroke="#1a0a04" stroke-width="0.5"/>
  <line x1="40" y1="68" x2="44" y2="74" stroke="#1a0a04" stroke-width="0.5"/>
  <line x1="60" y1="68" x2="56" y2="74" stroke="#1a0a04" stroke-width="0.5"/>
  <rect width="100" height="130" fill="url(#ghoul-shadow)" opacity="0.55"/>
</svg>`,
  cultist: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="cultist-bg" cx="50%" cy="30%" r="85%">
      <stop offset="0" stop-color="#5a3870"/><stop offset="0.5" stop-color="#1a1028"/><stop offset="1" stop-color="#050208"/>
    </radialGradient>
    <radialGradient id="cultist-eye" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#f0a0a0"/><stop offset="0.4" stop-color="#c44040"/><stop offset="1" stop-color="#3a0810"/>
    </radialGradient>
    <linearGradient id="cultist-robe" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0" stop-color="#28182a"/><stop offset="0.4" stop-color="#180a18"/><stop offset="1" stop-color="#0a0508"/>
    </linearGradient>
    <linearGradient id="cultist-shadow" x1="100%" x2="0%">
      <stop offset="0" stop-color="#050208" stop-opacity="0.7"/><stop offset="0.55" stop-color="#050208" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="100" height="130" fill="url(#cultist-bg)"/>
  <path d="M 20 130 Q 24 100 28 88 L 50 56 L 72 88 Q 76 100 80 130 Z" fill="url(#cultist-robe)" stroke="#050208" stroke-width="0.8"/>
  <path d="M 50 18 L 22 95 L 78 95 Z" fill="#1a0a20" stroke="#050208" stroke-width="0.8"/>
  <path d="M 50 18 L 22 95 L 50 95 Z" fill="#0a0510" opacity="0.5"/>
  <path d="M 50 18 L 60 50 L 50 56 Z" fill="#3a1840" opacity="0.6"/>
  <ellipse cx="50" cy="60" rx="14" ry="22" fill="#050208"/>
  <ellipse cx="50" cy="56" rx="12" ry="20" fill="#0a040a"/>
  <ellipse cx="50" cy="40" rx="3" ry="4" fill="url(#cultist-eye)"/>
  <circle cx="50" cy="40" r="1.2" fill="#f0e8c0"/>
  <circle cx="50" cy="40" r="0.5" fill="#0a0402"/>
  <ellipse cx="50" cy="40" rx="5" ry="6" fill="none" stroke="#c44040" stroke-width="0.4" opacity="0.5"/>
  <ellipse cx="50" cy="40" rx="7" ry="9" fill="none" stroke="#8b2e2e" stroke-width="0.3" opacity="0.3"/>
  <circle cx="44" cy="62" r="0.6" fill="#c44040" opacity="0.5"/>
  <circle cx="56" cy="62" r="0.6" fill="#c44040" opacity="0.5"/>
  <path d="M 32 78 L 50 72 L 68 78" stroke="#6a3870" stroke-width="0.4" fill="none" opacity="0.5"/>
  <path d="M 38 88 L 50 84 L 62 88" stroke="#6a3870" stroke-width="0.3" fill="none" opacity="0.4"/>
  <path d="M 50 96 L 47 102 L 53 102 Z" fill="#c44040" opacity="0.6"/>
  <line x1="50" y1="102" x2="50" y2="106" stroke="#c44040" stroke-width="0.5" opacity="0.5"/>
  <path d="M 36 110 L 64 110" stroke="#3a2010" stroke-width="0.6" opacity="0.4"/>
  <path d="M 32 120 L 68 120" stroke="#3a2010" stroke-width="0.5" opacity="0.3"/>
  <path d="M 22 92 Q 30 86 36 92 Q 30 96 22 92" fill="#1a0a18" opacity="0.6"/>
  <rect width="100" height="130" fill="url(#cultist-shadow)" opacity="0.5"/>
</svg>`,
  wraith: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="wraith-bg" cx="50%" cy="40%" r="90%">
      <stop offset="0" stop-color="#3a5878"/><stop offset="0.5" stop-color="#0a1828"/><stop offset="1" stop-color="#020610"/>
    </radialGradient>
    <radialGradient id="wraith-body" cx="50%" cy="40%" r="60%">
      <stop offset="0" stop-color="#8ab8d0" stop-opacity="0.8"/><stop offset="0.6" stop-color="#3a5878" stop-opacity="0.55"/><stop offset="1" stop-color="#0a1828" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="wraith-shadow" x1="100%" x2="0%">
      <stop offset="0" stop-color="#020610" stop-opacity="0.6"/><stop offset="0.55" stop-color="#020610" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="100" height="130" fill="url(#wraith-bg)"/>
  <path d="M 8 118 Q 22 110 36 118 Q 50 110 64 118 Q 78 110 92 118" stroke="#8ab0c8" stroke-width="0.6" fill="none" opacity="0.45"/>
  <path d="M 4 124 Q 22 118 40 124 Q 60 118 80 124 Q 92 120 96 124" stroke="#5a8aa8" stroke-width="0.4" fill="none" opacity="0.35"/>
  <ellipse cx="50" cy="62" rx="32" ry="44" fill="url(#wraith-body)"/>
  <ellipse cx="50" cy="60" rx="24" ry="36" fill="#3a5878" opacity="0.55"/>
  <ellipse cx="50" cy="60" rx="18" ry="30" fill="#506a88" opacity="0.45"/>
  <path d="M 30 24 Q 38 16 50 22 Q 62 16 70 24 Q 58 32 50 32 Q 42 32 30 24" fill="#88aac8" opacity="0.55"/>
  <ellipse cx="40" cy="56" rx="4" ry="8" fill="#020610"/>
  <ellipse cx="60" cy="56" rx="4" ry="8" fill="#020610"/>
  <circle cx="40" cy="56" r="2.2" fill="#9cd0e8"/>
  <circle cx="60" cy="56" r="2.2" fill="#9cd0e8"/>
  <circle cx="40" cy="56" r="0.8" fill="#e0f0f8"/>
  <circle cx="60" cy="56" r="0.8" fill="#e0f0f8"/>
  <ellipse cx="40" cy="56" rx="3.5" ry="6" fill="none" stroke="#5a8ac8" stroke-width="0.3" opacity="0.6"/>
  <ellipse cx="60" cy="56" rx="3.5" ry="6" fill="none" stroke="#5a8ac8" stroke-width="0.3" opacity="0.6"/>
  <path d="M 44 38 Q 48 36 46 30" stroke="#5a8aa8" stroke-width="0.3" fill="none" opacity="0.5"/>
  <path d="M 56 38 Q 52 36 54 30" stroke="#5a8aa8" stroke-width="0.3" fill="none" opacity="0.5"/>
  <ellipse cx="50" cy="80" rx="8" ry="12" fill="#020610"/>
  <ellipse cx="50" cy="78" rx="5" ry="9" fill="#0a1828"/>
  <path d="M 24 92 L 22 110 L 26 104 L 30 116 L 34 106 L 38 118 L 42 108 L 46 120 L 50 110 L 54 120 L 58 108 L 62 118 L 66 106 L 70 116 L 74 104 L 78 110 L 76 92 Z" fill="#1a2838" opacity="0.7"/>
  <path d="M 24 92 L 22 110 L 26 104 L 30 116 L 34 106 L 38 118 L 42 108 L 46 120 L 50 110 L 54 120 L 58 108 L 62 118 L 66 106 L 70 116 L 74 104 L 78 110 L 76 92 Z" fill="#3a5878" opacity="0.4"/>
  <path d="M 16 50 Q 14 70 18 90 Q 12 78 14 60 Q 10 56 16 50" fill="#3a5878" opacity="0.4"/>
  <path d="M 84 50 Q 86 70 82 90 Q 88 78 86 60 Q 90 56 84 50" fill="#3a5878" opacity="0.4"/>
  <rect width="100" height="130" fill="url(#wraith-shadow)" opacity="0.5"/>
</svg>`,
  lineCaster: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="lc-bg" cx="50%" cy="40%" r="85%">
      <stop offset="0" stop-color="#683868"/><stop offset="0.5" stop-color="#1a0a28"/><stop offset="1" stop-color="#080208"/>
    </radialGradient>
    <radialGradient id="lc-aura" cx="50%" cy="45%" r="45%">
      <stop offset="0" stop-color="#f0a0c0" stop-opacity="0.4"/><stop offset="0.5" stop-color="#c460a0" stop-opacity="0.18"/><stop offset="1" stop-color="#c460a0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="lc-robe" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0" stop-color="#3a1848"/><stop offset="0.5" stop-color="#1a0828"/><stop offset="1" stop-color="#0a0410"/>
    </linearGradient>
    <linearGradient id="lc-shadow" x1="0%" x2="100%">
      <stop offset="0" stop-color="#080208" stop-opacity="0.55"/><stop offset="0.5" stop-color="#080208" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="100" height="130" fill="url(#lc-bg)"/>
  <rect x="0" y="0" width="100" height="100" fill="url(#lc-aura)"/>
  <circle cx="50" cy="58" r="34" fill="none" stroke="#c460a0" stroke-width="0.4" opacity="0.5"/>
  <circle cx="50" cy="58" r="28" fill="none" stroke="#c460a0" stroke-width="0.3" opacity="0.4"/>
  <path d="M 24 58 L 76 58" stroke="#c460a0" stroke-width="0.3" opacity="0.3" stroke-dasharray="2 2"/>
  <path d="M 50 22 Q 22 26 22 60 L 18 130 L 82 130 L 78 60 Q 78 26 50 22 Z" fill="url(#lc-robe)" stroke="#080208" stroke-width="0.8"/>
  <path d="M 50 22 Q 22 26 22 60 L 18 130 L 50 130 Z" fill="#0a0410" opacity="0.4"/>
  <path d="M 32 28 L 50 14 L 68 28 L 64 36 L 50 24 L 36 36 Z" fill="#1a0824" stroke="#080208" stroke-width="0.5"/>
  <path d="M 50 14 L 50 22 M 42 22 L 58 22" stroke="#c460a0" stroke-width="0.3" opacity="0.7"/>
  <ellipse cx="50" cy="62" rx="14" ry="20" fill="#080208"/>
  <ellipse cx="50" cy="60" rx="12" ry="18" fill="#150828"/>
  <path d="M 38 56 Q 50 50 62 56" stroke="#f0a0c0" stroke-width="0.6" fill="none"/>
  <path d="M 38 62 Q 50 56 62 62" stroke="#e080a0" stroke-width="0.5" fill="none" opacity="0.75"/>
  <path d="M 38 68 Q 50 62 62 68" stroke="#c460a0" stroke-width="0.4" fill="none" opacity="0.55"/>
  <path d="M 38 74 Q 50 68 62 74" stroke="#a04088" stroke-width="0.3" fill="none" opacity="0.4"/>
  <circle cx="44" cy="64" r="1.6" fill="#f0c0d8"/>
  <circle cx="56" cy="64" r="1.6" fill="#f0c0d8"/>
  <circle cx="44" cy="64" r="0.6" fill="#fff8e8"/>
  <circle cx="56" cy="64" r="0.6" fill="#fff8e8"/>
  <path d="M 14 44 L 18 40 L 16 48 Z" fill="#c460a0" opacity="0.85"/>
  <circle cx="16" cy="44" r="3" fill="none" stroke="#c460a0" stroke-width="0.3" opacity="0.5"/>
  <path d="M 86 44 L 82 40 L 84 48 Z" fill="#c460a0" opacity="0.85"/>
  <circle cx="84" cy="44" r="3" fill="none" stroke="#c460a0" stroke-width="0.3" opacity="0.5"/>
  <path d="M 10 78 L 14 74 L 12 82 Z" fill="#c460a0" opacity="0.6"/>
  <path d="M 90 78 L 86 74 L 88 82 Z" fill="#c460a0" opacity="0.6"/>
  <path d="M 6 100 L 10 96 L 8 104 Z" fill="#c460a0" opacity="0.4"/>
  <path d="M 94 100 L 90 96 L 92 104 Z" fill="#c460a0" opacity="0.4"/>
  <path d="M 26 104 Q 50 100 74 104 L 70 130 L 30 130 Z" fill="#1a0828" opacity="0.6"/>
  <rect width="100" height="130" fill="url(#lc-shadow)" opacity="0.45"/>
</svg>`,
  sniper: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="sn-bg" cx="60%" cy="40%" r="85%">
      <stop offset="0" stop-color="#587038"/><stop offset="0.5" stop-color="#1c2410"/><stop offset="1" stop-color="#070a04"/>
    </radialGradient>
    <linearGradient id="sn-cloak" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0" stop-color="#3a4828"/><stop offset="0.5" stop-color="#1c2410"/><stop offset="1" stop-color="#080a04"/>
    </linearGradient>
    <linearGradient id="sn-shadow" x1="100%" x2="0%">
      <stop offset="0" stop-color="#070a04" stop-opacity="0.65"/><stop offset="0.55" stop-color="#070a04" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="100" height="130" fill="url(#sn-bg)"/>
  <ellipse cx="55" cy="118" rx="48" ry="12" fill="#080804" opacity="0.8"/>
  <path d="M 50 24 Q 24 26 26 56 L 22 130 L 78 130 L 74 56 Q 76 24 50 24 Z" fill="url(#sn-cloak)" stroke="#080a04" stroke-width="0.8"/>
  <path d="M 50 24 Q 24 26 26 56 L 22 130 L 50 130 Z" fill="#080a04" opacity="0.4"/>
  <path d="M 28 30 Q 28 20 50 18 Q 72 20 72 30 L 74 56 Q 64 44 50 44 Q 36 44 26 56 Z" fill="#1a200a" stroke="#050802" stroke-width="0.5"/>
  <path d="M 28 30 Q 32 22 42 22 Q 34 26 30 36 Z" fill="#080a04"/>
  <ellipse cx="50" cy="60" rx="14" ry="16" fill="#050802"/>
  <ellipse cx="50" cy="58" rx="13" ry="15" fill="#1a1808"/>
  <rect x="40" y="52" width="20" height="5" fill="#0a0502"/>
  <rect x="40" y="52" width="20" height="1" fill="#3a2810" opacity="0.7"/>
  <circle cx="46" cy="55" r="1.2" fill="#c44040"/>
  <circle cx="54" cy="55" r="1.2" fill="#c44040"/>
  <circle cx="46" cy="55" r="0.4" fill="#f0a0a0"/>
  <circle cx="54" cy="55" r="0.4" fill="#f0a0a0"/>
  <path d="M 38 66 L 62 66" stroke="#1a1004" stroke-width="0.5"/>
  <path d="M 40 70 L 60 70" stroke="#1a1004" stroke-width="0.4" opacity="0.7"/>
  <path d="M 10 26 Q 6 65 12 104" fill="none" stroke="#5a4830" stroke-width="2.2"/>
  <path d="M 10 26 Q 6 65 12 104" fill="none" stroke="#3a2818" stroke-width="0.6"/>
  <line x1="10" y1="26" x2="14" y2="104" stroke="#1a0e08" stroke-width="0.4"/>
  <path d="M 10 64 L 50 66" stroke="#e8dcc4" stroke-width="0.7" opacity="0.85"/>
  <path d="M 10 26 L 46 60" stroke="#e8dcc4" stroke-width="0.4" opacity="0.6"/>
  <path d="M 12 104 L 46 70" stroke="#e8dcc4" stroke-width="0.4" opacity="0.6"/>
  <polygon points="46,62 54,66 46,70 50,66" fill="#1a0e08" stroke="#3a2818" stroke-width="0.3"/>
  <polygon points="54,65 60,66 54,67" fill="#e8dcc4"/>
  <path d="M 78 80 L 88 76 L 84 84 Z" fill="#3a2818" stroke="#1a0e08" stroke-width="0.4"/>
  <line x1="78" y1="80" x2="74" y2="74" stroke="#3a2818" stroke-width="0.6"/>
  <line x1="80" y1="76" x2="78" y2="68" stroke="#5a3820" stroke-width="0.5"/>
  <line x1="82" y1="78" x2="84" y2="70" stroke="#5a3820" stroke-width="0.5"/>
  <rect width="100" height="130" fill="url(#sn-shadow)" opacity="0.5"/>
</svg>`,
  grappler: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="gr-bg" cx="40%" cy="40%" r="85%">
      <stop offset="0" stop-color="#7a4828"/><stop offset="0.5" stop-color="#241408"/><stop offset="1" stop-color="#080402"/>
    </radialGradient>
    <linearGradient id="gr-skin" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0" stop-color="#a87858"/><stop offset="0.5" stop-color="#5a3a28"/><stop offset="1" stop-color="#1a0e08"/>
    </linearGradient>
    <linearGradient id="gr-iron" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0" stop-color="#5a4838"/><stop offset="0.5" stop-color="#2a1f10"/><stop offset="1" stop-color="#0a0604"/>
    </linearGradient>
    <linearGradient id="gr-shadow" x1="0%" x2="100%">
      <stop offset="0" stop-color="#050200" stop-opacity="0"/><stop offset="0.55" stop-color="#050200" stop-opacity="0"/><stop offset="1" stop-color="#050200" stop-opacity="0.65"/>
    </linearGradient>
  </defs>
  <rect width="100" height="130" fill="url(#gr-bg)"/>
  <ellipse cx="50" cy="118" rx="50" ry="12" fill="#080402" opacity="0.85"/>
  <path d="M 8 130 L 12 92 Q 24 76 50 74 Q 76 76 88 92 L 92 130 Z" fill="url(#gr-skin)" stroke="#0a0604" stroke-width="0.8"/>
  <path d="M 8 130 L 12 92 Q 24 76 50 74 L 50 130 Z" fill="#1a0e08" opacity="0.3"/>
  <path d="M 30 90 Q 50 84 70 90 L 68 130 L 32 130 Z" fill="url(#gr-iron)" stroke="#0a0604" stroke-width="0.6"/>
  <path d="M 30 90 L 36 130 L 32 130 Z" fill="#0a0604" opacity="0.4"/>
  <rect x="46" y="92" width="8" height="36" fill="#1a0e04"/>
  <rect x="44" y="100" width="12" height="3" fill="#3a2410"/>
  <rect x="44" y="116" width="12" height="3" fill="#3a2410"/>
  <path d="M 8 92 Q 14 80 26 82 L 30 92 Q 18 96 12 104 Z" fill="url(#gr-iron)" stroke="#0a0604" stroke-width="0.6"/>
  <path d="M 92 92 Q 86 80 74 82 L 70 92 Q 82 96 88 104 Z" fill="url(#gr-iron)" stroke="#0a0604" stroke-width="0.6"/>
  <ellipse cx="50" cy="56" rx="22" ry="26" fill="url(#gr-skin)" stroke="#0a0604" stroke-width="0.6"/>
  <path d="M 28 56 Q 28 36 50 32 Q 60 36 64 50 Q 50 44 36 50 Q 30 54 28 56" fill="#1a0e08" opacity="0.6"/>
  <path d="M 32 40 Q 38 34 50 32 Q 62 34 68 40 L 66 44 Q 60 38 50 38 Q 40 38 34 44 Z" fill="#080402" stroke="#0a0604" stroke-width="0.4"/>
  <rect x="32" y="42" width="36" height="4" fill="#0a0604"/>
  <ellipse cx="40" cy="52" rx="4" ry="6" fill="#080402"/>
  <ellipse cx="60" cy="52" rx="4" ry="6" fill="#080402"/>
  <circle cx="40" cy="52" r="1.6" fill="#f0a040"/>
  <circle cx="60" cy="52" r="1.6" fill="#f0a040"/>
  <circle cx="40" cy="52" r="0.6" fill="#fff8c0"/>
  <circle cx="60" cy="52" r="0.6" fill="#fff8c0"/>
  <path d="M 36 72 Q 50 80 64 72 L 62 76 Q 50 84 38 76 Z" fill="#080402"/>
  <path d="M 38 73 L 40 78 L 42 73 M 50 73 L 52 79 L 54 73 M 58 73 L 60 78 L 62 73" fill="#3a2410"/>
  <line x1="32" y1="64" x2="36" y2="68" stroke="#1a0a04" stroke-width="0.5"/>
  <line x1="68" y1="64" x2="64" y2="68" stroke="#1a0a04" stroke-width="0.5"/>
  <line x1="34" y1="50" x2="38" y2="48" stroke="#080402" stroke-width="0.4"/>
  <line x1="66" y1="50" x2="62" y2="48" stroke="#080402" stroke-width="0.4"/>
  <circle cx="84" cy="36" r="2.4" fill="none" stroke="#8a7048" stroke-width="0.8"/>
  <circle cx="86" cy="48" r="2.4" fill="none" stroke="#8a7048" stroke-width="0.8"/>
  <circle cx="88" cy="60" r="2.4" fill="none" stroke="#8a7048" stroke-width="0.8"/>
  <circle cx="90" cy="72" r="2.4" fill="none" stroke="#a8845a" stroke-width="0.8"/>
  <circle cx="92" cy="84" r="2.4" fill="none" stroke="#a8845a" stroke-width="0.8"/>
  <path d="M 92 84 Q 98 90 96 100 Q 90 106 84 100 Q 80 96 86 94" fill="none" stroke="#c8a464" stroke-width="1.8"/>
  <path d="M 86 94 L 78 88" stroke="#c8a464" stroke-width="1.4"/>
  <path d="M 78 88 L 82 84 L 74 86" fill="#c8a464"/>
  <rect width="100" height="130" fill="url(#gr-shadow)" opacity="0.5"/>
</svg>`,
  korin: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="ko-bg" cx="55%" cy="35%" r="85%">
      <stop offset="0" stop-color="#7a2818"/><stop offset="0.5" stop-color="#3a1410"/><stop offset="1" stop-color="#0a0408"/>
    </radialGradient>
    <linearGradient id="ko-skin" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0" stop-color="#b87850"/><stop offset="0.5" stop-color="#7a4830"/><stop offset="1" stop-color="#2a1408"/>
    </linearGradient>
    <linearGradient id="ko-shadow" x1="0%" x2="100%">
      <stop offset="0" stop-color="#050200" stop-opacity="0.7"/><stop offset="0.55" stop-color="#050200" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="100" height="130" fill="url(#ko-bg)"/>
  <ellipse cx="55" cy="118" rx="50" ry="12" fill="#180a04" opacity="0.85"/>
  <path d="M 4 130 L 8 88 Q 26 68 50 66 Q 74 68 92 88 L 96 130 Z" fill="#5a2814" stroke="#0a0402" stroke-width="0.8"/>
  <path d="M 28 88 Q 50 82 72 88 L 70 130 L 30 130 Z" fill="url(#ko-skin)" stroke="#1a0a04" stroke-width="0.6"/>
  <line x1="40" y1="98" x2="48" y2="108" stroke="#8b2828" stroke-width="0.5"/>
  <line x1="50" y1="100" x2="58" y2="112" stroke="#8b2828" stroke-width="0.5"/>
  <line x1="44" y1="106" x2="52" y2="116" stroke="#8b2828" stroke-width="0.4"/>
  <ellipse cx="50" cy="56" rx="20" ry="22" fill="url(#ko-skin)" stroke="#1a0a04" stroke-width="0.8"/>
  <path d="M 26 50 Q 30 26 50 24 Q 70 26 74 50 Q 70 38 60 36 Q 50 32 40 36 Q 30 38 26 50" fill="#1a0a04"/>
  <path d="M 30 48 L 28 40 L 32 44 M 70 48 L 72 40 L 68 44" fill="#3a1810"/>
  <ellipse cx="42" cy="56" rx="3" ry="4" fill="#0a0402"/>
  <ellipse cx="58" cy="56" rx="3" ry="4" fill="#0a0402"/>
  <circle cx="42" cy="56" r="1.6" fill="#ff6020"/>
  <circle cx="58" cy="56" r="1.6" fill="#ff6020"/>
  <circle cx="42" cy="56" r="0.5" fill="#fff8e0"/>
  <circle cx="58" cy="56" r="0.5" fill="#fff8e0"/>
  <path d="M 38 70 Q 50 78 62 70 L 62 72 Q 50 80 38 72 Z" fill="#1a0408"/>
  <path d="M 40 72 L 42 76 L 44 72 M 56 72 L 58 76 L 60 72" fill="#e8dcc4"/>
  <path d="M 76 28 L 78 80 L 88 88 L 92 28 Z" fill="#48382a" stroke="#1a1008" stroke-width="0.8"/>
  <path d="M 76 28 L 92 28 L 96 14 L 86 10 L 74 14 Z" fill="#7a6850" stroke="#3a2818" stroke-width="0.8"/>
  <path d="M 80 22 L 92 22 M 78 16 L 90 16" stroke="#1a1008" stroke-width="0.4"/>
  <line x1="76" y1="50" x2="92" y2="50" stroke="#a82828" stroke-width="0.4" opacity="0.5"/>
  <rect width="100" height="130" fill="url(#ko-shadow)" opacity="0.55"/>
</svg>`,
  ash: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="ash-bg" cx="50%" cy="35%" r="85%">
      <stop offset="0" stop-color="#503870"/><stop offset="0.5" stop-color="#1a1428"/><stop offset="1" stop-color="#080610"/>
    </radialGradient>
    <radialGradient id="ash-aura" cx="50%" cy="40%" r="50%">
      <stop offset="0" stop-color="#a080f0" stop-opacity="0.45"/><stop offset="0.6" stop-color="#a080f0" stop-opacity="0.1"/><stop offset="1" stop-color="#a080f0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ash-robe" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0" stop-color="#3a2858"/><stop offset="0.5" stop-color="#1a1230"/><stop offset="1" stop-color="#080610"/>
    </linearGradient>
    <linearGradient id="ash-shadow" x1="100%" x2="0%">
      <stop offset="0" stop-color="#080610" stop-opacity="0.7"/><stop offset="0.55" stop-color="#080610" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="100" height="130" fill="url(#ash-bg)"/>
  <rect x="0" y="0" width="100" height="100" fill="url(#ash-aura)"/>
  <ellipse cx="50" cy="118" rx="48" ry="12" fill="#080610" opacity="0.85"/>
  <path d="M 50 22 Q 24 24 24 56 L 22 130 L 78 130 L 76 56 Q 76 22 50 22 Z" fill="url(#ash-robe)" stroke="#080610" stroke-width="0.8"/>
  <path d="M 50 22 Q 24 24 24 56 L 22 130 L 50 130 Z" fill="#080610" opacity="0.4"/>
  <path d="M 30 28 L 50 14 L 70 28 L 64 36 L 50 26 L 36 36 Z" fill="#1a1230" stroke="#080610" stroke-width="0.5"/>
  <ellipse cx="50" cy="58" rx="14" ry="20" fill="#080610"/>
  <ellipse cx="50" cy="56" rx="12" ry="18" fill="#1a1228"/>
  <circle cx="44" cy="56" r="1.6" fill="#c0a0ff"/>
  <circle cx="56" cy="56" r="1.6" fill="#c0a0ff"/>
  <circle cx="44" cy="56" r="0.6" fill="#ffffff"/>
  <circle cx="56" cy="56" r="0.6" fill="#ffffff"/>
  <path d="M 44 64 Q 50 66 56 64" stroke="#3a2858" stroke-width="0.4" fill="none"/>
  <path d="M 80 16 L 82 100 L 84 100 L 82 16 Z" fill="#5a4830" stroke="#1a1008" stroke-width="0.4"/>
  <ellipse cx="83" cy="14" rx="6" ry="8" fill="none" stroke="#c8a464" stroke-width="1"/>
  <ellipse cx="83" cy="14" rx="3" ry="4" fill="#a080f0" opacity="0.85"/>
  <circle cx="83" cy="14" r="1.6" fill="#fff0ff"/>
  <path d="M 83 6 L 85 12 L 81 12 Z M 83 22 L 85 16 L 81 16 Z" fill="#c8a464"/>
  <path d="M 14 50 Q 18 46 16 54 Z" fill="#a080f0" opacity="0.7"/>
  <path d="M 16 78 Q 20 74 18 82 Z" fill="#a080f0" opacity="0.5"/>
  <path d="M 12 100 Q 16 96 14 104 Z" fill="#a080f0" opacity="0.4"/>
  <rect width="100" height="130" fill="url(#ash-shadow)" opacity="0.5"/>
</svg>`,
  mira: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="mi-bg" cx="50%" cy="40%" r="85%">
      <stop offset="0" stop-color="#3a2848"/><stop offset="0.5" stop-color="#180a18"/><stop offset="1" stop-color="#050308"/>
    </radialGradient>
    <linearGradient id="mi-cloak" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0" stop-color="#2a1838"/><stop offset="0.5" stop-color="#150818"/><stop offset="1" stop-color="#050308"/>
    </linearGradient>
    <linearGradient id="mi-blade" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0" stop-color="#e0e0e8"/><stop offset="0.5" stop-color="#a0a0a8"/><stop offset="1" stop-color="#404048"/>
    </linearGradient>
    <linearGradient id="mi-shadow" x1="100%" x2="0%">
      <stop offset="0" stop-color="#050308" stop-opacity="0.7"/><stop offset="0.55" stop-color="#050308" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="100" height="130" fill="url(#mi-bg)"/>
  <ellipse cx="50" cy="118" rx="48" ry="12" fill="#080408" opacity="0.85"/>
  <path d="M 50 22 Q 22 24 22 56 L 18 130 L 82 130 L 78 56 Q 78 22 50 22 Z" fill="url(#mi-cloak)" stroke="#050308" stroke-width="0.8"/>
  <path d="M 50 22 Q 22 24 22 56 L 18 130 L 50 130 Z" fill="#050308" opacity="0.4"/>
  <path d="M 22 30 Q 28 22 50 18 Q 72 22 78 30 L 76 50 Q 70 38 50 36 Q 30 38 24 50 Z" fill="#0a0508" stroke="#050308" stroke-width="0.5"/>
  <path d="M 30 32 Q 34 26 42 24 Q 32 28 28 38 Z" fill="#1a0a18" opacity="0.7"/>
  <ellipse cx="50" cy="58" rx="14" ry="18" fill="#050308"/>
  <ellipse cx="50" cy="56" rx="12" ry="16" fill="#0a0510"/>
  <circle cx="44" cy="56" r="1.4" fill="#80f080"/>
  <circle cx="56" cy="56" r="1.4" fill="#80f080"/>
  <circle cx="44" cy="56" r="0.5" fill="#ffffff"/>
  <circle cx="56" cy="56" r="0.5" fill="#ffffff"/>
  <path d="M 38 50 L 62 50" stroke="#1a0a08" stroke-width="2.5" opacity="0.7"/>
  <path d="M 38 50 L 62 50" stroke="#48283a" stroke-width="1.2" opacity="0.85"/>
  <path d="M 14 80 L 14 110 L 18 110 L 18 80 L 22 78 L 22 76 L 10 76 L 10 78 Z" fill="url(#mi-blade)" stroke="#1a1018" stroke-width="0.4"/>
  <path d="M 14 80 L 18 80 L 16 72 Z" fill="#c0c0c8"/>
  <rect x="13" y="72" width="6" height="3" fill="#3a2018"/>
  <path d="M 86 80 L 86 110 L 82 110 L 82 80 L 78 78 L 78 76 L 90 76 L 90 78 Z" fill="url(#mi-blade)" stroke="#1a1018" stroke-width="0.4"/>
  <path d="M 86 80 L 82 80 L 84 72 Z" fill="#c0c0c8"/>
  <rect x="81" y="72" width="6" height="3" fill="#3a2018"/>
  <path d="M 26 100 L 22 110 M 30 102 L 28 112" stroke="#48283a" stroke-width="0.5" opacity="0.6"/>
  <rect width="100" height="130" fill="url(#mi-shadow)" opacity="0.5"/>
</svg>`,
  wakeling: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="wk-bg" cx="50%" cy="35%" r="95%">
      <stop offset="0" stop-color="#6a1820"/><stop offset="0.5" stop-color="#1a0810"/><stop offset="1" stop-color="#040208"/>
    </radialGradient>
    <radialGradient id="wk-aura" cx="50%" cy="35%" r="55%">
      <stop offset="0" stop-color="#ff4030" stop-opacity="0.5"/><stop offset="0.5" stop-color="#c01818" stop-opacity="0.18"/><stop offset="1" stop-color="#c01818" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="wk-cloak" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0" stop-color="#3a1014"/><stop offset="0.5" stop-color="#180408"/><stop offset="1" stop-color="#020004"/>
    </linearGradient>
    <linearGradient id="wk-shadow" x1="0%" x2="100%">
      <stop offset="0" stop-color="#020004" stop-opacity="0.6"/><stop offset="0.55" stop-color="#020004" stop-opacity="0"/><stop offset="1" stop-color="#020004" stop-opacity="0.6"/>
    </linearGradient>
  </defs>
  <rect width="100" height="130" fill="url(#wk-bg)"/>
  <rect x="0" y="0" width="100" height="100" fill="url(#wk-aura)"/>
  <ellipse cx="50" cy="120" rx="52" ry="10" fill="#040208" opacity="0.9"/>
  <path d="M 4 130 L 8 70 Q 24 36 50 30 Q 76 36 92 70 L 96 130 Z" fill="url(#wk-cloak)" stroke="#020004" stroke-width="0.8"/>
  <path d="M 4 130 L 8 70 Q 24 36 50 30 L 50 130 Z" fill="#020004" opacity="0.4"/>
  <path d="M 20 50 L 6 28 L 16 36 L 24 24 L 28 38 Z" fill="#3a1014" stroke="#1a0408" stroke-width="0.5"/>
  <path d="M 80 50 L 94 28 L 84 36 L 76 24 L 72 38 Z" fill="#3a1014" stroke="#1a0408" stroke-width="0.5"/>
  <path d="M 24 26 Q 36 14 50 12 Q 64 14 76 26 L 70 44 Q 60 32 50 32 Q 40 32 30 44 Z" fill="#1a0408" stroke="#020004" stroke-width="0.5"/>
  <ellipse cx="50" cy="62" rx="18" ry="24" fill="#020004"/>
  <ellipse cx="50" cy="58" rx="14" ry="20" fill="#0a0408"/>
  <ellipse cx="42" cy="56" rx="4" ry="6" fill="#020004"/>
  <ellipse cx="58" cy="56" rx="4" ry="6" fill="#020004"/>
  <circle cx="42" cy="56" r="2.2" fill="#ff2020"/>
  <circle cx="58" cy="56" r="2.2" fill="#ff2020"/>
  <circle cx="42" cy="56" r="0.8" fill="#ffd0d0"/>
  <circle cx="58" cy="56" r="0.8" fill="#ffd0d0"/>
  <path d="M 38 76 Q 50 84 62 76 L 64 78 Q 50 88 36 78 Z" fill="#020004"/>
  <path d="M 36 76 L 40 86 L 42 76 M 44 76 L 46 88 L 48 76 M 52 76 L 54 88 L 56 76 M 58 76 L 60 86 L 64 76" fill="#c8b0b0"/>
  <path d="M 34 50 Q 50 44 66 50 Q 60 40 50 38 Q 40 40 34 50" fill="#240810"/>
  <path d="M 6 60 Q 4 100 12 130 L 20 130 Q 14 95 18 60" fill="#2a0810" stroke="#0a0408" stroke-width="0.4"/>
  <path d="M 94 60 Q 96 100 88 130 L 80 130 Q 86 95 82 60" fill="#2a0810" stroke="#0a0408" stroke-width="0.4"/>
  <path d="M 22 28 L 50 12 L 78 28 L 50 4 Z" fill="#2a0810" stroke="#0a0408" stroke-width="0.5"/>
  <circle cx="50" cy="20" r="2" fill="#ff4040"/>
  <circle cx="50" cy="20" r="0.8" fill="#ffd0d0"/>
  <rect width="100" height="130" fill="url(#wk-shadow)" opacity="0.5"/>
</svg>`,
};

// ============================================================================
// CONSTANTS
// ============================================================================

const SLOTS = ['front', 'mid', 'back'];
const SLOT_LABELS = { front: 'Front', mid: 'Mid', back: 'Back' };
// visual display orders so the rows face each other (party right-edge = Front, enemy left-edge = Front)
const PARTY_DISPLAY_ORDER = ['back', 'mid', 'front'];
const ENEMY_DISPLAY_ORDER = ['front', 'mid', 'back'];

// queue / costs
const ATB_MAX = 3;            // total action-cost budget per turn
const ACTIONS_PER_CHAR = 2;   // each character can queue at most N actions per turn
const ACTION_ATB = {
  attack:  1,                 // basic
  special: 2,                 // signature — slower to wind up
  move:    1,                 // step ←/→
  brace:   1,                 // armor up
};
const TEAM_SPECIAL_ATB = ATB_MAX;
const SPECIAL_COST = 1;       // Resolve cost of an individual special
const TEAM_SPECIAL_COST = 3;  // Resolve cost of a team special
const BRACE_ARMOR = 2;

const RESOLVE_MAX = 5;
const RESOLVE_DRIP = 1;     // Resolve regenerated automatically each turn
const KILL_RESOLVE = 1;     // Resolve gained per enemy killed (tuned down so Team Special is a real save-up)

// stagger / chain
const STAGGER_THRESHOLD = 30;
const STAGGER_DMG_MULT = 1.5; // damage taken while staggered
const STAGGER_DURATION = 1;   // skipped enemy turns

// ============================================================================
// CHARACTERS — extreme specialists: one home slot, one ok, one weak
// passive applies always; home slot is where they shine
// ============================================================================

// Each damaging tech declares:
//   reach   — array of enemy slots it can hit (e.g. ['front'], ['mid','back'], or all 3)
//   pattern — 'front-most' | 'lowest' | 'all'   (how to pick within the reach)
// Techs that don't target enemies omit both fields; their fn signature is (s).
// Damaging techs receive a pre-resolved targets array: fn(s, targets).
const CHARS = {
  cassia: {
    id: 'cassia',
    name: 'Cassia',
    title: 'Disgraced Knight',
    school: 'physical',
    maxHp: 26,
    home: 'front',
    passive: { name: 'Steadfast', desc: '−1 dmg taken in Front' },
    techs: {
      front: {
        basic: { name: 'Greatsword Cleave', desc: '8 dmg + vuln', dmg: 8,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (!t[0]) return; applyDmgToEnemy(s, t[0], 8); if (!t[0].dead) t[0].vuln += 1; } },
        sig:   { name: 'Sunder', desc: '14 dmg + strip armor + 2 vuln', dmg: 14,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (!t[0]) return; applyDmgToEnemy(s, t[0], 14); if (!t[0].dead) { t[0].armor = 0; t[0].vuln += 2; } } },
      },
      mid: {
        basic: { name: 'Vanguard', desc: '5 dmg front + advance', dmg: 5,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 5); advance(s, 'cassia'); } },
        sig:   { name: 'Heroic Charge', desc: '9 dmg front + advance + 3 armor', dmg: 9,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 9); advance(s, 'cassia'); addArmor(s, 'cassia', 3); } },
      },
      back: {
        basic: { name: 'Banner', desc: '+2 armor party', fn: (s) => partyArmor(s, 2) },
        sig:   { name: 'Rally',  desc: 'Heal 4 to party', fn: (s) => partyHeal(s, 4) },
      },
    },
  },
  elin: {
    id: 'elin',
    name: 'Elin',
    title: 'Sister of the Veil',
    school: 'holy',
    maxHp: 19,
    home: 'mid',
    passive: { name: 'Mercy', desc: 'Heals self 1 when healing an ally' },
    techs: {
      front: {
        basic: { name: 'Phase Step', desc: '3 dmg + retreat to Mid', dmg: 3,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 3); retreat(s, 'elin'); } },
        sig:   { name: 'Veil Step', desc: '6 dmg + retreat + 2 armor', dmg: 6,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 6); retreat(s, 'elin'); addArmor(s, 'elin', 2); } },
      },
      mid: {
        basic: { name: 'Mend',         desc: 'Heal 6 lowest + cleanse', heal: 6, healTarget: 'lowest', fn: (s) => { healLowest(s, 6); cleanseLowest(s); } },
        sig:   { name: 'Greater Mend', desc: 'Heal 12 lowest + cleanse + 2 armor', heal: 12, healTarget: 'lowest', fn: (s) => { const c = healLowest(s, 12); cleanseLowest(s); if (c) c.armor += 2; } },
      },
      back: {
        basic: { name: 'Prayer',    desc: '+2 Resolve, heal 3 lowest', heal: 3, healTarget: 'lowest', fn: (s) => { gainResolve(s, 2); healLowest(s, 3); } },
        sig:   { name: 'Sanctuary', desc: '+4 armor to party', fn: (s) => partyArmor(s, 4) },
      },
    },
  },
  branwen: {
    id: 'branwen',
    name: 'Branwen',
    title: 'Outlaw Archer',
    school: 'ranged',
    maxHp: 17,
    home: 'back',
    passive: { name: 'Bleed Hunter', desc: '+2 dmg to bleeding enemies' },
    techs: {
      front: {
        // close-range when shoved to Front: melee shots
        basic: { name: 'Backstep Shot', desc: '4 dmg + bleed 1 + retreat', dmg: 4,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 4); if (!t[0].dead) t[0].bleed = Math.max(t[0].bleed, 1); } retreatFull(s, 'branwen'); } },
        sig:   { name: 'Vanish Shot', desc: '7 dmg + bleed 2 + retreat + 1 vuln', dmg: 7,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 7); if (!t[0].dead) { t[0].bleed = Math.max(t[0].bleed, 2); t[0].vuln += 1; } } retreatFull(s, 'branwen'); } },
      },
      mid: {
        // mortar-lob: skips the front line, snipes mid/back
        basic: { name: 'Trick Shot', desc: '5 dmg lowest mid/back', dmg: 5,
          reach: ['mid','back'], pattern: 'lowest',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 5); } },
        sig:   { name: 'Pierce', desc: '8 dmg lowest mid/back + ignore armor', dmg: 8,
          reach: ['mid','back'], pattern: 'lowest',
          fn: (s, t) => { if (!t[0]) return; s.ignoreArmor = true; applyDmgToEnemy(s, t[0], 8); s.ignoreArmor = false; } },
      },
      back: {
        // archer's sweet spot: full-field reach
        basic: { name: 'Volley', desc: '4 dmg + bleed 1 all', dmg: 4,
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 4)); t.forEach(e => { if (!e.dead) e.bleed = Math.max(e.bleed, 1); }); } },
        sig:   { name: 'Arrow Storm', desc: '7 dmg + bleed 2 all', dmg: 7,
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 7)); t.forEach(e => { if (!e.dead) e.bleed = Math.max(e.bleed, 2); }); } },
      },
    },
  },
  korin: {
    id: 'korin',
    name: 'Korin',
    title: 'Bloodbound Reaver',
    school: 'physical',
    maxHp: 22,
    home: 'front',
    passive: { name: 'Bloodlust', desc: '+2 dmg per 30% missing HP' },
    techs: {
      front: {
        basic: { name: 'Reckless Strike', desc: '7 dmg + 1 self-dmg', dmg: 7,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 7); applySelfDmg(s, 'korin', 1); } },
        sig:   { name: 'Berserker Cleave', desc: '11 dmg + bleed 2 + 2 self-dmg', dmg: 11,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 11); if (!t[0].dead) t[0].bleed = Math.max(t[0].bleed, 2); } applySelfDmg(s, 'korin', 2); } },
      },
      mid: {
        basic: { name: 'Wild Swing', desc: '4 dmg all', dmg: 4,
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => t.forEach(e => applyDmgToEnemy(s, e, 4)) },
        sig:   { name: 'Bloodfury', desc: '6 dmg all + bleed 1 all', dmg: 6,
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 6)); t.forEach(e => { if (!e.dead) e.bleed = Math.max(e.bleed, 1); }); } },
      },
      back: {
        basic: { name: 'Roar', desc: '+2 retaliate', fn: (s) => { const c = s.party.chars.korin; if (c && !c.downed) c.retaliate += 2; } },
        sig:   { name: 'Battle Trance', desc: '+4 retaliate, +3 armor', fn: (s) => { const c = s.party.chars.korin; if (c && !c.downed) { c.retaliate += 4; c.armor += 3; } } },
      },
    },
  },
  ash: {
    id: 'ash',
    name: 'Ash',
    title: 'Veil-Touched Mage',
    school: 'arcane',
    maxHp: 16,
    home: 'mid',
    passive: { name: 'Arcane Focus', desc: 'First attack each turn deals +2' },
    techs: {
      front: {
        basic: { name: 'Spark', desc: '3 dmg + retreat', dmg: 3,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 3); retreat(s, 'ash'); } },
        sig:   { name: 'Inferno Burst', desc: '5 dmg + 2 vuln + retreat', dmg: 5,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 5); if (!t[0].dead) t[0].vuln += 2; } retreat(s, 'ash'); } },
      },
      mid: {
        basic: { name: 'Fireball', desc: '6 dmg + 1 vuln', dmg: 6,
          reach: ['mid','back'], pattern: 'lowest',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 6); if (!t[0].dead) t[0].vuln += 1; } } },
        sig:   { name: 'Pyroclasm', desc: '9 dmg + 2 vuln', dmg: 9,
          reach: ['mid','back'], pattern: 'lowest',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 9); if (!t[0].dead) t[0].vuln += 2; } } },
      },
      back: {
        basic: { name: 'Arcane Bolts', desc: '3 dmg all', dmg: 3,
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => t.forEach(e => applyDmgToEnemy(s, e, 3)) },
        sig:   { name: 'Lightning Storm', desc: '5 dmg all + 1 vuln all', dmg: 5,
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 5)); t.forEach(e => { if (!e.dead) e.vuln += 1; }); } },
      },
    },
  },
  mira: {
    id: 'mira',
    name: 'Mira',
    title: 'Shadow Reaver',
    school: 'stealth',
    maxHp: 18,
    home: 'back',
    passive: { name: 'Eviscerate', desc: '+3 dmg vs bleeding enemies' },
    techs: {
      front: {
        basic: { name: 'Backstab', desc: '6 dmg + bleed 1 + retreat', dmg: 6,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 6); if (!t[0].dead) t[0].bleed = Math.max(t[0].bleed, 1); } retreat(s, 'mira'); } },
        sig:   { name: 'Vanish Strike', desc: '9 dmg + bleed 2 + retreat full', dmg: 9,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 9); if (!t[0].dead) t[0].bleed = Math.max(t[0].bleed, 2); } retreatFull(s, 'mira'); } },
      },
      mid: {
        basic: { name: 'Shadow Knife', desc: '4 dmg lowest + bleed 1', dmg: 4,
          reach: ['mid','back'], pattern: 'lowest',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 4); if (!t[0].dead) t[0].bleed = Math.max(t[0].bleed, 1); } } },
        sig:   { name: 'Twin Daggers', desc: '5 dmg lowest twice + bleed 2', dmg: 5, hits: 2,
          reach: ['mid','back'], pattern: 'lowest',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 5); if (!t[0].dead) applyDmgToEnemy(s, t[0], 5); if (!t[0].dead) t[0].bleed = Math.max(t[0].bleed, 2); } } },
      },
      back: {
        basic: { name: 'Poison Cloud', desc: '2 dmg all + bleed 1 all', dmg: 2,
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 2)); t.forEach(e => { if (!e.dead) e.bleed = Math.max(e.bleed, 1); }); } },
        sig:   { name: 'Shadow Storm', desc: '4 dmg all + bleed 2 all', dmg: 4,
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 4)); t.forEach(e => { if (!e.dead) e.bleed = Math.max(e.bleed, 2); }); } },
      },
    },
  },
};

// ============================================================================
// ENEMIES — slot-targeted intents create the positioning puzzle
// ============================================================================

const ENEMIES = {
  ghoul: {
    id: 'ghoul', name: 'Ghoul', title: 'Sin of Hunger', maxHp: 14,
    weakness: 'holy', resistance: 'physical',
    intents: [
      { name: 'Bite',    tag: 'ATK 6',          targetSlot: 'front', kind: 'atk', dmg: 6, fn: (s) => dmgPartyAt(s, 'front', 6) },
      { name: 'Charge',  tag: 'ATK 4 + shove',  targetSlot: 'front', kind: 'atk', dmg: 4, fn: (s) => { dmgPartyAt(s, 'front', 4); enemyShove(s, 'front', 'back'); } },
      { name: 'Frenzy',  tag: 'ATK 3 + bleed',  targetSlot: 'front', kind: 'atk', dmg: 3, fn: (s) => { dmgPartyAt(s, 'front', 3); bleedPartyAt(s, 'front', 2); } },
    ],
  },
  cultist: {
    id: 'cultist', name: 'Cultist', title: 'Sin of Whispers', maxHp: 10,
    weakness: 'physical', resistance: 'arcane',
    intents: [
      { name: 'Curse',     tag: 'WEAK 2',         targetSlot: 'front', kind: 'debuff', fn: (s) => weakSlot(s, 'front', 2) },
      { name: 'Hex',       tag: 'ATK 2 + weak',   targetSlot: 'front', kind: 'atk',    dmg: 2, fn: (s) => { dmgPartyAt(s, 'front', 2); weakSlot(s, 'front', 1); } },
      { name: 'Doom Mark', tag: 'ATK 2 + vuln',   targetSlot: 'back',  kind: 'debuff', dmg: 2, fn: (s) => { dmgPartyAt(s, 'back', 2); applyVulnParty(s, 'back', 1); } },
    ],
  },
  wraith: {
    id: 'wraith', name: 'Wraith', title: 'Sin of Sorrow', maxHp: 9,
    weakness: 'arcane', resistance: 'physical',
    intents: [
      { name: 'Spectral Bolt', tag: 'ATK 5',     targetSlot: 'back', kind: 'atk', dmg: 5, fn: (s) => dmgPartyAt(s, 'back', 5) },
      { name: 'Wail',          tag: 'ATK 2 all', targetSlot: 'all',  kind: 'aoe', dmg: 2, fn: (s) => dmgAllParty(s, 2) },
      { name: 'Drain',         tag: 'ATK 3 low', targetSlot: '?',    kind: 'atk', dmg: 3, fn: (s) => dmgLowestParty(s, 3) },
    ],
  },
  lineCaster: {
    id: 'lineCaster', name: 'Line Caster', title: 'Sin of Voices', maxHp: 12,
    weakness: 'physical', resistance: 'arcane',
    intents: [
      { name: 'Verse of Faces',   tag: 'ATK 3 F+M', targetSlot: 'fm',  kind: 'aoe', dmg: 3, fn: (s) => dmgLinePair(s, 'fm', 3) },
      { name: 'Discord',          tag: 'ATK 4 + vuln', targetSlot: 'mid', kind: 'atk', dmg: 4, fn: (s) => { dmgPartyAt(s, 'mid', 4); applyVulnParty(s, 'mid', 1); } },
      { name: 'Verse of Shadows', tag: 'ATK 3 M+B', targetSlot: 'mb',  kind: 'aoe', dmg: 3, fn: (s) => dmgLinePair(s, 'mb', 3) },
    ],
  },
  sniper: {
    id: 'sniper', name: 'Sniper', title: 'Sin of Distance', maxHp: 11,
    weakness: 'stealth', resistance: 'ranged',
    intents: [
      { name: 'Aimed Shot',       tag: 'ATK 6',        targetSlot: 'back',   kind: 'atk',    dmg: 6, fn: (s) => dmgPartyAt(s, 'back', 6) },
      { name: 'Pierce',           tag: 'ATK 3 M+B',    targetSlot: 'pierce', kind: 'aoe',    dmg: 3, fn: (s) => dmgPierce(s, 3) },
      { name: 'Crack the Shield', tag: 'ATK 2 + strip', targetSlot: 'back',   kind: 'debuff', dmg: 2, stripArmor: true, fn: (s) => {
        const c = charBySlot(s, 'back');
        if (c && !c.downed && c.armor > 0) { c.armor = 0; log(`<b>${CHARS[c.id].name}</b>'s armor shatters.`); }
        dmgPartyAt(s, 'back', 2);
      } },
    ],
  },
  grappler: {
    id: 'grappler', name: 'Grappler', title: 'Sin of Grasp', maxHp: 15,
    weakness: 'ranged', resistance: 'physical',
    intents: [
      { name: 'Hook',  tag: 'ATK 3 + pull', targetSlot: 'mid',   kind: 'atk', dmg: 3, fn: (s) => { dmgPartyAt(s, 'mid', 3); enemyShove(s, 'mid', 'front'); } },
      { name: 'Crush', tag: 'ATK 7',        targetSlot: 'front', kind: 'atk', dmg: 7, fn: (s) => dmgPartyAt(s, 'front', 7) },
      { name: 'Bind',  tag: 'WEAK 1 + bind', targetSlot: 'front', kind: 'debuff', fn: (s) => {
        const c = charBySlot(s, 'front');
        if (c && !c.downed) {
          if (c.taunt) { c.taunt = false; log(`<b>${CHARS[c.id].name}</b>'s taunt is broken.`); }
          c.weak += 1;
          log(`<b>${CHARS[c.id].name}</b> gains Weak.`);
        }
      } },
    ],
  },
  wakeling: {
    id: 'wakeling', name: 'The Wakeling', title: 'Sin of the Dawn', maxHp: 46, boss: true,
    weakness: ['arcane', 'stealth'], resistance: 'physical',
    intents: [
      { name: 'Sundering Strike', tag: 'ATK 8',         targetSlot: 'front', kind: 'atk',    dmg: 8, fn: (s) => dmgPartyAt(s, 'front', 8) },
      { name: 'Cyclone',          tag: 'ATK 3 all',     targetSlot: 'all',   kind: 'aoe',    dmg: 3, fn: (s) => dmgAllParty(s, 3) },
      { name: 'Final Sin',        tag: 'ATK 5 + bleed', targetSlot: 'mid',   kind: 'atk',    dmg: 5, fn: (s) => { dmgPartyAt(s, 'mid', 5); bleedPartyAt(s, 'mid', 2); } },
      { name: 'Hollow Reach',     tag: 'ATK 4 + vuln',  targetSlot: 'back',  kind: 'debuff', dmg: 4, fn: (s) => { dmgPartyAt(s, 'back', 4); applyVulnParty(s, 'back', 2); } },
    ],
  },
};

// ============================================================================
// ENCOUNTERS & RUN LAYOUT — 3-fight gauntlet with branching path choice
// ============================================================================

const ENCOUNTERS = {
  // standard encounters
  e1: { id: 'e1', name: 'Bone & Bile',     slots: { front: 'ghoul',      mid: 'cultist',    back: 'wraith'   } },
  e2: { id: 'e2', name: "Veil's Edge",     slots: { front: 'wraith',     mid: 'cultist',    back: 'ghoul'    } },
  e3: { id: 'e3', name: 'Line of Echoes',  slots: { front: 'cultist',    mid: 'lineCaster', back: 'wraith'   } },
  e4: { id: 'e4', name: 'Bowless Hunt',    slots: { front: 'ghoul',      mid: 'cultist',    back: 'sniper'   } },
  e5: { id: 'e5', name: 'Sundered Bond',   slots: { front: 'lineCaster', mid: 'grappler',   back: 'wraith'   } },
  e6: { id: 'e6', name: 'Quartered Sin',   slots: { front: 'cultist',    mid: 'lineCaster', back: 'sniper'   } },
  // elite encounters — harder fights that guarantee a Sigil reward on victory.
  // sigilCategory previews to the player what kind of sigil pool the win will draw from.
  ee1: { id: 'ee1', name: 'Sins Triumphant', elite: true, sigilCategory: 'combat',   slots: { front: 'grappler',  mid: 'lineCaster', back: 'sniper'  } },
  ee2: { id: 'ee2', name: 'Court of Wraiths', elite: true, sigilCategory: 'resource', slots: { front: 'grappler', mid: 'wraith', back: 'lineCaster' } },
  // boss encounter — single massive enemy, run-ending fight
  boss: { id: 'boss', name: 'The Wakeling', boss: true, slots: { front: 'wakeling' } },
};

const RUN_LAYOUT = [
  { slot: 0, label: 'First Reach',  options: ['e1', 'e2'] },
  { slot: 1, label: 'Second Reach', options: ['e3', 'ee1'] },   // normal vs elite
  { slot: 2, label: 'Final Reach',  options: ['ee2', 'boss'] }, // elite vs boss — both end the run
];

const RESOLVE_CARRY_CAP = 3;

// Pool of characters the player can encounter mid-run.
// Default starting party is the first three; the rest are recruitable between fights.
const ROSTER = ['cassia', 'elin', 'branwen', 'korin', 'ash', 'mira'];

// ============================================================================
// TECH UPGRADES — alternate variants for specific techs, picked between fights.
// Each upgrade replaces the base tech (CHARS[id].techs[slot][kind]) once applied.
// Resolution happens via getTech(s, charId, slot, kind).
// ============================================================================

const UPGRADES = {
  'cassia.front.basic.sweeping': {
    id: 'cassia.front.basic.sweeping', charId: 'cassia', slot: 'front', kind: 'basic',
    name: 'Sweeping Cleave', desc: '5 dmg front+mid + 1 vuln each', dmg: 5,
    reach: ['front','mid'], pattern: 'all',
    fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 5)); t.forEach(e => { if (!e.dead) e.vuln += 1; }); },
  },
  'cassia.front.sig.devastate': {
    id: 'cassia.front.sig.devastate', charId: 'cassia', slot: 'front', kind: 'sig',
    name: 'Devastate', desc: '18 dmg + strip armor · 3 self-dmg', dmg: 18,
    reach: ['front'], pattern: 'front-most',
    fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 18); if (!t[0].dead) t[0].armor = 0; } applySelfDmg(s, 'cassia', 3); },
  },
  'elin.mid.basic.channeled': {
    id: 'elin.mid.basic.channeled', charId: 'elin', slot: 'mid', kind: 'basic',
    name: 'Channeled Mend', desc: 'Heal 4 to all + cleanse', heal: 4, healTarget: 'all',
    fn: (s) => {
      const bonus = consumePendingBonus(s, s.currentActorId, 'healBonus');
      aliveParty(s).forEach(c => {
        const before = c.hp; c.hp = Math.min(c.maxHp, c.hp + 4 + bonus);
        const got = c.hp - before;
        if (got > 0) {
          spawnPopupId(c.id, `+${got}`, 'heal', 'party');
          fireAdjacencyHook(s, 'onHeal', s.currentActorId, c.id, got);
        }
        c.bleed = 0; c.weak = 0;
      });
    },
  },
  'elin.back.sig.battlesanctuary': {
    id: 'elin.back.sig.battlesanctuary', charId: 'elin', slot: 'back', kind: 'sig',
    name: 'Battle Sanctuary', desc: '+3 armor + 1 retaliate to party',
    fn: (s) => {
      aliveParty(s).forEach(c => {
        c.armor += 3;
        c.retaliate += 1;
        spawnPopupId(c.id, '+3⛨', 'armor', 'party');
        fireAdjacencyHook(s, 'onArmorGrant', s.currentActorId, c.id, 3);
      });
    },
  },
  // Holy damage options — give Elin offensive presence so the holy school can carry weakness exploitation
  'elin.mid.basic.searing': {
    id: 'elin.mid.basic.searing', charId: 'elin', slot: 'mid', kind: 'basic',
    name: 'Searing Light', desc: '4 holy dmg front + heal 1 lowest', dmg: 4, heal: 1, healTarget: 'lowest',
    reach: ['front'], pattern: 'front-most',
    fn: (s, t) => {
      if (t[0]) applyDmgToEnemy(s, t[0], 4);
      healLowest(s, 1);
    },
  },
  'elin.back.sig.verdict': {
    id: 'elin.back.sig.verdict', charId: 'elin', slot: 'back', kind: 'sig',
    name: "Dawn's Verdict", desc: '5 holy dmg all + 1 vuln all', dmg: 5,
    reach: ['front','mid','back'], pattern: 'all',
    fn: (s, t) => {
      t.forEach(e => applyDmgToEnemy(s, e, 5));
      t.forEach(e => { if (!e.dead) e.vuln += 1; });
    },
  },
  'branwen.back.basic.bloody': {
    id: 'branwen.back.basic.bloody', charId: 'branwen', slot: 'back', kind: 'basic',
    name: 'Bloody Volley', desc: '5 dmg + bleed 2 all', dmg: 5,
    reach: ['front','mid','back'], pattern: 'all',
    fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 5)); t.forEach(e => { if (!e.dead) e.bleed = Math.max(e.bleed, 2); }); },
  },
  'branwen.mid.sig.crippling': {
    id: 'branwen.mid.sig.crippling', charId: 'branwen', slot: 'mid', kind: 'sig',
    name: 'Crippling Pierce', desc: '9 dmg ignore armor + 2 vuln', dmg: 9,
    reach: ['mid','back'], pattern: 'lowest',
    fn: (s, t) => { if (!t[0]) return; s.ignoreArmor = true; applyDmgToEnemy(s, t[0], 9); s.ignoreArmor = false; if (!t[0].dead) t[0].vuln += 2; },
  },
  'korin.front.basic.vampiric': {
    id: 'korin.front.basic.vampiric', charId: 'korin', slot: 'front', kind: 'basic',
    name: 'Vampiric Strike', desc: '6 dmg + heal 2 self', dmg: 6, heal: 2, healTarget: 'self',
    reach: ['front'], pattern: 'front-most',
    fn: (s, t) => {
      if (t[0]) applyDmgToEnemy(s, t[0], 6);
      const c = s.party.chars.korin;
      if (c && !c.downed) {
        const before = c.hp; c.hp = Math.min(c.maxHp, c.hp + 2);
        if (c.hp > before) spawnPopupId('korin', `+${c.hp - before}`, 'heal', 'party');
      }
    },
  },
  'korin.mid.sig.warstorm': {
    id: 'korin.mid.sig.warstorm', charId: 'korin', slot: 'mid', kind: 'sig',
    name: 'War Storm', desc: '8 dmg all + bleed 2 all', dmg: 8,
    reach: ['front','mid','back'], pattern: 'all',
    fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 8)); t.forEach(e => { if (!e.dead) e.bleed = Math.max(e.bleed, 2); }); },
  },
  'ash.mid.basic.frostball': {
    id: 'ash.mid.basic.frostball', charId: 'ash', slot: 'mid', kind: 'basic',
    name: 'Frostball', desc: '5 dmg + chain 4', dmg: 5,
    reach: ['mid','back'], pattern: 'lowest',
    fn: (s, t) => {
      if (!t[0]) return;
      applyDmgToEnemy(s, t[0], 5);
      if (!t[0].dead && !t[0].staggered) {
        t[0].chain = Math.min(STAGGER_THRESHOLD, t[0].chain + 4);
        if (t[0].chain >= STAGGER_THRESHOLD) triggerStagger(s, t[0]);
      }
    },
  },
  'ash.back.sig.arcstorm': {
    id: 'ash.back.sig.arcstorm', charId: 'ash', slot: 'back', kind: 'sig',
    name: 'Arc Storm', desc: '7 dmg all + 2 vuln all', dmg: 7,
    reach: ['front','mid','back'], pattern: 'all',
    fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 7)); t.forEach(e => { if (!e.dead) e.vuln += 2; }); },
  },
  'mira.back.basic.toxic': {
    id: 'mira.back.basic.toxic', charId: 'mira', slot: 'back', kind: 'basic',
    name: 'Toxic Cloud', desc: '3 dmg all + bleed 2 all', dmg: 3,
    reach: ['front','mid','back'], pattern: 'all',
    fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 3)); t.forEach(e => { if (!e.dead) e.bleed = Math.max(e.bleed, 2); }); },
  },
  'mira.mid.sig.spinning': {
    id: 'mira.mid.sig.spinning', charId: 'mira', slot: 'mid', kind: 'sig',
    name: 'Spinning Blades', desc: '4 dmg all + bleed 2 to lowest', dmg: 4,
    reach: ['mid','back'], pattern: 'all',
    fn: (s, t) => {
      t.forEach(e => applyDmgToEnemy(s, e, 4));
      if (t.length) {
        const lowest = [...t].sort((a,b) => a.hp - b.hp)[0];
        if (lowest && !lowest.dead) lowest.bleed = Math.max(lowest.bleed, 2);
      }
    },
  },
};

// Resolve a tech reference. If the character has an upgrade applied for this
// (slot, kind), return the upgrade definition; otherwise the base tech.
function getTech(s, charId, slot, kind) {
  if (!charId || !slot || !kind) return null;
  const c = s && s.party && s.party.chars && s.party.chars[charId];
  if (c && c.upgrades) {
    const upId = c.upgrades[`${slot}.${kind}`];
    if (upId && UPGRADES[upId]) return UPGRADES[upId];
  }
  return CHARS[charId]?.techs?.[slot]?.[kind] || null;
}

// Build the list of upgrades the player can be offered right now: charId must be
// in the current party, and that tech slot must not already be upgraded.
function availableUpgrades(s) {
  const partyIds = new Set(Object.keys(s.party.chars));
  return Object.values(UPGRADES).filter(u => {
    if (!partyIds.has(u.charId)) return false;
    const c = s.party.chars[u.charId];
    return !(c.upgrades && c.upgrades[`${u.slot}.${u.kind}`]);
  });
}

// ============================================================================
// SIGILS — run-wide modifiers. Picked between fights; persist until run resets.
// Each sigil has effect hooks that the game logic checks via hasSigil(s, id).
// ============================================================================

// Sigils carry a category so elite encounters can preview the reward family.
//   combat   — offensive sharpening (more damage / status leverage)
//   defense  — staying alive (armor, healing)
//   resource — economy (ATB, Resolve, Team Special cost)
const SIGILS = {
  quickening: { id: 'quickening', name: 'Crown of Quickening', icon: '⚡', category: 'resource', desc: '+1 ATB per turn (4 total instead of 3).' },
  pact:       { id: 'pact',       name: 'Sigil of the Pact',   icon: '✦', category: 'resource', desc: 'Gain +1 Resolve per turn for each active bond between party members.' },
  wrath:      { id: 'wrath',      name: 'Ember of Wrath',      icon: '✕', category: 'combat',   desc: 'Vulnerable enemies take an extra +2 damage from all attacks.' },
  mending:    { id: 'mending',    name: 'Sigil of Mending',    icon: '✚', category: 'defense',  desc: 'At the end of your turn, your lowest-HP ally heals 2.' },
  bloodborne: { id: 'bloodborne', name: 'Bloodborne Sigil',    icon: '✤', category: 'combat',   desc: 'Bleed ticks deal +1 each turn.' },
  steel:      { id: 'steel',      name: 'Sigil of Steel',      icon: '⛨', category: 'defense',  desc: 'Start every fight with +2 armor on each party member.' },
  echo:       { id: 'echo',       name: 'Echo Sigil',          icon: '⚔', category: 'resource', desc: 'Team Special costs 1 less Resolve.' },
  patience:   { id: 'patience',   name: 'Crown of Patience',   icon: '◆', category: 'resource', desc: 'Start every fight with at least 2 Resolve.' },
  reaver:     { id: 'reaver',     name: 'Sigil of the Reaver', icon: '☠', category: 'combat',   desc: 'Killing an enemy grants +1 additional Resolve.' },
};

function hasSigil(s, id) {
  return !!(s && s.run && s.run.sigils && s.run.sigils.includes(id));
}

function getAtbMax(s) {
  let max = ATB_MAX;
  if (hasSigil(s, 'quickening')) max += 1;
  if (s && s.bonusAtb) max += s.bonusAtb;
  return max;
}

function getTeamSpecialCost(s) {
  let cost = TEAM_SPECIAL_COST;
  if (hasSigil(s, 'echo')) cost = Math.max(1, cost - 1);
  return cost;
}

function availableSigils(s) {
  const owned = new Set((s.run && s.run.sigils) || []);
  return Object.values(SIGILS).filter(sg => !owned.has(sg.id));
}

// ============================================================================
// ADJACENCY — pair synergies between adjacent positions (F-M and M-B)
// Each pair stores two synergies: one for the front-mid line, one for mid-back.
// Same pair produces a different bond depending on which adjacency line it occupies.
// ============================================================================

const ADJ = {
  'cassia+elin': {
    fm: {
      name: "Sister's Watch", type: 'bond',
      onPartyDamaged(s, charId) {
        if (charId !== 'cassia') return;
        gainResolve(s, 1);
        fireSynergyFeedback(s, "Sister's Watch", 'elin', '+1♦', 'heal');
      },
    },
    mb: {
      name: 'Veiled Vow', type: 'bond',
      onHeal(s, healerId) {
        if (healerId !== 'elin') return;
        const c = s.party.chars.cassia;
        if (!c || c.downed) return;
        c.armor += 1;
        fireSynergyFeedback(s, 'Veiled Vow', 'cassia', '+1⛨', 'armor');
      },
    },
  },
  'branwen+cassia': {
    fm: {
      name: 'Old Rivalry', type: 'friction',
      dmgMod: -2, dmgModFor: 'branwen', // -2 to Branwen's outgoing damage; see applyDmgToEnemy
    },
    mb: {
      name: 'Banner Fire', type: 'bond',
      onArmorGrant(s, granterId) {
        if (granterId !== 'cassia') return;
        const b = s.party.chars.branwen;
        if (!b || b.downed) return;
        if (b.pendingEffects.some(e => e.source === 'banner-fire')) return;
        b.pendingEffects.push({ kind: 'attackBonus', amt: 2, source: 'banner-fire' });
        fireSynergyFeedback(s, 'Banner Fire', 'branwen', '+2 atk', 'armor');
      },
    },
  },
  'branwen+elin': {
    fm: {
      name: 'Spirit Arrow', type: 'bond',
      onAttack(s, attackerId) {
        if (attackerId !== 'branwen') return;
        const e = s.party.chars.elin;
        if (!e || e.downed) return;
        if (e.pendingEffects.some(eff => eff.source === 'spirit-arrow')) return;
        e.pendingEffects.push({ kind: 'healBonus', amt: 2, source: 'spirit-arrow' });
        fireSynergyFeedback(s, 'Spirit Arrow', 'elin', '+2 heal', 'heal');
      },
    },
    mb: {
      name: "Mercy's Gift", type: 'bond',
      onHeal(s, healerId, targetId) {
        if (healerId !== 'elin' || targetId === 'branwen') return;
        const b = s.party.chars.branwen;
        if (!b || b.downed) return;
        const before = b.hp;
        b.hp = Math.min(b.maxHp, b.hp + 1);
        if (b.hp > before) fireSynergyFeedback(s, "Mercy's Gift", 'branwen', '+1', 'heal');
      },
    },
  },
  // ===== synergies introduced with Korin / Ash / Mira =====
  'cassia+korin': {
    fm: {
      name: 'Iron Bond', type: 'bond',
      onArmorGrant(s, granterId) {
        if (granterId !== 'cassia') return;
        const k = s.party.chars.korin;
        if (!k || k.downed) return;
        k.retaliate += 1;
        fireSynergyFeedback(s, 'Iron Bond', 'korin', '+1↻', 'armor');
      },
    },
    mb: {
      name: 'Bloodguard', type: 'bond',
      onPartyDamaged(s, charId) {
        if (charId !== 'cassia') return;
        const k = s.party.chars.korin;
        if (!k || k.downed) return;
        if (k.pendingEffects.some(e => e.source === 'bloodguard')) return;
        k.pendingEffects.push({ kind: 'attackBonus', amt: 2, source: 'bloodguard' });
        fireSynergyFeedback(s, 'Bloodguard', 'korin', '+2 atk', 'armor');
      },
    },
  },
  'branwen+korin': {
    fm: {
      name: 'Wild Hunt', type: 'bond',
      onAttack(s, attackerId) {
        if (attackerId !== 'korin') return;
        const b = s.party.chars.branwen;
        if (!b || b.downed) return;
        if (b.pendingEffects.some(e => e.source === 'wild-hunt')) return;
        b.pendingEffects.push({ kind: 'attackBonus', amt: 2, source: 'wild-hunt' });
        fireSynergyFeedback(s, 'Wild Hunt', 'branwen', '+2 atk', 'armor');
      },
    },
    mb: {
      name: 'Crimson Echo', type: 'bond',
      onAttack(s, attackerId) {
        if (attackerId !== 'branwen') return;
        const k = s.party.chars.korin;
        if (!k || k.downed) return;
        if (k.pendingEffects.some(e => e.source === 'crimson-echo')) return;
        k.pendingEffects.push({ kind: 'attackBonus', amt: 2, source: 'crimson-echo' });
        fireSynergyFeedback(s, 'Crimson Echo', 'korin', '+2 atk', 'armor');
      },
    },
  },
  'ash+elin': {
    fm: {
      name: 'Veiled Flame', type: 'bond',
      onAttack(s, attackerId) {
        if (attackerId !== 'ash') return;
        const el = s.party.chars.elin;
        if (!el || el.downed) return;
        const before = el.hp;
        el.hp = Math.min(el.maxHp, el.hp + 1);
        if (el.hp > before) fireSynergyFeedback(s, 'Veiled Flame', 'elin', '+1', 'heal');
      },
    },
    mb: {
      name: 'Sanctuary Fire', type: 'bond',
      onHeal(s, healerId, targetId) {
        if (healerId !== 'elin' || targetId === 'ash') return;
        const a = s.party.chars.ash;
        if (!a || a.downed) return;
        if (a.pendingEffects.some(e => e.source === 'sanctuary-fire')) return;
        a.pendingEffects.push({ kind: 'attackBonus', amt: 2, source: 'sanctuary-fire' });
        fireSynergyFeedback(s, 'Sanctuary Fire', 'ash', '+2 atk', 'heal');
      },
    },
  },
  'branwen+mira': {
    fm: {
      name: 'Sisters of Shadow', type: 'bond',
      onAttack(s, attackerId, e) {
        if (attackerId !== 'branwen' && attackerId !== 'mira') return;
        if (!e || e.dead || e.bleed === 0) return;
        const otherId = attackerId === 'branwen' ? 'mira' : 'branwen';
        const o = s.party.chars[otherId];
        if (!o || o.downed) return;
        if (o.pendingEffects.some(eff => eff.source === 'sisters-shadow')) return;
        o.pendingEffects.push({ kind: 'attackBonus', amt: 2, source: 'sisters-shadow' });
        fireSynergyFeedback(s, 'Sisters of Shadow', otherId, '+2 atk', 'armor');
      },
    },
    mb: {
      name: 'Twin Blades', type: 'bond',
      onAttack(s, attackerId, e) {
        if (attackerId !== 'branwen' && attackerId !== 'mira') return;
        if (!e || e.dead || e.bleed === 0) return;
        const otherId = attackerId === 'branwen' ? 'mira' : 'branwen';
        const o = s.party.chars[otherId];
        if (!o || o.downed) return;
        if (o.pendingEffects.some(eff => eff.source === 'twin-blades')) return;
        o.pendingEffects.push({ kind: 'attackBonus', amt: 2, source: 'twin-blades' });
        fireSynergyFeedback(s, 'Twin Blades', otherId, '+2 atk', 'armor');
      },
    },
  },
};

// ============================================================================
// STATE
// ============================================================================

let state;

function newState() {
  return {
    turn: 1,
    resolve: 0,
    queue: [],         // array of { kind, charId?, dir?, label, desc, atb, resolveCost } — sum(atb) ≤ ATB_MAX
    executing: false,  // true while queue is resolving
    over: false,       // input lock — true during end-of-fight/run overlays
    bonusAtb: 0,       // bonus ATB granted THIS turn from previous turn's weakness exploitation
    pendingBonusAtb: 0,// accumulating during this turn's resolution; applied on next startTurn
    outgoingDmgMod: 0,
    ignoreArmor: false,
    currentActorId: null, // who is acting right now (for passives + adjacency hooks)

    // run-level progress (persists across fights within a run)
    run: {
      slotIdx: 0,            // 0,1,2 — which RUN_LAYOUT entry we're on
      currentEncId: null,    // id of the active encounter, or null before first start
      completed: [],         // encIds of cleared fights, in order
      sigils: [],            // ids of acquired sigils (run-wide modifiers)
      lastVictoryElite: false, // did the most recent victory come from an elite encounter? (gates sigil reward size)
    },

    party: {
      slots: { front: 'cassia', mid: 'elin', back: 'branwen' },
      chars: {
        cassia:  newCharState('cassia'),
        elin:    newCharState('elin'),
        branwen: newCharState('branwen'),
      },
    },

    // populated by startEncounter — first slot config is loaded at init()
    enemies: { slots: {}, chars: {} },

    messages: [],
  };
}

// Begin (or restart on a new slot) a fight. Resets per-fight state but preserves
// run-level state: HP, downed status, pendingEffects, run.slotIdx, run.completed.
// Resolve is preserved up to RESOLVE_CARRY_CAP between fights (not capped on the very first fight).
function startEncounter(encId) {
  const enc = ENCOUNTERS[encId];
  if (!enc) return;
  const isFirstFight = !state.run.currentEncId;

  // reset per-fight party statuses; keep hp, downed, pendingEffects
  Object.values(state.party.chars).forEach(c => {
    c.armor = 0;
    c.bleed = 0;
    c.weak = 0;
    c.vuln = 0;
    c.taunt = false;
    c.retaliate = 0;
  });

  // rebuild enemies fresh from the encounter definition
  state.enemies.slots = { ...enc.slots };
  state.enemies.chars = {};
  SLOTS.forEach(sl => {
    const id = enc.slots[sl];
    if (id) state.enemies.chars[id] = newEnemyState(id);
  });

  state.queue = [];
  state.turn = 1;
  state.executing = false;
  state.over = false;
  state.outgoingDmgMod = 0;
  state.ignoreArmor = false;
  state.currentActorId = null;
  state.firedSynergies = new Set();
  state.run.currentEncId = encId;

  if (!isFirstFight) {
    state.resolve = Math.min(RESOLVE_CARRY_CAP, state.resolve);
  }
  // Crown of Patience — start every fight with at least 2 Resolve
  if (hasSigil(state, 'patience')) state.resolve = Math.max(state.resolve, 2);
  // Sigil of Steel — start each fight with +2 armor on each party member
  if (hasSigil(state, 'steel')) {
    Object.values(state.party.chars).forEach(c => { if (!c.downed) c.armor += 2; });
  }

  startTurn(state);
}

function newCharState(id) {
  const def = CHARS[id];
  return {
    id, hp: def.maxHp, maxHp: def.maxHp,
    armor: 0, bleed: 0, weak: 0, taunt: false, retaliate: 0, vuln: 0,
    downed: false,
    pendingEffects: [], // { kind: 'attackBonus'|'healBonus', amt, source } — consumed on use
    upgrades: {},       // map of `${slot}.${kind}` → upgrade id (persists across fights within a run)
  };
}
function newEnemyState(id) {
  const def = ENEMIES[id];
  return {
    id, hp: def.maxHp, maxHp: def.maxHp,
    armor: 0, bleed: 0, vuln: 0,
    chain: 0, staggered: false, staggerTurns: 0,
    dead: false, intentIdx: 0,
  };
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

function charBySlot(s, slot) { const id = s.party.slots[slot]; return id ? s.party.chars[id] : null; }
function enemyBySlot(s, slot) { const id = s.enemies.slots[slot]; return id ? s.enemies.chars[id] : null; }
function slotOfChar(s, id) { return SLOTS.find(sl => s.party.slots[sl] === id); }
function aliveParty(s) { return Object.values(s.party.chars).filter(c => !c.downed); }
function aliveEnemies(s) { return Object.values(s.enemies.chars).filter(e => !e.dead); }
function firstAliveEnemyFrom(s, startIdx) {
  for (let i = startIdx; i < 3; i++) { const e = enemyBySlot(s, SLOTS[i]); if (e && !e.dead) return e; }
  for (let i = startIdx - 1; i >= 0; i--) { const e = enemyBySlot(s, SLOTS[i]); if (e && !e.dead) return e; }
  return null;
}

// reach-aware target resolution. `reach` is an array of enemy slot names.
function enemiesInReach(s, reach) {
  if (!reach) return [];
  return SLOTS.filter(sl => reach.includes(sl))
    .map(sl => enemyBySlot(s, sl))
    .filter(e => e && !e.dead);
}
function frontMostInReach(s, reach) {
  const live = enemiesInReach(s, reach);
  return live.length ? live[0] : null;
}
function lowestInReach(s, reach) {
  const live = enemiesInReach(s, reach);
  if (!live.length) return null;
  return [...live].sort((a, b) => a.hp - b.hp)[0];
}
function resolveTargets(s, def) {
  if (!def || !def.reach) return null;
  if (def.pattern === 'all') return enemiesInReach(s, def.reach);
  if (def.pattern === 'lowest') { const e = lowestInReach(s, def.reach); return e ? [e] : []; }
  const e = frontMostInReach(s, def.reach);
  return e ? [e] : [];
}

// ============================================================================
// DAMAGE / HEAL — apply with popups + flashes
// ============================================================================

// Pure prediction — mirrors applyDmgToEnemy's modifier stack but never mutates state.
// Returns { amt, toHp, badge } where badge is 'WEAK!' | 'RESIST' | 'STG' | null.
// Assumes the action fires now (vuln/armor/pendings are read as-is from current state).
function previewDamage(s, e, baseAmt, actorId) {
  if (!e || e.dead || !(baseAmt > 0)) return { amt: 0, toHp: 0, badge: null };
  let amt = baseAmt;

  getAdjacencyPairs(s).forEach(p => {
    if (typeof p.synergy.dmgMod === 'number' && p.synergy.dmgModFor === actorId) {
      amt += p.synergy.dmgMod;
    }
  });
  if (actorId === 'branwen' && e.bleed > 0) amt += 2;
  if (actorId === 'mira' && e.bleed > 0) amt += 3;
  if (actorId === 'korin') {
    const k = s.party.chars.korin;
    if (k) {
      const missingPct = (k.maxHp - k.hp) / k.maxHp;
      if (missingPct >= 0.6) amt += 4;
      else if (missingPct >= 0.3) amt += 2;
    }
  }
  if (actorId === 'ash') {
    const a = s.party.chars.ash;
    if (a && !a.firstAttackUsed) amt += 2;
  }
  const actor = actorId && s.party.chars[actorId];
  if (actor && Array.isArray(actor.pendingEffects)) {
    actor.pendingEffects.forEach(eff => { if (eff.kind === 'attackBonus') amt += eff.amt; });
  }
  amt += (s.outgoingDmgMod || 0);

  if (e.vuln > 0 && amt > 0) amt += 2 + (hasSigil(s, 'wrath') ? 2 : 0);

  let badge = null;
  const actorDef = actorId ? CHARS[actorId] : null;
  if (actorDef && actorDef.school && amt > 0) {
    const enemyDef = ENEMIES[e.id];
    const asArr = x => Array.isArray(x) ? x : (x ? [x] : []);
    const weaks = asArr(enemyDef && enemyDef.weakness);
    const resists = asArr(enemyDef && enemyDef.resistance);
    if (weaks.includes(actorDef.school)) {
      amt = Math.round(amt * 1.5);
      badge = 'WEAK!';
    } else if (resists.includes(actorDef.school)) {
      amt = Math.max(1, Math.floor(amt * 0.5));
      badge = 'RESIST';
    }
  }

  if (e.staggered && amt > 0) {
    amt = Math.floor(amt * STAGGER_DMG_MULT);
    if (!badge) badge = 'STG';
  }

  amt = Math.max(0, amt);
  let toHp = amt;
  if (!s.ignoreArmor) {
    const absorbed = Math.min(e.armor, amt);
    toHp = Math.max(0, amt - absorbed);
  }
  return { amt, toHp, badge };
}

// Pure prediction for healing — mirrors healLowest/partyHeal without mutating.
// Returns the actual HP gain (clamped to maxHp). Reads any pending healBonus
// without consuming it.
function previewHeal(s, c, baseAmt, healerId) {
  if (!c || c.downed || !(baseAmt > 0)) return 0;
  let bonus = 0;
  const actor = healerId && s.party.chars[healerId];
  if (actor && Array.isArray(actor.pendingEffects)) {
    actor.pendingEffects.forEach(eff => { if (eff.kind === 'healBonus') bonus += eff.amt; });
  }
  const total = baseAmt + bonus;
  return Math.min(c.maxHp - c.hp, total);
}

// Resolve the heal targets for a variant given its healTarget pattern.
// Returns an array of party char states (alive only). 'lowest' returns one.
function resolveHealTargets(s, variant, healerId) {
  if (!variant || !variant.heal) return [];
  const alive = aliveParty(s);
  if (alive.length === 0) return [];
  if (variant.healTarget === 'all')    return alive;
  if (variant.healTarget === 'self') {
    if (!healerId) return [];
    const me = s.party.chars[healerId];
    return me && !me.downed ? [me] : [];
  }
  // default 'lowest'
  return [alive.slice().sort((a,b) => (a.hp/a.maxHp) - (b.hp/b.maxHp))[0]];
}

// Pure prediction for incoming damage to a party member from an enemy intent.
// Mirrors applyDmgToParty's modifier stack (Cassia Steadfast, vuln, armor)
// without mutating state. opts.armor / opts.vuln override current state so the
// caller can simulate sequential hits within a turn.
function previewIncomingDmg(s, c, baseAmt, opts) {
  if (!c || c.downed || !(baseAmt > 0)) return { amt: 0, toHp: 0 };
  let amt = baseAmt;
  if (c.id === 'cassia' && slotOfChar(s, 'cassia') === 'front') amt = Math.max(0, amt - 1);
  const vuln = (opts && typeof opts.vuln === 'number') ? opts.vuln : c.vuln;
  if (vuln > 0 && amt > 0) amt += 2;
  const baseArmor = (opts && typeof opts.armor === 'number') ? opts.armor : c.armor;
  const effArmor = (opts && opts.stripArmor) ? 0 : baseArmor;
  const absorbed = Math.min(effArmor, amt);
  const toHp = Math.max(0, amt - absorbed);
  return { amt, toHp };
}

// Which party char IDs does this intent target right now?
function intentTargetCharIds(s, intent) {
  const ts = intent.targetSlot;
  const ids = [];
  if (ts === 'all') {
    aliveParty(s).forEach(c => ids.push(c.id));
  } else if (ts === 'fm') {
    ['front','mid'].forEach(sl => { const c = charBySlot(s, sl); if (c && !c.downed) ids.push(c.id); });
  } else if (ts === 'mb' || ts === 'pierce') {
    ['mid','back'].forEach(sl => { const c = charBySlot(s, sl); if (c && !c.downed) ids.push(c.id); });
  } else if (ts === '?') {
    const alive = aliveParty(s).slice().sort((a,b) => (a.hp/a.maxHp) - (b.hp/b.maxHp));
    if (alive[0]) ids.push(alive[0].id);
  } else if (ts === 'front' || ts === 'mid' || ts === 'back') {
    const c = charBySlot(s, ts);
    if (c && !c.downed) ids.push(c.id);
  }
  return ids;
}

// Multi-hit-aware wrapper around previewDamage. Twin Daggers etc. land the
// same baseAmt multiple times, but armor only absorbs once and vuln only
// procs once per hit — so a naive (toHp * hits) overstates damage on armored
// targets and understates it after vuln consumption. Simulate a working copy.
function previewMultiHit(s, e, baseAmt, actorId, hits) {
  hits = hits || 1;
  let totalHp = 0;
  let badge = null;
  let simArmor = e.armor;
  let simVuln = e.vuln;
  for (let i = 0; i < hits; i++) {
    const sim = Object.assign({}, e, { armor: simArmor, vuln: simVuln });
    const r = previewDamage(s, sim, baseAmt, actorId);
    totalHp += r.toHp;
    if (r.badge && !badge) badge = r.badge;
    if (simVuln > 0 && r.amt > 0) simVuln -= 1;
    if (!s.ignoreArmor) simArmor = Math.max(0, simArmor - r.amt);
  }
  return { dmg: totalHp, badge };
}

function applyDmgToEnemy(s, e, baseAmt) {
  if (!e || e.dead) return;
  let amt = baseAmt;

  // adjacency dmgMod (e.g. Old Rivalry friction on Branwen in FM line)
  getAdjacencyPairs(s).forEach(p => {
    if (typeof p.synergy.dmgMod === 'number' && p.synergy.dmgModFor === s.currentActorId) {
      amt += p.synergy.dmgMod;
    }
  });
  // Branwen Bleed Hunter passive
  if (s.currentActorId === 'branwen' && e.bleed > 0) amt += 2;
  // Mira Eviscerate passive — bigger crit on bleeding enemies
  if (s.currentActorId === 'mira' && e.bleed > 0) amt += 3;
  // Korin Bloodlust passive — scaling damage based on missing HP %
  if (s.currentActorId === 'korin') {
    const k = s.party.chars.korin;
    if (k) {
      const missingPct = (k.maxHp - k.hp) / k.maxHp;
      if (missingPct >= 0.6) amt += 4;
      else if (missingPct >= 0.3) amt += 2;
    }
  }
  // Ash Arcane Focus passive — first attack each turn deals +2
  if (s.currentActorId === 'ash') {
    const a = s.party.chars.ash;
    if (a && !a.firstAttackUsed) {
      amt += 2;
      a.firstAttackUsed = true;
    }
  }
  // pending one-shot attack bonuses (Banner Fire, Wild Hunt, etc.)
  amt += consumePendingBonus(s, s.currentActorId, 'attackBonus');
  amt += s.outgoingDmgMod;

  // vulnerable adds +2 per stack consumed (1 stack per hit); Ember of Wrath sigil adds +2 more
  let vulnConsumed = 0;
  if (e.vuln > 0 && amt > 0) {
    amt += 2 + (hasSigil(s, 'wrath') ? 2 : 0);
    vulnConsumed = 1;
  }

  // School weakness / resistance — actor's school vs enemy's weak/resist (may be arrays)
  let schoolBadge = null;
  const actorDef = s.currentActorId ? CHARS[s.currentActorId] : null;
  if (actorDef && actorDef.school && amt > 0) {
    const enemyDef = ENEMIES[e.id];
    const asArr = x => Array.isArray(x) ? x : (x ? [x] : []);
    const weaks = asArr(enemyDef && enemyDef.weakness);
    const resists = asArr(enemyDef && enemyDef.resistance);
    if (weaks.includes(actorDef.school)) {
      amt = Math.round(amt * 1.5);
      schoolBadge = 'WEAK!';
      // press-turn loop: weakness hit banks +1 ATB for next turn (capped at +2)
      s.pendingBonusAtb = Math.min(2, (s.pendingBonusAtb || 0) + 1);
    } else if (resists.includes(actorDef.school)) {
      amt = Math.max(1, Math.floor(amt * 0.5));
      schoolBadge = 'RESIST';
    }
  }

  // staggered = +50% damage taken
  if (e.staggered && amt > 0) amt = Math.floor(amt * STAGGER_DMG_MULT);

  amt = Math.max(0, amt);
  if (amt === 0) {
    spawnPopupId(e.id, 'miss', 'miss', 'enemy');
    log(`<b>${ENEMIES[e.id].name}</b> shrugs it off.`);
    return;
  }

  let toHp = amt;
  if (!s.ignoreArmor) {
    const absorbed = Math.min(e.armor, amt);
    e.armor = Math.max(0, e.armor - amt);
    toHp = amt - absorbed;
  }
  e.hp = Math.max(0, e.hp - toHp);
  if (vulnConsumed) e.vuln = Math.max(0, e.vuln - 1);

  // chain build-up (skipped if already staggered or no HP damage)
  if (!e.staggered && toHp > 0) {
    let chainGain = toHp;
    if (vulnConsumed) chainGain *= 2;
    e.chain = Math.min(STAGGER_THRESHOLD, e.chain + chainGain);
    if (e.chain >= STAGGER_THRESHOLD) triggerStagger(s, e);
  }

  const popupType = e.staggered ? 'crit' : (schoolBadge === 'WEAK!' ? 'crit' : 'dmg');
  spawnPopupId(e.id, `-${toHp}`, popupType, 'enemy');
  if (schoolBadge) {
    setTimeout(() => spawnPopupId(e.id, schoolBadge, schoolBadge === 'WEAK!' ? 'crit' : 'miss', 'enemy'), 80);
  }
  flashCardId(e.id, 'hit', 'enemy');
  log(`<b>${ENEMIES[e.id].name}</b> takes ${toHp} damage${e.staggered ? ' (stagger!)' : ''}${schoolBadge ? ` — ${schoolBadge.toLowerCase()}` : ''}.`);
  if (s.currentActorId && toHp > 0) fireAdjacencyHook(s, 'onAttack', s.currentActorId, e, toHp);
  if (e.hp === 0) killEnemy(s, e);
}

function triggerStagger(s, e) {
  e.staggered = true;
  e.staggerTurns = STAGGER_DURATION;
  spawnPopupId(e.id, 'STAGGER', 'stagger', 'enemy');
  flashCardId(e.id, 'hit', 'enemy');
  log(`<b>${ENEMIES[e.id].name}</b> is STAGGERED!`);
}

function killEnemy(s, e) {
  e.dead = true;
  log(`<b>${ENEMIES[e.id].name}</b> falls.`);
  gainResolve(s, KILL_RESOLVE + (hasSigil(s, 'reaver') ? 1 : 0));
}

function applyDmgToParty(s, c, amt) {
  if (!c || c.downed) return;
  // Cassia "Steadfast" — -1 dmg when in Front
  if (c.id === 'cassia' && slotOfChar(s, 'cassia') === 'front') amt = Math.max(0, amt - 1);
  // Vulnerable on party
  if (c.vuln > 0 && amt > 0) { amt += 2; c.vuln = Math.max(0, c.vuln - 1); }

  const absorbed = Math.min(c.armor, amt);
  c.armor = Math.max(0, c.armor - amt);
  const toHp = amt - absorbed;
  c.hp = Math.max(0, c.hp - toHp);

  spawnPopupId(c.id, `-${toHp}`, 'dmg', 'party');
  flashCardId(c.id, 'hit', 'party');
  log(`<b>${CHARS[c.id].name}</b> takes ${toHp} damage.`);

  fireAdjacencyHook(s, 'onPartyDamaged', c.id, toHp);

  // Retaliate
  if (c.retaliate > 0 && toHp > 0) {
    log(`<b>${CHARS[c.id].name}</b> retaliates!`);
    const target = firstAliveEnemyFrom(s, 0);
    if (target) applyDmgToEnemy(s, target, c.retaliate);
  }

  if (c.hp === 0) {
    c.downed = true;
    c.pendingEffects = [];
    log(`<b>${CHARS[c.id].name}</b> falls.`);
  }
}

function applySelfDmg(s, charId, amt) {
  const c = s.party.chars[charId];
  if (!c || c.downed) return;
  c.hp = Math.max(0, c.hp - amt);
  spawnPopupId(charId, `-${amt}`, 'dmg', 'party');
  flashCardId(charId, 'hit', 'party');
  log(`<b>${CHARS[charId].name}</b> takes ${amt} self damage.`);
  if (c.hp === 0) { c.downed = true; c.pendingEffects = []; log(`<b>${CHARS[charId].name}</b> falls.`); }
}

// ============================================================================
// EFFECT HELPERS (used by techs/intents)
// ============================================================================

function dmgEnemyAt(s, startIdx, amt) {
  const e = firstAliveEnemyFrom(s, startIdx);
  if (e) applyDmgToEnemy(s, e, amt);
}
function dmgEnemyLowest(s, amt) {
  const alive = aliveEnemies(s); if (alive.length === 0) return;
  alive.sort((a, b) => a.hp - b.hp);
  applyDmgToEnemy(s, alive[0], amt);
}
function dmgAllEnemies(s, amt) { aliveEnemies(s).forEach(e => applyDmgToEnemy(s, e, amt)); }

function stripArmor(s, idx) {
  const e = firstAliveEnemyFrom(s, idx);
  if (e) e.armor = 0;
}
function bleedEnemyAt(s, idx, turns) {
  const e = firstAliveEnemyFrom(s, idx);
  if (e) e.bleed = Math.max(e.bleed, turns);
}
function applyVulnEnemy(s, idx, stacks) {
  const e = firstAliveEnemyFrom(s, idx);
  if (e) e.vuln += stacks;
}

function addArmor(s, id, amt) {
  const c = s.party.chars[id];
  if (!c || c.downed) return;
  c.armor += amt;
  fireAdjacencyHook(s, 'onArmorGrant', s.currentActorId, id, amt);
}
function partyArmor(s, amt) {
  aliveParty(s).forEach(c => {
    c.armor += amt;
    spawnPopupId(c.id, `+${amt}⛨`, 'armor', 'party');
    fireAdjacencyHook(s, 'onArmorGrant', s.currentActorId, c.id, amt);
  });
}
function partyHeal(s, amt) {
  const bonus = consumePendingBonus(s, s.currentActorId, 'healBonus');
  const total = amt + bonus;
  aliveParty(s).forEach(c => {
    const before = c.hp;
    c.hp = Math.min(c.maxHp, c.hp + total);
    const got = c.hp - before;
    if (got > 0) {
      spawnPopupId(c.id, `+${got}`, 'heal', 'party');
      fireAdjacencyHook(s, 'onHeal', s.currentActorId, c.id, got);
    }
  });
}
function healLowest(s, amt) {
  const alive = aliveParty(s); if (alive.length === 0) return null;
  alive.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
  const c = alive[0];
  const bonus = consumePendingBonus(s, s.currentActorId, 'healBonus');
  const total = amt + bonus;
  const before = c.hp;
  c.hp = Math.min(c.maxHp, c.hp + total);
  const got = c.hp - before;
  if (got > 0) {
    spawnPopupId(c.id, `+${got}`, 'heal', 'party');
    flashCardId(c.id, 'heal', 'party');
    fireAdjacencyHook(s, 'onHeal', s.currentActorId, c.id, got);
  }
  // Elin passive: heal self 1 when healing an ally
  if (s.currentActorId === 'elin' && c.id !== 'elin') {
    const e = s.party.chars.elin;
    const eb = e.hp; e.hp = Math.min(e.maxHp, e.hp + 1);
    if (e.hp - eb > 0) spawnPopupId('elin', '+1', 'heal', 'party');
  }
  return c;
}
function cleanseLowest(s) {
  const alive = aliveParty(s); if (alive.length === 0) return;
  alive.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
  const c = alive[0]; c.bleed = 0; c.weak = 0;
}
function taunt(s, id) { const c = s.party.chars[id]; if (c && !c.downed) c.taunt = true; }
function gainResolve(s, amt) {
  const before = s.resolve;
  s.resolve = Math.min(RESOLVE_MAX, s.resolve + amt);
  if (s.resolve > before) flashResolve();
}

// Enemy → party effects (slot-targeted)
function dmgPartyAt(s, slot, amt) {
  const tauntee = aliveParty(s).find(c => c.taunt);
  let target = tauntee || charBySlot(s, slot);
  if (!target || target.downed) target = aliveParty(s)[0];
  if (target) applyDmgToParty(s, target, amt);
}
function dmgLowestParty(s, amt) {
  const tauntee = aliveParty(s).find(c => c.taunt);
  if (tauntee) return applyDmgToParty(s, tauntee, amt);
  const alive = aliveParty(s); if (alive.length === 0) return;
  alive.sort((a, b) => a.hp - b.hp);
  applyDmgToParty(s, alive[0], amt);
}
function dmgAllParty(s, amt) { aliveParty(s).forEach(c => applyDmgToParty(s, c, amt)); }
// Line Caster: hit both slots in a Front-Mid or Mid-Back line. AoE-style — bypasses taunt redirect.
function dmgLinePair(s, line, amt) {
  const slots = line === 'fm' ? ['front', 'mid'] : ['mid', 'back'];
  slots.forEach(slot => {
    const c = charBySlot(s, slot);
    if (c && !c.downed) applyDmgToParty(s, c, amt);
  });
}
// Sniper Pierce: ignores front, hits mid and back. AoE-style.
function dmgPierce(s, amt) {
  ['mid', 'back'].forEach(slot => {
    const c = charBySlot(s, slot);
    if (c && !c.downed) applyDmgToParty(s, c, amt);
  });
}
function weakSlot(s, slot, amt) {
  const c = charBySlot(s, slot);
  if (c && !c.downed) { c.weak += amt; log(`<b>${CHARS[c.id].name}</b> gains Weak.`); }
}
function bleedPartyAt(s, slot, turns) {
  const c = charBySlot(s, slot);
  if (c && !c.downed) c.bleed = Math.max(c.bleed, turns);
}
function applyVulnParty(s, slot, stacks) {
  const c = charBySlot(s, slot);
  if (c && !c.downed) c.vuln += stacks;
}

// ============================================================================
// POSITIONING — swap helpers used by abilities and forced-rotation intents
// ============================================================================

function swapWith(s, charId, targetSlot) {
  const fromSlot = slotOfChar(s, charId);
  if (!fromSlot || fromSlot === targetSlot) return;
  const other = s.party.slots[targetSlot];
  s.party.slots[fromSlot] = other;
  s.party.slots[targetSlot] = charId;
  log(`<b>${CHARS[charId].name}</b> moves to ${SLOT_LABELS[targetSlot]}.`);
}
function advance(s, charId) {
  const slot = slotOfChar(s, charId);
  if (slot === 'mid')  swapWith(s, charId, 'front');
  else if (slot === 'back') swapWith(s, charId, 'mid');
}
function retreat(s, charId) {
  const slot = slotOfChar(s, charId);
  if (slot === 'front') swapWith(s, charId, 'mid');
  else if (slot === 'mid')  swapWith(s, charId, 'back');
}
function retreatFull(s, charId) {
  const slot = slotOfChar(s, charId);
  if (slot === 'front') swapWith(s, charId, 'back');
  else if (slot === 'mid')  swapWith(s, charId, 'back');
}
// enemy effect: shove the player in fromSlot to toSlot, swapping with whoever's there
function enemyShove(s, fromSlot, toSlot) {
  const a = s.party.slots[fromSlot], b = s.party.slots[toSlot];
  if (!a || !b) return;
  if (s.party.chars[a].downed) return;
  s.party.slots[fromSlot] = b;
  s.party.slots[toSlot]   = a;
  log(`<b>${CHARS[a].name}</b> is shoved to ${SLOT_LABELS[toSlot]}.`);
}

// ============================================================================
// ADJACENCY
// ============================================================================

function adjKey(a, b) { return [a, b].sort().join('+'); }
function getAdjacencyPairs(s) {
  const pairs = [];
  [['front','mid','fm'], ['mid','back','mb']].forEach(([sa, sb, line]) => {
    const a = s.party.slots[sa], b = s.party.slots[sb];
    if (!a || !b) return;
    if (s.party.chars[a].downed || s.party.chars[b].downed) return;
    const entry = ADJ[adjKey(a, b)];
    const synergy = entry && entry[line];
    if (!synergy) return;
    pairs.push({ ids: [a, b], line, synergy, key: `${adjKey(a, b)}@${line}` });
  });
  return pairs;
}
function fireAdjacencyHook(s, hookName, ...args) {
  getAdjacencyPairs(s).forEach(p => {
    const fn = p.synergy[hookName];
    if (typeof fn === 'function') fn(s, ...args);
  });
}

// Spawn the synergy's effect popup, and on its first fire each fight,
// also spawn the synergy NAME so the player learns what the chip means.
function fireSynergyFeedback(s, name, receiverId, effectText, effectType) {
  spawnPopupId(receiverId, effectText, effectType, 'party');
  if (!s || !s.firedSynergies) return;
  if (s.firedSynergies.has(name)) return;
  s.firedSynergies.add(name);
  setTimeout(() => spawnPopupId(receiverId, name, 'synergy', 'party'), 180);
}
function consumePendingBonus(s, charId, kind) {
  if (!charId) return 0;
  const c = s.party.chars[charId];
  if (!c) return 0;
  let total = 0;
  c.pendingEffects = c.pendingEffects.filter(e => {
    if (e.kind === kind) { total += e.amt; return false; }
    return true;
  });
  return total;
}

// ============================================================================
// TURN FLOW
// ============================================================================

function startTurn(s) {
  s.messages = [];
  s.executing = false;
  s.queue = [];
  // Press-turn echo: weakness hits last turn give us +1 ATB this turn.
  s.bonusAtb = Math.min(2, s.pendingBonusAtb || 0);
  s.pendingBonusAtb = 0;
  // clear single-turn buffs that survived the enemy phase
  aliveParty(s).forEach(c => { c.taunt = false; c.retaliate = 0; c.firstAttackUsed = false; });
  log(`<span class="msg-strong">— Turn ${s.turn} —</span>`);
  if (s.bonusAtb > 0) log(`<i>Weakness exploited — +${s.bonusAtb} ATB this turn.</i>`);

  // bleed tick — base 2 per turn, +1 if Bloodborne Sigil owned
  const bleedTick = 2 + (hasSigil(s, 'bloodborne') ? 1 : 0);
  aliveParty(s).forEach(c => {
    if (c.bleed > 0) {
      c.hp = Math.max(0, c.hp - bleedTick); c.bleed -= 1;
      spawnPopupId(c.id, `-${bleedTick}`, 'dmg', 'party');
      flashCardId(c.id, 'hit', 'party');
      log(`<b>${CHARS[c.id].name}</b> bleeds (${bleedTick}).`);
      if (c.hp === 0) { c.downed = true; c.pendingEffects = []; log(`<b>${CHARS[c.id].name}</b> falls.`); }
    }
  });
  aliveEnemies(s).forEach(e => {
    if (e.bleed > 0) {
      const dmg = Math.max(0, bleedTick - (s.ignoreArmor ? 0 : e.armor));
      e.hp = Math.max(0, e.hp - dmg); e.bleed -= 1;
      if (dmg > 0) { spawnPopupId(e.id, `-${dmg}`, 'dmg', 'enemy'); flashCardId(e.id, 'hit', 'enemy'); }
      log(`<b>${ENEMIES[e.id].name}</b> bleeds (${dmg}).`);
      if (e.hp === 0) killEnemy(s, e);
    }
  });

  gainResolve(s, RESOLVE_DRIP);
  // Sigil of the Pact — +1 Resolve per active bond
  if (hasSigil(s, 'pact')) {
    const bondCount = getAdjacencyPairs(s).filter(p => p.synergy.type === 'bond').length;
    if (bondCount > 0) {
      gainResolve(s, bondCount);
      log(`<i>Sigil of the Pact stirs — +${bondCount} Resolve.</i>`);
    }
  }

  // queue intents — ensure each living enemy has a valid intent index
  aliveEnemies(s).forEach(e => { e.intentIdx = e.intentIdx % ENEMIES[e.id].intents.length; });

  checkEnd(s);
  render();
}

// ============================================================================
// QUEUE — build a 3-action plan, then commit it
// ============================================================================

// Simulate party slot positions after applying queue items up to (but not
// including) index `upto`. Moves are the only thing that changes positions
// mid-queue. Used for tile previews and for resolving "contextual" actions.
function simulateSlotsThrough(s, upto) {
  const sim = { ...s.party.slots };
  for (let i = 0; i < upto && i < s.queue.length; i++) {
    const item = s.queue[i];
    if (item.kind !== 'move') continue;
    const cur = Object.keys(sim).find(sl => sim[sl] === item.charId);
    if (!cur) continue;
    const idx = SLOTS.indexOf(cur);
    const ti = idx + item.dir;
    if (ti < 0 || ti > 2) continue;
    const target = SLOTS[ti];
    const swap = sim[target];
    sim[cur] = swap;
    sim[target] = item.charId;
  }
  return sim;
}

function slotOfCharSim(sim, id) { return SLOTS.find(sl => sim[sl] === id); }

// What action would clicking this tile QUEUE right now?
// Returns { label, desc, atb, resolveCost, valid, kind } based on simulated post-queue state.
function previewTile(kind, charId, dir) {
  const s = state;
  const c = s.party.chars[charId];
  if (!c || c.downed) return { valid: false };
  const sim = simulateSlotsThrough(s, s.queue.length);
  const slot = slotOfCharSim(sim, charId);
  if (!slot) return { valid: false };

  const atb = ACTION_ATB[kind] || 0;

  if (kind === 'attack') {
    const tech = getTech(s, charId, slot, 'basic');
    return { kind, valid: true, label: tech.name, desc: tech.desc, atb, resolveCost: 0, slot };
  }
  if (kind === 'special') {
    const tech = getTech(s, charId, slot, 'sig');
    return { kind, valid: true, label: tech.name, desc: tech.desc, atb, resolveCost: SPECIAL_COST, slot };
  }
  if (kind === 'move') {
    const idx = SLOTS.indexOf(slot);
    const ti = idx + dir;
    if (ti < 0 || ti > 2) return { kind, valid: false, label: 'Move', desc: 'no room', atb, slot };
    const target = SLOTS[ti];
    const otherId = sim[target];
    const otherName = otherId ? CHARS[otherId].name : '—';
    return { kind, valid: true, label: `→ ${SLOT_LABELS[target]}`, desc: `swap w/ ${otherName}`, atb, resolveCost: 0, slot, target };
  }
  if (kind === 'brace') {
    return { kind, valid: true, label: 'Brace', desc: `+${BRACE_ARMOR} armor`, atb, resolveCost: 0, slot };
  }
  return { valid: false };
}

function queueAtbUsed() {
  return state.queue.reduce((sum, it) => sum + (it.atb || 0), 0);
}
function queueAtbAvailable() {
  return getAtbMax(state) - queueAtbUsed();
}
function queueReservedResolve() {
  return state.queue.reduce((sum, it) => sum + (it.resolveCost || 0), 0);
}
function queueAvailableResolve() {
  return state.resolve - queueReservedResolve();
}

function queueAdd(item) {
  const s = state;
  if (s.executing || s.over) return;
  if ((item.atb || 0) > queueAtbAvailable()) {
    flashMsg(`Not enough ATB (need ${item.atb}).`);
    return;
  }
  if ((item.resolveCost || 0) > queueAvailableResolve()) {
    flashMsg(`Not enough Resolve (need ${item.resolveCost}).`);
    return;
  }
  // Cap each character at ACTIONS_PER_CHAR actions per turn (team special excluded — no charId)
  if (item.charId) {
    const charActions = s.queue.filter(q => q.charId === item.charId).length;
    if (charActions >= ACTIONS_PER_CHAR) {
      flashMsg(`${CHARS[item.charId].name} has already acted ${ACTIONS_PER_CHAR} times this turn.`);
      return;
    }
  }
  s.queue.push(item);
  render();
}

function queueRemoveAt(idx) {
  const s = state;
  if (s.executing || s.over) return;
  if (idx < 0 || idx >= s.queue.length) return;
  s.queue.splice(idx, 1);
  render();
}

function clearQueue() {
  const s = state;
  if (s.executing || s.over) return;
  s.queue = [];
  render();
}

// ============================================================================
// MOVE PICKER — press-and-hold a party figure, drag toward an arrow to queue a move.
// Bound on each figure via bindFigureHold(); the actual commit goes through pickMoveDir.
// ============================================================================

function pickMoveDir(charId, dir) {
  const s = state;
  const slot = slotOfChar(s, charId);
  if (!slot) return;
  const idx = SLOTS.indexOf(slot);
  const ti = idx + dir;
  if (ti < 0 || ti > 2) return;
  const target = SLOTS[ti];
  const otherId = s.party.slots[target];
  const otherName = otherId ? CHARS[otherId].name : '—';
  // If a move is already queued for this character, swap direction by removing the old one first.
  const queuedIdx = s.queue.findIndex(q => q.kind === 'move' && q.charId === charId);
  if (queuedIdx >= 0) s.queue.splice(queuedIdx, 1);
  queueAdd({
    kind: 'move',
    charId,
    dir,
    label: `→ ${SLOT_LABELS[target]}`,
    desc: `swap with ${otherName}`,
    atb: ACTION_ATB.move,
    resolveCost: 0,
  });
}

// Press-and-hold on a figure: reveals the figure's name (and, for party figures,
// directional move arrows). Drag the finger onto an arrow and release → commit move.
// Release elsewhere → cancel (no state change).
function bindFigureHold(fig, charId, isParty) {
  const HOLD_MS = 200;
  let timer = null;
  let active = false;
  let holding = false;
  let aimArrow = null;

  const removeAim = () => {
    if (aimArrow) {
      aimArrow.classList.remove('aim');
      aimArrow = null;
    }
  };
  const cleanup = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    removeAim();
    fig.classList.remove('inspecting');
    active = false;
    holding = false;
  };
  const isUsable = () => {
    if (state.executing || state.over) return false;
    if (isParty) {
      const c = state.party.chars[charId];
      return !!c && !c.downed;
    } else {
      const e = state.enemies.chars[charId];
      return !!e && !e.dead;
    }
  };

  const start = (e) => {
    if (!isUsable()) return;
    active = true;
    holding = false;
    // clear any other figure that may have been left in inspecting state
    document.querySelectorAll('.figure.inspecting').forEach(f => { if (f !== fig) f.classList.remove('inspecting'); });
    try { fig.setPointerCapture(e.pointerId); } catch (_) {}
    timer = setTimeout(() => {
      if (!active) return;
      holding = true;
      fig.classList.add('inspecting');
    }, HOLD_MS);
    e.preventDefault();
  };

  const move = (e) => {
    if (!holding) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const arrow = (el && el.closest) ? el.closest('.move-arrow') : null;
    if (arrow === aimArrow) return;
    removeAim();
    if (arrow && fig.contains(arrow)) {
      aimArrow = arrow;
      aimArrow.classList.add('aim');
    }
  };

  const end = () => {
    if (holding && aimArrow && isParty) {
      const dir = parseInt(aimArrow.dataset.dir, 10);
      cleanup();
      pickMoveDir(charId, dir);
      return;
    }
    cleanup();
  };

  fig.addEventListener('pointerdown', start);
  fig.addEventListener('pointermove', move);
  fig.addEventListener('pointerup', end);
  fig.addEventListener('pointercancel', cleanup);
  fig.addEventListener('lostpointercapture', cleanup);
  fig.addEventListener('contextmenu', (e) => e.preventDefault());
}

function queueTeamSpecial() {
  const s = state;
  if (s.executing || s.over) return;
  const tsCost = getTeamSpecialCost(s);
  if (s.resolve < tsCost) { flashMsg('Not enough Resolve.'); return; }
  if (s.queue.length > 0) { flashMsg('Team Special needs an empty queue.'); return; }
  const ts = getTeamSpecial(s);
  s.queue = [{
    kind: 'team',
    label: ts.name,
    desc: ts.short,
    atb: getAtbMax(s),
    resolveCost: tsCost,
    tsId: ts.id,
  }];
  render();
}

// ============================================================================
// FIGHT — resolve queue, then enemies
// ============================================================================

function onFight() {
  const s = state;
  if (s.over || s.executing) return;
  if (s.queue.length === 0) { flashMsg('Queue at least one action.'); return; }
  s.executing = true;
  s.resolve -= queueReservedResolve();
  render();
  resolveQueueStep(0);
}

function resolveQueueStep(i) {
  const s = state;
  if (s.over) { s.executing = false; render(); return; }
  if (i >= s.queue.length) {
    // queue done — leave taunt/retaliate up for the incoming enemy phase
    s.queue = [];
    // Sigil of Mending — at end of player phase, lowest-HP ally heals 2
    if (hasSigil(s, 'mending')) {
      const alive = aliveParty(s).slice().sort((a,b) => (a.hp/a.maxHp) - (b.hp/b.maxHp));
      const c = alive[0];
      if (c) {
        const before = c.hp;
        c.hp = Math.min(c.maxHp, c.hp + 2);
        if (c.hp > before) {
          spawnPopupId(c.id, `+${c.hp - before}`, 'heal', 'party');
          log(`<i>Sigil of Mending soothes <b>${CHARS[c.id].name}</b>.</i>`);
        }
      }
    }
    if (checkEnd(s)) { s.executing = false; render(); return; }
    render();
    setTimeout(() => resolveEnemyTurn(s), 320);
    return;
  }
  const item = s.queue[i];
  executeQueueItem(s, item);
  if (checkEnd(s)) { s.executing = false; render(); return; }
  render();
  setTimeout(() => resolveQueueStep(i + 1), 380);
}

function executeQueueItem(s, item) {
  if (item.kind === 'team') { execTeamSpecial(s, item.tsId); return; }

  const c = item.charId ? s.party.chars[item.charId] : null;
  if (item.charId && (!c || c.downed)) {
    log(`<i>${CHARS[item.charId].name} cannot act.</i>`);
    return;
  }

  if (item.kind === 'attack' || item.kind === 'special') {
    const slot = slotOfChar(s, item.charId);
    if (!slot) return;
    const variant = getTech(s, item.charId, slot, item.kind === 'special' ? 'sig' : 'basic');
    if (!variant) return;
    log(`<b>${CHARS[item.charId].name}</b> uses <b>${variant.name}</b>${item.kind === 'special' ? ' ★' : ''}.`);
    s.currentActorId = item.charId;
    s.outgoingDmgMod = c.weak > 0 ? -2 : 0;
    try {
      if (variant.reach) {
        const targets = resolveTargets(s, variant);
        if (targets.length === 0) {
          log(`<i>No target in reach — ${variant.name} fizzles.</i>`);
        } else {
          variant.fn(s, targets);
        }
      } else {
        variant.fn(s);
      }
    }
    finally { s.outgoingDmgMod = 0; s.ignoreArmor = false; s.currentActorId = null; }
    if (c.weak > 0) c.weak = Math.max(0, c.weak - 1);
    return;
  }

  if (item.kind === 'move') {
    const slot = slotOfChar(s, item.charId);
    if (!slot) return;
    const idx = SLOTS.indexOf(slot);
    const ti = idx + item.dir;
    if (ti < 0 || ti > 2) { log(`<i>${CHARS[item.charId].name} can't move that way.</i>`); return; }
    const target = SLOTS[ti];
    const other = s.party.slots[target];
    s.party.slots[slot] = other;
    s.party.slots[target] = item.charId;
    log(`<b>${CHARS[item.charId].name}</b> steps to ${SLOT_LABELS[target]}.`);
    return;
  }

  if (item.kind === 'brace') {
    c.armor += BRACE_ARMOR;
    spawnPopupId(item.charId, `+${BRACE_ARMOR}⛨`, 'armor', 'party');
    log(`<b>${CHARS[item.charId].name}</b> braces (+${BRACE_ARMOR} armor).`);
    return;
  }
}

// ============================================================================
// TEAM SPECIALS — formation-dependent ultimates
// Keyed by `front:mid:back` character ids. Each one fills the queue and costs
// TEAM_SPECIAL_COST Resolve. Unknown formations fall back to "Triad Strike".
// ============================================================================

// Team Specials carry the same reach/pattern metadata as techs so previews can
// highlight what they'll hit.
const TEAM_SPECIALS = {
  // home: Cassia front, Elin mid, Branwen back
  'cassia:elin:branwen': {
    id: 'sacred', name: 'Sacred Triad',
    short: 'AoE 5 · heal 5 · cleanse · armor', dmg: 5, heal: 5, healTarget: 'all',
    reach: ['front','mid','back'], pattern: 'all',
    fn: (s) => {
      dmgAllEnemies(s, 5);
      aliveParty(s).forEach(c => {
        const before = c.hp; c.hp = Math.min(c.maxHp, c.hp + 5);
        if (c.hp > before) spawnPopupId(c.id, `+${c.hp - before}`, 'heal', 'party');
        c.bleed = 0; c.weak = 0; c.armor += 2;
      });
    },
  },
  // full reverse: Branwen front, Elin mid, Cassia back
  'branwen:elin:cassia': {
    id: 'lastreach', name: 'Last Reach',
    short: 'Pierce 10 + bleed all · Cassia retaliate', dmg: 10,
    reach: ['front','mid','back'], pattern: 'all',
    fn: (s) => {
      s.ignoreArmor = true; dmgEnemyAt(s, 0, 10); s.ignoreArmor = false;
      aliveEnemies(s).forEach(e => e.bleed = Math.max(e.bleed, 2));
      const cas = s.party.chars.cassia;
      if (cas && !cas.downed) { cas.armor += 3; cas.retaliate = 3; cas.taunt = true; }
    },
  },
  // Cassia + Branwen swapped, Elin home: Branwen front, Cassia mid, Elin back
  'branwen:cassia:elin': {
    id: 'wedge', name: "Hunter's Wedge",
    short: 'Volley 6 all · Cassia advances · armor', dmg: 6,
    reach: ['front','mid','back'], pattern: 'all',
    fn: (s) => {
      dmgAllEnemies(s, 6);
      aliveEnemies(s).forEach(e => e.bleed = Math.max(e.bleed, 1));
      const cur = slotOfChar(s, 'cassia');
      if (cur && cur !== 'front') {
        const f = s.party.slots.front;
        s.party.slots[cur] = f; s.party.slots.front = 'cassia';
        log(`<b>Cassia</b> surges to Front.`);
      }
      aliveParty(s).forEach(c => c.armor += 2);
    },
  },
};

const TEAM_SPECIAL_DEFAULT = {
  id: 'strike', name: 'Triad Strike',
  short: 'AoE 4 · heal 3 lowest · +1 Resolve', dmg: 4, heal: 3, healTarget: 'lowest',
  reach: ['front','mid','back'], pattern: 'all',
  fn: (s) => {
    dmgAllEnemies(s, 4);
    healLowest(s, 3);
    gainResolve(s, 1);
  },
};

function formationKey(s) {
  return `${s.party.slots.front}:${s.party.slots.mid}:${s.party.slots.back}`;
}

function getTeamSpecial(s) {
  return TEAM_SPECIALS[formationKey(s)] || TEAM_SPECIAL_DEFAULT;
}

function execTeamSpecial(s, tsId) {
  // find the matching def — may not be the current-formation one if formation
  // shifted between queueing and execution (rare with team-special since it
  // consumes the queue, but defensive)
  let ts = getTeamSpecial(s);
  if (ts.id !== tsId) {
    ts = Object.values(TEAM_SPECIALS).find(t => t.id === tsId) || TEAM_SPECIAL_DEFAULT;
  }
  log(`<span class="msg-strong">★ ${ts.name} ★</span>`);
  s.currentActorId = null;
  try { ts.fn(s); }
  finally { s.outgoingDmgMod = 0; s.ignoreArmor = false; s.currentActorId = null; }
}

function resolveEnemyTurn(s) {
  for (const e of aliveEnemies(s)) {
    if (s.over) break;
    if (e.staggered) {
      log(`<b>${ENEMIES[e.id].name}</b> is staggered — cannot act.`);
      e.staggerTurns -= 1;
      if (e.staggerTurns <= 0) {
        e.staggered = false;
        e.chain = 0;
        log(`<b>${ENEMIES[e.id].name}</b> recovers.`);
      }
      continue;
    }
    const def = ENEMIES[e.id];
    const intent = def.intents[e.intentIdx % def.intents.length];
    log(`<b>${def.name}</b> uses <b>${intent.name}</b>.`);
    intent.fn(s);
    if (checkEnd(s)) break;
    e.intentIdx = (e.intentIdx + 1) % def.intents.length;
  }
  if (s.over) { render(); return; }
  s.turn += 1;
  startTurn(s);
}

function checkEnd(s) {
  if (s.over) return true;
  if (aliveEnemies(s).length === 0) {
    s.over = true;
    s.run.completed.push(s.run.currentEncId);
    const completedEnc = ENCOUNTERS[s.run.currentEncId];
    s.run.lastVictoryElite = !!(completedEnc && completedEnc.elite);
    const isFinal = s.run.slotIdx >= RUN_LAYOUT.length - 1;
    if (isFinal) {
      if (completedEnc && completedEnc.boss) {
        showOverlay('The Wakeling Falls', 'The Sin of Dawn is unmade. The triad endures, and the world breathes again.');
      } else {
        showOverlay('Victory', 'The reaches are quiet. For a moment, the sins rest.');
      }
    } else {
      s.run.slotIdx += 1;
      // Between fights: offer a recruit if any unrecruited characters remain.
      // Recruit overlay leads into the path-choice overlay (or skips straight to it).
      setTimeout(() => offerRecruitOrPath(), 480);
    }
    return true;
  }
  if (aliveParty(s).length === 0) {
    s.over = true;
    showOverlay('Defeat', 'Your order is dust. The sins walk on.');
    return true;
  }
  return false;
}

// ============================================================================
// UI — RENDER
// ============================================================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function render() {
  renderHUD();
  renderBattlefield();
  renderTiles();
  renderQueue();
  renderTeamSpecial();
  renderFightButton();
  renderMessages();
}

function renderHUD() {
  const pips = $('#resolve-pips'); pips.innerHTML = '';
  // pips fill from left:
  //   bright  = available to spend on further actions
  //   reserved (half-grey) = already slotted to be spent when you press Fight
  //   empty   = unfilled
  const reserved = queueReservedResolve();
  const available = state.resolve - reserved;
  for (let i = 0; i < RESOLVE_MAX; i++) {
    const p = document.createElement('div');
    if (i < available) p.className = 'pip filled';
    else if (i < state.resolve) p.className = 'pip filled reserved';
    else p.className = 'pip';
    pips.appendChild(p);
  }
  const encName = $('#encounter-name');
  if (encName && state.run && state.run.currentEncId) {
    const enc = ENCOUNTERS[state.run.currentEncId];
    encName.textContent = enc ? enc.name : '';
  }
  // glanceable resolve readout in the HUD line (no interaction, just a count)
  const hudNum = $('#hud-resolve-num');
  if (hudNum) hudNum.textContent = String(state.resolve);
  const hudResolve = $('#hud-resolve');
  if (hudResolve) {
    if (reserved > 0) hudResolve.classList.add('has-reserved');
    else hudResolve.classList.remove('has-reserved');
  }
}

function flashResolve() {
  $('#resolve-pips').animate(
    [{ filter: 'brightness(2)' }, { filter: 'brightness(1)' }],
    { duration: 350 }
  );
}

function renderBattlefield() {
  // For each unstaggered enemy this turn, project its intent: which party
  // slots are threatened, and per-character predicted HP loss with armor/vuln
  // depleting across sequential hits.
  const threatened = new Set();
  const incomingByChar = {};
  const sim = {};  // charId -> { armor, vuln } working copy
  aliveEnemies(state).forEach(e => {
    if (e.staggered) return;
    const intent = ENEMIES[e.id].intents[e.intentIdx % ENEMIES[e.id].intents.length];
    const ts = intent.targetSlot;
    if (ts === 'all') SLOTS.forEach(s => threatened.add(s));
    else if (ts === 'fm') { threatened.add('front'); threatened.add('mid'); }
    else if (ts === 'mb' || ts === 'pierce') { threatened.add('mid'); threatened.add('back'); }
    else if (ts && ts !== '?') threatened.add(ts);
    // '?'-targeting also lights up the actual lowest-HP figure
    if (ts === '?') intentTargetCharIds(state, intent).forEach(id => { const sl = slotOfChar(state, id); if (sl) threatened.add(sl); });
    if (typeof intent.dmg !== 'number') return;
    intentTargetCharIds(state, intent).forEach(charId => {
      const c = state.party.chars[charId];
      if (!c || c.downed) return;
      if (!sim[charId]) sim[charId] = { armor: c.armor, vuln: c.vuln };
      const r = previewIncomingDmg(state, c, intent.dmg, { armor: sim[charId].armor, vuln: sim[charId].vuln, stripArmor: !!intent.stripArmor });
      if (r.amt > 0 && sim[charId].vuln > 0) sim[charId].vuln -= 1;
      sim[charId].armor = intent.stripArmor ? 0 : Math.max(0, sim[charId].armor - r.amt);
      if (!incomingByChar[charId]) incomingByChar[charId] = { total: 0, lethal: false };
      incomingByChar[charId].total += r.toHp;
      if (incomingByChar[charId].total >= c.hp) incomingByChar[charId].lethal = true;
    });
  });

  // adjacency map for visual borders + chip labels.
  const adjMap = {};
  getAdjacencyPairs(state).forEach(p => {
    p.ids.forEach(id => {
      if (!adjMap[id]) adjMap[id] = {};
      adjMap[id][p.line] = { name: p.synergy.name, type: p.synergy.type };
      if (!adjMap[id].type || p.synergy.type === 'friction') adjMap[id].type = p.synergy.type;
    });
  });

  // PARTY: three cards in display order (back / mid / front)
  const partyHalf = $('#party-half'); partyHalf.innerHTML = '';
  PARTY_DISPLAY_ORDER.forEach(slot => {
    const c = charBySlot(state, slot);
    const incoming = c ? incomingByChar[c.id] : null;
    partyHalf.appendChild(makePartyCard(c, slot, threatened.has(slot), adjMap, incoming));
  });

  // ENEMY: three cards in display order (front / mid / back)
  const enemyHalf = $('#enemy-half'); enemyHalf.innerHTML = '';
  ENEMY_DISPLAY_ORDER.forEach(slot => {
    const e = enemyBySlot(state, slot);
    enemyHalf.appendChild(makeEnemyCard(e, slot));
  });
}

// Bottom action row — one column per party character, rendered in
// PARTY_DISPLAY_ORDER so each column sits beneath its matching card above.
function renderTiles() {
  const grid = $('#tile-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const sim = simulateSlotsThrough(state, state.queue.length);
  const teamLocked = state.queue.some(q => q.kind === 'team');
  const tileCounts = {};
  state.queue.forEach(q => {
    const key = `${q.kind}:${q.charId || ''}:${q.dir ?? ''}`;
    tileCounts[key] = (tileCounts[key] || 0) + 1;
  });

  PARTY_DISPLAY_ORDER.forEach(slot => {
    const charId = state.party.slots[slot];
    const col = document.createElement('div');
    col.className = 'char-col';
    if (!charId) { col.classList.add('empty'); grid.appendChild(col); return; }

    const c = state.party.chars[charId];
    const def = CHARS[charId];
    const simSlot = slotOfCharSim(sim, charId) || slot;
    if (c.downed) col.classList.add('downed');
    col.title = `${def.name} — ${SLOT_LABELS[simSlot] || '—'}${simSlot === def.home ? ' · home' : ''}`;

    col.appendChild(makeTile('attack', charId, null, tileCounts, teamLocked));
    col.appendChild(makeTile('special', charId, null, tileCounts, teamLocked));
    // Move action is handled by tap-the-figure drag-drop on the battlefield, not a tile.

    grid.appendChild(col);
  });
}

function cornerBrackets() {
  return '<i class="cnr cnr-tl"></i><i class="cnr cnr-tr"></i><i class="cnr cnr-bl"></i><i class="cnr cnr-br"></i>';
}

function makePartyCard(c, slot, threatened, adjMap, incoming) {
  const fig = document.createElement('div');
  fig.className = 'figure party-figure';
  fig.dataset.slot = slot;
  if (!c) {
    fig.classList.add('empty');
    fig.innerHTML = `<div class="figure-portrait"></div><div class="figure-shadow"></div><div class="figure-info"><div class="figure-name">—</div></div>`;
    return fig;
  }
  fig.dataset.id = c.id;
  if (c.downed) fig.classList.add('downed');
  const adj = adjMap[c.id];
  if (adj?.type === 'bond') fig.classList.add('adjacent-bond');
  if (adj?.type === 'friction') fig.classList.add('adjacent-friction');
  if (threatened && !c.downed) fig.classList.add('targeted-by-enemy');

  // collect all active adjacency synergies — render as small icon glyphs at the top.
  // bond = gold ✦, friction = red ✕. Full name lives on the title attribute.
  const synergies = [];
  if (!c.downed && adj) {
    if (adj.fm) synergies.push(adj.fm);
    if (adj.mb) synergies.push(adj.mb);
  }
  const synStack = synergies.length
    ? `<div class="figure-adj">${synergies.map(s => `<span class="adj-chip ${s.type}" title="${s.name}">${s.type === 'friction' ? '✕' : '✦'}</span>`).join('')}</div>`
    : '';

  const def = CHARS[c.id];
  const isHome = def.home === slot;
  const hpPct = (c.hp / c.maxHp) * 100;

  // movement arrows: dir +1 (toward back in slot order) renders on the LEFT (because
  // PARTY_DISPLAY_ORDER puts back on the left); dir -1 (toward front) renders on the RIGHT.
  const slotIdx = SLOTS.indexOf(slot);
  const canMoveBack  = slotIdx + 1 < SLOTS.length;
  const canMoveFront = slotIdx - 1 >= 0;

  // a move queued for this character → show the planned-direction arrow as a persistent overlay
  const queuedMove = state.queue.find(q => q.kind === 'move' && q.charId === c.id);
  const queuedMoveGlyph = queuedMove ? (queuedMove.dir > 0 ? '◀' : '▶') : '';
  if (queuedMove) fig.classList.add('has-queued-move');

  // incoming-damage chip — predicted HP loss this turn from all unstaggered enemies
  // targeting this character. Red on normal hits, pulsing brighter when lethal.
  const incomingChip = (incoming && incoming.total > 0 && !c.downed)
    ? `<div class="incoming-chip ${incoming.lethal ? 'lethal' : ''}" title="${incoming.lethal ? 'LETHAL — ' : ''}Predicted incoming damage this turn">−${incoming.total}${incoming.lethal ? '<span class="incoming-ko">KO</span>' : ''}</div>`
    : '';

  fig.innerHTML = `
    ${synStack}
    ${incomingChip}
    <div class="figure-statuses">${renderStatuses(c)}</div>
    <div class="figure-portrait">${PORTRAITS[c.id] || ''}</div>
    <div class="figure-shadow"></div>
    <div class="figure-info">
      <div class="figure-hp">
        <div class="hp-fill ${hpPct < 35 ? 'low' : ''}" style="width:${hpPct}%"></div>
        <div class="hp-text">${c.hp}/${c.maxHp}</div>
      </div>
      <div class="figure-name${isHome ? ' home' : ''}">${def.name}</div>
    </div>
    ${canMoveBack  ? `<button class="move-arrow move-arrow-left"  data-dir="1"  aria-label="Move toward back">◀</button>`  : ''}
    ${canMoveFront ? `<button class="move-arrow move-arrow-right" data-dir="-1" aria-label="Move toward front">▶</button>` : ''}
    ${queuedMove ? `<div class="figure-queued-move">${queuedMoveGlyph}</div>` : ''}
  `;

  bindFigureHold(fig, c.id, true);
  return fig;
}

function chipHtml(syn, edge) {
  return `<div class="adj-chip ${edge} ${syn.type}">${syn.name}</div>`;
}

function intentIconGlyph(kind) {
  if (kind === 'aoe')    return '✷';
  if (kind === 'debuff') return '☽';
  return '⚔';
}

// Pull the primary numeric value out of an intent tag — e.g. "ATK 6" → "6", "WEAK 2" → "2"
function intentPrimaryNum(tag) {
  const m = (tag || '').match(/\d+/);
  return m ? m[0] : '';
}

function makeEnemyCard(e, slot) {
  const fig = document.createElement('div');
  fig.className = 'figure enemy-figure';
  fig.dataset.slot = slot;
  if (!e || e.dead) {
    fig.classList.add('empty');
    fig.innerHTML = `<div class="figure-portrait"></div><div class="figure-shadow"></div><div class="figure-info"><div class="figure-name">—</div></div>`;
    return fig;
  }
  fig.dataset.id = e.id;
  if (e.staggered) fig.classList.add('staggered');

  const def = ENEMIES[e.id];
  const intent = def.intents[e.intentIdx % def.intents.length];
  const hpPct = (e.hp / e.maxHp) * 100;
  const chainPct = (e.chain / STAGGER_THRESHOLD) * 100;
  const intentClass = intent.kind === 'aoe' ? 'intent-aoe' : (intent.kind === 'debuff' ? 'intent-debuff' : '');
  const ts = intent.targetSlot;
  const targetTag = ts === 'all' ? 'ALL'
    : ts === '?' ? 'LOW'
    : ts === 'fm' ? 'F+M'
    : ts === 'mb' ? 'M+B'
    : ts === 'pierce' ? 'M+B>'
    : (ts || '').slice(0,1).toUpperCase();
  const icon = intentIconGlyph(intent.kind);
  const num = intentPrimaryNum(intent.tag);

  const staggerBanner = e.staggered ? `<div class="staggered-banner">STAGGERED</div>` : '';
  // Minimal intent: just kind icon + the primary number. Targeting is conveyed by
  // the .targeted-by-enemy glow on the party figures it threatens.
  const intentBubble = e.staggered ? '' : `
    <div class="intent-bubble ${intentClass}" title="${intent.name}: ${intent.tag} → ${targetTag}">
      <span class="intent-icon">${icon}</span>
      ${num ? `<span class="intent-num">${num}</span>` : ''}
    </div>`;

  // Weak / Resist affinity chips — short 3-letter school codes so the targeting
  // puzzle is legible at a glance (was 13px glyphs which players missed).
  const schoolCode = { physical: 'PHY', holy: 'HLY', arcane: 'ARC', stealth: 'STL', ranged: 'RNG' };
  const asArr = x => Array.isArray(x) ? x : (x ? [x] : []);
  const weakSchools = asArr(def.weakness);
  const resistSchools = asArr(def.resistance);
  const affChips = [];
  weakSchools.forEach(w => {
    affChips.push(`<span class="affinity-chip weak" title="Weak to ${w} — takes 50% more damage from ${w} attacks"><span class="aff-tag">W</span><span class="aff-school">${schoolCode[w] || '?'}</span></span>`);
  });
  resistSchools.forEach(r => {
    affChips.push(`<span class="affinity-chip resist" title="Resists ${r} — takes 50% less damage from ${r} attacks"><span class="aff-tag">R</span><span class="aff-school">${schoolCode[r] || '?'}</span></span>`);
  });
  const affRow = affChips.length ? `<div class="affinity-row">${affChips.join('')}</div>` : '';

  fig.innerHTML = `
    ${intentBubble}
    ${staggerBanner}
    <div class="figure-statuses">${renderStatuses(e)}</div>
    <div class="figure-portrait">${PORTRAITS[e.id] || ''}</div>
    <div class="figure-shadow"></div>
    <div class="figure-info">
      ${affRow}
      <div class="figure-hp">
        <div class="hp-fill ${hpPct < 35 ? 'low' : ''}" style="width:${hpPct}%"></div>
        <div class="hp-text">${e.hp}/${e.maxHp}</div>
      </div>
      <div class="figure-name">${def.name}</div>
      <div class="chain-bar"><div class="chain-fill" style="width:${chainPct}%"></div></div>
    </div>
  `;
  bindFigureHold(fig, e.id, false);
  return fig;
}

function renderStatuses(ent) {
  const c = [];
  const chip = (cls, icon, num, title) =>
    `<span class="status-chip ${cls}" title="${title}"><span class="status-icon">${icon}</span>${num != null ? `<span class="status-num">${num}</span>` : ''}</span>`;
  if (ent.armor > 0)     c.push(chip('status-armor', '⛨', ent.armor,    `Armor ${ent.armor} — absorbs ${ent.armor} damage before HP. Wears off as it absorbs.`));
  if (ent.bleed > 0)     c.push(chip('status-bleed', '✤', ent.bleed,    `Bleed ${ent.bleed} — takes 2 damage at the start of each turn (3 with Bloodborne Sigil), then the stack decreases by 1.`));
  if (ent.taunt)         c.push(chip('status-taunt', '⌖', null,         'Taunt — enemies single-target attacks redirect to this character instead of the original slot.'));
  if (ent.weak > 0)      c.push(chip('status-weak',  '↓', ent.weak,     `Weak ${ent.weak} — this character's outgoing damage is reduced by 2 for the next ${ent.weak} attack(s).`));
  if (ent.vuln > 0)      c.push(chip('status-vuln',  '⊕', ent.vuln,     `Vulnerable ${ent.vuln} — next ${ent.vuln} incoming attacks deal +2 damage (+4 with Ember of Wrath Sigil) and consume one stack.`));
  if (ent.retaliate > 0) c.push(chip('status-retal', '↻', ent.retaliate,`Retaliate ${ent.retaliate} — when hit, counter-attack the front-most enemy for ${ent.retaliate} damage.`));
  if (ent.pendingEffects) ent.pendingEffects.forEach(e => {
    if (e.kind === 'attackBonus')      c.push(chip('status-pending', '⚔', `+${e.amt}`, `Next attack +${e.amt} damage (one-shot, consumed on use).`));
    else if (e.kind === 'healBonus')   c.push(chip('status-pending', '✚', `+${e.amt}`, `Next heal +${e.amt} (one-shot, consumed on use).`));
    else                                c.push(chip('status-pending', '✦', `+${e.amt}`, `Pending +${e.amt}`));
  });
  return c.join('');
}

// queue strip — variable-width bar. Each queued item takes flex-grow proportional
// to its ATB cost. Remaining ATB is shown as a dimmed placeholder taking the leftover.
function renderQueue() {
  const strip = $('#queue-strip');
  strip.innerHTML = '';
  // Queue strip is a grid of getAtbMax(state) columns; items span by their atb cost.
  // dataset.atbMax drives CSS so the strip can be 3- or 4-wide (Crown of Quickening).
  const atbMax = getAtbMax(state);
  strip.dataset.atbMax = String(atbMax);
  let used = 0;
  state.queue.forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = `queue-slot filled kind-${item.kind}`;
    el.dataset.atb = String(item.atb || 1);
    const portraitSvg = item.charId ? (PORTRAITS[item.charId] || '') : '';
    // team-special shows a crossed-swords glyph instead of a single character portrait
    const teamGlyph = item.kind === 'team'
      ? '<svg class="qs-team" viewBox="0 0 24 24" aria-hidden="true"><path d="M 4 4 L 20 20 M 20 4 L 4 20" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg>'
      : '';
    el.innerHTML = `
      <span class="qs-cost">${item.atb}</span>
      <span class="qs-avatar">${portraitSvg}${teamGlyph}</span>
      <span class="qs-name">${item.label || ''}</span>
    `;
    // hover tooltip — keep the label/desc accessible via title even though it's not visible
    el.title = `${item.label}${item.desc ? ' — ' + item.desc : ''} (tap to remove)`;
    el.addEventListener('click', () => queueRemoveAt(idx));
    strip.appendChild(el);
    used += item.atb || 0;
  });
  const remaining = atbMax - used;
  const bonus = state.bonusAtb || 0;
  for (let i = 0; i < remaining; i++) {
    const ph = document.createElement('div');
    ph.className = 'queue-slot placeholder';
    // mark the trailing N cells as "bonus" when bonus ATB is active
    const cellIdx = used + i;
    if (bonus && cellIdx >= (atbMax - bonus)) ph.classList.add('bonus');
    ph.dataset.atb = '1';
    ph.innerHTML = `<span class="qs-name">${ph.classList.contains('bonus') ? '+' : '·'}</span>`;
    strip.appendChild(ph);
  }
}

function renderTeamSpecial() {
  const area = $('#ts-area');
  if (!area) return;
  area.innerHTML = '';
  const teamLocked = state.queue.some(q => q.kind === 'team');
  area.appendChild(makeTeamSpecialTile(teamLocked));
}

function makeTile(kind, charId, dir, tileCounts, teamLocked) {
  const preview = previewTile(kind, charId, dir);
  const c = state.party.chars[charId];
  const t = document.createElement('button');
  t.className = `tile kind-${kind}`;
  const atbCost = preview.atb || 0;
  const resolveCost = preview.resolveCost || 0;
  const charActionsQueued = state.queue.filter(q => q.charId === charId).length;
  const atCharCap = charActionsQueued >= ACTIONS_PER_CHAR;
  t.disabled = !preview.valid || c.downed || state.executing || state.over || teamLocked
    || atbCost > queueAtbAvailable()
    || resolveCost > queueAvailableResolve()
    || atCharCap;
  if (atCharCap && !c.downed) t.classList.add('char-capped');
  t.dataset.kind = kind;
  t.dataset.charId = charId;
  if (dir !== null && dir !== undefined) t.dataset.dir = dir;

  const key = `${kind}:${charId}:${dir ?? ''}`;
  const qCount = tileCounts[key];
  if (qCount) t.classList.add('queued');

  // reach badge (static info — different from the live hold-preview)
  const reachLabel = previewReachLabel(kind, charId, dir);

  const costBadges = [];
  if (atbCost > 0)     costBadges.push(`<span class="tile-atb">${atbCost}</span>`);
  if (resolveCost > 0) costBadges.push(`<span class="tile-cost">${resolveCost}♦</span>`);

  t.innerHTML = `
    <span class="tile-badges">${costBadges.join('')}</span>
    <span class="tile-name">${preview.label || '—'}</span>
    <span class="tile-desc">${preview.desc || ''}</span>
    ${reachLabel ? `<span class="tile-reach">${reachLabel}</span>` : ''}
    ${qCount ? `<span class="q-count">×${qCount}</span>` : ''}
  `;

  bindTileHold(t, {
    onQueue: () => queueAdd({
      kind, charId,
      dir: dir,
      label: preview.label,
      desc: preview.desc,
      atb: atbCost,
      resolveCost: resolveCost,
    }),
    onPreview: () => previewTargetsForTile(kind, charId, dir),
  });
  return t;
}

// reach-label shown statically on damaging tiles ("F" / "MB" / "FMB" / "low")
function previewReachLabel(kind, charId, dir) {
  if (kind !== 'attack' && kind !== 'special') return '';
  const sim = simulateSlotsThrough(state, state.queue.length);
  const slot = slotOfCharSim(sim, charId);
  if (!slot) return '';
  const variant = getTech(state, charId, slot, kind === 'special' ? 'sig' : 'basic');
  if (!variant || !variant.reach) return '';
  const letters = variant.reach.map(r => r[0].toUpperCase()).join('');
  if (variant.pattern === 'all')    return `hit ${letters}`;
  if (variant.pattern === 'lowest') return `low ${letters}`;
  return letters;
}

// returns the set of enemy slot names that would be hit if the tile fired now,
// plus a per-target damage prediction (dmg + WEAK!/RESIST/STG badge) for damaging tiles.
function previewTargetsForTile(kind, charId, dir) {
  if (kind === 'attack' || kind === 'special') {
    const sim = simulateSlotsThrough(state, state.queue.length);
    const slot = slotOfCharSim(sim, charId);
    if (!slot) return { enemySlots: [], partySlots: [], enemyHits: [], partyHeals: [] };
    const variant = getTech(state, charId, slot, kind === 'special' ? 'sig' : 'basic');
    const targets = resolveTargets(state, variant) || [];
    const enemyHits = targets.map(e => {
      const sl = SLOTS.find(sl => state.enemies.slots[sl] === e.id);
      if (!sl) return null;
      if (typeof variant.dmg !== 'number') return { slot: sl };
      const r = previewMultiHit(state, e, variant.dmg, charId, variant.hits || 1);
      const kill = !e.dead && r.dmg >= e.hp;
      return { slot: sl, dmg: r.dmg, badge: r.badge, kill };
    }).filter(Boolean);
    const enemySlots = enemyHits.map(h => h.slot);
    const partyHeals = resolveHealTargets(state, variant, charId).map(c => {
      const sl = slotOfChar(state, c.id);
      if (!sl) return null;
      return { slot: sl, heal: previewHeal(state, c, variant.heal, charId) };
    }).filter(Boolean);
    const partySlots = partyHeals.map(h => h.slot);
    return { enemySlots, partySlots, enemyHits, partyHeals };
  }
  if (kind === 'move') {
    const sim = simulateSlotsThrough(state, state.queue.length);
    const slot = slotOfCharSim(sim, charId);
    if (!slot) return { enemySlots: [], partySlots: [], enemyHits: [] };
    const idx = SLOTS.indexOf(slot);
    const ti = idx + dir;
    if (ti < 0 || ti > 2) return { enemySlots: [], partySlots: [], enemyHits: [] };
    return { enemySlots: [], partySlots: [SLOTS[ti]], enemyHits: [] };
  }
  return { enemySlots: [], partySlots: [], enemyHits: [] };
}

// shared hold-detection. ~220ms hold enters preview mode (no queue on release);
// shorter pointerup = queue immediately.
function bindTileHold(tile, handlers) {
  const HOLD_MS = 220;
  let timer = null;
  let previewing = false;
  let active = false;

  const start = (e) => {
    if (tile.disabled || state.over || state.executing) return;
    e.preventDefault();
    active = true;
    previewing = false;
    timer = setTimeout(() => {
      if (!active) return;
      previewing = true;
      tile.classList.add('previewing');
      applyPreviewHighlight(handlers.onPreview());
    }, HOLD_MS);
  };
  const endTap = () => {
    if (!active) return;
    if (timer) { clearTimeout(timer); timer = null; }
    if (previewing) {
      clearPreviewHighlight();
      tile.classList.remove('previewing');
    } else {
      handlers.onQueue();
    }
    active = false; previewing = false;
  };
  const cancel = () => {
    if (!active) return;
    if (timer) { clearTimeout(timer); timer = null; }
    if (previewing) {
      clearPreviewHighlight();
      tile.classList.remove('previewing');
    }
    active = false; previewing = false;
  };

  tile.addEventListener('pointerdown',  start);
  tile.addEventListener('pointerup',    endTap);
  tile.addEventListener('pointerleave', cancel);
  tile.addEventListener('pointercancel', cancel);
  tile.addEventListener('contextmenu',  (e) => e.preventDefault());
}

function applyPreviewHighlight({ enemySlots, partySlots, enemyHits, partyHeals }) {
  clearPreviewHighlight();
  const hitBySlot = {};
  (enemyHits || []).forEach(h => { if (h && h.slot) hitBySlot[h.slot] = h; });
  (enemySlots || []).forEach(sl => {
    const el = document.querySelector(`#enemy-half .figure[data-slot="${sl}"]`);
    if (!el) return;
    el.classList.add('target-marker');
    const hit = hitBySlot[sl];
    if (hit && typeof hit.dmg === 'number') {
      const label = document.createElement('div');
      label.className = 'target-dmg-label';
      if (hit.kill) label.classList.add('kill');
      else if (hit.badge === 'WEAK!') label.classList.add('weak');
      else if (hit.badge === 'RESIST') label.classList.add('resist');
      else if (hit.badge === 'STG') label.classList.add('stagger');
      const badgeText = hit.kill ? 'KO' : hit.badge;
      label.innerHTML = badgeText
        ? `<span class="dmg-num">${hit.dmg}</span><span class="dmg-badge">${badgeText}</span>`
        : `<span class="dmg-num">${hit.dmg}</span>`;
      el.appendChild(label);
    }
  });
  const healBySlot = {};
  (partyHeals || []).forEach(h => { if (h && h.slot) healBySlot[h.slot] = h; });
  (partySlots || []).forEach(sl => {
    const el = document.querySelector(`#party-half .figure[data-slot="${sl}"]`);
    if (!el) return;
    el.classList.add('target-marker');
    const heal = healBySlot[sl];
    if (heal && typeof heal.heal === 'number') {
      const label = document.createElement('div');
      label.className = 'target-heal-label';
      label.innerHTML = `<span class="dmg-num">+${heal.heal}</span>`;
      el.appendChild(label);
    }
  });
}
function clearPreviewHighlight() {
  document.querySelectorAll('.target-marker').forEach(el => el.classList.remove('target-marker'));
  document.querySelectorAll('.target-dmg-label, .target-heal-label').forEach(el => el.remove());
}

function makeMoveOrBraceTile(charId, slot, tileCounts, teamLocked) {
  const idx = SLOTS.indexOf(slot);
  // Mid character has two move directions — render a split-tile.
  if (idx === 1) {
    const wrap = document.createElement('div');
    wrap.className = 'tile-pair';
    wrap.style.display = 'grid';
    wrap.style.gridTemplateColumns = '1fr 1fr';
    wrap.style.gap = '3px';
    wrap.style.minHeight = '0';
    wrap.appendChild(makeTile('move', charId, -1, tileCounts, teamLocked));
    wrap.appendChild(makeTile('move', charId, +1, tileCounts, teamLocked));
    return wrap;
  }
  // Front (idx 0): only +1 (toward back). Back (idx 2): only -1 (toward front).
  // Show move tile if movement is valid in some direction; otherwise show Brace.
  const dir = idx === 0 ? +1 : -1;
  // mid sim says you can move; for front/back, also valid. Just render move tile.
  return makeTile('move', charId, dir, tileCounts, teamLocked);
}

function makeTeamSpecialTile(teamLocked) {
  const ts = getTeamSpecial(state);
  const t = document.createElement('button');
  t.className = 'tile team-special';
  const tsCost = getTeamSpecialCost(state);
  const tsAtb = getAtbMax(state);
  const canAfford = state.resolve >= tsCost;
  const queueEmpty = state.queue.length === 0;
  t.disabled = !canAfford || !queueEmpty || state.executing || state.over;
  if (canAfford && queueEmpty) t.classList.add('ready');
  if (teamLocked) t.classList.add('queued');

  const formationLabel = `${CHARS[state.party.slots.front]?.name?.[0] || '·'}-${CHARS[state.party.slots.mid]?.name?.[0] || '·'}-${CHARS[state.party.slots.back]?.name?.[0] || '·'}`;
  t.title = `${ts.name} · formation ${formationLabel} · ${ts.short}`;
  t.innerHTML = `
    <span class="ts-name">${ts.name}</span>
    <span class="ts-cost"><span class="tile-atb">${tsAtb}</span><span class="tile-cost">${tsCost}♦</span></span>
    <span class="ts-desc">${ts.short}</span>
  `;
  bindTileHold(t, {
    onQueue: () => queueTeamSpecial(),
    onPreview: () => {
      const targets = resolveTargets(state, ts) || [];
      const enemyHits = targets.map(e => {
        const sl = SLOTS.find(sl => state.enemies.slots[sl] === e.id);
        if (!sl) return null;
        if (typeof ts.dmg !== 'number') return { slot: sl };
        const per = previewDamage(state, e, ts.dmg, null);
        const kill = !e.dead && per.toHp >= e.hp;
        return { slot: sl, dmg: per.toHp, badge: per.badge, kill };
      }).filter(Boolean);
      const enemySlots = enemyHits.map(h => h.slot);
      const partyHeals = resolveHealTargets(state, ts, null).map(c => {
        const sl = slotOfChar(state, c.id);
        if (!sl) return null;
        return { slot: sl, heal: previewHeal(state, c, ts.heal, null) };
      }).filter(Boolean);
      const partySlots = partyHeals.map(h => h.slot);
      return { enemySlots, partySlots, enemyHits, partyHeals };
    },
  });
  return t;
}

function renderFightButton() {
  const btn = $('#btn-fight');
  const canFight = state.queue.length > 0 && !state.executing && !state.over;
  btn.disabled = !canFight;
}

function renderMessages() {
  const bar = $('#message-bar');
  // single-line ticker: show only the most recent message
  const latest = state.messages[state.messages.length - 1];
  if (!latest) { bar.innerHTML = ''; return; }
  const isStrong = latest.startsWith('<span class="msg-strong">');
  bar.innerHTML = `<div class="msg-line ${isStrong ? 'msg-strong' : ''}">${latest.replace(/<span class="msg-strong">|<\/span>/g,'')}</div>`;
}

function log(html) { state.messages.push(html); }
function flashMsg(text) { log(`<i>${text}</i>`); renderMessages(); }

// ============================================================================
// POPUPS + FLASHES — visual juice
// ============================================================================

function spawnPopupId(id, text, type, side) {
  // resolve side automatically if not given
  let cardEl;
  if (side) cardEl = document.querySelector(`#${side === 'enemy' ? 'enemy' : 'party'}-half [data-id="${id}"]`);
  if (!cardEl) cardEl = document.querySelector(`#battlefield [data-id="${id}"]`);
  if (!cardEl) return;
  spawnPopup(cardEl, text, type);
}

function spawnPopup(cardEl, text, type='dmg') {
  const layer = $('#popup-layer');
  const stage = $('#stage');
  if (!cardEl || !layer || !stage) return;
  const r = cardEl.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `popup ${type}`;
  el.textContent = text;
  el.style.left = (r.left + r.width / 2 - s.left) + 'px';
  el.style.top  = (r.top - s.top + 8) + 'px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function flashCardId(id, type, side) {
  let cardEl;
  if (side) cardEl = document.querySelector(`#${side === 'enemy' ? 'enemy' : 'party'}-half [data-id="${id}"]`);
  if (!cardEl) cardEl = document.querySelector(`#battlefield [data-id="${id}"]`);
  if (!cardEl) return;
  cardEl.classList.add(`${type}-flash`);
  setTimeout(() => cardEl.classList.remove(`${type}-flash`), 600);
}

// ============================================================================
// INPUT
// ============================================================================

function bindUI() {
  $('#btn-fight').addEventListener('click', () => onFight());
  $('#btn-clear').addEventListener('click', () => clearQueue());
  // queue-slot click handlers are attached inside renderQueue (items are dynamic)
  // overlay-btn handler is reassigned by overlay flows (recruit/swap) so we use
  // .onclick rather than addEventListener to keep a single replaceable handler.
  $('#overlay-btn').onclick = () => { hideOverlay(); init(); };
}

function resetOverlayBtn() {
  const btn = $('#overlay-btn');
  if (!btn) return;
  btn.textContent = 'Restart';
  btn.onclick = () => { hideOverlay(); init(); };
}

function showOverlay(title, body) {
  $('#overlay-title').textContent = title;
  $('#overlay-body').textContent = body;
  const choices = $('#overlay-choices');
  if (choices) { choices.innerHTML = ''; choices.classList.add('hidden'); }
  resetOverlayBtn();
  $('#overlay-btn').classList.remove('hidden');
  $('#overlay').classList.remove('hidden');
}

function showPathChoice(slotConfig) {
  $('#overlay-title').textContent = slotConfig.label;
  $('#overlay-body').textContent = 'Choose your next reach.';
  const choices = $('#overlay-choices');
  choices.innerHTML = '';
  slotConfig.options.forEach(encId => {
    const enc = ENCOUNTERS[encId];
    const card = document.createElement('button');
    card.className = 'encounter-choice';
    if (enc.elite) card.classList.add('encounter-elite');
    const enemyIcons = SLOTS.map(sl => {
      const eid = enc.slots[sl];
      const def = ENEMIES[eid];
      return `<div class="enc-icon" title="${def?.name || ''}">${PORTRAITS[eid] || ''}<div class="enc-icon-slot">${SLOT_LABELS[sl]}</div></div>`;
    }).join('');
    const catLabel = enc.elite && enc.sigilCategory ? ` · ${enc.sigilCategory.charAt(0).toUpperCase() + enc.sigilCategory.slice(1)} Sigil` : (enc.elite ? ' · Sigil reward' : '');
    card.innerHTML = `
      ${enc.elite ? `<div class="enc-badge">☠ Elite${catLabel}</div>` : ''}
      <div class="enc-name">${enc.name}</div>
      <div class="enc-row">${enemyIcons}</div>
    `;
    card.addEventListener('click', () => {
      hideOverlay();
      startEncounter(encId);
    });
    choices.appendChild(card);
  });
  choices.classList.remove('hidden');
  resetOverlayBtn();
  $('#overlay-btn').classList.add('hidden');
  $('#overlay').classList.remove('hidden');
}

function hideOverlay() { $('#overlay').classList.add('hidden'); }

// ============================================================================
// RECRUIT — between-fight character draft
// ============================================================================

// Decide whether to show recruit, then proceed to upgrade-or-path.
function offerRecruitOrPath() {
  const pickable = ROSTER.filter(id => !state.party.chars[id]);
  if (pickable.length === 0) {
    offerUpgradeOrPath();
    return;
  }
  // Pick 2 random candidates from the pool of unrecruited characters
  const shuffled = pickable.slice().sort(() => Math.random() - 0.5);
  const candidates = shuffled.slice(0, Math.min(2, shuffled.length));
  showRecruitOverlay(candidates);
}

// After recruit (or skip): offer a tech upgrade if any are available.
function offerUpgradeOrPath() {
  const pool = availableUpgrades(state);
  if (pool.length === 0) {
    offerSigilOrPath();
    return;
  }
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  const offers = shuffled.slice(0, Math.min(2, shuffled.length));
  showUpgradeOverlay(offers);
}

// Sigil offer step. Elites guarantee 3 cards (more agency); normals offer 2.
function offerSigilOrPath() {
  let pool = availableSigils(state);
  if (pool.length === 0) {
    showPathChoice(RUN_LAYOUT[state.run.slotIdx]);
    return;
  }
  // If the last victory was an elite that declared a sigil category, weight the pool
  // toward that category (fall back to full pool if exhausted).
  const lastEncId = state.run.completed[state.run.completed.length - 1];
  const lastEnc = lastEncId && ENCOUNTERS[lastEncId];
  const targetCategory = (lastEnc && lastEnc.elite) ? lastEnc.sigilCategory : null;
  if (targetCategory) {
    const filtered = pool.filter(s => s.category === targetCategory);
    if (filtered.length > 0) pool = filtered;
  }
  const count = state.run.lastVictoryElite ? 3 : 2;
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  const offers = shuffled.slice(0, Math.min(count, shuffled.length));
  showSigilOverlay(offers);
}

function showSigilOverlay(offers) {
  $('#overlay-title').textContent = state.run.lastVictoryElite ? 'An elite sigil offers itself' : 'A sigil flickers into reach';
  $('#overlay-body').textContent = 'Add one to your run, or pass.';
  const choices = $('#overlay-choices');
  choices.innerHTML = '';
  offers.forEach(sg => {
    const card = document.createElement('button');
    card.className = 'encounter-choice sigil-choice';
    card.innerHTML = `
      <div class="enc-name">${sg.name}</div>
      <div class="sigil-glyph">${sg.icon}</div>
      <div class="sigil-desc">${sg.desc}</div>
    `;
    card.addEventListener('click', () => commitSigil(sg.id));
    choices.appendChild(card);
  });
  const btn = $('#overlay-btn');
  btn.textContent = 'Pass';
  btn.onclick = () => {
    hideOverlay();
    resetOverlayBtn();
    showPathChoice(RUN_LAYOUT[state.run.slotIdx]);
  };
  btn.classList.remove('hidden');
  choices.classList.remove('hidden');
  $('#overlay').classList.remove('hidden');
}

function commitSigil(sigilId) {
  if (!SIGILS[sigilId]) return;
  if (!state.run.sigils.includes(sigilId)) state.run.sigils.push(sigilId);
  log(`<i>You bind the <b>${SIGILS[sigilId].name}</b>.</i>`);
  hideOverlay();
  resetOverlayBtn();
  showPathChoice(RUN_LAYOUT[state.run.slotIdx]);
}

function showUpgradeOverlay(offers) {
  $('#overlay-title').textContent = 'Hone your edge';
  $('#overlay-body').textContent = 'Pick an upgrade — or pass.';
  const choices = $('#overlay-choices');
  choices.innerHTML = '';
  offers.forEach(up => {
    const char = CHARS[up.charId];
    const baseTech = char.techs[up.slot][up.kind];
    const card = document.createElement('button');
    card.className = 'encounter-choice upgrade-choice';
    card.innerHTML = `
      <div class="enc-name">${up.name}</div>
      <div class="upgrade-row">
        <div class="upgrade-avatar">${PORTRAITS[up.charId] || ''}</div>
        <div class="upgrade-meta">
          <div class="upgrade-char">${char.name} · ${SLOT_LABELS[up.slot]} · ${up.kind === 'sig' ? 'Special' : 'Attack'}</div>
          <div class="upgrade-from">${baseTech.name}<span class="upgrade-from-desc">${baseTech.desc}</span></div>
          <div class="upgrade-arrow">↓</div>
          <div class="upgrade-to"><b>${up.name}</b><span class="upgrade-to-desc">${up.desc}</span></div>
        </div>
      </div>
    `;
    card.addEventListener('click', () => commitUpgrade(up.id));
    choices.appendChild(card);
  });
  const btn = $('#overlay-btn');
  btn.textContent = 'Pass';
  btn.onclick = () => {
    hideOverlay();
    resetOverlayBtn();
    offerSigilOrPath();
  };
  btn.classList.remove('hidden');
  choices.classList.remove('hidden');
  $('#overlay').classList.remove('hidden');
}

function commitUpgrade(upgradeId) {
  const up = UPGRADES[upgradeId];
  if (!up) return;
  const c = state.party.chars[up.charId];
  if (!c) return;
  if (!c.upgrades) c.upgrades = {};
  c.upgrades[`${up.slot}.${up.kind}`] = upgradeId;
  log(`<b>${CHARS[up.charId].name}</b> learns <b>${up.name}</b>.`);
  hideOverlay();
  resetOverlayBtn();
  offerSigilOrPath();
}

function showRecruitOverlay(candidates) {
  $('#overlay-title').textContent = 'A new ally appears';
  $('#overlay-body').textContent = 'Add them to your party — or pass and continue.';
  const choices = $('#overlay-choices');
  choices.innerHTML = '';
  candidates.forEach(charId => {
    const def = CHARS[charId];
    const card = document.createElement('button');
    card.className = 'encounter-choice recruit-choice';
    card.innerHTML = `
      <div class="enc-name">${def.name}</div>
      <div class="recruit-portrait">${PORTRAITS[charId] || ''}</div>
      <div class="recruit-meta">
        <div class="recruit-title">${def.title || ''}</div>
        <div class="recruit-stats">
          <span class="recruit-stat">HP ${def.maxHp}</span>
          <span class="recruit-stat">Home ${SLOT_LABELS[def.home]}</span>
        </div>
        <div class="recruit-passive"><b>${def.passive?.name || ''}</b> · ${def.passive?.desc || ''}</div>
      </div>
    `;
    card.addEventListener('click', () => showSwapOverlay(charId));
    choices.appendChild(card);
  });
  // Skip button — uses existing overlay-btn slot, relabeled
  const btn = $('#overlay-btn');
  btn.textContent = 'Pass';
  btn.classList.remove('hidden');
  btn.onclick = () => {
    hideOverlay();
    resetOverlayBtn();
    offerUpgradeOrPath();
  };
  choices.classList.remove('hidden');
  $('#overlay').classList.remove('hidden');
}

function showSwapOverlay(recruitId) {
  const def = CHARS[recruitId];
  $('#overlay-title').textContent = `Recruit ${def.name}`;
  $('#overlay-body').textContent = 'Choose who steps aside.';
  const choices = $('#overlay-choices');
  choices.innerHTML = '';
  // List current party (downed members allowed — recruit replaces them too)
  Object.keys(state.party.chars).forEach(currentId => {
    const cd = CHARS[currentId];
    const cs = state.party.chars[currentId];
    const slot = slotOfChar(state, currentId);
    const card = document.createElement('button');
    card.className = 'encounter-choice swap-choice';
    if (cs.downed) card.classList.add('swap-downed');
    card.innerHTML = `
      <div class="enc-name">${cd.name}${cs.downed ? ' · downed' : ''}</div>
      <div class="recruit-portrait">${PORTRAITS[currentId] || ''}</div>
      <div class="recruit-meta">
        <div class="recruit-title">${cd.title || ''}</div>
        <div class="recruit-stats">
          <span class="recruit-stat">HP ${cs.hp}/${cd.maxHp}</span>
          <span class="recruit-stat">${SLOT_LABELS[slot] || '—'}</span>
        </div>
      </div>
    `;
    card.addEventListener('click', () => commitRecruit(currentId, recruitId));
    choices.appendChild(card);
  });
  const btn = $('#overlay-btn');
  btn.textContent = '← Back';
  btn.onclick = () => {
    resetOverlayBtn();
    offerRecruitOrPath();
  };
}

function commitRecruit(removeId, recruitId) {
  const slot = slotOfChar(state, removeId);
  if (!slot) return;
  delete state.party.chars[removeId];
  state.party.chars[recruitId] = newCharState(recruitId);
  state.party.slots[slot] = recruitId;
  log(`<b>${CHARS[recruitId].name}</b> joins the party.`);
  hideOverlay();
  resetOverlayBtn();
  offerUpgradeOrPath();
}

// ============================================================================
// BOOT
// ============================================================================

function init() {
  state = newState();
  // start at the first option of the first slot; player branches between fights
  startEncounter(RUN_LAYOUT[0].options[0]);
}

// First-run welcome — gates init() until the player taps Begin.
// Keyed off localStorage so it only shows once per device.
function showWelcomeOverlay(onBegin) {
  $('#overlay-title').textContent = 'Triad';
  const body = $('#overlay-body');
  body.classList.add('welcome-body');
  body.innerHTML = `
    <p class="welcome-lede">Three heroes. Three slots. A 3-point budget per turn.</p>
    <ul class="welcome-list">
      <li><span class="welcome-key">Tap</span> an action to queue it. Spend your ATB, then play to commit.</li>
      <li><span class="welcome-key">Hold</span> an action to see its reach and predicted damage.</li>
      <li><span class="welcome-key">Hold</span> a hero to pick them up — drag onto an arrow to move slots.</li>
      <li>Win three reaches. HP and Resolve carry between fights.</li>
    </ul>
  `;
  const btn = $('#overlay-btn');
  btn.textContent = 'Begin';
  btn.classList.remove('hidden');
  btn.onclick = () => {
    try { localStorage.setItem('triad.welcomed', '1'); } catch (_) {}
    body.classList.remove('welcome-body');
    body.innerHTML = '';
    hideOverlay();
    resetOverlayBtn();
    onBegin();
  };
  $('#overlay-choices').classList.add('hidden');
  $('#overlay').classList.remove('hidden');
}

function bootGame() {
  bindUI();
  let welcomed = false;
  try { welcomed = !!localStorage.getItem('triad.welcomed'); } catch (_) {}
  if (welcomed) { init(); return; }
  showWelcomeOverlay(init);
}

document.addEventListener('DOMContentLoaded', bootGame);
