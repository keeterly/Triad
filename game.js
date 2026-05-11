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
const RESOLVE_DRIP = 1;
const KILL_RESOLVE = 2;

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
    maxHp: 26,
    home: 'front',
    passive: { name: 'Steadfast', desc: '−1 dmg taken in Front' },
    techs: {
      front: {
        basic: { name: 'Greatsword Cleave', desc: '8 dmg + vuln',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (!t[0]) return; applyDmgToEnemy(s, t[0], 8); if (!t[0].dead) t[0].vuln += 1; } },
        sig:   { name: 'Sunder', desc: '14 dmg + strip armor + 2 vuln',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (!t[0]) return; applyDmgToEnemy(s, t[0], 14); if (!t[0].dead) { t[0].armor = 0; t[0].vuln += 2; } } },
      },
      mid: {
        basic: { name: 'Vanguard', desc: '5 dmg front + advance',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 5); advance(s, 'cassia'); } },
        sig:   { name: 'Heroic Charge', desc: '9 dmg front + advance + 3 armor',
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
    maxHp: 19,
    home: 'mid',
    passive: { name: 'Mercy', desc: 'Heals self 1 when healing an ally' },
    techs: {
      front: {
        basic: { name: 'Phase Step', desc: '3 dmg + retreat to Mid',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 3); retreat(s, 'elin'); } },
        sig:   { name: 'Veil Step', desc: '6 dmg + retreat + 2 armor',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 6); retreat(s, 'elin'); addArmor(s, 'elin', 2); } },
      },
      mid: {
        basic: { name: 'Mend',         desc: 'Heal 6 lowest + cleanse', fn: (s) => { healLowest(s, 6); cleanseLowest(s); } },
        sig:   { name: 'Greater Mend', desc: 'Heal 12 lowest + cleanse + 2 armor', fn: (s) => { const c = healLowest(s, 12); cleanseLowest(s); if (c) c.armor += 2; } },
      },
      back: {
        basic: { name: 'Prayer',    desc: '+2 Resolve, heal 3 lowest', fn: (s) => { gainResolve(s, 2); healLowest(s, 3); } },
        sig:   { name: 'Sanctuary', desc: '+4 armor to party', fn: (s) => partyArmor(s, 4) },
      },
    },
  },
  branwen: {
    id: 'branwen',
    name: 'Branwen',
    title: 'Outlaw Archer',
    maxHp: 17,
    home: 'back',
    passive: { name: 'Bleed Hunter', desc: '+2 dmg to bleeding enemies' },
    techs: {
      front: {
        // close-range when shoved to Front: melee shots
        basic: { name: 'Backstep Shot', desc: '4 dmg + bleed 1 + retreat',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 4); if (!t[0].dead) t[0].bleed = Math.max(t[0].bleed, 1); } retreatFull(s, 'branwen'); } },
        sig:   { name: 'Vanish Shot', desc: '7 dmg + bleed 2 + retreat + 1 vuln',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 7); if (!t[0].dead) { t[0].bleed = Math.max(t[0].bleed, 2); t[0].vuln += 1; } } retreatFull(s, 'branwen'); } },
      },
      mid: {
        // mortar-lob: skips the front line, snipes mid/back
        basic: { name: 'Trick Shot', desc: '5 dmg lowest mid/back',
          reach: ['mid','back'], pattern: 'lowest',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 5); } },
        sig:   { name: 'Pierce', desc: '8 dmg lowest mid/back + ignore armor',
          reach: ['mid','back'], pattern: 'lowest',
          fn: (s, t) => { if (!t[0]) return; s.ignoreArmor = true; applyDmgToEnemy(s, t[0], 8); s.ignoreArmor = false; } },
      },
      back: {
        // archer's sweet spot: full-field reach
        basic: { name: 'Volley', desc: '4 dmg + bleed 1 all',
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 4)); t.forEach(e => { if (!e.dead) e.bleed = Math.max(e.bleed, 1); }); } },
        sig:   { name: 'Arrow Storm', desc: '7 dmg + bleed 2 all',
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 7)); t.forEach(e => { if (!e.dead) e.bleed = Math.max(e.bleed, 2); }); } },
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
    intents: [
      { name: 'Bite',    tag: 'ATK 6',          targetSlot: 'front', kind: 'atk', fn: (s) => dmgPartyAt(s, 'front', 6) },
      { name: 'Charge',  tag: 'ATK 4 + shove',  targetSlot: 'front', kind: 'atk', fn: (s) => { dmgPartyAt(s, 'front', 4); enemyShove(s, 'front', 'back'); } },
      { name: 'Frenzy',  tag: 'ATK 3 + bleed',  targetSlot: 'front', kind: 'atk', fn: (s) => { dmgPartyAt(s, 'front', 3); bleedPartyAt(s, 'front', 2); } },
    ],
  },
  cultist: {
    id: 'cultist', name: 'Cultist', title: 'Sin of Whispers', maxHp: 10,
    intents: [
      { name: 'Curse',     tag: 'WEAK 2',         targetSlot: 'front', kind: 'debuff', fn: (s) => weakSlot(s, 'front', 2) },
      { name: 'Hex',       tag: 'ATK 2 + weak',   targetSlot: 'front', kind: 'atk',    fn: (s) => { dmgPartyAt(s, 'front', 2); weakSlot(s, 'front', 1); } },
      { name: 'Doom Mark', tag: 'ATK 2 + vuln',   targetSlot: 'back',  kind: 'debuff', fn: (s) => { dmgPartyAt(s, 'back', 2); applyVulnParty(s, 'back', 1); } },
    ],
  },
  wraith: {
    id: 'wraith', name: 'Wraith', title: 'Sin of Sorrow', maxHp: 9,
    intents: [
      { name: 'Spectral Bolt', tag: 'ATK 5',     targetSlot: 'back', kind: 'atk', fn: (s) => dmgPartyAt(s, 'back', 5) },
      { name: 'Wail',          tag: 'ATK 2 all', targetSlot: 'all',  kind: 'aoe', fn: (s) => dmgAllParty(s, 2) },
      { name: 'Drain',         tag: 'ATK 3 low', targetSlot: '?',    kind: 'atk', fn: (s) => dmgLowestParty(s, 3) },
    ],
  },
  lineCaster: {
    id: 'lineCaster', name: 'Line Caster', title: 'Sin of Voices', maxHp: 12,
    intents: [
      { name: 'Verse of Faces',   tag: 'ATK 3 F+M', targetSlot: 'fm',  kind: 'aoe', fn: (s) => dmgLinePair(s, 'fm', 3) },
      { name: 'Discord',          tag: 'ATK 4 + vuln', targetSlot: 'mid', kind: 'atk', fn: (s) => { dmgPartyAt(s, 'mid', 4); applyVulnParty(s, 'mid', 1); } },
      { name: 'Verse of Shadows', tag: 'ATK 3 M+B', targetSlot: 'mb',  kind: 'aoe', fn: (s) => dmgLinePair(s, 'mb', 3) },
    ],
  },
  sniper: {
    id: 'sniper', name: 'Sniper', title: 'Sin of Distance', maxHp: 11,
    intents: [
      { name: 'Aimed Shot',       tag: 'ATK 6',        targetSlot: 'back',   kind: 'atk',    fn: (s) => dmgPartyAt(s, 'back', 6) },
      { name: 'Pierce',           tag: 'ATK 3 M+B',    targetSlot: 'pierce', kind: 'aoe',    fn: (s) => dmgPierce(s, 3) },
      { name: 'Crack the Shield', tag: 'ATK 2 + strip', targetSlot: 'back',   kind: 'debuff', fn: (s) => {
        const c = charBySlot(s, 'back');
        if (c && !c.downed && c.armor > 0) { c.armor = 0; log(`<b>${CHARS[c.id].name}</b>'s armor shatters.`); }
        dmgPartyAt(s, 'back', 2);
      } },
    ],
  },
  grappler: {
    id: 'grappler', name: 'Grappler', title: 'Sin of Grasp', maxHp: 15,
    intents: [
      { name: 'Hook',  tag: 'ATK 3 + pull', targetSlot: 'mid',   kind: 'atk', fn: (s) => { dmgPartyAt(s, 'mid', 3); enemyShove(s, 'mid', 'front'); } },
      { name: 'Crush', tag: 'ATK 7',        targetSlot: 'front', kind: 'atk', fn: (s) => dmgPartyAt(s, 'front', 7) },
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
};

// ============================================================================
// ENCOUNTERS & RUN LAYOUT — 3-fight gauntlet with branching path choice
// ============================================================================

const ENCOUNTERS = {
  e1: { id: 'e1', name: 'Bone & Bile',    slots: { front: 'ghoul',      mid: 'cultist',    back: 'wraith'  } },
  e2: { id: 'e2', name: "Veil's Edge",    slots: { front: 'wraith',     mid: 'cultist',    back: 'ghoul'   } },
  e3: { id: 'e3', name: 'Line of Echoes', slots: { front: 'cultist',    mid: 'lineCaster', back: 'wraith'  } },
  e4: { id: 'e4', name: 'Bowless Hunt',   slots: { front: 'ghoul',      mid: 'cultist',    back: 'sniper'  } },
  e5: { id: 'e5', name: 'Sundered Bond',  slots: { front: 'lineCaster', mid: 'grappler',   back: 'wraith'  } },
  e6: { id: 'e6', name: 'Quartered Sin',  slots: { front: 'cultist',    mid: 'lineCaster', back: 'sniper'  } },
};

const RUN_LAYOUT = [
  { slot: 0, label: 'First Reach',  options: ['e1', 'e2'] },
  { slot: 1, label: 'Second Reach', options: ['e3', 'e4'] },
  { slot: 2, label: 'Final Reach',  options: ['e5', 'e6'] },
];

const RESOLVE_CARRY_CAP = 3;

// ============================================================================
// ADJACENCY — pair synergies between adjacent positions (F-M and M-B)
// Each pair stores two synergies: one for the front-mid line, one for mid-back.
// Same pair produces a different bond depending on which adjacency line it occupies.
// ============================================================================

const ADJ = {
  'cassia+elin': {
    fm: {
      name: "Sister's Watch", type: 'bond',
      onPartyDamaged(s, charId) { if (charId === 'cassia') gainResolve(s, 1); },
    },
    mb: {
      name: 'Veiled Vow', type: 'bond',
      onHeal(s, healerId) {
        if (healerId !== 'elin') return;
        const c = s.party.chars.cassia;
        if (!c || c.downed) return;
        c.armor += 1;
        spawnPopupId('cassia', '+1⛨', 'armor', 'party');
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
        spawnPopupId('branwen', '+2 atk', 'armor', 'party');
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
        spawnPopupId('elin', '+2 heal', 'heal', 'party');
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
        if (b.hp > before) spawnPopupId('branwen', '+1', 'heal', 'party');
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
    outgoingDmgMod: 0,
    ignoreArmor: false,
    currentActorId: null, // who is acting right now (for passives + adjacency hooks)

    // run-level progress (persists across fights within a run)
    run: {
      slotIdx: 0,            // 0,1,2 — which RUN_LAYOUT entry we're on
      currentEncId: null,    // id of the active encounter, or null before first start
      completed: [],         // encIds of cleared fights, in order
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
  state.run.currentEncId = encId;

  if (!isFirstFight) {
    state.resolve = Math.min(RESOLVE_CARRY_CAP, state.resolve);
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
  // pending one-shot attack bonuses (Banner Fire)
  amt += consumePendingBonus(s, s.currentActorId, 'attackBonus');
  amt += s.outgoingDmgMod;

  // vulnerable adds +2 per stack consumed (1 stack per hit)
  let vulnConsumed = 0;
  if (e.vuln > 0 && amt > 0) { amt += 2; vulnConsumed = 1; }

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

  const popupType = e.staggered ? 'crit' : 'dmg';
  spawnPopupId(e.id, `-${toHp}`, popupType, 'enemy');
  flashCardId(e.id, 'hit', 'enemy');
  log(`<b>${ENEMIES[e.id].name}</b> takes ${toHp} damage${e.staggered ? ' (stagger!)' : ''}.`);
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
  gainResolve(s, KILL_RESOLVE);
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
  // clear single-turn buffs that survived the enemy phase
  aliveParty(s).forEach(c => { c.taunt = false; c.retaliate = 0; });
  log(`<span class="msg-strong">— Turn ${s.turn} —</span>`);

  // bleed tick
  aliveParty(s).forEach(c => {
    if (c.bleed > 0) {
      const dmg = 2;
      c.hp = Math.max(0, c.hp - dmg); c.bleed -= 1;
      spawnPopupId(c.id, `-${dmg}`, 'dmg', 'party');
      flashCardId(c.id, 'hit', 'party');
      log(`<b>${CHARS[c.id].name}</b> bleeds (${dmg}).`);
      if (c.hp === 0) { c.downed = true; c.pendingEffects = []; log(`<b>${CHARS[c.id].name}</b> falls.`); }
    }
  });
  aliveEnemies(s).forEach(e => {
    if (e.bleed > 0) {
      const dmg = Math.max(0, 2 - (s.ignoreArmor ? 0 : e.armor));
      e.hp = Math.max(0, e.hp - dmg); e.bleed -= 1;
      if (dmg > 0) { spawnPopupId(e.id, `-${dmg}`, 'dmg', 'enemy'); flashCardId(e.id, 'hit', 'enemy'); }
      log(`<b>${ENEMIES[e.id].name}</b> bleeds (${dmg}).`);
      if (e.hp === 0) killEnemy(s, e);
    }
  });

  gainResolve(s, RESOLVE_DRIP);

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
    const tech = CHARS[charId].techs[slot].basic;
    return { kind, valid: true, label: tech.name, desc: tech.desc, atb, resolveCost: 0, slot };
  }
  if (kind === 'special') {
    const tech = CHARS[charId].techs[slot].sig;
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
  return ATB_MAX - queueAtbUsed();
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

function queueTeamSpecial() {
  const s = state;
  if (s.executing || s.over) return;
  if (s.resolve < TEAM_SPECIAL_COST) { flashMsg('Not enough Resolve.'); return; }
  if (s.queue.length > 0) { flashMsg('Team Special needs an empty queue.'); return; }
  const ts = getTeamSpecial(s);
  s.queue = [{
    kind: 'team',
    label: ts.name,
    desc: ts.short,
    atb: TEAM_SPECIAL_ATB,
    resolveCost: TEAM_SPECIAL_COST,
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
    const techDef = CHARS[item.charId].techs[slot];
    const variant = item.kind === 'special' ? techDef.sig : techDef.basic;
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
    short: 'AoE 5 · heal 5 · cleanse · armor',
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
    short: 'Pierce 10 + bleed all · Cassia retaliate',
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
    short: 'Volley 6 all · Cassia advances · armor',
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
  short: 'AoE 4 · heal 3 lowest · +1 Resolve',
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
    const isFinal = s.run.slotIdx >= RUN_LAYOUT.length - 1;
    if (isFinal) {
      showOverlay('Victory', 'All three sins are unbound. Your reach holds the dawn.');
    } else {
      s.run.slotIdx += 1;
      const nextSlot = RUN_LAYOUT[s.run.slotIdx];
      // brief delay so the kill animations land before the choice appears
      setTimeout(() => showPathChoice(nextSlot), 480);
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
  $('#turn-num').textContent = state.turn;
  const pips = $('#resolve-pips'); pips.innerHTML = '';
  for (let i = 0; i < RESOLVE_MAX; i++) {
    const p = document.createElement('div');
    p.className = 'pip' + (i < state.resolve ? ' filled' : '');
    pips.appendChild(p);
  }
  const pill = $('#encounter-pill');
  if (pill && state.run) {
    pill.textContent = `${state.run.slotIdx + 1}/${RUN_LAYOUT.length}`;
  }
  const encName = $('#encounter-name');
  if (encName && state.run && state.run.currentEncId) {
    const enc = ENCOUNTERS[state.run.currentEncId];
    encName.textContent = enc ? enc.name : '';
  }
}

function flashResolve() {
  $('#resolve-pips').animate(
    [{ filter: 'brightness(2)' }, { filter: 'brightness(1)' }],
    { duration: 350 }
  );
}

function renderBattlefield() {
  // determine which player slots are targeted by enemy intents
  const threatened = new Set();
  aliveEnemies(state).forEach(e => {
    const intent = ENEMIES[e.id].intents[e.intentIdx % ENEMIES[e.id].intents.length];
    const ts = intent.targetSlot;
    if (ts === 'all') SLOTS.forEach(s => threatened.add(s));
    else if (ts === 'fm') { threatened.add('front'); threatened.add('mid'); }
    else if (ts === 'mb' || ts === 'pierce') { threatened.add('mid'); threatened.add('back'); }
    else if (ts && ts !== '?') threatened.add(ts);
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
    partyHalf.appendChild(makePartyCard(c, slot, threatened.has(slot), adjMap));
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

    const header = document.createElement('div');
    header.className = 'char-col-header';
    if (simSlot === def.home) header.classList.add('home-color');
    header.innerHTML = `
      <div class="cch-avatar">${PORTRAITS[charId] || ''}</div>
      <div class="cch-text">
        <div class="cch-name">${def.name}</div>
        <div class="cch-slot">${SLOT_LABELS[simSlot] || '—'}${simSlot === def.home ? ' · home' : ''}</div>
      </div>
    `;
    col.appendChild(header);

    col.appendChild(makeTile('attack', charId, null, tileCounts, teamLocked));
    col.appendChild(makeTile('special', charId, null, tileCounts, teamLocked));
    col.appendChild(makeMoveOrBraceTile(charId, simSlot, tileCounts, teamLocked));

    grid.appendChild(col);
  });
}

function cornerBrackets() {
  return '<i class="cnr cnr-tl"></i><i class="cnr cnr-tr"></i><i class="cnr cnr-bl"></i><i class="cnr cnr-br"></i>';
}

function makePartyCard(c, slot, threatened, adjMap) {
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

  let topChip = '', bottomChip = '';
  if (!c.downed && adj) {
    if (slot === 'front' && adj.fm) topChip = chipHtml(adj.fm, 'top');
    else if (slot === 'back' && adj.mb) bottomChip = chipHtml(adj.mb, 'bottom');
    else if (slot === 'mid') {
      if (adj.mb) topChip = chipHtml(adj.mb, 'top');
      if (adj.fm) bottomChip = chipHtml(adj.fm, 'bottom');
    }
  }

  const def = CHARS[c.id];
  const isHome = def.home === slot;
  const hpPct = (c.hp / c.maxHp) * 100;
  fig.innerHTML = `
    ${topChip}
    ${bottomChip}
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
  `;
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

  const staggerBanner = e.staggered ? `<div class="staggered-banner">STAGGERED</div>` : '';
  // Intent floats ABOVE the figure as a damage-call bubble (like the reference's "⚔ 14" hover-glyphs).
  const intentBubble = e.staggered ? '' : `
    <div class="intent-bubble ${intentClass}">
      <span class="intent-icon">${icon}</span>
      <span class="intent-tag">${intent.tag}</span>
      <span class="intent-target">${targetTag}</span>
    </div>`;

  fig.innerHTML = `
    ${intentBubble}
    ${staggerBanner}
    <div class="figure-statuses">${renderStatuses(e)}</div>
    <div class="figure-portrait">${PORTRAITS[e.id] || ''}</div>
    <div class="figure-shadow"></div>
    <div class="figure-info">
      <div class="figure-hp">
        <div class="hp-fill ${hpPct < 35 ? 'low' : ''}" style="width:${hpPct}%"></div>
        <div class="hp-text">${e.hp}/${e.maxHp}</div>
      </div>
      <div class="figure-name">${def.name}</div>
      <div class="chain-bar"><div class="chain-fill" style="width:${chainPct}%"></div></div>
    </div>
  `;
  return fig;
}

function renderStatuses(ent) {
  const c = [];
  if (ent.armor > 0)     c.push(`<span class="status-chip status-armor">⛨${ent.armor}</span>`);
  if (ent.bleed > 0)     c.push(`<span class="status-chip status-bleed">bleed ${ent.bleed}</span>`);
  if (ent.taunt)         c.push(`<span class="status-chip status-taunt">taunt</span>`);
  if (ent.weak > 0)      c.push(`<span class="status-chip status-weak">weak ${ent.weak}</span>`);
  if (ent.vuln > 0)      c.push(`<span class="status-chip status-vuln">vuln ${ent.vuln}</span>`);
  if (ent.retaliate > 0) c.push(`<span class="status-chip status-retal">retaliate ${ent.retaliate}</span>`);
  if (ent.pendingEffects) ent.pendingEffects.forEach(e => {
    const label = e.kind === 'attackBonus' ? `+${e.amt} atk` : e.kind === 'healBonus' ? `+${e.amt} heal` : `+${e.amt}`;
    c.push(`<span class="status-chip status-pending">${label}</span>`);
  });
  return c.join('');
}

// queue strip — variable-width bar. Each queued item takes flex-grow proportional
// to its ATB cost. Remaining ATB is shown as a dimmed placeholder taking the leftover.
function renderQueue() {
  const strip = $('#queue-strip');
  strip.innerHTML = '';
  // Queue strip is a 3-column grid where each item spans (atb) columns via [data-atb].
  // The remaining ATB shows as individual 1-cell placeholders so the strip never
  // resizes existing items when a new action is queued.
  let used = 0;
  state.queue.forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = `queue-slot filled kind-${item.kind}`;
    el.dataset.atb = String(item.atb || 1);
    const who = item.charId ? CHARS[item.charId].name : '';
    el.innerHTML = `
      <span class="qs-cost">${item.atb}</span>
      <span class="qs-name">${who ? `${who} · ${item.label}` : item.label}</span>
      <span class="qs-desc">${item.desc || ''}</span>
    `;
    el.title = 'tap to remove';
    el.addEventListener('click', () => queueRemoveAt(idx));
    strip.appendChild(el);
    used += item.atb || 0;
  });
  const remaining = ATB_MAX - used;
  for (let i = 0; i < remaining; i++) {
    const ph = document.createElement('div');
    ph.className = 'queue-slot placeholder';
    ph.dataset.atb = '1';
    ph.innerHTML = `<span class="qs-name">·</span>`;
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
  t.disabled = !preview.valid || c.downed || state.executing || state.over || teamLocked
    || atbCost > queueAtbAvailable()
    || resolveCost > queueAvailableResolve();
  t.dataset.kind = kind;
  t.dataset.charId = charId;
  if (dir !== null && dir !== undefined) t.dataset.dir = dir;

  const key = `${kind}:${charId}:${dir ?? ''}`;
  const qCount = tileCounts[key];
  if (qCount) t.classList.add('queued');

  // reach badge (static info — different from the live hold-preview)
  const reachLabel = previewReachLabel(kind, charId, dir);

  const costBadges = [];
  if (atbCost > 0)     costBadges.push(`<span class="tile-atb">${atbCost} ATB</span>`);
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
  const tech = CHARS[charId].techs[slot];
  const variant = kind === 'special' ? tech.sig : tech.basic;
  if (!variant || !variant.reach) return '';
  const letters = variant.reach.map(r => r[0].toUpperCase()).join('');
  if (variant.pattern === 'all')    return `hit ${letters}`;
  if (variant.pattern === 'lowest') return `low ${letters}`;
  return letters;
}

// returns the set of enemy slot names that would be hit if the tile fired now
function previewTargetsForTile(kind, charId, dir) {
  if (kind === 'attack' || kind === 'special') {
    const sim = simulateSlotsThrough(state, state.queue.length);
    const slot = slotOfCharSim(sim, charId);
    if (!slot) return { enemySlots: [], partySlots: [] };
    const tech = CHARS[charId].techs[slot];
    const variant = kind === 'special' ? tech.sig : tech.basic;
    const targets = resolveTargets(state, variant) || [];
    const enemySlots = targets.map(e => SLOTS.find(sl => state.enemies.slots[sl] === e.id)).filter(Boolean);
    return { enemySlots, partySlots: [] };
  }
  if (kind === 'move') {
    const sim = simulateSlotsThrough(state, state.queue.length);
    const slot = slotOfCharSim(sim, charId);
    if (!slot) return { enemySlots: [], partySlots: [] };
    const idx = SLOTS.indexOf(slot);
    const ti = idx + dir;
    if (ti < 0 || ti > 2) return { enemySlots: [], partySlots: [] };
    return { enemySlots: [], partySlots: [SLOTS[ti]] };
  }
  return { enemySlots: [], partySlots: [] };
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

function applyPreviewHighlight({ enemySlots, partySlots }) {
  clearPreviewHighlight();
  (enemySlots || []).forEach(sl => {
    const el = document.querySelector(`#enemy-half .card[data-slot="${sl}"]`);
    if (el) el.classList.add('target-marker');
  });
  (partySlots || []).forEach(sl => {
    const el = document.querySelector(`#party-half .card[data-slot="${sl}"]`);
    if (el) el.classList.add('target-marker');
  });
}
function clearPreviewHighlight() {
  document.querySelectorAll('.target-marker').forEach(el => el.classList.remove('target-marker'));
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
  const canAfford = state.resolve >= TEAM_SPECIAL_COST;
  const queueEmpty = state.queue.length === 0;
  t.disabled = !canAfford || !queueEmpty || state.executing || state.over;
  if (canAfford && queueEmpty) t.classList.add('ready');
  if (teamLocked) t.classList.add('queued');

  const formationLabel = `${CHARS[state.party.slots.front]?.name?.[0] || '·'}-${CHARS[state.party.slots.mid]?.name?.[0] || '·'}-${CHARS[state.party.slots.back]?.name?.[0] || '·'}`;
  t.innerHTML = `
    <span class="ts-label">Team Special</span>
    <span class="ts-name">${ts.name}</span>
    <span class="ts-form">formation ${formationLabel}</span>
    <span class="ts-desc">${ts.short}</span>
    <span class="ts-cost">${TEAM_SPECIAL_ATB} ATB · ${TEAM_SPECIAL_COST}♦</span>
  `;
  bindTileHold(t, {
    onQueue: () => queueTeamSpecial(),
    onPreview: () => {
      const targets = resolveTargets(state, ts) || [];
      const enemySlots = targets.map(e => SLOTS.find(sl => state.enemies.slots[sl] === e.id)).filter(Boolean);
      return { enemySlots, partySlots: [] };
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
  $('#overlay-btn').addEventListener('click', () => { hideOverlay(); init(); });
}

function showOverlay(title, body) {
  $('#overlay-title').textContent = title;
  $('#overlay-body').textContent = body;
  const choices = $('#overlay-choices');
  if (choices) { choices.innerHTML = ''; choices.classList.add('hidden'); }
  const btn = $('#overlay-btn');
  if (btn) btn.classList.remove('hidden');
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
    const enemyIcons = SLOTS.map(sl => {
      const eid = enc.slots[sl];
      const def = ENEMIES[eid];
      return `<div class="enc-icon" title="${def?.name || ''}">${PORTRAITS[eid] || ''}<div class="enc-icon-slot">${SLOT_LABELS[sl]}</div></div>`;
    }).join('');
    card.innerHTML = `
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
  $('#overlay-btn').classList.add('hidden');
  $('#overlay').classList.remove('hidden');
}

function hideOverlay() { $('#overlay').classList.add('hidden'); }

// ============================================================================
// BOOT
// ============================================================================

function init() {
  state = newState();
  // start at the first option of the first slot; player branches between fights
  startEncounter(RUN_LAYOUT[0].options[0]);
}

document.addEventListener('DOMContentLoaded', () => { bindUI(); init(); });
