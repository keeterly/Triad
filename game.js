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
</svg>`,
  kai: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="kai-bg" cx="50%" cy="30%" r="85%">
      <stop offset="0%" stop-color="#3a3a3e"/>
      <stop offset="100%" stop-color="#0c0a10"/>
    </radialGradient>
    <linearGradient id="kai-cloak" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2d2228"/>
      <stop offset="100%" stop-color="#15101a"/>
    </linearGradient>
    <linearGradient id="kai-blade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#dfe5ea"/>
      <stop offset="100%" stop-color="#8a93a0"/>
    </linearGradient>
  </defs>
  <!-- cloak / shoulders -->
  <path d="M16 130 L24 70 Q50 58 76 70 L84 130 Z" fill="url(#kai-cloak)" stroke="#0a070d" stroke-width="0.6"/>
  <!-- tunic open at the chest -->
  <path d="M38 78 L50 90 L62 78 L62 130 L38 130 Z" fill="#1a1418" stroke="#0a070d" stroke-width="0.5"/>
  <!-- belt / sash -->
  <rect x="36" y="100" width="28" height="4" fill="#7a4a2a"/>
  <!-- neck -->
  <path d="M44 60 L44 72 L56 72 L56 60 Z" fill="#d8c1a8"/>
  <!-- head -->
  <ellipse cx="50" cy="48" rx="14" ry="16" fill="#e3c8ad"/>
  <!-- hair -->
  <path d="M36 42 Q40 30 50 30 Q60 30 64 42 Q60 36 50 36 Q40 36 36 42 Z" fill="#2a1a14"/>
  <path d="M36 42 Q35 50 38 56" fill="none" stroke="#2a1a14" stroke-width="2"/>
  <path d="M64 42 Q65 50 62 56" fill="none" stroke="#2a1a14" stroke-width="2"/>
  <!-- scar across left cheek -->
  <path d="M42 50 L46 56" stroke="#a85050" stroke-width="0.7" fill="none"/>
  <!-- eyes -->
  <ellipse cx="44" cy="48" rx="1.2" ry="1.4" fill="#1a1014"/>
  <ellipse cx="56" cy="48" rx="1.2" ry="1.4" fill="#1a1014"/>
  <!-- subtle smirk -->
  <path d="M46 56 Q50 58 54 56" stroke="#7a3838" stroke-width="0.6" fill="none"/>
  <!-- one-hand sword on hip (resting) -->
  <rect x="64" y="92" width="2.4" height="32" fill="url(#kai-blade)"/>
  <rect x="62" y="90" width="6" height="3" fill="#3a2418"/>
  <rect x="64.5" y="88" width="1.5" height="6" fill="#8a6a32"/>
  <!-- shoulder buckle -->
  <circle cx="32" cy="76" r="2.2" fill="#8a6a32"/>
  <circle cx="68" cy="76" r="2.2" fill="#8a6a32"/>
</svg>`,
  // ===== GARRON — Warden of the Gate =====
  // Heavy plate silhouette, a great kite shield held forward.  Cool steel
  // grey palette with iron-blue accents and a faint gold trim line.
  garron: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="garron-armor" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#5a6470"/>
      <stop offset="60%" stop-color="#2c343c"/>
      <stop offset="100%" stop-color="#10141a"/>
    </linearGradient>
    <linearGradient id="garron-shield" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#6a7682"/>
      <stop offset="60%" stop-color="#2e3640"/>
      <stop offset="100%" stop-color="#0a0e14"/>
    </linearGradient>
  </defs>
  <!-- bulky pauldrons + chest plate silhouette -->
  <path d="M22 130 L18 78 Q26 60 32 56 Q50 52 68 56 Q74 60 82 78 L78 130 Z"
        fill="url(#garron-armor)" stroke="#06080c" stroke-width="0.7"/>
  <!-- helm with face slit (great-helm) -->
  <path d="M36 60 Q36 38 50 36 Q64 38 64 60 L60 64 L40 64 Z" fill="#3a4250" stroke="#06080c" stroke-width="0.5"/>
  <!-- horizontal eye slit -->
  <rect x="40" y="50" width="20" height="2.4" fill="#0a0c10"/>
  <!-- twin glowing slits inside (the eyes) -->
  <rect x="42" y="50.6" width="6" height="1.2" fill="#7c98c0" opacity="0.9"/>
  <rect x="52" y="50.6" width="6" height="1.2" fill="#7c98c0" opacity="0.9"/>
  <!-- helm crest ridge -->
  <path d="M48 36 L50 30 L52 36 Z" fill="#5a6470"/>
  <!-- pauldron edges -->
  <path d="M18 78 Q14 70 22 64 L28 70 Z" fill="#3a4250"/>
  <path d="M82 78 Q86 70 78 64 L72 70 Z" fill="#3a4250"/>
  <!-- center chest emblem — gold cross on dark plate -->
  <rect x="46" y="84" width="8" height="22" fill="#1a2028"/>
  <rect x="48" y="86" width="4" height="18" fill="#a07a3c"/>
  <rect x="46" y="92" width="8" height="3" fill="#a07a3c"/>
  <!-- great kite shield held forward (left side from viewer) -->
  <path d="M14 84 Q12 80 16 78 L26 80 L28 110 Q22 118 14 110 Z"
        fill="url(#garron-shield)" stroke="#04060a" stroke-width="0.6"/>
  <!-- shield boss + cross emblem -->
  <circle cx="20" cy="92" r="3" fill="#1a2028" stroke="#a07a3c" stroke-width="0.6"/>
  <line x1="20" y1="86" x2="20" y2="100" stroke="#a07a3c" stroke-width="0.5"/>
  <line x1="14" y1="92" x2="26" y2="92" stroke="#a07a3c" stroke-width="0.5"/>
  <!-- mace haft on his right hip (just a hint of weapon weight) -->
  <rect x="68" y="90" width="2.4" height="30" fill="#3a2c20"/>
  <rect x="65" y="118" width="9" height="6" fill="#2a323a" stroke="#06080c" stroke-width="0.4"/>
</svg>`,
  // ===== LIRIEN — Songbinder =====
  // Slim hooded silhouette in deep teal, holding a small harp.  Cool
  // arcane palette with faint violet eye-glow + drifting note glyphs
  // around her shoulders so the player reads "musician-mage" at a glance.
  lirien: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="lirien-robe" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2a4a52"/>
      <stop offset="60%" stop-color="#142428"/>
      <stop offset="100%" stop-color="#06101a"/>
    </linearGradient>
    <radialGradient id="lirien-eye" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f0e0ff"/>
      <stop offset="55%" stop-color="#a07acc"/>
      <stop offset="100%" stop-color="#3a2050"/>
    </radialGradient>
  </defs>
  <!-- robed silhouette + hood -->
  <path d="M22 130 L20 70 Q30 52 50 50 Q70 52 80 70 L78 130 Z"
        fill="url(#lirien-robe)" stroke="#04080c" stroke-width="0.6"/>
  <!-- hood drape -->
  <path d="M30 56 Q50 42 70 56 Q66 70 50 72 Q34 70 30 56 Z" fill="#0e1820"/>
  <!-- shoulders cloth slit (asymmetric) -->
  <path d="M18 76 Q22 70 28 72 L28 92 Q24 96 18 92 Z" fill="#1a2c34"/>
  <!-- pale face, eyes faintly glowing -->
  <ellipse cx="50" cy="62" rx="6.5" ry="8" fill="#f6e9d6"/>
  <ellipse cx="46" cy="62" rx="1.4" ry="2" fill="url(#lirien-eye)"/>
  <ellipse cx="54" cy="62" rx="1.4" ry="2" fill="url(#lirien-eye)"/>
  <line x1="48" y1="68" x2="52" y2="68" stroke="#2a1a2a" stroke-width="0.5"/>
  <!-- small harp held forward (just an angular bow + 3 strings) -->
  <path d="M28 96 Q24 84 38 80 L38 100 Z" fill="none" stroke="#a07a3c" stroke-width="1.2"/>
  <line x1="31" y1="92" x2="38" y2="92" stroke="#cfb86a" stroke-width="0.35"/>
  <line x1="30" y1="96" x2="38" y2="96" stroke="#cfb86a" stroke-width="0.35"/>
  <line x1="29" y1="100" x2="38" y2="100" stroke="#cfb86a" stroke-width="0.35"/>
  <!-- drifting note glyphs around her -->
  <text x="68" y="76" font-size="6" fill="#a07acc" opacity="0.75">♪</text>
  <text x="80" y="92" font-size="5" fill="#a07acc" opacity="0.6">♪</text>
  <text x="22" y="110" font-size="5" fill="#a07acc" opacity="0.55">♫</text>
  <text x="76" y="116" font-size="4.5" fill="#a07acc" opacity="0.45">♪</text>
</svg>`,
  // ===== VASHA — Lightspeaker =====
  // Open-robed silhouette in pale cream + warm gold trim.  Carries a
  // lantern-staff on her right side and an open book on her left.  Soft
  // gold dust motes around her head sell the holy back-line vibe.
  vasha: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="vasha-robe" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f0e0c4"/>
      <stop offset="60%" stop-color="#a08862"/>
      <stop offset="100%" stop-color="#3a2c1a"/>
    </linearGradient>
    <radialGradient id="vasha-lantern" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fff4d2"/>
      <stop offset="55%" stop-color="#f0c460"/>
      <stop offset="100%" stop-color="#3a2010"/>
    </radialGradient>
  </defs>
  <!-- robed silhouette -->
  <path d="M24 130 L20 70 Q28 56 50 54 Q72 56 80 70 L76 130 Z"
        fill="url(#vasha-robe)" stroke="#2a1a08" stroke-width="0.6"/>
  <!-- shoulder mantle trim -->
  <path d="M22 78 Q34 70 50 70 Q66 70 78 78 L78 86 Q66 80 50 80 Q34 80 22 86 Z" fill="#d4b86a"/>
  <!-- pale face -->
  <ellipse cx="50" cy="60" rx="6.5" ry="8.5" fill="#f6e9d6"/>
  <ellipse cx="46" cy="60" rx="1.2" ry="1.6" fill="#3a2010"/>
  <ellipse cx="54" cy="60" rx="1.2" ry="1.6" fill="#3a2010"/>
  <line x1="48" y1="66" x2="52" y2="66" stroke="#3a2010" stroke-width="0.5"/>
  <!-- gold-trimmed hood, half-pulled back -->
  <path d="M40 56 Q40 44 50 42 Q60 44 60 56 L56 54 L44 54 Z" fill="#a08862"/>
  <path d="M40 56 Q40 44 50 42 Q60 44 60 56" fill="none" stroke="#f0c460" stroke-width="0.6"/>
  <!-- lantern staff on her right -->
  <rect x="78" y="76" width="2.4" height="46" fill="#5a3818"/>
  <circle cx="79.2" cy="74" r="4.5" fill="url(#vasha-lantern)" stroke="#5a3818" stroke-width="0.5"/>
  <line x1="76" y1="74" x2="82" y2="74" stroke="#3a2010" stroke-width="0.3"/>
  <line x1="79.2" y1="70" x2="79.2" y2="78" stroke="#3a2010" stroke-width="0.3"/>
  <!-- open book on her left arm -->
  <rect x="14" y="92" width="14" height="10" fill="#f0e0c4" stroke="#3a2010" stroke-width="0.5"/>
  <line x1="21" y1="92" x2="21" y2="102" stroke="#a08862" stroke-width="0.5"/>
  <line x1="17" y1="95" x2="20" y2="95" stroke="#3a2010" stroke-width="0.25"/>
  <line x1="17" y1="98" x2="20" y2="98" stroke="#3a2010" stroke-width="0.25"/>
  <line x1="22" y1="95" x2="25" y2="95" stroke="#3a2010" stroke-width="0.25"/>
  <line x1="22" y1="98" x2="25" y2="98" stroke="#3a2010" stroke-width="0.25"/>
  <!-- gold dust motes around the head -->
  <circle cx="36" cy="50" r="0.9" fill="#fff4d2" opacity="0.85"/>
  <circle cx="64" cy="46" r="0.9" fill="#fff4d2" opacity="0.8"/>
  <circle cx="50" cy="36" r="0.7" fill="#fff4d2" opacity="0.75"/>
  <circle cx="42" cy="42" r="0.6" fill="#fff4d2" opacity="0.6"/>
  <circle cx="58" cy="50" r="0.6" fill="#fff4d2" opacity="0.6"/>
</svg>`,
  // ===== HASK — Frostling =====
  // Heavy fur-wrapped figure with ice plates on the shoulders and a long
  // frosted blade held low.  Cold blue-white palette, pale eyes glowing
  // through a winter hood, small ice motes drifting near his head.
  hask: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="hask-cloak" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#4a6478"/>
      <stop offset="60%" stop-color="#1a2838"/>
      <stop offset="100%" stop-color="#080e16"/>
    </linearGradient>
    <linearGradient id="hask-ice" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#d6e8f4"/>
      <stop offset="100%" stop-color="#6090b0"/>
    </linearGradient>
    <radialGradient id="hask-eye" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#eaf6ff"/>
      <stop offset="55%" stop-color="#7cb4d6"/>
      <stop offset="100%" stop-color="#1a3850"/>
    </radialGradient>
  </defs>
  <!-- broad fur cloak silhouette -->
  <path d="M14 130 L10 76 Q24 56 50 56 Q76 56 90 76 L86 130 Z"
        fill="url(#hask-cloak)" stroke="#04060a" stroke-width="0.7"/>
  <!-- shaggy fur shoulder ruff -->
  <path d="M16 78 Q24 70 36 76 Q26 72 18 86 Z" fill="#2c3e4e"/>
  <path d="M84 78 Q76 70 64 76 Q74 72 82 86 Z" fill="#2c3e4e"/>
  <!-- pale hood + face -->
  <path d="M36 62 Q36 44 50 42 Q64 44 64 62 L60 66 L40 66 Z" fill="#3a4a5c"/>
  <!-- ice plates / frost crystal on top of hood -->
  <polygon points="48,42 50,32 52,42" fill="url(#hask-ice)"/>
  <polygon points="44,46 41,38 46,44" fill="url(#hask-ice)" opacity="0.85"/>
  <polygon points="56,46 59,38 54,44" fill="url(#hask-ice)" opacity="0.85"/>
  <!-- glowing pale eyes -->
  <ellipse cx="44" cy="58" rx="1.6" ry="2" fill="url(#hask-eye)"/>
  <ellipse cx="56" cy="58" rx="1.6" ry="2" fill="url(#hask-eye)"/>
  <!-- jaw shadow -->
  <path d="M40 66 Q50 72 60 66 L58 70 L42 70 Z" fill="#1a2838"/>
  <!-- long frosted blade held low on his right -->
  <rect x="76" y="92" width="2.2" height="34" fill="url(#hask-ice)"/>
  <rect x="74" y="90" width="6" height="3" fill="#3a4a5c"/>
  <rect x="76.5" y="88" width="1.2" height="6" fill="#5a6a78"/>
  <!-- ice motes around the head -->
  <circle cx="34" cy="50" r="0.9" fill="#d6e8f4" opacity="0.85"/>
  <circle cx="66" cy="48" r="0.9" fill="#d6e8f4" opacity="0.8"/>
  <circle cx="50" cy="34" r="0.7" fill="#d6e8f4" opacity="0.75"/>
  <circle cx="40" cy="38" r="0.6" fill="#d6e8f4" opacity="0.6"/>
  <circle cx="60" cy="40" r="0.6" fill="#d6e8f4" opacity="0.6"/>
</svg>`,
  husk: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <path d="M30 130 L26 70 Q50 56 74 70 L70 130 Z" fill="#2a2628" stroke="#0a070a" stroke-width="0.6"/>
  <path d="M38 130 L40 86 L60 86 L62 130 Z" fill="#16131a"/>
  <ellipse cx="50" cy="56" rx="14" ry="14" fill="#3a3438"/>
  <ellipse cx="50" cy="56" rx="11" ry="11" fill="#0e0c10"/>
  <!-- two pinprick eyes -->
  <circle cx="44" cy="56" r="1.2" fill="#dcd0c0"/>
  <circle cx="56" cy="56" r="1.2" fill="#dcd0c0"/>
  <!-- bound jaw rope -->
  <rect x="42" y="64" width="16" height="2" fill="#4a3a2a"/>
  <!-- broad shoulders -->
  <ellipse cx="50" cy="74" rx="26" ry="6" fill="#1c181e"/>
</svg>`,
  pyremaw: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="pm-mouth" cx="50%" cy="65%" r="55%">
      <stop offset="0%" stop-color="#ffd070"/>
      <stop offset="55%" stop-color="#e84a18"/>
      <stop offset="100%" stop-color="#1c0606"/>
    </radialGradient>
  </defs>
  <path d="M26 130 L24 64 Q50 48 76 64 L74 130 Z" fill="#1a0e0a"/>
  <ellipse cx="50" cy="76" rx="22" ry="22" fill="#150806"/>
  <ellipse cx="50" cy="80" rx="16" ry="14" fill="url(#pm-mouth)"/>
  <!-- teeth -->
  <path d="M38 76 L42 86 L46 76 L50 86 L54 76 L58 86 L62 76 Z" fill="#f0e8d8"/>
  <!-- glowing eyes -->
  <circle cx="42" cy="66" r="2.4" fill="#ffae5c"/>
  <circle cx="58" cy="66" r="2.4" fill="#ffae5c"/>
</svg>`,
  echocaster: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <path d="M30 130 L20 76 Q50 60 80 76 L70 130 Z" fill="#1a1828" stroke="#080612" stroke-width="0.5"/>
  <!-- floating shards above the figure -->
  <polygon points="50,46 54,54 50,60 46,54" fill="#7a8ac0" opacity="0.9"/>
  <polygon points="38,52 42,58 38,62 34,58" fill="#5a6aa0" opacity="0.7"/>
  <polygon points="62,52 66,58 62,62 58,58" fill="#5a6aa0" opacity="0.7"/>
  <!-- hooded head -->
  <ellipse cx="50" cy="74" rx="14" ry="14" fill="#241e30"/>
  <ellipse cx="50" cy="74" rx="11" ry="11" fill="#0e0c18"/>
  <!-- glowing eye line -->
  <rect x="42" y="74" width="16" height="1.6" fill="#9aa8d8"/>
  <!-- robe drape -->
  <path d="M30 100 Q50 92 70 100 L66 130 L34 130 Z" fill="#100e1a"/>
</svg>`,
  ashling: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <path d="M40 130 L36 78 Q50 70 64 78 L60 130 Z" fill="#2a2018"/>
  <ellipse cx="50" cy="72" rx="10" ry="10" fill="#1a1410"/>
  <circle cx="46" cy="72" r="1.2" fill="#ffa050"/>
  <circle cx="54" cy="72" r="1.2" fill="#ffa050"/>
  <!-- trailing ash -->
  <circle cx="34" cy="100" r="1.4" fill="#a09080" opacity="0.6"/>
  <circle cx="66" cy="104" r="1"   fill="#a09080" opacity="0.5"/>
  <circle cx="42" cy="110" r="0.8" fill="#a09080" opacity="0.45"/>
  <circle cx="58" cy="118" r="1.1" fill="#a09080" opacity="0.4"/>
</svg>`,
  // --- Layer 2 portraits ---
  mourner: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <!-- robe drape -->
  <path d="M30 130 L24 70 Q50 60 76 70 L70 130 Z" fill="#1c1620" stroke="#080510" stroke-width="0.5"/>
  <!-- head veil -->
  <path d="M34 60 Q50 36 66 60 L66 88 L34 88 Z" fill="#2c2638"/>
  <!-- face shadow -->
  <ellipse cx="50" cy="70" rx="12" ry="14" fill="#0a0612"/>
  <!-- pale tear lines -->
  <path d="M46 76 L46 90" stroke="#5a5a82" stroke-width="0.8"/>
  <path d="M54 76 L54 88" stroke="#5a5a82" stroke-width="0.6"/>
  <!-- floating name-shards -->
  <text x="22" y="50" font-size="6" fill="#806a96" opacity="0.5">name</text>
  <text x="74" y="58" font-size="6" fill="#806a96" opacity="0.45">echo</text>
  <text x="18" y="92" font-size="5" fill="#806a96" opacity="0.4">forgotten</text>
</svg>`,
  drone: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <!-- floating geometric body -->
  <polygon points="50,50 64,68 50,92 36,68" fill="#1a1828" stroke="#0a0612" stroke-width="0.5"/>
  <!-- inner glyph -->
  <circle cx="50" cy="70" r="6" fill="#0a0612"/>
  <circle cx="50" cy="70" r="3" fill="#9a8ac8" opacity="0.7"/>
  <!-- side fins -->
  <polygon points="36,68 24,76 26,82 38,78" fill="#221c34"/>
  <polygon points="64,68 76,76 74,82 62,78" fill="#221c34"/>
  <!-- trailing tendrils -->
  <path d="M48 92 L46 116" stroke="#3a304a" stroke-width="1.2" fill="none"/>
  <path d="M52 92 L54 116" stroke="#3a304a" stroke-width="1.2" fill="none"/>
  <path d="M50 92 L50 122" stroke="#5a4a6a" stroke-width="1" fill="none" opacity="0.7"/>
</svg>`,
  echoknight: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <!-- broad armored shoulders -->
  <path d="M22 130 L18 64 Q50 50 82 64 L78 130 Z" fill="#2a2632" stroke="#0a0612" stroke-width="0.6"/>
  <!-- helm -->
  <ellipse cx="50" cy="60" rx="16" ry="16" fill="#181420"/>
  <!-- visor slit -->
  <rect x="38" y="58" width="24" height="2.5" fill="#3a3050"/>
  <rect x="42" y="58.5" width="4" height="1.5" fill="#9a8ac8"/>
  <rect x="54" y="58.5" width="4" height="1.5" fill="#9a8ac8"/>
  <!-- crest -->
  <path d="M44 46 L50 38 L56 46 Z" fill="#5a3838"/>
  <!-- gauntlet on great sword -->
  <rect x="78" y="80" width="3" height="40" fill="#7a7282"/>
  <rect x="76" y="78" width="7" height="3" fill="#3a2818"/>
  <!-- chestplate ridges -->
  <path d="M40 88 L40 120 M50 90 L50 124 M60 88 L60 120" stroke="#0a0612" stroke-width="0.6"/>
</svg>`,
  listener: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="lst-eye" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fff4d2"/>
      <stop offset="40%" stop-color="#d4a44a"/>
      <stop offset="100%" stop-color="#3a2010"/>
    </radialGradient>
  </defs>
  <!-- towering silhouette -->
  <path d="M14 130 L8 72 Q50 50 92 72 L86 130 Z" fill="#15101a" stroke="#020108" stroke-width="0.8"/>
  <!-- two great ear-fins -->
  <path d="M10 64 Q4 50 14 38 L24 60 Z" fill="#1a1422"/>
  <path d="M90 64 Q96 50 86 38 L76 60 Z" fill="#1a1422"/>
  <!-- many eyes that hear -->
  <ellipse cx="32" cy="70" rx="3" ry="5" fill="url(#lst-eye)"/>
  <ellipse cx="50" cy="64" rx="4" ry="6" fill="url(#lst-eye)"/>
  <ellipse cx="68" cy="70" rx="3" ry="5" fill="url(#lst-eye)"/>
  <ellipse cx="40" cy="82" rx="2" ry="3" fill="url(#lst-eye)"/>
  <ellipse cx="60" cy="82" rx="2" ry="3" fill="url(#lst-eye)"/>
  <!-- a single hanging chime -->
  <path d="M50 96 L50 108" stroke="#8a7252" stroke-width="0.8"/>
  <polygon points="46,108 54,108 52,116 48,116" fill="#d4b86a"/>
  <!-- whisper trails along the body -->
  <text x="20" y="100" font-size="5" fill="#5a4830" opacity="0.6">listen</text>
  <text x="62" y="116" font-size="5" fill="#5a4830" opacity="0.55">listen</text>
  <text x="22" y="118" font-size="5" fill="#5a4830" opacity="0.45">listen</text>
</svg>`,
  // ===== LAYER 3 BOSS — THE TWIN =====
  // Two mirrored halves that share a frame.  Cool silver/glass palette with
  // pale eyes; the inner seam splits the silhouette down the centerline.
  twin: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="twin-body" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#3a4858"/>
      <stop offset="60%" stop-color="#181c26"/>
      <stop offset="100%" stop-color="#06080c"/>
    </linearGradient>
    <radialGradient id="twin-eye" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#eaf2ff"/>
      <stop offset="55%" stop-color="#7a8fb0"/>
      <stop offset="100%" stop-color="#10141c"/>
    </radialGradient>
  </defs>
  <!-- mirror silhouette: two arches joined at the center -->
  <path d="M6 130 L4 60 Q22 40 50 50 Q78 40 96 60 L94 130 Z" fill="url(#twin-body)" stroke="#04060a" stroke-width="0.8"/>
  <!-- glass seam down the middle -->
  <line x1="50" y1="50" x2="50" y2="128" stroke="#c8d6ec" stroke-width="0.7" opacity="0.55"/>
  <line x1="50" y1="50" x2="50" y2="128" stroke="#eaf2ff" stroke-width="0.25" opacity="0.85"/>
  <!-- twin eyes, mirrored on either side of the seam -->
  <ellipse cx="32" cy="74" rx="5" ry="6" fill="url(#twin-eye)"/>
  <ellipse cx="68" cy="74" rx="5" ry="6" fill="url(#twin-eye)"/>
  <circle cx="32" cy="74" r="1.4" fill="#0a0c12"/>
  <circle cx="68" cy="74" r="1.4" fill="#0a0c12"/>
  <!-- two crowns of glass shards, one above each head -->
  <polygon points="22,38 26,30 30,40" fill="#c8d6ec" opacity="0.7"/>
  <polygon points="32,42 36,32 40,42" fill="#a0b4cc" opacity="0.6"/>
  <polygon points="60,42 64,32 68,42" fill="#a0b4cc" opacity="0.6"/>
  <polygon points="70,38 74,30 78,40" fill="#c8d6ec" opacity="0.7"/>
  <!-- mirror-cuts crossing the body, faint -->
  <line x1="20" y1="90"  x2="40" y2="98"  stroke="#c8d6ec" stroke-width="0.4" opacity="0.4"/>
  <line x1="80" y1="90"  x2="60" y2="98"  stroke="#c8d6ec" stroke-width="0.4" opacity="0.4"/>
  <line x1="24" y1="108" x2="44" y2="118" stroke="#c8d6ec" stroke-width="0.3" opacity="0.3"/>
  <line x1="76" y1="108" x2="56" y2="118" stroke="#c8d6ec" stroke-width="0.3" opacity="0.3"/>
</svg>`,
  // ===== LAYER 4 BOSS — THE DROWNED CHOIR =====
  // A weighty hooded silhouette filled with many silent mouths.  Deep blue
  // palette with cold cyan accents; water-line glints flow across the body.
  drownedchoir: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="dc-body" cx="50%" cy="40%" r="80%">
      <stop offset="0%" stop-color="#1a2a3e"/>
      <stop offset="60%" stop-color="#0a1422"/>
      <stop offset="100%" stop-color="#020610"/>
    </radialGradient>
    <radialGradient id="dc-mouth" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#7ed0e2"/>
      <stop offset="60%" stop-color="#1a4a6a"/>
      <stop offset="100%" stop-color="#04101a"/>
    </radialGradient>
  </defs>
  <!-- heavy hooded silhouette -->
  <path d="M10 130 L6 76 Q14 40 50 38 Q86 40 94 76 L90 130 Z" fill="url(#dc-body)" stroke="#020408" stroke-width="0.8"/>
  <!-- hood opening -->
  <path d="M28 78 Q50 68 72 78 Q70 90 50 92 Q30 90 28 78 Z" fill="#04080e"/>
  <!-- many singing mouths inside the hood -->
  <ellipse cx="38" cy="80" rx="2" ry="3" fill="url(#dc-mouth)"/>
  <ellipse cx="50" cy="78" rx="2.4" ry="3.6" fill="url(#dc-mouth)"/>
  <ellipse cx="62" cy="80" rx="2" ry="3" fill="url(#dc-mouth)"/>
  <ellipse cx="44" cy="86" rx="1.4" ry="2.2" fill="url(#dc-mouth)"/>
  <ellipse cx="56" cy="86" rx="1.4" ry="2.2" fill="url(#dc-mouth)"/>
  <!-- water-line glints across the robe -->
  <path d="M14 100 Q30 96 50 100 Q70 104 86 100" stroke="#3a6890" stroke-width="0.5" fill="none" opacity="0.6"/>
  <path d="M16 112 Q32 108 50 112 Q68 116 84 112" stroke="#3a6890" stroke-width="0.5" fill="none" opacity="0.5"/>
  <path d="M18 122 Q34 119 50 122 Q66 125 82 122" stroke="#3a6890" stroke-width="0.4" fill="none" opacity="0.4"/>
  <!-- droplets falling from the hem -->
  <ellipse cx="22" cy="128" rx="0.8" ry="1.2" fill="#7ed0e2" opacity="0.7"/>
  <ellipse cx="78" cy="128" rx="0.8" ry="1.2" fill="#7ed0e2" opacity="0.7"/>
  <ellipse cx="42" cy="128" rx="0.6" ry="1" fill="#7ed0e2" opacity="0.55"/>
  <ellipse cx="58" cy="128" rx="0.6" ry="1" fill="#7ed0e2" opacity="0.55"/>
</svg>`,
  // ===== LAYER 5 BOSS — THE SLOW BLOOM =====
  // Towering thorned silhouette wrapped in curling branches and embers.
  // Deep maroon palette with ash-grey vine accents and small ember motes.
  slowbloom: `
<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="sb-body" cx="50%" cy="60%" r="80%">
      <stop offset="0%" stop-color="#4a1a18"/>
      <stop offset="55%" stop-color="#1c0a08"/>
      <stop offset="100%" stop-color="#080202"/>
    </radialGradient>
    <radialGradient id="sb-ember" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffe0a4"/>
      <stop offset="55%" stop-color="#d46a32"/>
      <stop offset="100%" stop-color="#3a1408"/>
    </radialGradient>
  </defs>
  <!-- towering bramble silhouette -->
  <path d="M14 130 L8 70 Q24 44 50 42 Q76 44 92 70 L86 130 Z"
        fill="url(#sb-body)" stroke="#04020a" stroke-width="0.8"/>
  <!-- curling branches reaching up from the shoulders -->
  <path d="M22 64 Q14 50 18 36 Q22 44 26 50 Q22 56 22 64 Z" fill="#2a1410"/>
  <path d="M78 64 Q86 50 82 36 Q78 44 74 50 Q78 56 78 64 Z" fill="#2a1410"/>
  <!-- two more vines coiling overhead -->
  <path d="M40 44 Q44 28 50 24 Q56 28 60 44" fill="none" stroke="#2a1410" stroke-width="1.8" stroke-linecap="round"/>
  <!-- petal crown — uneven, burnt -->
  <path d="M38 48 L42 36 L44 48 Z" fill="#5a1410"/>
  <path d="M48 46 L50 32 L52 46 Z" fill="#6a1810"/>
  <path d="M56 48 L58 36 L62 48 Z" fill="#5a1410"/>
  <!-- single ember-eye centered, lidded -->
  <ellipse cx="50" cy="64" rx="6" ry="4" fill="url(#sb-ember)"/>
  <ellipse cx="50" cy="64" rx="2.4" ry="1.6" fill="#08020c"/>
  <ellipse cx="50" cy="63.5" rx="1" ry="0.6" fill="#fff2c8"/>
  <!-- thorned ribs running down the body -->
  <line x1="32" y1="84" x2="48" y2="92" stroke="#3a1410" stroke-width="0.8"/>
  <line x1="68" y1="84" x2="52" y2="92" stroke="#3a1410" stroke-width="0.8"/>
  <line x1="30" y1="100" x2="46" y2="106" stroke="#3a1410" stroke-width="0.6"/>
  <line x1="70" y1="100" x2="54" y2="106" stroke="#3a1410" stroke-width="0.6"/>
  <!-- ember motes drifting up around the figure -->
  <circle cx="22" cy="58" r="1.1" fill="#ffb86b" opacity="0.85"/>
  <circle cx="80" cy="62" r="0.9" fill="#ffb86b" opacity="0.75"/>
  <circle cx="32" cy="36" r="0.8" fill="#ffd092" opacity="0.65"/>
  <circle cx="70" cy="30" r="0.7" fill="#ffd092" opacity="0.6"/>
  <circle cx="50" cy="20" r="0.9" fill="#ffe0a4" opacity="0.8"/>
  <!-- ash drift along the hem -->
  <ellipse cx="20" cy="128" rx="2.5" ry="0.8" fill="#1a0e0a" opacity="0.7"/>
  <ellipse cx="80" cy="128" rx="2.5" ry="0.8" fill="#1a0e0a" opacity="0.7"/>
  <ellipse cx="50" cy="129" rx="3" ry="0.7" fill="#1a0e0a" opacity="0.55"/>
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
const ACTIONS_PER_CHAR = 3;   // each character can queue up to N distinct actions per turn (no duplicates)
const ACTION_ATB = {
  attack:  1,                 // basic
  special: 2,                 // signature — slower to wind up
  move:    1,                 // step ←/→
  brace:   1,                 // armor up
};
const TEAM_SPECIAL_ATB = ATB_MAX;
const SPECIAL_COST = 2;       // Resolve cost of an individual special
const TEAM_SPECIAL_COST = 3;  // Resolve cost of a team special
const BRACE_ARMOR = 2;

const RESOLVE_MAX = 3;
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
        sig:   { name: 'Sunder', desc: '3♦ · 14 dmg + strip armor + 2 vuln', cost: 3, dmg: 14,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (!t[0]) return; applyDmgToEnemy(s, t[0], 14); if (!t[0].dead) { t[0].armor = 0; t[0].vuln += 2; } } },
      },
      mid: {
        basic: { name: 'Vanguard', desc: '5 dmg front + advance', dmg: 5, move: 'advance',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 5); advance(s, 'cassia'); } },
        sig:   { name: 'Heroic Charge', desc: '9 dmg front + advance + 3 armor', dmg: 9, move: 'advance',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 9); advance(s, 'cassia'); addArmor(s, 'cassia', 3); } },
      },
      back: {
        basic: { name: 'Banner', desc: '+2 armor party · advance', move: 'advance',
          fn: (s) => { partyArmor(s, 2); advance(s, 'cassia'); } },
        sig:   { name: 'Rally',  desc: '1♦ · Heal 4 to party', cost: 1, fn: (s) => partyHeal(s, 4) },
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
        basic: { name: 'Phase Step', desc: '3 dmg + retreat to Mid', dmg: 3, move: 'retreat',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 3); retreat(s, 'elin'); } },
        sig:   { name: 'Veil Step', desc: '6 dmg + retreat + 2 armor', dmg: 6, move: 'retreat',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 6); retreat(s, 'elin'); addArmor(s, 'elin', 2); } },
      },
      mid: {
        basic: { name: 'Mend',         desc: 'Heal 6 lowest + cleanse', heal: 6, healTarget: 'lowest', fn: (s) => { healLowest(s, 6); cleanseLowest(s); } },
        sig:   { name: 'Greater Mend', desc: '3♦ · Heal 12 lowest + cleanse + 2 armor', cost: 3, heal: 12, healTarget: 'lowest', fn: (s) => { const c = healLowest(s, 12); cleanseLowest(s); if (c) c.armor += 2; } },
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
    maxHp: 20,
    home: 'back',
    passive: { name: 'Bleed Hunter', desc: '+2 dmg vs bleeding · heal 1 on bleeding kill (once/turn)' },
    techs: {
      front: {
        // close-range when shoved to Front: melee shots
        basic: { name: 'Backstep Shot', desc: '4 dmg + bleed 1 + retreat', dmg: 4, move: 'retreatFull',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 4); if (!t[0].dead) t[0].bleed = Math.max(t[0].bleed, 1); } retreatFull(s, 'branwen'); } },
        sig:   { name: 'Vanish Shot', desc: '7 dmg + bleed 2 + retreat + 1 vuln', dmg: 7, move: 'retreatFull',
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
        sig:   { name: 'Arrow Storm', desc: '3♦ · 7 dmg + bleed 2 all', cost: 3, dmg: 7,
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
        basic: { name: 'Reckless Strike', desc: '7 dmg + 2 self-dmg', dmg: 7,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 7); applySelfDmg(s, 'korin', 2); } },
        sig:   { name: 'Berserker Cleave', desc: '11 dmg + bleed 2 + 3 self-dmg', dmg: 11,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 11); if (!t[0].dead) t[0].bleed = Math.max(t[0].bleed, 2); } applySelfDmg(s, 'korin', 3); } },
      },
      mid: {
        basic: { name: 'Wild Swing', desc: '4 dmg all · advance', dmg: 4, move: 'advance',
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 4)); advance(s, 'korin'); } },
        sig:   { name: 'Bloodfury', desc: '6 dmg all + bleed 1 all · advance', dmg: 6, move: 'advance',
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 6)); t.forEach(e => { if (!e.dead) e.bleed = Math.max(e.bleed, 1); }); advance(s, 'korin'); } },
      },
      back: {
        basic: { name: 'Roar', desc: '+2 retaliate · advance', move: 'advance',
          fn: (s) => { const c = s.party.chars.korin; if (c && !c.downed) c.retaliate += 2; advance(s, 'korin'); } },
        sig:   { name: 'Battle Trance', desc: '3♦ · +4 retaliate, +3 armor · advance', cost: 3, move: 'advance',
          fn: (s) => { const c = s.party.chars.korin; if (c && !c.downed) { c.retaliate += 4; c.armor += 3; } advance(s, 'korin'); } },
      },
    },
  },
  ash: {
    id: 'ash',
    name: 'Ash',
    title: 'Veil-Touched Mage',
    school: 'arcane',
    maxHp: 19,
    home: 'mid',
    passive: { name: 'Arcane Focus', desc: 'First attack each turn deals +2' },
    techs: {
      front: {
        basic: { name: 'Spark', desc: '3 dmg + retreat', dmg: 3, move: 'retreat',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 3); retreat(s, 'ash'); } },
        sig:   { name: 'Inferno Burst', desc: '5 dmg + 2 vuln + retreat', dmg: 5, move: 'retreat',
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
        basic: { name: 'Arcane Bolts', desc: '4 dmg all', dmg: 4,
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => t.forEach(e => applyDmgToEnemy(s, e, 4)) },
        sig:   { name: 'Lightning Storm', desc: '3♦ · 5 dmg all + 1 vuln all', cost: 3, dmg: 5,
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
    maxHp: 21,
    home: 'back',
    passive: { name: 'Eviscerate', desc: '+3 dmg vs bleeding enemies' },
    techs: {
      front: {
        basic: { name: 'Backstab', desc: '6 dmg + bleed 1 + retreat', dmg: 6, move: 'retreat',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 6); if (!t[0].dead) t[0].bleed = Math.max(t[0].bleed, 1); } retreat(s, 'mira'); } },
        sig:   { name: 'Vanish Strike', desc: '9 dmg + bleed 2 + retreat full', dmg: 9, move: 'retreatFull',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 9); if (!t[0].dead) t[0].bleed = Math.max(t[0].bleed, 2); } retreatFull(s, 'mira'); } },
      },
      mid: {
        basic: { name: 'Shadow Knife', desc: '4 dmg lowest + bleed 1 · retreat', dmg: 4, move: 'retreat',
          reach: ['mid','back'], pattern: 'lowest',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 4); if (!t[0].dead) t[0].bleed = Math.max(t[0].bleed, 1); } retreat(s, 'mira'); } },
        sig:   { name: 'Twin Daggers', desc: '5 dmg lowest twice + bleed 2 · retreat', dmg: 5, hits: 2, move: 'retreat',
          reach: ['mid','back'], pattern: 'lowest',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 5); if (!t[0].dead) applyDmgToEnemy(s, t[0], 5); if (!t[0].dead) t[0].bleed = Math.max(t[0].bleed, 2); } retreat(s, 'mira'); } },
      },
      back: {
        basic: { name: 'Poison Cloud', desc: '3 dmg all + bleed 1 all', dmg: 3,
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 3)); t.forEach(e => { if (!e.dead) e.bleed = Math.max(e.bleed, 1); }); } },
        sig:   { name: 'Shadow Storm', desc: '3♦ · 4 dmg all + bleed 2 all', cost: 3, dmg: 4,
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 4)); t.forEach(e => { if (!e.dead) e.bleed = Math.max(e.bleed, 2); }); } },
      },
    },
  },
  // Kai — the solo starter.  Rogue swordsman, one-hand sword; jack-of-
  // all-trades kit so the player has a playable solo run regardless of
  // which slot they're in.
  kai: {
    id: 'kai',
    name: 'Kai',
    title: 'Awakened in the Abyss',
    school: 'physical',
    maxHp: 28,
    home: 'mid',
    passive: { name: 'Adept', desc: 'Heals 2 on kill.  Alone in the abyss: +2 dmg.' },
    techs: {
      front: {
        basic: { name: 'Slash', desc: '7 dmg front', dmg: 7,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 7); } },
        sig:   { name: 'Riposte', desc: '11 dmg front + 2 armor', dmg: 11,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 11); addArmor(s, 'kai', 2); } },
      },
      mid: {
        basic: { name: 'Quick Cut', desc: '5 dmg lowest + bleed 1 · advance', dmg: 5, move: 'advance',
          reach: ['front','mid'], pattern: 'lowest',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 5); if (!t[0].dead) t[0].bleed = Math.max(t[0].bleed, 1); } advance(s, 'kai'); } },
        sig:   { name: 'Crossblade', desc: '4 dmg twice (lowest)', dmg: 4, hits: 2,
          reach: ['front','mid'], pattern: 'lowest',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 4); if (!t[0].dead) applyDmgToEnemy(s, t[0], 4); } } },
      },
      back: {
        basic: { name: 'Whetstone', desc: '+1 atk next turn (self)',
          fn: (s) => { const c = s.party.chars.kai; if (c) c.pendingEffects.push({ kind: 'attackBonus', amt: 1, source: 'whetstone' }); } },
        sig:   { name: 'Patch Up',  desc: '1♦ · Heal 5 self', cost: 1,
          fn: (s) => { const c = s.party.chars.kai; if (c) { c.hp = Math.min(c.maxHp, c.hp + 5); } } },
      },
    },
  },
  // ============================ GARRON — Warden of the Gate ============
  // Front-line tank/protector built around taunt + armor.  Highest HP in
  // the roster, paired with the Sentinel passive that softens damage on
  // adjacent allies while he holds the front.  Counterweight to the
  // glass-cannon casters.
  garron: {
    id: 'garron',
    name: 'Garron',
    title: 'Warden of the Gate',
    school: 'physical',
    maxHp: 30,
    home: 'front',
    passive: { name: 'Sentinel', desc: 'While in Front, allies take -1 damage.' },
    techs: {
      front: {
        basic: { name: 'Halt', desc: '4 dmg + self-taunt this turn', dmg: 4,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 4); const g = s.party.chars.garron; if (g && !g.downed) g.taunt = true; } },
        sig:   { name: 'Bulwark', desc: 'Party +3⛨ + self-taunt',
          fn: (s) => { partyArmor(s, 3); const g = s.party.chars.garron; if (g && !g.downed) g.taunt = true; } },
      },
      mid: {
        basic: { name: 'Tower Slam', desc: '7 dmg front-most', dmg: 7,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 7); } },
        sig:   { name: 'Anchor', desc: '3♦ · 10 dmg front + 3 retaliate self', cost: 3, dmg: 10,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 10); const g = s.party.chars.garron; if (g && !g.downed) g.retaliate += 3; } },
      },
      back: {
        basic: { name: 'Whistle', desc: '+2 armor party', fn: (s) => partyArmor(s, 2) },
        sig:   { name: 'Last Words', desc: 'Heal 6 lowest + +2 armor party',
          fn: (s) => { healLowest(s, 6); partyArmor(s, 2); } },
      },
    },
  },
  // ============================ LIRIEN — Songbinder =====================
  // Back-line arcane debuffer.  Built around stacking vuln on enemies and
  // pushing small attack-bonus notes into the party.  Pairs with Mira/
  // Branwen bleed parties (every vuln stack turns bleed ticks into
  // pressure), with Ash (sig amplification on stacked targets), and with
  // any front-liner that wants its next hit to land harder.
  lirien: {
    id: 'lirien',
    name: 'Lirien',
    title: 'Songbinder',
    school: 'arcane',
    maxHp: 18,
    home: 'back',
    passive: { name: 'Lingering Note', desc: "Lirien's first attack each turn also applies vuln 1." },
    techs: {
      front: {
        basic: { name: 'Sharp Note', desc: '3 dmg front + retreat', dmg: 3, move: 'retreat',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 3); retreat(s, 'lirien'); } },
        sig:   { name: 'Discord', desc: '5 dmg front + 2 vuln + retreat', dmg: 5, move: 'retreat',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) { applyDmgToEnemy(s, t[0], 5); if (!t[0].dead) t[0].vuln += 2; } retreat(s, 'lirien'); } },
      },
      mid: {
        basic: { name: 'Beguile', desc: '3 dmg lowest + +1 atk to lowest-HP ally', dmg: 3,
          reach: ['mid','back'], pattern: 'lowest',
          fn: (s, t) => {
            if (t[0]) applyDmgToEnemy(s, t[0], 3);
            const ally = aliveParty(s).slice().sort((a, b) => a.hp - b.hp)[0];
            if (ally) ally.pendingEffects.push({ kind: 'attackBonus', amt: 1, source: 'lirien-beguile' });
          } },
        sig:   { name: 'Crescendo', desc: '3♦ · 4 dmg all + party +1 atk next attack', cost: 3, dmg: 4,
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => {
            t.forEach(e => applyDmgToEnemy(s, e, 4));
            aliveParty(s).forEach(c => c.pendingEffects.push({ kind: 'attackBonus', amt: 1, source: 'lirien-crescendo' }));
          } },
      },
      back: {
        basic: { name: 'Lullaby', desc: '2 dmg all + 1 vuln all', dmg: 2,
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 2)); aliveEnemies(s).forEach(e => { e.vuln += 1; }); } },
        sig:   { name: 'Aria', desc: '2♦ · Vuln 2 to all enemies',
          fn: (s) => aliveEnemies(s).forEach(e => { e.vuln += 2; }) },
      },
    },
  },
  // ============================ VASHA — Lightspeaker ====================
  // Holy back-line.  Bright AoE damage + healing via offence — every hit
  // Vasha lands also tops up the lowest-HP ally for 1.  Fills the holy
  // back gap (Elin sits mid).  Pairs with Cassia for Mercy Doubled
  // (her Litany pings count as heals through partyHeal/healLowest's
  // shared bump pipe), and with any bleed party that wants steady
  // ambient healing to offset bleed taken.
  vasha: {
    id: 'vasha',
    name: 'Vasha',
    title: 'Lightspeaker',
    school: 'holy',
    maxHp: 19,
    home: 'back',
    passive: { name: 'Litany', desc: 'When Vasha damages an enemy, the lowest-HP ally heals 1.' },
    techs: {
      front: {
        basic: { name: 'Pulpit', desc: '4 dmg front + retreat', dmg: 4, move: 'retreat',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 4); retreat(s, 'vasha'); } },
        sig:   { name: 'Hallowed Strike', desc: '6 dmg front + heal 2 self + retreat', dmg: 6, move: 'retreat',
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 6); const v = s.party.chars.vasha; if (v && !v.downed) v.hp = Math.min(v.maxHp, v.hp + 2); retreat(s, 'vasha'); } },
      },
      mid: {
        basic: { name: 'Recite', desc: '3 dmg lowest + cleanse one ally', dmg: 3,
          reach: ['mid','back'], pattern: 'lowest',
          fn: (s, t) => {
            if (t[0]) applyDmgToEnemy(s, t[0], 3);
            const ally = aliveParty(s).find(c => (c.bleed > 0 || c.weak > 0 || c.vuln > 0));
            if (ally) { ally.bleed = 0; ally.weak = 0; ally.vuln = 0; }
          } },
        sig:   { name: 'Hymn of Light', desc: '5 dmg + +1 Resolve party', dmg: 5,
          reach: ['mid','back'], pattern: 'lowest',
          fn: (s, t) => { if (t[0]) applyDmgToEnemy(s, t[0], 5); gainResolve(s, 1); } },
      },
      back: {
        basic: { name: 'Bright Word', desc: '3 dmg all', dmg: 3,
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => t.forEach(e => applyDmgToEnemy(s, e, 3)) },
        sig:   { name: "Sun's Decree", desc: '3♦ · 6 dmg all + 1 vuln all', cost: 3, dmg: 6,
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 6)); aliveEnemies(s).forEach(e => { e.vuln += 1; }); } },
      },
    },
  },
  // ============================ HASK — Frostling ========================
  // Arcane front-line — the first front-row caster.  Built around chain
  // (stagger meter).  His attacks add chain on top of the auto-build, his
  // Shatter passive turns every stagger into +1 Resolve while he's alive,
  // and his back-slot Frost-Lock is a cheap chain bomb for setting up
  // expensive bursts.  Pairs well with Mark of the Hunt and Hask sigs.
  hask: {
    id: 'hask',
    name: 'Hask',
    title: 'Frostling',
    school: 'arcane',
    maxHp: 22,
    home: 'front',
    passive: { name: 'Shatter', desc: 'When an enemy is staggered while Hask is alive, gain +1 Resolve.' },
    techs: {
      front: {
        basic: { name: 'Frost-Claw', desc: '5 dmg front + chain 5', dmg: 5,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => {
            if (t[0]) {
              applyDmgToEnemy(s, t[0], 5);
              if (!t[0].dead && !t[0].staggered) {
                t[0].chain = Math.min(STAGGER_THRESHOLD, t[0].chain + 5);
                if (t[0].chain >= STAGGER_THRESHOLD) triggerStagger(s, t[0]);
              }
            }
          } },
        sig:   { name: 'Glacier Crush', desc: '8 dmg front + chain 8', dmg: 8,
          reach: ['front'], pattern: 'front-most',
          fn: (s, t) => {
            if (t[0]) {
              applyDmgToEnemy(s, t[0], 8);
              if (!t[0].dead && !t[0].staggered) {
                t[0].chain = Math.min(STAGGER_THRESHOLD, t[0].chain + 8);
                if (t[0].chain >= STAGGER_THRESHOLD) triggerStagger(s, t[0]);
              }
            }
          } },
      },
      mid: {
        basic: { name: 'Ice Bolt', desc: '4 dmg lowest + chain 3', dmg: 4,
          reach: ['mid','back'], pattern: 'lowest',
          fn: (s, t) => {
            if (t[0]) {
              applyDmgToEnemy(s, t[0], 4);
              if (!t[0].dead && !t[0].staggered) {
                t[0].chain = Math.min(STAGGER_THRESHOLD, t[0].chain + 3);
                if (t[0].chain >= STAGGER_THRESHOLD) triggerStagger(s, t[0]);
              }
            }
          } },
        sig:   { name: 'Hailstorm', desc: '3♦ · 4 dmg all + chain 3 all', cost: 3, dmg: 4,
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => {
            t.forEach(e => {
              applyDmgToEnemy(s, e, 4);
              if (!e.dead && !e.staggered) {
                e.chain = Math.min(STAGGER_THRESHOLD, e.chain + 3);
                if (e.chain >= STAGGER_THRESHOLD) triggerStagger(s, e);
              }
            });
          } },
      },
      back: {
        basic: { name: 'Chill Mist', desc: '2 dmg all + vuln 1 all', dmg: 2,
          reach: ['front','mid','back'], pattern: 'all',
          fn: (s, t) => { t.forEach(e => applyDmgToEnemy(s, e, 2)); aliveEnemies(s).forEach(e => { e.vuln += 1; }); } },
        sig:   { name: 'Frost-Lock', desc: '1♦ · Chain 10 to lowest + 2 to all', cost: 1,
          reach: ['mid','back'], pattern: 'lowest',
          fn: (s, t) => {
            if (t[0] && !t[0].dead && !t[0].staggered) {
              t[0].chain = Math.min(STAGGER_THRESHOLD, t[0].chain + 10);
              if (t[0].chain >= STAGGER_THRESHOLD) triggerStagger(s, t[0]);
            }
            aliveEnemies(s).forEach(e => {
              if (e === t[0] || e.staggered) return;
              e.chain = Math.min(STAGGER_THRESHOLD, e.chain + 2);
              if (e.chain >= STAGGER_THRESHOLD) triggerStagger(s, e);
            });
          } },
      },
    },
  },
};

// ============================================================================
// ENEMIES — slot-targeted intents create the positioning puzzle
// ============================================================================

const ENEMIES = {
  ghoul: {
    id: 'ghoul', name: 'Ghoul', title: 'Sin of Hunger', maxHp: 18,
    weakness: 'holy', resistance: 'physical',
    intents: [
      { name: 'Bite',    tag: 'ATK 6',          targetSlot: 'front', kind: 'atk', dmg: 6, fn: (s) => dmgPartyAt(s, 'front', 6) },
      { name: 'Charge',  tag: 'ATK 4 + shove',  targetSlot: 'front', kind: 'atk', dmg: 4, fn: (s) => { dmgPartyAt(s, 'front', 4); enemyShove(s, 'front', 'back'); } },
      { name: 'Frenzy',  tag: 'ATK 3 + bleed',  targetSlot: 'front', kind: 'atk', dmg: 3, fn: (s) => { dmgPartyAt(s, 'front', 3); bleedPartyAt(s, 'front', 2); } },
    ],
  },
  cultist: {
    id: 'cultist', name: 'Cultist', title: 'Sin of Whispers', maxHp: 13,
    weakness: 'physical', resistance: 'arcane',
    intents: [
      { name: 'Curse',     tag: 'WEAK 2',         targetSlot: 'front', kind: 'debuff', fn: (s) => weakSlot(s, 'front', 2) },
      { name: 'Hex',       tag: 'ATK 2 + weak',   targetSlot: 'front', kind: 'atk',    dmg: 2, fn: (s) => { dmgPartyAt(s, 'front', 2); weakSlot(s, 'front', 1); } },
      { name: 'Doom Mark', tag: 'ATK 2 + vuln',   targetSlot: 'back',  kind: 'debuff', dmg: 2, fn: (s) => { dmgPartyAt(s, 'back', 2); applyVulnParty(s, 'back', 1); } },
    ],
  },
  wraith: {
    id: 'wraith', name: 'Wraith', title: 'Sin of Sorrow', maxHp: 12,
    weakness: 'arcane', resistance: 'physical',
    intents: [
      { name: 'Spectral Bolt', tag: 'ATK 5',     targetSlot: 'back', kind: 'atk', dmg: 5, fn: (s) => dmgPartyAt(s, 'back', 5) },
      { name: 'Wail',          tag: 'ATK 2 all', targetSlot: 'all',  kind: 'aoe', dmg: 2, fn: (s) => dmgAllParty(s, 2) },
      { name: 'Drain',         tag: 'ATK 3 low', targetSlot: '?',    kind: 'atk', dmg: 3, fn: (s) => dmgLowestParty(s, 3) },
    ],
  },
  lineCaster: {
    id: 'lineCaster', name: 'Line Caster', title: 'Sin of Voices', maxHp: 16,
    weakness: 'physical', resistance: 'arcane',
    intents: [
      { name: 'Verse of Faces',   tag: 'ATK 3 F+M', targetSlot: 'fm',  kind: 'aoe', dmg: 3, fn: (s) => dmgLinePair(s, 'fm', 3) },
      { name: 'Discord',          tag: 'ATK 4 + vuln', targetSlot: 'mid', kind: 'atk', dmg: 4, fn: (s) => { dmgPartyAt(s, 'mid', 4); applyVulnParty(s, 'mid', 1); } },
      { name: 'Verse of Shadows', tag: 'ATK 3 M+B', targetSlot: 'mb',  kind: 'aoe', dmg: 3, fn: (s) => dmgLinePair(s, 'mb', 3) },
    ],
  },
  sniper: {
    id: 'sniper', name: 'Sniper', title: 'Sin of Distance', maxHp: 14,
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
    id: 'grappler', name: 'Grappler', title: 'Sin of Grasp', maxHp: 20,
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
  // ---- Additional enemy types for run-to-run variety ----
  husk: {
    id: 'husk', name: 'Hollow Husk', title: 'Sin of Stillness', maxHp: 22,
    weakness: 'physical', resistance: 'arcane',
    intents: [
      { name: 'Resolute Stand', tag: '+3⛨ self',    targetSlot: '?',     kind: 'armor',  fn: (s) => { const me = Object.values(s.enemies.chars).find(en => en.id === 'husk' && !en.dead); if (me) me.armor += 3; } },
      { name: 'Crashing Fist',  tag: 'ATK 7',       targetSlot: 'front', kind: 'atk', dmg: 7, fn: (s) => dmgPartyAt(s, 'front', 7) },
      { name: 'Hollow Sigh',    tag: 'WEAK all',    targetSlot: 'all',   kind: 'debuff', fn: (s) => aliveParty(s).forEach(c => { c.weak += 1; }) },
    ],
  },
  pyremaw: {
    id: 'pyremaw', name: 'Pyre Maw', title: 'Sin of Cinders', maxHp: 16,
    weakness: 'stealth', resistance: 'holy',
    intents: [
      { name: 'Ember Bite',  tag: 'ATK 5 + bleed', targetSlot: 'mid',  kind: 'atk',    dmg: 5, fn: (s) => { dmgPartyAt(s, 'mid', 5); bleedPartyAt(s, 'mid', 2); } },
      { name: 'Cinder Wave', tag: 'ATK 2 all + bleed', targetSlot: 'all', kind: 'aoe', dmg: 2, fn: (s) => { dmgAllParty(s, 2); aliveParty(s).forEach(c => { c.bleed = Math.max(c.bleed, 1); }); } },
    ],
  },
  echocaster: {
    id: 'echocaster', name: 'Echo Caster', title: 'Sin of Recall', maxHp: 14,
    weakness: 'physical', resistance: 'stealth',
    intents: [
      { name: 'Repeat',       tag: 'ATK 3 + repeats', targetSlot: 'fm',  kind: 'debuff', dmg: 3, fn: (s) => { dmgPartyAt(s, 'front', 3); dmgPartyAt(s, 'mid', 3); } },
      { name: 'Mirror Shard', tag: 'ATK 4 + vuln',    targetSlot: 'back', kind: 'debuff', dmg: 4, fn: (s) => { dmgPartyAt(s, 'back', 4); applyVulnParty(s, 'back', 1); } },
      { name: 'Hush',         tag: 'WEAK lowest',     targetSlot: '?',   kind: 'debuff', fn: (s) => { const t = aliveParty(s).slice().sort((a,b) => a.hp - b.hp)[0]; if (t) t.weak += 2; } },
    ],
  },
  ashling: {
    id: 'ashling', name: 'Ashling', title: 'Sin of Drifting', maxHp: 10,
    weakness: 'holy', resistance: 'physical',
    intents: [
      { name: 'Cinder Skip',  tag: 'ATK 3 + bleed', targetSlot: 'front', kind: 'atk', dmg: 3, fn: (s) => { dmgPartyAt(s, 'front', 3); bleedPartyAt(s, 'front', 1); } },
      { name: 'Trail of Ash', tag: 'bleed 1 all',   targetSlot: 'all',   kind: 'debuff', fn: (s) => aliveParty(s).forEach(c => { c.bleed = Math.max(c.bleed, 1); }) },
    ],
  },
  wakeling: {
    id: 'wakeling', name: 'The Wakeling', title: 'Sin of the Dawn', maxHp: 60, boss: true,
    weakness: ['arcane', 'stealth'], resistance: 'physical',
    intents: [
      { name: 'Sundering Strike', tag: 'ATK 8',         targetSlot: 'front', kind: 'atk',    dmg: 8, fn: (s) => dmgPartyAt(s, 'front', 8) },
      { name: 'Cyclone',          tag: 'ATK 3 all',     targetSlot: 'all',   kind: 'aoe',    dmg: 3, fn: (s) => dmgAllParty(s, 3) },
      { name: 'Final Sin',        tag: 'ATK 5 + bleed', targetSlot: 'mid',   kind: 'atk',    dmg: 5, fn: (s) => { dmgPartyAt(s, 'mid', 5); bleedPartyAt(s, 'mid', 2); } },
      { name: 'Hollow Reach',     tag: 'ATK 4 + vuln',  targetSlot: 'back',  kind: 'debuff', dmg: 4, fn: (s) => { dmgPartyAt(s, 'back', 4); applyVulnParty(s, 'back', 2); } },
    ],
  },
  // ============================== LAYER 2 — THE VEIL OF NAMES ===============
  // Memory-themed sins.  Each leans into "naming" and "echoing" as mechanics.
  mourner: {
    id: 'mourner', name: 'Mourner', title: 'Sin of Naming', maxHp: 20,
    weakness: 'physical', resistance: 'arcane',
    intents: [
      { name: 'Whisper a Name',  tag: 'WEAK 2 all', targetSlot: 'all',   kind: 'debuff', fn: (s) => aliveParty(s).forEach(c => { c.weak += 2; }) },
      { name: 'Old Grief',       tag: 'ATK 4 + vuln', targetSlot: 'mid', kind: 'atk',    dmg: 4, fn: (s) => { dmgPartyAt(s, 'mid', 4); applyVulnParty(s, 'mid', 1); } },
      { name: 'The Mourning',    tag: 'ATK 3 all + bleed', targetSlot: 'all', kind: 'aoe', dmg: 3, fn: (s) => { dmgAllParty(s, 3); aliveParty(s).forEach(c => { c.bleed = Math.max(c.bleed, 1); }); } },
    ],
  },
  drone: {
    id: 'drone', name: 'Naming Drone', title: 'Sin of Repetition', maxHp: 14,
    weakness: 'stealth', resistance: 'holy',
    intents: [
      { name: 'Repeat',         tag: 'ATK 3 fm',    targetSlot: 'fm',   kind: 'debuff', dmg: 3, fn: (s) => { dmgPartyAt(s, 'front', 3); dmgPartyAt(s, 'mid', 3); } },
      { name: 'Echo Back',      tag: '+3⛨ self',    targetSlot: '?',    kind: 'armor',  fn: (s) => { const me = Object.values(s.enemies.chars).find(en => en.id === 'drone' && !en.dead); if (me) me.armor += 3; } },
      { name: 'Repetition',     tag: 'ATK 2 all twice', targetSlot: 'all', kind: 'aoe', dmg: 2, fn: (s) => { dmgAllParty(s, 2); dmgAllParty(s, 2); } },
    ],
  },
  echoknight: {
    id: 'echoknight', name: 'Echo Knight', title: 'Sin of Persistence', maxHp: 26,
    weakness: 'arcane', resistance: 'physical',
    intents: [
      { name: 'Heavy Cleave',   tag: 'ATK 7',       targetSlot: 'front', kind: 'atk', dmg: 7, fn: (s) => dmgPartyAt(s, 'front', 7) },
      { name: 'Return Stroke',  tag: 'ATK 5 + retal', targetSlot: 'front', kind: 'atk', dmg: 5, fn: (s) => { dmgPartyAt(s, 'front', 5); const me = Object.values(s.enemies.chars).find(en => en.id === 'echoknight' && !en.dead); if (me) me.retaliate = 2; } },
      { name: 'Remembered',     tag: 'heal 5 self', targetSlot: '?',     kind: 'armor', fn: (s) => { const me = Object.values(s.enemies.chars).find(en => en.id === 'echoknight' && !en.dead); if (me) { me.hp = Math.min(me.maxHp, me.hp + 5); spawnPopupId('echoknight', '+5', 'heal', 'enemy'); } } },
    ],
  },
  // Layer 2 boss — The Listener.  Knows every name; waits.  Marks a hero
  // each turn and detonates the mark.
  listener: {
    id: 'listener', name: 'The Listener', title: 'Sin of Hearing', maxHp: 80, boss: true,
    weakness: ['physical', 'stealth'], resistance: 'arcane',
    intents: [
      { name: 'I Know You',         tag: '+vuln front', targetSlot: 'front', kind: 'debuff', fn: (s) => applyVulnParty(s, 'front', 2) },
      { name: 'Name Said Aloud',    tag: 'ATK 9 lowest', targetSlot: '?',     kind: 'atk', dmg: 9, fn: (s) => dmgLowestParty(s, 9) },
      { name: 'Chamber Echo',       tag: 'ATK 4 all',   targetSlot: 'all',   kind: 'aoe', dmg: 4, fn: (s) => dmgAllParty(s, 4) },
      { name: 'Stillness',          tag: 'heal 8 self', targetSlot: '?',     kind: 'armor', fn: (s) => { const me = Object.values(s.enemies.chars).find(en => en.id === 'listener' && !en.dead); if (me) { me.hp = Math.min(me.maxHp, me.hp + 8); spawnPopupId('listener', '+8', 'heal', 'enemy'); me.armor += 2; } } },
      { name: 'Final Word',         tag: 'ATK 6 mid + weak', targetSlot: 'mid', kind: 'atk', dmg: 6, fn: (s) => { dmgPartyAt(s, 'mid', 6); const c = charBySlot(s, 'mid'); if (c) c.weak += 1; } },
    ],
  },
  // ============================== LAYER 3 — THE SPIRE OF GLASS ===============
  // Mirror / pride boss.  Reflects what the party brings: stacks retaliate on
  // itself, mirrors damage taken into armor, marks the wounded for a twin
  // strike.  Glass shards as flavor.
  twin: {
    id: 'twin', name: 'The Twin', title: 'Sin of Mirrors', maxHp: 92, boss: true,
    weakness: ['holy', 'physical'], resistance: 'arcane',
    intents: [
      { name: 'Mirror Cut',         tag: 'ATK 8 front + retal',   targetSlot: 'front', kind: 'atk',
        dmg: 8, fn: (s) => { dmgPartyAt(s, 'front', 8); const me = Object.values(s.enemies.chars).find(en => en.id === 'twin' && !en.dead); if (me) me.retaliate = (me.retaliate || 0) + 3; } },
      { name: "Pride's Reflection", tag: 'heal 6 + 3 armor self', targetSlot: '?',     kind: 'armor',
        fn: (s) => { const me = Object.values(s.enemies.chars).find(en => en.id === 'twin' && !en.dead); if (me) { me.hp = Math.min(me.maxHp, me.hp + 6); spawnPopupId('twin', '+6', 'heal', 'enemy'); me.armor = (me.armor || 0) + 3; } } },
      { name: 'Glass Shards',       tag: 'ATK 3 all + bleed 1 all', targetSlot: 'all', kind: 'aoe',
        dmg: 3, fn: (s) => { dmgAllParty(s, 3); aliveParty(s).forEach(c => { c.bleed = Math.max(c.bleed, 1); }); } },
      { name: "Twin's Mark",        tag: '+vuln 2 + weak 1 front',  targetSlot: 'front', kind: 'debuff',
        fn: (s) => { applyVulnParty(s, 'front', 2); const c = charBySlot(s, 'front'); if (c) c.weak += 1; } },
      { name: 'Shattering Stroke',  tag: 'ATK 7 mid + strip armor', targetSlot: 'mid',   kind: 'atk',
        dmg: 7, fn: (s) => { const c = charBySlot(s, 'mid'); if (c) c.armor = 0; dmgPartyAt(s, 'mid', 7); } },
    ],
  },
  // ============================== LAYER 4 — THE FLOODLIT HALL ================
  // Drowning / weight boss.  Sings vuln + weak across the party, then sings
  // again.  Big single-target verse on the lowest HP hero.  Self-heals by
  // burying its own pact (bleeds the choir into life).
  drownedchoir: {
    id: 'drownedchoir', name: 'The Drowned Choir', title: 'Sin of Hearing-Under', maxHp: 110, boss: true,
    weakness: ['arcane'], resistance: ['physical', 'holy'],
    intents: [
      { name: 'Hymn of Weight',     tag: 'ATK 5 all + vuln 1 all', targetSlot: 'all', kind: 'aoe',
        dmg: 5, fn: (s) => { dmgAllParty(s, 5); aliveParty(s).forEach(c => { c.vuln += 1; }); } },
      { name: 'Drowning Verse',     tag: 'ATK 9 lowest + weak 2',  targetSlot: '?',   kind: 'atk',
        dmg: 9, fn: (s) => { dmgLowestParty(s, 9); const a = aliveParty(s).slice().sort((x, y) => x.hp - y.hp)[0]; if (a) a.weak += 2; } },
      { name: 'Choir Crescendo',    tag: 'ATK 4 all twice',         targetSlot: 'all', kind: 'aoe',
        dmg: 4, fn: (s) => { dmgAllParty(s, 4); dmgAllParty(s, 4); } },
      { name: 'Buried Pact',        tag: 'heal 10 self + bleed all',targetSlot: '?',   kind: 'armor',
        fn: (s) => { const me = Object.values(s.enemies.chars).find(en => en.id === 'drownedchoir' && !en.dead); if (me) { me.hp = Math.min(me.maxHp, me.hp + 10); spawnPopupId('drownedchoir', '+10', 'heal', 'enemy'); } aliveParty(s).forEach(c => { c.bleed = Math.max(c.bleed, 2); }); } },
      { name: 'Final Verse',        tag: 'ATK 7 front + bleed 2',   targetSlot: 'front', kind: 'atk',
        dmg: 7, fn: (s) => { dmgPartyAt(s, 'front', 7); bleedPartyAt(s, 'front', 2); } },
    ],
  },
  // ============================== LAYER 5 — THE CINDER GARDEN ===============
  // Cycles / buried fires / roots that won't die.  The Slow Bloom self-heals,
  // applies bleed via burning roots, and grows armor as it unfurls.  Beat the
  // tempo of its regrowth or the fight just renews itself.
  slowbloom: {
    id: 'slowbloom', name: 'The Slow Bloom', title: 'Sin of Cycles', maxHp: 128, boss: true,
    weakness: ['holy', 'arcane'], resistance: ['physical'],
    intents: [
      { name: 'Burrowing Root',     tag: 'ATK 6 back + bleed 2',         targetSlot: 'back',  kind: 'atk',
        dmg: 6, fn: (s) => { dmgPartyAt(s, 'back', 6); bleedPartyAt(s, 'back', 2); } },
      { name: 'Spore Bloom',        tag: 'ATK 3 all + vuln 1 all',       targetSlot: 'all',   kind: 'aoe',
        dmg: 3, fn: (s) => { dmgAllParty(s, 3); aliveParty(s).forEach(c => { c.vuln += 1; }); } },
      { name: 'Slow Unfurling',     tag: 'heal 12 self + 3⛨ self',       targetSlot: '?',     kind: 'armor',
        fn: (s) => { const me = Object.values(s.enemies.chars).find(en => en.id === 'slowbloom' && !en.dead); if (me) { me.hp = Math.min(me.maxHp, me.hp + 12); spawnPopupId('slowbloom', '+12', 'heal', 'enemy'); me.armor += 3; } } },
      { name: 'Cycle of Ash',       tag: 'ATK 8 front + weak 1',         targetSlot: 'front', kind: 'atk',
        dmg: 8, fn: (s) => { dmgPartyAt(s, 'front', 8); const c = charBySlot(s, 'front'); if (c) c.weak += 1; } },
      { name: 'Final Bloom',        tag: 'ATK 5 all + heal 5 self',      targetSlot: 'all',   kind: 'aoe',
        dmg: 5, fn: (s) => { dmgAllParty(s, 5); const me = Object.values(s.enemies.chars).find(en => en.id === 'slowbloom' && !en.dead); if (me) { me.hp = Math.min(me.maxHp, me.hp + 5); spawnPopupId('slowbloom', '+5', 'heal', 'enemy'); } } },
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

// ============================================================================
// MAP — Slay-the-Spire-style branching graph, freshly generated per run.
// MAP_NODES is no longer a static constant; state.run.map carries the generated
// graph for the current run.  See generateMap() below for the procedural rules.
// ============================================================================

// Pools for procedural encounter generation — Layer 1 (Hollow Reach)
const COMBAT_ENEMY_POOL = ['ghoul', 'cultist', 'wraith', 'lineCaster', 'sniper', 'husk', 'pyremaw', 'echocaster', 'ashling'];
const ELITE_ENEMY_POOL  = ['grappler', 'sniper', 'lineCaster', 'wraith', 'cultist', 'husk', 'echocaster'];

// Layer-specific encounter content.  state.run.layer determines which set
// genCombatEncounter / genEliteEncounter / genBossEncounter draw from.
// Layer 2 also bumps every enemy's HP slightly so the climb feels harder.
const LAYER_CONTENT = {
  1: {
    combat: COMBAT_ENEMY_POOL,
    elite:  ELITE_ENEMY_POOL,
    boss:   'wakeling',
    bossName: 'The Wakeling',
    bossSubtitle: 'SIN OF THE DAWN',
    bossTag: 'It does not flinch.',
    hpBonus: 0, intentDmgBonus: 0,
  },
  2: {
    combat: ['mourner', 'drone', 'echoknight', 'cultist', 'wraith', 'lineCaster'],
    elite:  ['echoknight', 'mourner', 'grappler', 'lineCaster'],
    boss:   'listener',
    bossName: 'The Listener',
    bossSubtitle: 'SIN OF HEARING',
    bossTag: 'It knows every name.',
    hpBonus: 2, intentDmgBonus: 1,
  },
  3: {
    // Layer 3 — The Spire of Glass.  Mirror / pride enemies leaning on
    // retaliate + armor reflection.  Echoknight (returns strokes), drone
    // (repeats), wraith (slippery) carry the theme from layer 2; cultist +
    // mourner round out the combat pool.
    combat: ['echoknight', 'drone', 'wraith', 'cultist', 'mourner', 'lineCaster'],
    elite:  ['echoknight', 'grappler', 'mourner', 'lineCaster'],
    boss:   'twin',
    bossName: 'The Twin',
    bossSubtitle: 'SIN OF MIRRORS',
    bossTag: 'It learns what you bring.',
    hpBonus: 4, intentDmgBonus: 1,
  },
  4: {
    // Layer 4 — The Floodlit Hall.  Drowning / weight enemies.  Grappler
    // (holds you), lineCaster (long verse), mourner (sorrow), drone
    // (refrain) all carry the choir theme — the boss sings on top of them.
    combat: ['grappler', 'lineCaster', 'mourner', 'drone', 'cultist', 'wraith'],
    elite:  ['grappler', 'lineCaster', 'echoknight', 'mourner'],
    boss:   'drownedchoir',
    bossName: 'The Drowned Choir',
    bossSubtitle: 'SIN OF HEARING-UNDER',
    bossTag: 'It sings the weight onto you.',
    hpBonus: 6, intentDmgBonus: 2,
  },
  5: {
    // Layer 5 — The Cinder Garden.  Cycles / buried fires.  Roots, ash,
    // and slow blooms.  Echoknight (the returning stroke), grappler
    // (binding vines), mourner (ash names), drone (refrain of the
    // garden) reuse from earlier layers; cultist + wraith round it out.
    combat: ['echoknight', 'grappler', 'mourner', 'drone', 'cultist', 'wraith'],
    elite:  ['echoknight', 'grappler', 'mourner', 'lineCaster'],
    boss:   'slowbloom',
    bossName: 'The Slow Bloom',
    bossSubtitle: 'SIN OF CYCLES',
    bossTag: 'It buried itself.  It grew back.',
    hpBonus: 8, intentDmgBonus: 2,
  },
};
function getLayerContent(s) {
  const id = (s && s.run && s.run.layer) || 1;
  return LAYER_CONTENT[id] || LAYER_CONTENT[1];
}

// Flavor name pools — combat encounters draw a name from here at gen time so
// the map has variety even when the underlying enemy mix is similar.
const COMBAT_NAMES = [
  'Bone & Bile', "Veil's Edge", 'Line of Echoes', 'Bowless Hunt',
  'Sundered Bond', 'Quartered Sin', 'Hollow Vigil', 'Cracked Reliquary',
  "Whisper's End", 'Pale Procession', 'Brackish Hour', 'Mourner\'s Pass',
];
const ELITE_NAMES = [
  'Sins Triumphant', 'Court of Wraiths', 'Reaving Vow',
  'The Hooded Three', 'Hollow Ascendant',
];

function _pickRandom(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }
function _shuffle(arr)     { return arr.slice().sort(() => Math.random() - 0.5); }
function _consumeName(pool, used) {
  // Pick a name that isn't already used; if pool exhausted, allow repeats.
  const fresh = pool.filter(n => !used.has(n));
  const pick = fresh.length ? _pickRandom(fresh) : _pickRandom(pool);
  used.add(pick);
  return pick;
}

// Generate a combat encounter spec.  Always at least 1 enemy in Front.
// Level-1 encounters lean lighter so the solo opener is survivable; the
// player typically picks up companions by mid-run.
function genCombatEncounter(level, names) {
  const count = level <= 1 ? (Math.random() < 0.6 ? 1 : 2)
              : level === 2 ? (Math.random() < 0.5 ? 2 : 3)
              : (Math.random() < 0.45 ? 2 : 3);
  // Pull from the current layer's combat pool; falls back to Layer 1.
  const pool = (typeof state !== 'undefined' && state && state.run && LAYER_CONTENT[state.run.layer])
    ? LAYER_CONTENT[state.run.layer].combat
    : COMBAT_ENEMY_POOL;
  const enemies = _shuffle(pool).slice(0, count);
  const slotNames = _shuffle(['front', 'mid', 'back']);
  // Guarantee Front: rotate so 'front' is first slot in the shuffled order
  const frontIdx = slotNames.indexOf('front');
  if (frontIdx > 0) [slotNames[0], slotNames[frontIdx]] = [slotNames[frontIdx], slotNames[0]];
  const slots = {};
  enemies.forEach((eid, i) => { slots[slotNames[i]] = eid; });
  const enc = { name: _consumeName(COMBAT_NAMES, names), slots };
  // ~30% chance on multi-enemy combats: roll one of three objective kinds.
  // Ringleader (priority kill), Ticking Threat (kill the catalyst before
  // it detonates), or Hold the Line (survive N turns).  Single-enemy
  // fights stay vanilla.
  if (enemies.length >= 2 && Math.random() < 0.3) {
    const targetSlot = slotNames[Math.floor(Math.random() * enemies.length)];
    const roll = Math.random();
    if (roll < 0.45) {
      enc.objective = {
        kind: 'priority',
        targetSlot,
        label: 'Mark the Ringleader',
        hint: 'The marked enemy commands the others.  Cut them down and the rest will flee.',
      };
    } else if (roll < 0.78) {
      enc.objective = {
        kind: 'ticking',
        targetSlot,
        charge: 4,
        chargeMax: 4,
        dmg: 7,
        label: 'Stop the Catalyst',
        hint: 'The marked enemy is charging an unblockable.  Kill or stagger them before the count reaches zero.',
      };
    } else {
      enc.objective = {
        kind: 'survive',
        turns: 5,
        turnsMax: 5,
        label: 'Hold the Line',
        hint: 'Outlast them.  Survive the count and the sins will break off.',
      };
    }
  }
  return enc;
}

function genEliteEncounter(level, names) {
  const pool = (typeof state !== 'undefined' && state && state.run && LAYER_CONTENT[state.run.layer])
    ? LAYER_CONTENT[state.run.layer].elite
    : ELITE_ENEMY_POOL;
  const enemies = _shuffle(pool).slice(0, 3);
  const slots = { front: enemies[0], mid: enemies[1], back: enemies[2] };
  const sigilCategory = _pickRandom(['combat', 'defense', 'resource']);
  return {
    name: _consumeName(ELITE_NAMES, names),
    slots,
    elite: true,
    sigilCategory,
  };
}

function genBossEncounter() {
  const layer = (typeof state !== 'undefined' && state && state.run && LAYER_CONTENT[state.run.layer]) || LAYER_CONTENT[1];
  return { name: layer.bossName, slots: { front: layer.boss }, boss: true };
}

// ----- Non-combat map node content -----

// EVENTS — single-screen choice prompts that resolve without a fight.
// Each event has flavor + 2 choices.  Choice resolvers mutate state directly
// (heal/dmg/quirk/sigil grants).  Player picks one, then returns to the map.
const EVENTS = {
  // Path-stranger encounter — hands off to a recruit beat on accept.
  // _completeNonCombatNode reads run._pendingStrangerRecruit and routes
  // into showRecruitVignette('stranger', ...) before returning to map.
  // If the party is full, the strategic swap overlay opens instead.
  wanderer: {
    id: 'wanderer',
    name: 'A Stranger on the Path',
    flavor: 'Footsteps in the dust that are not yours.  Whoever they are, they stop when you stop.  They are waiting for you to choose first.',
    choices: [
      { label: 'Hear them out', tag: 'A new ally may walk with you',
        resolve: (s) => { s.run._pendingStrangerRecruit = true; } },
      { label: 'Keep walking',  tag: 'no change',
        resolve: () => { log('The footsteps fade behind you.'); } },
    ],
  },

  // ============================ HIDDEN / SECRET EVENTS ====================
  // Only enter the gen pool when their `when(state)` predicate matches.
  // They reward specific play patterns — particular layer, comp, build.
  mirror_shrine: {
    id: 'mirror_shrine',
    name: 'The Mirror Shrine',
    secret: true,
    when: (s) => s && s.run && s.run.layer === 3,
    flavor: 'A shard of glass stands upright on the path, taller than any of you.  Your reflection blinks first.',
    choices: [
      { label: 'Look long', tag: 'Heal party 6 · cleanse',
        resolve: (s) => { aliveParty(s).forEach(c => { c.hp = Math.min(c.maxHp, c.hp + 6); c.bleed = 0; c.weak = 0; }); log('The reflection forgives.'); } },
      { label: 'Break it',  tag: '+2 max HP party · 2 self-dmg each',
        resolve: (s) => { aliveParty(s).forEach(c => { c.maxHp += 2; c.hp = Math.max(1, c.hp - 2 + 2); }); log('Glass falls like rain.'); } },
    ],
  },
  buried_hymn: {
    id: 'buried_hymn',
    name: 'A Buried Hymn',
    secret: true,
    when: (s) => s && s.party && s.party.chars && s.party.chars.cassia && s.party.chars.elin,
    flavor: 'A note threads up out of the ground — old, slow, and tired of being buried.  Cassia tilts her head; Elin closes her eyes.',
    choices: [
      { label: 'Sing along',     tag: 'Heal party to full · +1 max HP each',
        resolve: (s) => { aliveParty(s).forEach(c => { c.maxHp += 1; c.hp = c.maxHp; }); log('The hymn finishes through you.'); } },
      { label: 'Walk past it',   tag: '+1 Resolve next fight',
        resolve: (s) => { s.run.bonusResolveNextFight = (s.run.bonusResolveNextFight || 0) + 1; log('The note follows for a while, then fades.'); } },
    ],
  },
  pact_eater: {
    id: 'pact_eater',
    name: 'The Pact-Eater',
    secret: true,
    when: (s) => {
      if (!s || !s.party || !s.party.chars) return false;
      const totalNeg = Object.values(s.party.chars)
        .reduce((n, c) => n + ((c.quirks && c.quirks.negative) ? c.quirks.negative.length : 0), 0);
      return totalNeg >= 2;
    },
    flavor: 'A figure in stitched leather offers a knife.  "Names you do not want.  I will eat them.  The cost is in the cut."',
    choices: [
      { label: 'Strike the bargain', tag: 'Clear all negative quirks · 3 self-dmg each',
        resolve: (s) => {
          aliveParty(s).forEach(c => { if (c.quirks) c.quirks.negative = []; c.hp = Math.max(1, c.hp - 3); });
          log('The Pact-Eater swallows every name.');
        } },
      { label: 'Refuse',             tag: 'no change',
        resolve: () => { log('You keep your wounds.  They are yours.'); } },
    ],
  },
  last_verse: {
    id: 'last_verse',
    name: 'The Last Verse',
    secret: true,
    when: (s) => s && s.run && s.run.layer >= 2 && (!s.run.sigils || s.run.sigils.length === 0),
    flavor: 'An old singer rests against a marker stone.  "I have a verse left.  No one to hear it but you."',
    choices: [
      { label: 'Listen',       tag: 'Bind a random rare sigil · −2 max HP each',
        resolve: (s) => {
          const rare = ['memory', 'wrath', 'doom', 'reaver'];
          const candidates = rare.filter(id => SIGILS[id] && !(s.run.sigils || []).includes(id));
          if (candidates.length) {
            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            (s.run.sigils = s.run.sigils || []).push(pick);
            log(`The verse becomes a sigil — <b>${SIGILS[pick].name}</b>.`);
          }
          aliveParty(s).forEach(c => { c.maxHp = Math.max(1, c.maxHp - 2); c.hp = Math.min(c.hp, c.maxHp); });
        } },
      { label: 'Walk on',      tag: 'no change',
        resolve: () => { log('The verse stays with the singer.'); } },
    ],
  },
  bone_altar: {
    id: 'bone_altar',
    name: 'Bone Altar',
    flavor: 'A bone altar coughs grey ash into the wind. It hungers.',
    choices: [
      { label: 'Bleed for a boon', tag: '−5 HP, gain a positive affinity',
        resolve: (s) => { _hurtRandomAlive(s, 5); _rollEventQuirk(s, 'positive'); } },
      { label: 'Walk on', tag: 'no change', resolve: () => {} },
    ],
  },
  hollow_reliquary: {
    id: 'hollow_reliquary',
    name: 'Hollow Reliquary',
    flavor: 'A reliquary stands open. Something inside is ready to be claimed.',
    choices: [
      { label: 'Take the offering', tag: 'gain a random sigil',
        resolve: (s) => _grantRandomSigil(s) },
      { label: 'Seal it shut', tag: 'no change', resolve: () => {} },
    ],
  },
  wraiths_whisper: {
    id: 'wraiths_whisper',
    name: "Wraith's Whisper",
    flavor: 'A wraith whispers — promises wrapped in ash.',
    choices: [
      { label: 'Listen', tag: '+positive AND +negative affinity',
        resolve: (s) => { _rollEventQuirk(s, 'positive'); _rollEventQuirk(s, 'negative'); } },
      { label: 'Refuse', tag: 'no change', resolve: () => {} },
    ],
  },
  veiled_well: {
    id: 'veiled_well',
    name: 'Veiled Well',
    flavor: 'A well of cold water under a veil of woven hair.',
    choices: [
      { label: 'Drink', tag: 'heal party 6',
        resolve: (s) => { aliveParty(s).forEach(c => { const b = c.hp; c.hp = Math.min(c.maxHp, c.hp + 6); }); } },
      { label: 'Walk on', tag: 'no change', resolve: () => {} },
    ],
  },
  // ---- Abyss event additions ----
  kneeling_stranger: {
    id: 'kneeling_stranger',
    name: 'A Kneeling Stranger',
    flavor: 'A stranger kneels with their head bowed.  They do not look up when you approach.  In their open palm: a small grey stone.',
    choices: [
      { label: 'Take the stone',  tag: '−3 HP each · gain a random sigil',
        resolve: (s) => { aliveParty(s).forEach(c => { c.hp = Math.max(1, c.hp - 3); }); _grantRandomSigil(s); } },
      { label: 'Press their hand', tag: 'Heal lowest to full · +1 Resolve next fight',
        resolve: (s) => { const id = _lowestHpAliveId(s); const c = id && s.party.chars[id]; if (c) c.hp = c.maxHp; s.run.bonusResolveNextFight = (s.run.bonusResolveNextFight || 0) + 1; } },
      { label: 'Walk past',       tag: 'no change', resolve: () => {} },
    ],
  },
  shrine_lost_names: {
    id: 'shrine_lost_names',
    name: 'Shrine of Lost Names',
    flavor: 'A small shrine carved into the wall, names eroded.  Wind has been arguing with this stone for a long time.',
    choices: [
      { label: 'Speak a name', tag: '+positive affinity · −2 HP each',
        resolve: (s) => { aliveParty(s).forEach(c => { c.hp = Math.max(1, c.hp - 2); }); _rollEventQuirk(s, 'positive'); } },
      { label: 'Carve another',tag: 'gain Coin of Memory (sigil)',
        resolve: (s) => { bindSigil(s, 'memory'); } },
      { label: 'Move on',      tag: 'no change', resolve: () => {} },
    ],
  },
  fallen_knight: {
    id: 'fallen_knight',
    name: 'A Knight, Already Fallen',
    flavor: 'Armor crumpled against a wall.  Eyes still open.  Their hand reaches toward you as if asking for forgiveness — but you cannot tell who it is meant for.',
    choices: [
      { label: 'Forgive them',     tag: 'heal party 4 · +2⛨ each',
        resolve: (s) => { aliveParty(s).forEach(c => { const b = c.hp; c.hp = Math.min(c.maxHp, c.hp + 4); if (c.hp > b) spawnPopupId(c.id, `+${c.hp - b}`, 'heal', 'party'); c.armor += 2; }); } },
      { label: 'Take the armor',   tag: 'Front gains Warhardened',
        resolve: (s) => { const fId = s.party.slots.front; if (fId) grantQuirk(s, fId, 'warhardened'); } },
      { label: 'Leave them be',    tag: 'no change', resolve: () => {} },
    ],
  },
  hanging_chime: {
    id: 'hanging_chime',
    name: 'A Hanging Chime',
    flavor: 'A bronze chime hangs without a wind to move it.  As you pass, it sounds anyway — once for each of you.',
    choices: [
      { label: 'Bow to the chime', tag: 'all heroes +3 max HP',
        resolve: (s) => { aliveParty(s).forEach(c => { c.maxHp += 3; c.hp += 3; }); log('Each hero stands a little straighter.'); } },
      { label: 'Silence it',       tag: 'gain Ember of Wrath (sigil) · −5 HP each',
        resolve: (s) => { aliveParty(s).forEach(c => { c.hp = Math.max(1, c.hp - 5); }); bindSigil(s, 'wrath'); } },
    ],
  },
  child_mask: {
    id: 'child_mask',
    name: "A Child's Mask",
    flavor: 'A wooden mask sits at the edge of a chasm.  Painted to look surprised.  Around its eyes, the wood is wet.',
    choices: [
      { label: 'Wear it briefly', tag: 'Random sigil · negative affinity',
        resolve: (s) => { _grantRandomSigil(s); _rollEventQuirk(s, 'negative'); } },
      { label: 'Bury it',         tag: 'party +1 Resolve next fight · cleanse',
        resolve: (s) => { aliveParty(s).forEach(c => { c.bleed = 0; c.weak = 0; }); s.run.bonusResolveNextFight = (s.run.bonusResolveNextFight || 0) + 1; } },
    ],
  },
  open_door: {
    id: 'open_door',
    name: 'An Open Door, Going Up',
    flavor: 'A door stands open in the cliff face.  Beyond it, a staircase that does not match the rest of the abyss.  Newer.  Or older.  Both, maybe.',
    choices: [
      { label: 'Climb a few steps', tag: 'gain a tech upgrade now',
        resolve: (s) => {
          const pool = availableUpgrades(s);
          if (!pool.length) return;
          const up = pool[Math.floor(Math.random() * pool.length)];
          const c = s.party.chars[up.charId];
          if (!c) return;
          c.upgrades = c.upgrades || {};
          c.upgrades[`${up.slot}.${up.kind}`] = up.id;
          log(`<b>${CHARS[up.charId].name}</b> learns <b>${up.name}</b>.`);
        } },
      { label: 'Close the door',    tag: 'heal party to full',
        resolve: (s) => { aliveParty(s).forEach(c => { c.hp = c.maxHp; }); } },
    ],
  },
};

function _hurtRandomAlive(s, amt) {
  const alive = Object.values(s.party.chars).filter(c => !c.downed);
  if (!alive.length) return;
  const c = alive[Math.floor(Math.random() * alive.length)];
  c.hp = Math.max(1, c.hp - amt);
  log(`<b>${CHARS[c.id].name}</b> sheds blood — ${amt} HP.`);
}
function _rollEventQuirk(s, polarity) {
  const ids = Object.values(s.party.chars).map(c => c.id);
  if (!ids.length) return;
  const targetId = ids[Math.floor(Math.random() * ids.length)];
  const c = s.party.chars[targetId];
  if (!c) return;
  const taken = new Set([...c.quirks.positive, ...c.quirks.negative]);
  const pool = Object.values(QUIRKS).filter(q =>
    (polarity === 'positive') === !!q.positive
    && !taken.has(q.id)
    && (!q.heroId || q.heroId === targetId));
  if (!pool.length) return;
  if (c.quirks[polarity].length >= QUIRK_CAP) return;
  const q = pool[Math.floor(Math.random() * pool.length)];
  grantQuirk(s, targetId, q.id);
  const verb = polarity === 'positive' ? 'gains' : 'is afflicted with';
  log(`<i><b>${CHARS[targetId].name}</b> ${verb} <b>${q.name}</b>.</i>`);
}
// Survivor variant — boss-defeat rewards skip downed heroes since only the
// surviving party carries to the next layer.  Falls back silently if no
// quirk fits (quirk cap reached, hero-locked pool empty).
function _rollSurvivorQuirk(s, polarity) {
  const survivors = aliveParty(s);
  if (!survivors.length) return;
  const eligible = survivors.filter(c => (c.quirks[polarity] || []).length < QUIRK_CAP);
  if (!eligible.length) return;
  const target = eligible[Math.floor(Math.random() * eligible.length)];
  const taken = new Set([...target.quirks.positive, ...target.quirks.negative]);
  const pool = Object.values(QUIRKS).filter(q =>
    (polarity === 'positive') === !!q.positive
    && !taken.has(q.id)
    && (!q.heroId || q.heroId === target.id));
  if (!pool.length) return;
  const q = pool[Math.floor(Math.random() * pool.length)];
  grantQuirk(s, target.id, q.id);
  const verb = polarity === 'positive' ? 'gains' : 'is afflicted with';
  log(`<i><b>${CHARS[target.id].name}</b> ${verb} <b>${q.name}</b>.</i>`);
}
function _grantRandomSigil(s) {
  const pool = availableSigils(s);
  if (!pool.length) return;
  const sg = pool[Math.floor(Math.random() * pool.length)];
  bindSigil(s, sg.id);
}

// Single entry point for binding a sigil to the run.  Pushes the id onto
// state.run.sigils if it isn't already owned, logs, and fires the fanfare.
// Every grant site should route through here so the player always sees the
// reveal, not just the message log.
function bindSigil(s, sigilId) {
  if (!s || !s.run) return null;
  const sg = SIGILS[sigilId];
  if (!sg) return null;
  s.run.sigils = s.run.sigils || [];
  if (s.run.sigils.includes(sigilId)) return sg;
  s.run.sigils.push(sigilId);
  log(`<i>You bind the <b>${sg.name}</b>.</i>`);
  showSigilAward(sigilId);
  return sg;
}

// ============================================================================
// VIGNETTES — light-novel beats triggered by what just happened in a fight.
// Each vignette declares conditions (bond/friction fired, biome, low HP, who
// is alive) and renders as a portrait + dialogue + 1-2 choices that mutate
// run state.  See showVignette() for rendering; offerVignetteOrPath() picks
// one (if any match) between the victory summary and the recruit/upgrade flow.
// ============================================================================
const VIGNETTES = {
  // Mira watches Elin's back — Sister's Watch is the FM bond between them.
  sister_watch: {
    id: 'sister_watch',
    when: { bondFired: "Sister's Watch", bondFiredCount: { name: "Sister's Watch", n: 3 }, requires: ['mira', 'elin'] },
    title: 'A glance, returning',
    speaker: 'mira',
    lines: [
      { who: 'mira', text: "You watched my back.  Three times now.  I lost count after the second." },
      { who: 'elin', text: "Someone has to look behind.  You only look ahead." },
      { who: 'mira', text: "Because the front is where the killing is." },
      { who: 'elin', text: "And behind is where the bleeding is." },
      // Reactive — Branwen, half-listening, can't help herself
      { who: 'branwen', text: "(She does watch your back.  I noticed.)",
        if: (s) => s.party.chars.branwen && !s.party.chars.branwen.downed },
      { who: null,   text: "They stand in the dust without quite meeting each other's eyes." },
    ],
    choices: [
      { label: 'Deepen the vow', tag: 'Elin gains Vow Unbroken',
        resolve: (s) => { grantQuirk(s, 'elin', 'vow_unbroken'); log(`<b>Elin</b> gains <i>Vow Unbroken</i>.`); } },
      { label: 'Say nothing',    tag: 'no change', resolve: () => {} },
    ],
  },
  // Cassia + Korin's Iron Bond — two front-liners after a hard fight.
  iron_bond: {
    id: 'iron_bond',
    when: { bondFired: 'Iron Bond', bondFiredCount: { name: 'Iron Bond', n: 3 }, requires: ['cassia', 'korin'] },
    title: 'Shoulders, side by side',
    speaker: 'cassia',
    lines: [
      { who: 'cassia', text: "You took the blow that was meant for me.  Again." },
      { who: 'korin',  text: "And you took the one before that, meant for me." },
      { who: 'cassia', text: "...we'll run out of blows to trade eventually." },
      { who: 'korin',  text: "Then we run out together.  That's the bond." },
      // Reactive — Mira, watching from the dark
      { who: 'mira',  text: "(I am not standing close to either of you.)",
        if: (s) => s.party.chars.mira && !s.party.chars.mira.downed },
      // Reactive — Elin, deadpan
      { who: 'elin',  text: "(I'll need bandages.  A lot of bandages.)",
        if: (s) => s.party.chars.elin && !s.party.chars.elin.downed },
      { who: null,    text: "Cassia laughs, soft and tired, and Korin's mouth does almost the same thing." },
    ],
    choices: [
      { label: 'Carry the banner', tag: 'Cassia gains Banner Bearer',
        resolve: (s) => { grantQuirk(s, 'cassia', 'banner_bearer'); log(`<b>Cassia</b> gains <i>Banner Bearer</i>.`); } },
      { label: 'Clean the blade',  tag: 'Heal both to full',
        resolve: (s) => { ['cassia','korin'].forEach(id => { const c = s.party.chars[id]; if (c && !c.downed) c.hp = c.maxHp; }); log('Cassia and Korin recover fully.'); } },
    ],
  },
  // Branwen + Cassia friction — Old Rivalry's residue.
  old_rivalry: {
    id: 'old_rivalry',
    when: { frictionFired: 'Old Rivalry', frictionFiredCount: { name: 'Old Rivalry', n: 2 }, requires: ['branwen', 'cassia'] },
    title: 'A line, redrawn',
    speaker: 'branwen',
    lines: [
      { who: 'branwen', text: "If you'd held your line, the cultist wouldn't have reached me." },
      { who: 'cassia',  text: "If you'd loosed faster, he wouldn't have." },
    ],
    choices: [
      { label: 'Speak it through', tag: 'Branwen gains Bleed Stalker',
        resolve: (s) => { grantQuirk(s, 'branwen', 'bleed_stalker'); log(`<b>Branwen</b> gains <i>Bleed Stalker</i>.`); } },
      { label: 'Walk it off',      tag: 'Cassia gains +3 max HP for the run',
        resolve: (s) => { const c = s.party.chars.cassia; if (c) { c.maxHp += 3; c.hp += 3; } log(`<b>Cassia</b> hardens — +3 max HP.`); } },
    ],
  },
  // Burning Sky biome — works regardless of party comp.
  burning_sky_reflection: {
    id: 'burning_sky_reflection',
    when: { whileBiome: 'burning' },
    title: 'The ash rises',
    speaker: null, // narration-only beat
    lines: [
      { who: null, text: 'The ash did not fall today. It rose.' },
      { who: null, text: 'Somewhere, a village burned a long time ago. The sky remembers.' },
    ],
    choices: [
      { label: 'Press on', tag: '+2 Resolve next fight',
        resolve: (s) => { s.run.bonusResolveNextFight = (s.run.bonusResolveNextFight || 0) + 2; log('You carry the unease forward.'); } },
      { label: 'Make a small offering', tag: 'Heal lowest hero to full',
        resolve: (s) => { const alive = Object.values(s.party.chars).filter(c => !c.downed); alive.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp); if (alive[0]) { alive[0].hp = alive[0].maxHp; log(`<b>${CHARS[alive[0].id].name}</b> is restored.`); } } },
    ],
  },
  // Bone Tide biome — bleed-themed, plays differently if Branwen or Mira is present.
  bone_tide_reflection: {
    id: 'bone_tide_reflection',
    when: { whileBiome: 'bonetide' },
    title: 'The tide does not recede',
    speaker: 'branwen', // prefers Branwen if present
    speakerFallback: 'mira',
    lines: [
      { who: 'branwen', altWho: 'mira', text: 'The blood reaches further every fight.' },
      { who: null, text: 'The land does not wash itself clean.' },
    ],
    choices: [
      { label: 'Sharpen the blade', tag: 'Bind Bloodborne Sigil',
        resolve: (s) => { bindSigil(s, 'bloodborne'); } },
      { label: 'Wash the wound',   tag: 'Heal all party 3',
        resolve: (s) => { aliveParty(s).forEach(c => { c.hp = Math.min(c.maxHp, c.hp + 3); }); log('The party staunches.'); } },
    ],
  },
  // Hero near death — triggers if any hero ended a fight at <= 4 HP.
  near_death: {
    id: 'near_death',
    when: { someoneAtOrBelow: 4 },
    title: 'A breath, drawn slow',
    speakerFromLowestHp: true,
    lines: [
      { who: '_lowest', text: 'I was closer than I should have been.' },
      { who: null,      text: 'You can almost hear them count the heartbeats they almost lost.' },
    ],
    choices: [
      { label: 'Bind the wound', tag: 'That hero gains +4 max HP for the run',
        resolve: (s) => { const id = _lowestHpAliveId(s); const c = id && s.party.chars[id]; if (c) { c.maxHp += 4; c.hp += 4; log(`<b>${CHARS[id].name}</b>'s frame hardens — +4 max HP.`); } } },
      { label: 'Walk it off',    tag: 'Hero gains Resilient',
        resolve: (s) => { const id = _lowestHpAliveId(s); if (id) { grantQuirk(s, id, 'precise'); grantQuirk(s, id, 'gentle'); log(`<b>${CHARS[id].name}</b> steadies.`); } } },
    ],
  },

  // ---- One-shot run-bracket beats ----

  run_start: {
    id: 'run_start',
    when: { runStart: true, whileLayer: 1 },
    oneShot: true,
    title: 'You wake at the bottom',
    speakerFromFirstAlive: true,
    lines: [
      { who: null,     text: 'The first thing you understand is that there is a ceiling.  Very high up.' },
      { who: null,     text: 'The second thing you understand is that you are alone.' },
      { who: '_first', text: '...up, then.  But not empty-handed.' },
    ],
    choices: [
      { label: 'Bind a sigil',         tag: 'Choose 1 of 3 run-wide powers',
        resolve: (s) => { s.run._openingBoon = 'sigil'; } },
      { label: 'Hone the edge twice',  tag: '2 tech upgrades for your starter',
        resolve: (s) => { s.run._openingBoon = 'upgrade'; } },
      { label: 'Listen for an ally',   tag: 'Rumor a future hero',
        resolve: (s) => { s.run._openingBoon = 'rumor'; } },
    ],
  },

  boss_prep: {
    id: 'boss_prep',
    when: { bossPrep: true },
    oneShot: true,
    title: 'The Wakeling waits',
    speakerFromLowestHp: true,
    lines: [
      { who: null,     text: 'The air closes over the reach like a hand.' },
      { who: '_first', text: 'It knows we came.' },
      { who: '_last',  text: 'Let it.' },
    ],
    choices: [
      { label: 'Brace as one', tag: 'Heal all party 6 + +2 armor each',
        resolve: (s) => { aliveParty(s).forEach(c => { c.hp = Math.min(c.maxHp, c.hp + 6); c.armor += 2; }); log('The party braces.'); } },
      { label: 'Sharpen one blade', tag: 'Lowest-HP hero gains Brutal (+2 dmg)',
        resolve: (s) => { const id = _lowestHpAliveId(s); if (id) { grantQuirk(s, id, 'brutal'); log(`<b>${CHARS[id].name}</b> gains <i>Brutal</i>.`); } } },
    ],
  },

  // ---- New trigger-type vignettes ----

  first_elite_clear: {
    id: 'first_elite_clear',
    when: { firstClearOf: 'elite' },
    oneShot: true,
    title: 'After the first true reach',
    speakerFromFirstAlive: true,
    lines: [
      { who: '_first', text: "They called that one a sin worth its own name." },
      { who: null,    text: "It dies the same as the rest." },
      { who: '_first', text: "Not the same.  Cleaner." },
    ],
    choices: [
      { label: 'Hoard the relic',      tag: 'Gain a random sigil',
        resolve: (s) => _grantRandomSigil(s) },
      { label: 'Share the marrow', tag: 'Heal every alive hero to full',
        resolve: (s) => { aliveParty(s).forEach(c => { c.hp = c.maxHp; }); log('The party is restored.'); } },
    ],
  },

  reaper_emerges: {
    id: 'reaper_emerges',
    when: { actorKilledAtLeast: { charId: 'mira',    n: 2 } },
    oneShot: true,
    title: 'Quiet in the work',
    speaker: 'mira',
    lines: [
      { who: 'mira', text: 'Two of them, and neither saw me.' },
      { who: null,   text: 'She wipes the blade on a sleeve that was never clean to begin with.' },
    ],
    choices: [
      { label: 'Sharpen the edge', tag: "Mira gains Razor's Edge",
        resolve: (s) => { grantQuirk(s, 'mira', 'razor_edge'); log(`<b>Mira</b> gains <i>Razor's Edge</i>.`); } },
      { label: 'Walk on', tag: 'no change', resolve: () => {} },
    ],
  },

  bow_warmed: {
    id: 'bow_warmed',
    when: { actorKilledAtLeast: { charId: 'branwen', n: 3 } },
    oneShot: true,
    title: 'Counting arrows',
    speaker: 'branwen',
    lines: [
      { who: 'branwen', text: 'Three.  I lost three arrows.  Got three back.' },
      { who: null,      text: 'There is satisfaction in the math.' },
    ],
    choices: [
      { label: 'Trust the bow', tag: 'Branwen gains Bleed Stalker',
        resolve: (s) => { grantQuirk(s, 'branwen', 'bleed_stalker'); log(`<b>Branwen</b> gains <i>Bleed Stalker</i>.`); } },
      { label: 'Mend the fletching', tag: 'Branwen heals to full',
        resolve: (s) => { const c = s.party.chars.branwen; if (c) { c.hp = c.maxHp; log('<b>Branwen</b> is restored.'); } } },
    ],
  },

  // ---- Additional bond/friction beats ----

  banner_fire: {
    id: 'banner_fire',
    when: { bondFired: 'Banner Fire', bondFiredCount: { name: 'Banner Fire', n: 3 }, requires: ['branwen', 'cassia'] },
    title: 'A banner, not a name',
    speaker: 'branwen',
    lines: [
      { who: 'branwen', text: 'You raised the banner.  I shot under it.' },
      { who: 'cassia',  text: 'A banner is just where the arrows know to go.' },
      { who: 'branwen', text: 'I noticed.' },
    ],
    choices: [
      { label: 'Raise it higher', tag: 'Cassia gains Banner Bearer',
        resolve: (s) => { grantQuirk(s, 'cassia', 'banner_bearer'); log(`<b>Cassia</b> gains <i>Banner Bearer</i>.`); } },
      { label: 'Loose another',   tag: 'Branwen gains Bleed Stalker',
        resolve: (s) => { grantQuirk(s, 'branwen', 'bleed_stalker'); log(`<b>Branwen</b> gains <i>Bleed Stalker</i>.`); } },
    ],
  },

  spirit_arrow: {
    id: 'spirit_arrow',
    when: { bondFired: 'Spirit Arrow', bondFiredCount: { name: 'Spirit Arrow', n: 3 }, requires: ['elin', 'branwen'] },
    title: 'Two prayers, one shaft',
    speaker: 'elin',
    lines: [
      { who: 'elin',    text: 'I named the arrow before you loosed it.' },
      { who: 'branwen', text: 'I felt that.  The fletching warmed.' },
      { who: 'elin',    text: 'Good.' },
    ],
    choices: [
      { label: 'Pray over the next quiver', tag: 'Branwen gains Precise (+1 dmg)',
        resolve: (s) => { grantQuirk(s, 'branwen', 'precise'); log(`<b>Branwen</b> gains <i>Precise</i>.`); } },
      { label: 'Pray over the wounded',     tag: 'Elin gains Vow Unbroken (+1 heal)',
        resolve: (s) => { grantQuirk(s, 'elin', 'vow_unbroken'); log(`<b>Elin</b> gains <i>Vow Unbroken</i>.`); } },
    ],
  },

  veiled_flame: {
    id: 'veiled_flame',
    when: { bondFired: 'Veiled Flame', bondFiredCount: { name: 'Veiled Flame', n: 3 }, requires: ['ash', 'elin'] },
    title: 'Flame, behind the veil',
    speaker: 'ash',
    lines: [
      { who: 'ash',  text: 'Every time I strike, you breathe.' },
      { who: 'elin', text: 'Every time I breathe, you strike harder.' },
    ],
    choices: [
      { label: 'Walk under the veil', tag: 'Ash gains Veil Walker',
        resolve: (s) => { grantQuirk(s, 'ash', 'veil_walker'); log(`<b>Ash</b> gains <i>Veil Walker</i>.`); } },
      { label: 'Mend in the dark',    tag: 'Heal Ash + Elin to full',
        resolve: (s) => { ['ash','elin'].forEach(id => { const c = s.party.chars[id]; if (c) c.hp = c.maxHp; }); log('Ash and Elin recover.'); } },
    ],
  },

  twin_blades: {
    id: 'twin_blades',
    when: { bondFired: 'Twin Blades', bondFiredCount: { name: 'Twin Blades', n: 3 }, requires: ['branwen', 'mira'] },
    title: 'Two blades, one bleed',
    speaker: 'mira',
    lines: [
      { who: 'mira',    text: 'They bleed before they fall.' },
      { who: 'branwen', text: 'They fall because they bleed.' },
      { who: 'mira',    text: 'Same thing.' },
      { who: 'branwen', text: 'Not the same thing.' },
    ],
    choices: [
      { label: 'Keep the edge', tag: "Mira gains Razor's Edge",
        resolve: (s) => { grantQuirk(s, 'mira', 'razor_edge'); log(`<b>Mira</b> gains <i>Razor's Edge</i>.`); } },
      { label: 'Keep the eye',  tag: 'Branwen gains Bleed Stalker',
        resolve: (s) => { grantQuirk(s, 'branwen', 'bleed_stalker'); log(`<b>Branwen</b> gains <i>Bleed Stalker</i>.`); } },
    ],
  },

  // Withered biome reflection — narration-only beat unique to that biome.
  withered_reflection: {
    id: 'withered_reflection',
    when: { whileBiome: 'withered' },
    title: 'The land does not return what it takes',
    lines: [
      { who: null, text: 'The dressings come away dry.' },
      { who: null, text: "Even mercy here is rationed." },
    ],
    choices: [
      { label: 'Hoard a memory', tag: 'Gain Coin of Memory (sigil)',
        resolve: (s) => { bindSigil(s, 'memory'); } },
      { label: 'Endure', tag: 'no change', resolve: () => {} },
    ],
  },

  // ---- Additional bond beats for previously-uncovered pairs ----

  veiled_vow: {
    id: 'veiled_vow',
    when: { bondFired: 'Veiled Vow', bondFiredCount: { name: 'Veiled Vow', n: 3 }, requires: ['mira', 'cassia'] },
    title: 'A vow, drawn in shadow',
    speaker: 'mira',
    lines: [
      { who: 'mira',   text: 'You stood while I cut.  Twice.' },
      { who: 'cassia', text: 'Standing is what I have.' },
      { who: 'mira',   text: 'Standing is more than most have.' },
    ],
    choices: [
      { label: 'Veil the blade', tag: "Mira gains Razor's Edge",
        resolve: (s) => { grantQuirk(s, 'mira', 'razor_edge'); log(`<b>Mira</b> gains <i>Razor's Edge</i>.`); } },
      { label: 'Steady the line', tag: 'Cassia gains Banner Bearer',
        resolve: (s) => { grantQuirk(s, 'cassia', 'banner_bearer'); log(`<b>Cassia</b> gains <i>Banner Bearer</i>.`); } },
    ],
  },

  bloodguard: {
    id: 'bloodguard',
    when: { bondFired: 'Bloodguard', bondFiredCount: { name: 'Bloodguard', n: 3 }, requires: ['cassia', 'korin'] },
    title: 'A wall, not a hero',
    speaker: 'korin',
    lines: [
      { who: 'korin',  text: "You bled twice for me back there." },
      { who: 'cassia', text: "Only twice." },
      { who: 'korin',  text: "I owe you a third." },
    ],
    choices: [
      { label: 'Carry the wall', tag: 'Korin gains Warhardened',
        resolve: (s) => { grantQuirk(s, 'korin', 'warhardened'); log(`<b>Korin</b> gains <i>Warhardened</i>.`); } },
      { label: 'Keep the banner', tag: 'Cassia gains Banner Bearer',
        resolve: (s) => { grantQuirk(s, 'cassia', 'banner_bearer'); log(`<b>Cassia</b> gains <i>Banner Bearer</i>.`); } },
    ],
  },

  wild_hunt: {
    id: 'wild_hunt',
    when: { bondFired: 'Wild Hunt', bondFiredCount: { name: 'Wild Hunt', n: 3 }, requires: ['branwen', 'korin'] },
    title: 'Hounds, both of you',
    speaker: 'korin',
    lines: [
      { who: 'korin',   text: 'You loose, I close.  We took two of them between heartbeats.' },
      { who: 'branwen', text: "It's good hunting." },
      { who: 'korin',   text: "It's good hunting." },
    ],
    choices: [
      { label: 'Run them together', tag: 'Korin gains Warhardened',
        resolve: (s) => { grantQuirk(s, 'korin', 'warhardened'); log(`<b>Korin</b> gains <i>Warhardened</i>.`); } },
      { label: 'Trust the arrow',   tag: 'Branwen gains Bleed Stalker',
        resolve: (s) => { grantQuirk(s, 'branwen', 'bleed_stalker'); log(`<b>Branwen</b> gains <i>Bleed Stalker</i>.`); } },
    ],
  },

  sisters_of_shadow: {
    id: 'sisters_of_shadow',
    when: { bondFired: 'Sisters of Shadow', bondFiredCount: { name: 'Sisters of Shadow', n: 3 }, requires: ['branwen', 'mira'] },
    title: 'Sisters, not in name',
    speaker: 'branwen',
    lines: [
      { who: 'branwen', text: 'I marked one bleeding.  You found the rest of them bleeding too.' },
      { who: 'mira',    text: 'Wounds rhyme.' },
      { who: 'branwen', text: '...what?' },
      { who: 'mira',    text: 'Nothing.  Hold the line.' },
    ],
    choices: [
      { label: 'Mark the next quiver', tag: 'Branwen gains Bleed Stalker',
        resolve: (s) => { grantQuirk(s, 'branwen', 'bleed_stalker'); log(`<b>Branwen</b> gains <i>Bleed Stalker</i>.`); } },
      { label: 'Whet the blade', tag: "Mira gains Razor's Edge",
        resolve: (s) => { grantQuirk(s, 'mira', 'razor_edge'); log(`<b>Mira</b> gains <i>Razor's Edge</i>.`); } },
    ],
  },

  sanctuary_fire: {
    id: 'sanctuary_fire',
    when: { bondFired: 'Sanctuary Fire', bondFiredCount: { name: 'Sanctuary Fire', n: 3 }, requires: ['ash', 'elin'] },
    title: 'A flame that asks for nothing',
    speaker: 'elin',
    lines: [
      { who: 'elin', text: 'When I mended them, you struck cleaner.  I noticed.' },
      { who: 'ash',  text: 'I noticed you noticing.' },
      { who: 'elin', text: '...this is awkward.' },
      { who: 'ash',  text: 'Good awkward.' },
    ],
    choices: [
      { label: 'Keep the flame', tag: 'Ash gains Veil Walker',
        resolve: (s) => { grantQuirk(s, 'ash', 'veil_walker'); log(`<b>Ash</b> gains <i>Veil Walker</i>.`); } },
      { label: 'Keep the vow',   tag: 'Elin gains Vow Unbroken',
        resolve: (s) => { grantQuirk(s, 'elin', 'vow_unbroken'); log(`<b>Elin</b> gains <i>Vow Unbroken</i>.`); } },
    ],
  },

  // ---- Tone / humor scenes ----

  humor_after_near_death: {
    id: 'humor_after_near_death',
    when: { someoneAtOrBelow: 3, requires: ['korin'] },
    title: 'A bad joke, well-timed',
    speaker: 'korin',
    lines: [
      { who: '_lowest', text: 'I should not have laughed at the last one.' },
      { who: 'korin',   text: 'You should have laughed harder.  Dying things hate that.' },
      { who: null,      text: 'A small cracked smile finds its way around the table.' },
    ],
    choices: [
      { label: "Laugh now, while we can", tag: '+1 Resolve next fight ',
        resolve: (s) => { s.run.bonusResolveNextFight = (s.run.bonusResolveNextFight || 0) + 1; log('The party steadies.'); } },
      { label: 'Roll your eyes', tag: 'Heal lowest to full',
        resolve: (s) => { const id = _lowestHpAliveId(s); const c = id && s.party.chars[id]; if (c) { c.hp = c.maxHp; log(`<b>${CHARS[id].name}</b> is restored.`); } } },
    ],
  },

  veiled_hour_narration: {
    id: 'veiled_hour_narration',
    when: { whileBiome: 'veiled' },
    title: 'The veil thins',
    lines: [
      { who: null, text: 'A grey wind crosses the reach, and every shadow leans the wrong way.' },
      { who: null, text: 'Whatever you fight here was already half-undone before you arrived.' },
    ],
    choices: [
      { label: 'Step softly', tag: '+2 Resolve next fight',
        resolve: (s) => { s.run.bonusResolveNextFight = (s.run.bonusResolveNextFight || 0) + 2; log('You move with the veil.'); } },
      { label: 'Drop the veil', tag: 'Gain Ember of Wrath (sigil)',
        resolve: (s) => { bindSigil(s, 'wrath'); } },
    ],
  },

  fortified_bones_reflection: {
    id: 'fortified_bones_reflection',
    when: { whileBiome: 'fortified' },
    title: 'Bones, kept dressed',
    lines: [
      { who: null, text: 'Their armor is older than the names they were buried under.' },
      { who: null, text: 'Nothing comes off clean here.  But everything comes off eventually.' },
    ],
    choices: [
      { label: 'Sharpen the wedge', tag: 'Gain Sigil of the Reaver',
        resolve: (s) => { bindSigil(s, 'reaver'); } },
      { label: 'Settle in', tag: 'Heal party 4',
        resolve: (s) => { aliveParty(s).forEach(c => { c.hp = Math.min(c.maxHp, c.hp + 4); }); log('You catch your breath.'); } },
    ],
  },

  hunger_reflection: {
    id: 'hunger_reflection',
    when: { whileBiome: 'hunger' },
    title: 'Something eats from the air',
    speakerFromFirstAlive: true,
    lines: [
      { who: null,    text: 'The front of the line tastes wrong on every hit — like the reach is hungry.' },
      { who: '_first', text: "We keep the front rested.  We rotate." },
      { who: null,    text: "It is not a strategy.  It is a survival." },
    ],
    choices: [
      { label: 'Feed the back', tag: 'Heal back-row hero to full',
        resolve: (s) => { const id = s.party.slots.back; const c = id && s.party.chars[id]; if (c && !c.downed) { c.hp = c.maxHp; log(`<b>${CHARS[id].name}</b> is restored.`); } } },
      { label: 'Brace the front', tag: 'Front-row hero gains +3 armor',
        resolve: (s) => { const id = s.party.slots.front; const c = id && s.party.chars[id]; if (c && !c.downed) { c.armor += 3; log(`<b>${CHARS[id].name}</b> +3 armor.`); } } },
    ],
  },

  // ---- Run-bracket beats ----

  run_defeat: {
    id: 'run_defeat',
    when: { runDefeat: true },
    oneShot: true,
    title: 'The reach takes you back',
    speakerFromFirstAlive: true,
    lines: [
      { who: null, text: 'The wind moves over the line of you, and the reach does not flinch.' },
      { who: null, text: "Someone, somewhere, hears the story you didn't finish telling." },
      { who: '_first', text: '...we try again.' },
    ],
    choices: [
      // Both choices simply close into the run-summary screen — the scene is
      // about catharsis, not bonuses.
      { label: 'We try again', resolve: () => {} },
      { label: 'Walk into the next reach in silence', resolve: () => {} },
    ],
  },

  wakeling_slain: {
    id: 'wakeling_slain',
    when: { bossDefeated: true },
    oneShot: true,
    title: 'The Wakeling falls',
    speakerFromFirstAlive: true,
    lines: [
      // Opening — the silence after.
      { who: null, text: 'It does not scream.' },
      { who: null, text: 'When the great body unmakes itself, the reach drinks the noise and does not give it back.' },
      // First → last exchange.  Neutral enough that any pairing of survivors
      // can carry it; on solo runs only the first beat lands (the closer is
      // gated to 2+ alive).
      { who: '_first', text: 'It is done.' },
      { who: '_last',  text: 'Until the next one wakes.',
        if: (s) => aliveParty(s).length > 1 },
      // Closing — the dawn doesn't quite settle.
      { who: null, text: 'The dawn rises in pieces — too bright in some places, missing in others, like a half-remembered song.' },
    ],
    // Hero-pair variants — when both heroes survive, override the base lines
    // with a scripted exchange written for them specifically.  Falls back to
    // the base when no variant matches.  Order matters: showVignette picks
    // the first matching entry, so most-specific (3-hero) goes first.
    variants: [
      // Full starter trio — the iconic Cassia/Elin/Branwen team.
      {
        requires: ['cassia', 'elin', 'branwen'],
        lines: [
          { who: null,      text: 'It does not scream.' },
          { who: 'cassia',  text: 'It is done.' },
          { who: 'elin',    text: 'Until the next one wakes.' },
          { who: 'branwen', text: 'Then we walk faster.' },
          { who: 'cassia',  text: 'We walk together.' },
          { who: 'branwen', text: '...fine.  Together.' },
          { who: null,      text: 'The dawn rises in pieces — too bright in some places, missing in others.' },
        ],
      },
      // Cassia + Elin — Sister's Watch.  The grim joke they keep trading.
      {
        requires: ['cassia', 'elin'],
        lines: [
          { who: null,     text: 'It does not scream.' },
          { who: 'cassia', text: 'It is done.' },
          { who: 'elin',   text: 'Until the next one wakes.' },
          { who: 'cassia', text: 'You said that on the last reach, too.' },
          { who: 'elin',   text: 'I will keep saying it.' },
          { who: null,     text: 'The dawn rises in pieces — too bright in some places, missing in others.' },
        ],
      },
      // Kai + Branwen — the solo starter meets the lone archer.  Both used
      // to fights they didn't plan to walk out of.
      {
        requires: ['kai', 'branwen'],
        lines: [
          { who: null,      text: 'It does not scream.' },
          { who: 'kai',     text: 'I owe you the throat shot.' },
          { who: 'branwen', text: 'I owe you the second one.' },
          { who: 'kai',     text: '...we should walk faster.  Before the dawn argues.' },
          { who: 'branwen', text: 'Already walking.' },
          { who: null,      text: 'The dawn rises in pieces — too bright in some places, missing in others.' },
        ],
      },
    ],
    choices: [
      // Three reflections — each takes something from the moment up the climb.
      // 'Walk home' was the wrong frame; the run is an ascent, not a retreat.
      { label: 'Take its silence', tag: "Bind a sigil from the Wakeling's residue",
        resolve: (s) => { _grantRandomSigil(s); } },
      { label: 'Take its name',    tag: 'A survivor gains a positive affinity',
        resolve: (s) => { _rollSurvivorQuirk(s, 'positive'); } },
      { label: 'Take a breath',    tag: 'Survivors gain +5 max HP',
        resolve: (s) => {
          aliveParty(s).forEach(c => {
            c.maxHp += 5;
            c.hp = Math.min(c.maxHp, c.hp + 5);
          });
          log('The dawn settles.  Each survivor draws a deeper breath — +5 max HP.');
        } },
    ],
  },

  // ---- Friction beats (new pairs) ----

  hollow_vow: {
    id: 'hollow_vow',
    when: { frictionFired: 'Hollow Vow', frictionFiredCount: { name: 'Hollow Vow', n: 2 }, requires: ['cassia', 'mira'] },
    title: 'Two ways to keep a vow',
    speaker: 'cassia',
    lines: [
      { who: 'cassia', text: 'I do not enjoy killing in the dark.' },
      { who: 'mira',   text: 'I do not enjoy killing in the light.' },
      { who: 'cassia', text: '...then we have a problem.' },
      { who: 'mira',   text: 'Yes.  Theirs.' },
    ],
    choices: [
      { label: 'Bear the vow', tag: 'Cassia gains Banner Bearer',
        resolve: (s) => { grantQuirk(s, 'cassia', 'banner_bearer'); log(`<b>Cassia</b> gains <i>Banner Bearer</i>.`); } },
      { label: 'Swallow the disagreement', tag: 'no change', resolve: () => {} },
    ],
  },

  crossed_oaths: {
    id: 'crossed_oaths',
    when: { frictionFired: 'Crossed Oaths', frictionFiredCount: { name: 'Crossed Oaths', n: 2 }, requires: ['korin', 'mira'] },
    title: 'A paladin and a thief',
    speaker: 'korin',
    lines: [
      { who: 'korin', text: 'You bowed before you stabbed.  That was not a courtesy.' },
      { who: 'mira',  text: 'It was a habit.  The body kept moving.' },
      { who: 'korin', text: 'The body always keeps moving.' },
    ],
    choices: [
      { label: 'Trade no more words', tag: 'Korin gains Warhardened',
        resolve: (s) => { grantQuirk(s, 'korin', 'warhardened'); log(`<b>Korin</b> gains <i>Warhardened</i>.`); } },
      { label: 'Let it sit',          tag: 'no change', resolve: () => {} },
    ],
  },

  tangled_sight: {
    id: 'tangled_sight',
    when: { frictionFired: 'Tangled Sight', frictionFiredCount: { name: 'Tangled Sight', n: 2 }, requires: ['ash', 'branwen'] },
    title: 'A shared line',
    speaker: 'branwen',
    lines: [
      { who: 'branwen', text: "I had the shot.  You crossed it." },
      { who: 'ash',     text: "I had the shot.  You crossed it." },
      { who: null,      text: 'Both of them lower their weapons by half a degree.  Neither apologizes.' },
    ],
    choices: [
      { label: 'Walk the line', tag: 'Ash gains Veil Walker',
        resolve: (s) => { grantQuirk(s, 'ash', 'veil_walker'); log(`<b>Ash</b> gains <i>Veil Walker</i>.`); } },
      { label: 'Mark the target', tag: 'Branwen gains Bleed Stalker',
        resolve: (s) => { grantQuirk(s, 'branwen', 'bleed_stalker'); log(`<b>Branwen</b> gains <i>Bleed Stalker</i>.`); } },
    ],
  },

  // ---- Hero death lines (a hero was downed this fight) ----
  // Post-fight, the survivors react.  Speaker = first alive hero.
  hero_downed: {
    id: 'hero_downed',
    when: { heroDowned: true },
    title: 'A space where someone was',
    speakerFromFirstAlive: true,
    lines: [
      { who: '_first', text: 'They went down where I was supposed to be.' },
      { who: null,     text: 'The survivors set their dead-weight friend upright and check the breath.' },
      { who: '_first', text: '...they will rise for the next reach.' },
    ],
    choices: [
      { label: 'Carry them forward', tag: 'Downed restored to 1 HP',
        resolve: (s) => { Object.values(s.party.chars).forEach(c => { if (c.downed) { c.downed = false; c.hp = 1; } }); log('The fallen are lifted.'); } },
      { label: 'Bind in silence',    tag: 'Restore 25% · Sigil of Mending',
        resolve: (s) => {
          Object.values(s.party.chars).forEach(c => { if (c.downed) { c.downed = false; c.hp = Math.max(1, Math.ceil(c.maxHp * 0.25)); } });
          bindSigil(s, 'mending');
          log('The fallen are lifted.');
        }
      },
    ],
  },

  // ---- Recruit intros: one per recruitable hero (oneShot per run) ----
  recruit_cassia: {
    id: 'recruit_cassia', when: { recruited: 'cassia' }, oneShot: true,
    title: 'Cassia, at the gate',
    speaker: 'cassia',
    lines: [
      { who: null,      text: "She stands at the threshold of the next reach, sword set point-down in the dust." },
      { who: 'cassia',  text: "I lost what was worth keeping.  What I have left, I will spend down here." },
      { who: '_first',  text: "Spend it well, then.  We're going up, not back." },
      { who: 'cassia',  text: "Up.  I'd forgotten the word." },
      { who: null,      text: "She lifts her sword.  The banner tied to its grip is grey with old smoke." },
    ],
    choices: [
      { label: 'Welcome her', tag: 'Cassia rests (HP restored)',
        resolve: (s) => { const c = s.party.chars.cassia; if (c) c.hp = c.maxHp; } },
    ],
  },
  recruit_elin: {
    id: 'recruit_elin', when: { recruited: 'elin' }, oneShot: true,
    title: 'Elin, behind the veil',
    speaker: 'elin',
    lines: [
      { who: 'elin',    text: 'Mercy still has weight.  I will carry it.' },
      { who: '_first',  text: 'Carry it close.  The reach is greedy.' },
    ],
    choices: [
      { label: 'Welcome her', tag: 'Elin heals to full', resolve: (s) => { const c = s.party.chars.elin; if (c) c.hp = c.maxHp; } },
    ],
  },
  recruit_branwen: {
    id: 'recruit_branwen', when: { recruited: 'branwen' }, oneShot: true,
    title: 'Branwen, counting arrows',
    speaker: 'branwen',
    lines: [
      { who: 'branwen', text: 'I name every arrow before I loose it.' },
      { who: '_first',  text: 'Name the one you save for the Wakeling.' },
      { who: 'branwen', text: 'I have.' },
    ],
    choices: [
      { label: 'Welcome her', tag: 'Branwen heals to full', resolve: (s) => { const c = s.party.chars.branwen; if (c) c.hp = c.maxHp; } },
    ],
  },
  recruit_korin: {
    id: 'recruit_korin', when: { recruited: 'korin' }, oneShot: true,
    title: 'Korin, with the wall',
    speaker: 'korin',
    lines: [
      { who: 'korin',  text: 'I do not run.  If that is a problem, say it now.' },
      { who: '_first', text: 'Stay in front.  We will manage.' },
      { who: 'korin',  text: 'Good.' },
    ],
    choices: [
      { label: 'Welcome him', tag: 'Korin heals to full', resolve: (s) => { const c = s.party.chars.korin; if (c) c.hp = c.maxHp; } },
    ],
  },
  recruit_ash: {
    id: 'recruit_ash', when: { recruited: 'ash' }, oneShot: true,
    title: 'Ash, half in the dark',
    speaker: 'ash',
    lines: [
      { who: 'ash',    text: 'I do not promise to be seen.' },
      { who: '_first', text: 'Be useful.  The seen part is optional.' },
      { who: 'ash',    text: 'Then we will get along.' },
    ],
    choices: [
      { label: 'Welcome them', tag: 'Ash heals to full', resolve: (s) => { const c = s.party.chars.ash; if (c) c.hp = c.maxHp; } },
    ],
  },
  recruit_mira: {
    id: 'recruit_mira', when: { recruited: 'mira' }, oneShot: true,
    title: 'Mira, blade already drawn',
    speaker: 'mira',
    lines: [
      { who: 'mira',   text: 'I prefer to finish before they notice.' },
      { who: '_first', text: 'Then finish.  We will follow up.' },
      { who: 'mira',   text: 'Try to keep up.' },
    ],
    choices: [
      { label: 'Welcome her', tag: 'Mira heals to full', resolve: (s) => { const c = s.party.chars.mira; if (c) c.hp = c.maxHp; } },
    ],
  },
  recruit_garron: {
    id: 'recruit_garron', when: { recruited: 'garron' }, oneShot: true,
    title: 'Garron, kite-shield to the path',
    speaker: 'garron',
    lines: [
      { who: null,     text: 'A great kite shield is planted in the dust like a marker.  Behind it, a man in plate sits very still, helm balanced on one knee.' },
      { who: 'garron', text: 'You moved well in the last fight.  I watched.' },
      { who: '_first', text: 'You watched and didn\'t help?' },
      { who: 'garron', text: 'You did not need helping then.  You may need it later.  Stand behind me.  I will know when to step aside.' },
    ],
    choices: [
      { label: 'Welcome him', tag: 'Garron rests (HP restored)',
        resolve: (s) => { const c = s.party.chars.garron; if (c) c.hp = c.maxHp; } },
    ],
  },
  recruit_lirien: {
    id: 'recruit_lirien', when: { recruited: 'lirien' }, oneShot: true,
    title: 'Lirien, with a song on her teeth',
    speaker: 'lirien',
    lines: [
      { who: null,     text: 'A hooded figure sits cross-legged on a flat stone, plucking a small harp.  The notes do not echo.  They sink.' },
      { who: 'lirien', text: 'The first sin I undid, I unwound with a chord.  The second with a verse.  The third would not listen.' },
      { who: '_first', text: 'And you?' },
      { who: 'lirien', text: 'I am told my songs are a kind of weapon.  Let us see if it is true.' },
    ],
    choices: [
      { label: 'Welcome her', tag: 'Lirien rests (HP restored)',
        resolve: (s) => { const c = s.party.chars.lirien; if (c) c.hp = c.maxHp; } },
    ],
  },
  recruit_vasha: {
    id: 'recruit_vasha', when: { recruited: 'vasha' }, oneShot: true,
    title: 'Vasha, lantern lit against the dark',
    speaker: 'vasha',
    lines: [
      { who: null,    text: 'A woman in pale, dust-cuffed robes stands at the edge of the path with a lantern on a long staff.  The light does not move when the wind does.' },
      { who: 'vasha', text: 'The reach takes my readings poorly.  Half my verses come back changed.' },
      { who: '_first', text: 'Why keep reading?' },
      { who: 'vasha', text: 'Light does not forgive.  But it remembers.  I can carry both.' },
    ],
    choices: [
      { label: 'Welcome her', tag: 'Vasha rests (HP restored)',
        resolve: (s) => { const c = s.party.chars.vasha; if (c) c.hp = c.maxHp; } },
    ],
  },
  recruit_hask: {
    id: 'recruit_hask', when: { recruited: 'hask' }, oneShot: true,
    title: 'Hask, breath in the air',
    speaker: 'hask',
    lines: [
      { who: null,    text: 'You see him before you feel him — a long pale figure in fur and frost, breath making slow shapes that do not melt.' },
      { who: 'hask',  text: 'Stand in front of me if you can.  I do not pull punches with the cold.' },
      { who: '_first', text: "We've held front against worse.  Walk with us." },
      { who: 'hask',  text: 'I bring the cold with me.  Do not stand still.' },
    ],
    choices: [
      { label: 'Welcome him', tag: 'Hask rests (HP restored)',
        resolve: (s) => { const c = s.party.chars.hask; if (c) c.hp = c.maxHp; } },
    ],
  },
  recruit_kai: {
    id: 'recruit_kai', when: { recruited: 'kai' }, oneShot: true,
    title: 'Kai, on his feet again',
    speaker: 'kai',
    lines: [
      { who: null,     text: "He's sitting against a dry stone with his sword across his knees when the party rounds the corner." },
      { who: 'kai',    text: "Long walk by yourself, the abyss." },
      { who: '_first', text: "We were going to keep walking past you." },
      { who: 'kai',    text: "Reasonable.  I would have done the same." },
      { who: 'kai',    text: "But — I have done this stretch alone too long.  Climb together?" },
      { who: '_first', text: "Climb together." },
    ],
    choices: [
      { label: 'Welcome him', tag: 'Kai rests (HP restored)',
        resolve: (s) => { const c = s.party.chars.kai; if (c) c.hp = c.maxHp; } },
    ],
  },

  // ---- Rumor vignettes — short observations that plant a hero's name in
  // the run.  state.run.rumoredHeroes gates which hero appears when the
  // recruit moment fires, so the world feels like it wove them in instead
  // of the picker handing out a random pair.
  rumor_cassia: {
    id: 'rumor_cassia',
    when: { firstClearOf: 'combat', whileLayer: 1 },
    oneShot: true,
    title: 'A banner in the dust',
    speakerFromFirstAlive: true,
    lines: [
      { who: null,     text: 'A torn banner snags in the brush — a sword set point-down in stone.' },
      { who: '_first', text: 'Cassia.  They said she walked the gate when her house fell.' },
    ],
    choices: [
      { label: 'Mark the sign', tag: 'Rumor noted: Cassia',
        resolve: (s) => { (s.run.rumoredHeroes = s.run.rumoredHeroes || []).push('cassia'); } },
    ],
  },
  rumor_elin: {
    id: 'rumor_elin',
    when: { someoneAtOrBelow: 6 },
    oneShot: true,
    title: 'A hand without a name',
    speakerFromFirstAlive: true,
    lines: [
      { who: null,     text: 'You find a strip of linen bound around a hawthorn branch — a field-medic mark.' },
      { who: '_first', text: 'Someone is healing strangers down here.  Elin, the old wards used to call her.' },
    ],
    choices: [
      { label: 'Keep the strip', tag: 'Rumor noted: Elin',
        resolve: (s) => { (s.run.rumoredHeroes = s.run.rumoredHeroes || []).push('elin'); } },
    ],
  },
  rumor_branwen: {
    id: 'rumor_branwen',
    when: { whileBiome: 'bonetide' },
    oneShot: true,
    title: 'A shaft in the marrow',
    speakerFromFirstAlive: true,
    lines: [
      { who: null,     text: 'An arrow stands in a sin, fletched with green thread.  The shaft has a name carved into it.' },
      { who: '_first', text: 'Branwen.  Every arrow named before it flies.' },
    ],
    choices: [
      { label: 'Read the name', tag: 'Rumor noted: Branwen',
        resolve: (s) => { (s.run.rumoredHeroes = s.run.rumoredHeroes || []).push('branwen'); } },
    ],
  },
  rumor_korin: {
    id: 'rumor_korin',
    when: { firstClearOf: 'elite' },
    oneShot: true,
    title: 'A wall someone built',
    speakerFromFirstAlive: true,
    lines: [
      { who: null,     text: 'A row of cairns stands across the path, set by patient hands.  Whoever built them did not run.' },
      { who: '_first', text: 'Korin.  He holds the line when no one asks him to.' },
    ],
    choices: [
      { label: 'Pass through', tag: 'Rumor noted: Korin',
        resolve: (s) => { (s.run.rumoredHeroes = s.run.rumoredHeroes || []).push('korin'); } },
    ],
  },

  // ---- "An enemy wanted to live" — post-fight vignettes that flavor the
  // existing recruit offer as a survivor asking to walk with you. Mechanic
  // is purely narrative: granting Resolve / heal, not adding new heroes.
  enemy_survivor: {
    id: 'enemy_survivor',
    when: { firstClearOf: 'combat' },
    oneShot: true,
    title: 'One of them rises',
    speakerFromFirstAlive: true,
    lines: [
      { who: null, text: 'A wounded shape lifts both hands in the dust.  Not surrender — a request.' },
      { who: '_first', text: 'You walked with them.  Why would you walk with us?' },
      { who: null, text: 'The reply is too quiet to write down.' },
    ],
    choices: [
      { label: 'Spare them',  tag: 'Heal party 4 · +1 Resolve next',
        resolve: (s) => { aliveParty(s).forEach(c => { c.hp = Math.min(c.maxHp, c.hp + 4); }); s.run.bonusResolveNextFight = (s.run.bonusResolveNextFight || 0) + 1; log('A bandage finds its way around the survivor.'); } },
      { label: 'Walk on',     tag: 'no change', resolve: () => {} },
    ],
  },
  enemy_survivor_elite: {
    id: 'enemy_survivor_elite',
    when: { firstClearOf: 'elite' },
    oneShot: true,
    title: "A sin that won't lie down",
    speakerFromFirstAlive: true,
    lines: [
      { who: null, text: 'You had named them a Sin.  In the dust, they look like a person again.' },
      { who: '_first', text: 'I do not know if mercy belongs here.' },
      { who: null, text: 'But you kneel anyway, and offer water.' },
    ],
    choices: [
      { label: 'Bind their wounds', tag: 'Heal party to full · +2 Resolve next',
        resolve: (s) => { aliveParty(s).forEach(c => { c.hp = c.maxHp; }); s.run.bonusResolveNextFight = (s.run.bonusResolveNextFight || 0) + 2; log('A small kindness in a cruel place.'); } },
      { label: 'Walk on',           tag: 'no change', resolve: () => {} },
    ],
  },

  // =================== LAYER 2 — THE VEIL OF NAMES =====================
  // Each is gated by whileLayer: 2 so they only surface on the second climb.

  layer2_arrival: {
    id: 'layer2_arrival',
    when: { runStart: true, whileLayer: 2 },
    oneShot: true,
    title: 'You climb into the veil',
    speakerFromFirstAlive: true,
    lines: [
      { who: null,     text: "The light here is not light.  It is what light remembers." },
      { who: null,     text: "Names you have not said in years drift past you on the wind." },
      { who: '_first', text: "I heard mine just now." },
      { who: null,     text: "Something heard it too.  It is older than the abyss." },
    ],
    choices: [
      { label: 'Climb anyway', tag: '+1 Resolve next fight',
        resolve: (s) => { s.run.bonusResolveNextFight = (s.run.bonusResolveNextFight || 0) + 1; log('You press on into the veil.'); } },
      { label: 'Listen first', tag: 'Lowest-HP hero gains +4 max HP',
        resolve: (s) => { const id = _lowestHpAliveId(s); const c = id && s.party.chars[id]; if (c) { c.maxHp += 4; c.hp += 4; log(`<b>${CHARS[id].name}</b> hears something true. +4 max HP.`); } } },
    ],
  },

  layer2_name_whisper: {
    id: 'layer2_name_whisper',
    when: { whileLayer: 2, someoneAtOrBelow: 6 },
    title: 'A name, whispered close',
    speakerFromLowestHp: true,
    lines: [
      { who: null,     text: "Something speaks the name they were given, before any of this." },
      { who: '_lowest', text: "...do not.  Do not say it again." },
      { who: null,     text: "The whisper does not stop.  But the bleeding does, a little." },
    ],
    choices: [
      { label: 'Refuse the name', tag: 'Heal lowest to full · Resolve +1 next fight',
        resolve: (s) => { const id = _lowestHpAliveId(s); const c = id && s.party.chars[id]; if (c) c.hp = c.maxHp; s.run.bonusResolveNextFight = (s.run.bonusResolveNextFight || 0) + 1; } },
      { label: 'Answer it',       tag: 'Lowest-HP hero gains Brutal (+2 dmg)',
        resolve: (s) => { const id = _lowestHpAliveId(s); if (id) grantQuirk(s, id, 'brutal'); } },
    ],
  },

  layer2_mourner_dust: {
    id: 'layer2_mourner_dust',
    when: { whileLayer: 2, firstClearOf: 'combat' },
    oneShot: true,
    title: 'The mourner becomes dust',
    speakerFromFirstAlive: true,
    lines: [
      { who: null,     text: "Her grief flakes off her shape like ash off a beam." },
      { who: '_first', text: "I think she was someone." },
      { who: null,     text: "She was.  She walked the floors above and was given a name.  Then she was given one too many." },
    ],
    choices: [
      { label: 'Carry the silence', tag: 'Party heals 3 + cleanse',
        resolve: (s) => { aliveParty(s).forEach(c => { const b = c.hp; c.hp = Math.min(c.maxHp, c.hp + 3); if (c.hp > b) spawnPopupId(c.id, `+${c.hp - b}`, 'heal', 'party'); c.bleed = 0; c.weak = 0; }); } },
      { label: 'Bury her name',     tag: 'Gain a random sigil',
        resolve: (s) => _grantRandomSigil(s) },
    ],
  },

  layer2_listener_prep: {
    id: 'layer2_listener_prep',
    when: { bossPrep: true, whileLayer: 2 },
    oneShot: true,
    title: 'The Listener waits',
    speakerFromFirstAlive: true,
    lines: [
      { who: null,     text: "The air is dense with names.  Every step you take is a name being said somewhere." },
      { who: '_first', text: "Don't say its name back.  Don't say anyone's name." },
      { who: '_last',  text: "Then how do we win?" },
      { who: '_first', text: "Quietly." },
    ],
    choices: [
      { label: 'Move in silence', tag: 'Party +3⛨ + cleanse',
        resolve: (s) => { aliveParty(s).forEach(c => { c.armor += 3; c.bleed = 0; c.weak = 0; }); } },
      { label: 'Whet a blade',    tag: 'Lowest-HP hero gains Brutal (+2 dmg)',
        resolve: (s) => { const id = _lowestHpAliveId(s); if (id) grantQuirk(s, id, 'brutal'); } },
    ],
  },

  layer2_listener_falls: {
    id: 'layer2_listener_falls',
    when: { bossDefeated: true, whileLayer: 2 },
    oneShot: true,
    title: 'The Listener is unheard',
    speakerFromFirstAlive: true,
    lines: [
      { who: null,     text: "The eyes close, one by one, like windows being shut against weather." },
      { who: null,     text: "The chime falls without a sound." },
      { who: '_first', text: "...did the names go with her?" },
      { who: '_last',  text: "Most.  A few are still waiting on the next floor.",
        if: (s) => aliveParty(s).length > 1 },
      { who: null,     text: "The veil thins where she stood, like cloth wearing through." },
    ],
    variants: [
      // Branwen + Elin — Spirit Arrow / Mercy's Gift.  Branwen names her
      // arrows; Elin names what each one cost.  The Listener was their
      // shape, in different directions.
      {
        requires: ['branwen', 'elin'],
        lines: [
          { who: null,     text: "The eyes close, one by one, like windows being shut against weather." },
          { who: 'branwen', text: "She knew every name I ever shot." },
          { who: 'elin',    text: "She knew every name I ever sang over." },
          { who: 'branwen', text: "Which list was longer?" },
          { who: 'elin',    text: "Don't ask me that on this floor." },
          { who: null,      text: "The veil thins where she stood, like cloth wearing through." },
        ],
      },
    ],
    choices: [
      // Mirrors the Wakeling reward pattern — three reflections, each
      // takes something useful up the climb.  'Climb on' / 'Bury the
      // chime' both did nothing before.
      { label: 'Take her chime', tag: "Bind a sigil from the Listener's silence",
        resolve: (s) => { _grantRandomSigil(s); } },
      { label: 'Take a name',    tag: 'A survivor gains a positive affinity',
        resolve: (s) => { _rollSurvivorQuirk(s, 'positive'); } },
      { label: 'Take the veil',  tag: 'Survivors gain +4 max HP',
        resolve: (s) => {
          aliveParty(s).forEach(c => {
            c.maxHp += 4;
            c.hp = Math.min(c.maxHp, c.hp + 4);
          });
          log('The veil settles on the survivors.  +4 max HP.');
        } },
    ],
  },

  // ==================== LAYER 3 — THE SPIRE OF GLASS ====================
  // Arrival cinematic for the climb into layer 3.  Mirror theme — every
  // surface returns a face.  Per-hero reactive lines so the carried party
  // each get a moment of seeing themselves reflected back.
  layer3_arrival: {
    id: 'layer3_arrival',
    when: { runStart: true, whileLayer: 3 },
    oneShot: true,
    title: 'You climb into the Spire',
    speakerFromFirstAlive: true,
    lines: [
      // Setting — the spire's mirror law.
      { who: null,     text: "Every surface here remembers a face.  Yours are waiting." },
      // First → last exchange.  The first survivor names what they see; the
      // last responds with the warning.  Solo runs get the look, not the
      // reply.
      { who: '_first', text: "...mine looks tired." },
      { who: '_last',  text: "Don't trust your own face down here.",
        if: (s) => aliveParty(s).length > 1 },
      // Closing — the reflections move.
      { who: null,     text: "Your reflections turn before you do.  They carry your weapons, your scars, your same tired hands." },
    ],
    variants: [
      // Branwen + Cassia — the Old Rivalry pair meets themselves in mirrors.
      {
        requires: ['branwen', 'cassia'],
        lines: [
          { who: null,     text: "Every surface here remembers a face.  Yours are waiting." },
          { who: 'branwen', text: "Mine is aiming at yours." },
          { who: 'cassia',  text: "Mine has a banner.  Yours has an arrow." },
          { who: 'branwen', text: "...that's accurate." },
          { who: 'cassia',  text: "Don't trust either of them.  Just us." },
          { who: null,      text: "Your reflections turn before you do." },
        ],
      },
    ],
    choices: [
      { label: 'Step through it', tag: '+1 Resolve next fight',
        resolve: (s) => { s.run.bonusResolveNextFight = (s.run.bonusResolveNextFight || 0) + 1; log('You pass through your reflection.'); } },
      { label: 'Take its scar',   tag: 'A survivor gains a positive affinity',
        resolve: (s) => { _rollSurvivorQuirk(s, 'positive'); } },
    ],
  },

  // ==================== LAYER 4 — THE FLOODLIT HALL =====================
  // Arrival cinematic for layer 4.  Drowning / choir theme — light from
  // below, water under the floor, the choir starting to remember.  Each
  // hero reacts to the rising sound in their own register.
  layer4_arrival: {
    id: 'layer4_arrival',
    when: { runStart: true, whileLayer: 4 },
    oneShot: true,
    title: 'You climb into the Hall',
    speakerFromFirstAlive: true,
    lines: [
      // Setting — the light is wrong here.
      { who: null,     text: "The light comes from below the floor.  The water that ate the sky is still down there, somewhere under." },
      // First names what's rising; last names what it wants.
      { who: '_first', text: "Something is singing." },
      { who: '_last',  text: "It's been waiting for an audience.",
        if: (s) => aliveParty(s).length > 1 },
      // Closing — the choir starts to remember.
      { who: null,     text: "Far below, a choir starts to remember its hymn.  One note at a time, like rust learning to be metal again." },
    ],
    variants: [
      // Elin + Vasha — the two healers, light against rising water.
      {
        requires: ['elin', 'vasha'],
        lines: [
          { who: null,    text: "The light comes from below the floor.  The water that ate the sky is still down there." },
          { who: 'vasha', text: "It is singing the wrong key." },
          { who: 'elin',  text: "Then we sing the right one." },
          { who: 'vasha', text: "Together?  Light against water?" },
          { who: 'elin',  text: "I will hold the note.  You hold the line." },
          { who: null,    text: "Far below, a choir starts to remember its hymn." },
        ],
      },
      // Mira + Cassia — opposite styles brace against the chorus.
      {
        requires: ['mira', 'cassia'],
        lines: [
          { who: null,     text: "The light comes from below the floor.  The water that ate the sky is still down there." },
          { who: 'mira',   text: "If they sing, I cut.  Hymns first, then throats." },
          { who: 'cassia', text: "If they sing, I march.  Loud.  Drown them out." },
          { who: 'mira',   text: "...I hate that that works." },
          { who: 'cassia', text: "We do both." },
          { who: null,     text: "Far below, a choir starts to remember its hymn." },
        ],
      },
    ],
    choices: [
      { label: 'Hold against the chorus', tag: 'Survivors heal to full · +1 Resolve next fight',
        resolve: (s) => {
          aliveParty(s).forEach(c => { c.hp = c.maxHp; });
          s.run.bonusResolveNextFight = (s.run.bonusResolveNextFight || 0) + 1;
          log('The party braces against the rising hymn.');
        } },
      { label: 'Sing back',               tag: 'A survivor gains a positive affinity',
        resolve: (s) => { _rollSurvivorQuirk(s, 'positive'); } },
    ],
  },

  // ==================== LAYER 5 — THE CINDER GARDEN =====================
  // Arrival cinematic for layer 5.  Buried-fire / cycles theme — black
  // soil, old ash, things that should not be growing.  The party reads
  // the pattern, each in their own way.
  layer5_arrival: {
    id: 'layer5_arrival',
    when: { runStart: true, whileLayer: 5 },
    oneShot: true,
    title: 'You climb into the Garden',
    speakerFromFirstAlive: true,
    lines: [
      // Setting — the rows of black soil.
      { who: null,     text: "The path opens onto rows.  Black soil, old ash, things that should not be growing." },
      // First asks the question; last answers it.
      { who: '_first', text: "How many times has this been planted?" },
      { who: '_last',  text: "Once more than it should have been.",
        if: (s) => aliveParty(s).length > 1 },
      // Closing — the pattern goes on.
      { who: null,     text: "Something here has done this before.  It will do it again." },
    ],
    variants: [
      // Cassia + Korin — the Iron Bond pair, both knowing what 'hold the row' means.
      {
        requires: ['cassia', 'korin'],
        lines: [
          { who: null,     text: "The path opens onto rows.  Black soil, old ash, things that should not be growing." },
          { who: 'cassia', text: "Edge of the row.  We hold here." },
          { who: 'korin',  text: "(He nods.  Drives his shield into the ash up to the strap.)" },
          { who: 'cassia', text: "If it blooms past us, we plant ourselves." },
          { who: 'korin',  text: "Then nothing past." },
          { who: null,     text: "Something here has done this before.  It will not do it through them." },
        ],
      },
    ],
    choices: [
      { label: "Burn what's already buried", tag: 'A survivor gains a positive affinity',
        resolve: (s) => { _rollSurvivorQuirk(s, 'positive'); } },
      { label: 'Plant your boot',            tag: 'Survivors gain +3 max HP',
        resolve: (s) => {
          aliveParty(s).forEach(c => {
            c.maxHp += 3;
            c.hp = Math.min(c.maxHp, c.hp + 3);
          });
          log('The party stakes its weight into the row.  +3 max HP.');
        } },
    ],
  },

  // ============================================================================
  // BOSS-DEFEAT VIGNETTES — layers 3 / 4 / 5
  // Same pattern as wakeling_slain and layer2_listener_falls: a tight base
  // exchange via _first/_last, three Take rewards, and one iconic pair variant
  // gated to that pair's survival.  Each boss gets its own thematic frame.
  // ============================================================================

  // ==================== LAYER 3 — THE TWIN ===============================
  // Boss-defeat for the Twin (Sin of Mirrors).  Its trick was learning what
  // you brought; broken, every reflection it stole returns to its surface.
  layer3_twin_falls: {
    id: 'layer3_twin_falls',
    when: { bossDefeated: true, whileLayer: 3 },
    oneShot: true,
    title: 'The Twin is broken',
    speakerFromFirstAlive: true,
    lines: [
      { who: null, text: "It does not fall.  It splinters." },
      { who: null, text: "Every reflection it stole goes back to its surface — yours, finally, returned." },
      { who: '_first', text: "It got close, didn't it." },
      { who: '_last',  text: "Close.  Not quite.",
        if: (s) => aliveParty(s).length > 1 },
      { who: null, text: "Glass remembers a long time.  But not forever." },
    ],
    variants: [
      // Mira + Branwen — two hunters, both used to spotting decoys.
      {
        requires: ['mira', 'branwen'],
        lines: [
          { who: null,      text: "It does not fall.  It splinters." },
          { who: 'mira',    text: "I thought I was about to shoot you for a second." },
          { who: 'branwen', text: "...I was halfway to shooting you back." },
          { who: 'mira',    text: "How did you know?" },
          { who: 'branwen', text: "Your version of me always aims left.  Mine aims right." },
          { who: null,      text: "Glass remembers a long time.  But not forever." },
        ],
      },
    ],
    choices: [
      { label: 'Take its mirror', tag: "Bind a sigil from the Twin's surface",
        resolve: (s) => { _grantRandomSigil(s); } },
      { label: 'Take its eye',    tag: 'A survivor gains a positive affinity',
        resolve: (s) => { _rollSurvivorQuirk(s, 'positive'); } },
      { label: 'Take its shape',  tag: 'Survivors gain +4 max HP',
        resolve: (s) => {
          aliveParty(s).forEach(c => {
            c.maxHp += 4;
            c.hp = Math.min(c.maxHp, c.hp + 4);
          });
          log("The party takes the Twin's shape.  +4 max HP.");
        } },
    ],
  },

  // ==================== LAYER 4 — THE DROWNED CHOIR ======================
  // Boss-defeat for the Choir (Sin of Hearing-Under).  Its hymn unsings.
  // The water under the floor stops pretending to be a sky.
  layer4_choir_falls: {
    id: 'layer4_choir_falls',
    when: { bossDefeated: true, whileLayer: 4 },
    oneShot: true,
    title: 'The Choir is unsung',
    speakerFromFirstAlive: true,
    lines: [
      { who: null, text: "The hymn cracks.  One voice at a time, like icicles giving up." },
      { who: null, text: "The water under the floor stops pretending to be a sky." },
      { who: '_first', text: "Did it hear itself, at the end?" },
      { who: '_last',  text: "Just at the end.",
        if: (s) => aliveParty(s).length > 1 },
      { who: null, text: "Somewhere far above, a real sky leans down to listen." },
    ],
    variants: [
      // Hask + Lirien — the cold and the songbinder.  Both feel rhythm.
      {
        requires: ['hask', 'lirien'],
        lines: [
          { who: null,    text: "The hymn cracks.  One voice at a time, like icicles giving up." },
          { who: 'lirien', text: "It was a beautiful chord, before the end." },
          { who: 'hask',   text: "It was a cold chord.  I liked it." },
          { who: 'lirien', text: "...you would." },
          { who: 'hask',   text: "The rhythm is ours again." },
          { who: null,     text: "Somewhere far above, a real sky leans down to listen." },
        ],
      },
    ],
    choices: [
      { label: 'Take its hymn',   tag: 'Bind a sigil from the unsung verse',
        resolve: (s) => { _grantRandomSigil(s); } },
      { label: 'Take a note',     tag: 'A survivor gains a positive affinity',
        resolve: (s) => { _rollSurvivorQuirk(s, 'positive'); } },
      { label: 'Take its breath', tag: 'Survivors heal to full · +4 max HP',
        resolve: (s) => {
          aliveParty(s).forEach(c => {
            c.maxHp += 4;
            c.hp = c.maxHp;
          });
          log('The party catches the breath the Choir was holding.  +4 max HP, full heal.');
        } },
    ],
  },

  // ==================== LAYER 5 — THE SLOW BLOOM =========================
  // Boss-defeat for the Slow Bloom (Sin of Cycles).  It composts back into
  // the rows that bore it — for now.  Cycles end at the row's edge.
  layer5_bloom_falls: {
    id: 'layer5_bloom_falls',
    when: { bossDefeated: true, whileLayer: 5 },
    oneShot: true,
    title: 'The Slow Bloom withers',
    speakerFromFirstAlive: true,
    lines: [
      { who: null, text: "It does not die.  It composts.  Layer by layer, into the rows that bore it." },
      { who: null, text: "A long, slow exhale rises from the soil and disperses up the spine of the abyss." },
      { who: '_first', text: "How long until it comes back?" },
      { who: '_last',  text: "Not before we do.",
        if: (s) => aliveParty(s).length > 1 },
      { who: null, text: "For the first time in cycles, no new shoots." },
    ],
    variants: [
      // Garron + Korin — two tanks who held the row's edge.
      {
        requires: ['garron', 'korin'],
        lines: [
          { who: null,     text: "It does not die.  It composts.  Layer by layer, into the rows that bore it." },
          { who: 'garron', text: "The row held." },
          { who: 'korin',  text: "(He plants his shield, finally tired.  Nods, once.)" },
          { who: 'garron', text: "I felt you behind me the whole time.  Like a second spine." },
          { who: 'korin',  text: "...same." },
          { who: null,     text: "For the first time in cycles, no new shoots." },
        ],
      },
    ],
    choices: [
      { label: 'Take its root',   tag: 'Bind a sigil from the buried fire',
        resolve: (s) => { _grantRandomSigil(s); } },
      { label: 'Take its season', tag: 'A survivor gains a positive affinity',
        resolve: (s) => { _rollSurvivorQuirk(s, 'positive'); } },
      { label: 'Take its ash',    tag: 'Survivors gain +5 max HP',
        resolve: (s) => {
          aliveParty(s).forEach(c => {
            c.maxHp += 5;
            c.hp = Math.min(c.maxHp, c.hp + 5);
          });
          log('The party tracks ash up the climb.  +5 max HP.');
        } },
    ],
  },
};

function _lowestHpAliveId(s) {
  const alive = Object.values(s.party.chars).filter(c => !c.downed);
  if (!alive.length) return null;
  alive.sort((a, b) => a.hp - b.hp);
  return alive[0].id;
}

function captureFightContext(s, nodeType) {
  const completedNode = s.run.currentNodeId ? getMapNode(s.run.currentNodeId) : null;
  return {
    firedSynergies: Array.from(s.firedSynergies || []),
    synergyCounts: { ...((s.run && s.run.synergyCounts) || {}) },
    minHp: { ...((s.fightStats && s.fightStats.minHp) || {}) },
    killsBy: { ...((s.fightStats && s.fightStats.killsBy) || {}) },
    downedThisFight: [...((s.fightStats && s.fightStats.downed) || [])],
    party: Object.keys(s.party.chars),
    alive: Object.values(s.party.chars).filter(c => !c.downed).map(c => c.id),
    biome: s.run && s.run.modifier,
    layer: (s.run && s.run.layer) || 1,
    nodeType: nodeType || (completedNode && completedNode.type) || null,
    completedTypes: (s.run.completedNodes || []).map(id => getMapNode(id)?.type).filter(Boolean),
  };
}

function matchVignettes(s, ctx) {
  const fired = (s.run && s.run.firedVignettes) || [];
  return Object.values(VIGNETTES).filter(v => {
    const w = v.when || {};
    // One-shot vignettes only play once per run
    if (v.oneShot && fired.includes(v.id)) return false;
    // Special phase triggers — bypass other conditions; only fire when the
    // matching phase is active.
    // Special-phase vignettes (runStart/bossPrep/etc.) bypass node/synergy
    // gating, but still respect whileLayer so layer-specific intros only fire
    // on their layer.  Without this, multiple runStart vignettes match every
    // climb and one gets picked at random.
    if (w.runStart) {
      if (ctx.phase !== 'runStart') return false;
      if (w.whileLayer && ctx.layer !== w.whileLayer) return false;
      return true;
    }
    if (w.bossPrep)      return ctx.phase === 'bossPrep';
    if (w.runDefeat)     return ctx.phase === 'runDefeat';
    if (w.bossDefeated)  return ctx.phase === 'bossDefeated';
    if (ctx.phase === 'runStart' || ctx.phase === 'bossPrep'
        || ctx.phase === 'runDefeat' || ctx.phase === 'bossDefeated') return false;
    // Recruit phase: only `recruited` vignettes can play; everything else waits
    if (ctx.phase === 'recruit') {
      if (!w.recruited) return false;
      if (typeof w.recruited === 'string' && ctx.recruitedId !== w.recruited) return false;
      return true;
    }
    if (w.recruited) return false; // recruit-vignettes never fire outside the recruit phase
    if (w.requires && !w.requires.every(id => ctx.alive.includes(id))) return false;
    if (w.bondFired && !ctx.firedSynergies.includes(w.bondFired)) return false;
    if (w.frictionFired && !ctx.firedSynergies.includes(w.frictionFired)) return false;
    // Catalyst gates — the named bond must have fired at least N times this run.
    // Vignettes that grant lasting rewards (hero quirks, sigils) gate on
    // this so the reward feels earned rather than handed out on first sight.
    if (w.bondFiredCount) {
      const { name: bn, n: bnNeeded } = w.bondFiredCount;
      if ((ctx.synergyCounts[bn] || 0) < bnNeeded) return false;
    }
    if (w.frictionFiredCount) {
      const { name: fn, n: fnNeeded } = w.frictionFiredCount;
      if ((ctx.synergyCounts[fn] || 0) < fnNeeded) return false;
    }
    if (w.whileBiome && ctx.biome !== w.whileBiome) return false;
    if (w.whileLayer && ctx.layer !== w.whileLayer) return false;
    if (typeof w.someoneAtOrBelow === 'number') {
      const hit = Object.entries(ctx.minHp).some(([id, hp]) => hp <= w.someoneAtOrBelow && ctx.alive.includes(id));
      if (!hit) return false;
    }
    if (w.firstClearOf) {
      // True iff the just-completed node matches AND no earlier completed node was that type
      if (ctx.nodeType !== w.firstClearOf) return false;
      const earlier = ctx.completedTypes.slice(0, -1);
      if (earlier.includes(w.firstClearOf)) return false;
    }
    if (w.actorKilledAtLeast) {
      const { charId, n } = w.actorKilledAtLeast;
      if ((ctx.killsBy[charId] || 0) < n) return false;
    }
    if (w.heroDowned) {
      const list = (ctx.downedThisFight || []);
      if (!list.length) return false;
      if (typeof w.heroDowned === 'string' && !list.includes(w.heroDowned)) return false;
    }
    if (w.recruited) {
      if (!ctx.recruitedId) return false;
      if (typeof w.recruited === 'string' && ctx.recruitedId !== w.recruited) return false;
    }
    return true;
  });
}

// Mark a vignette as fired for this run (one-shot housekeeping).
function markVignetteFired(id) {
  if (!state.run) return;
  state.run.firedVignettes = state.run.firedVignettes || [];
  if (!state.run.firedVignettes.includes(id)) state.run.firedVignettes.push(id);
}

// Generate the run's map graph.  Layout (5 levels):
//   L1: 2-3 combat (entries)
//   L2: 2-3 combat
//   L3: 2 nodes — usually 1 elite + 1 combat
//   L4: 1 elite gate
//   L5: boss
// Each non-boss node links to 1-2 random next-level nodes; we then
// guarantee every next-level node is reachable from at least one parent.
function generateMap() {
  const numLevels = 5;
  const usedNames = new Set();
  const levels = [];
  const nodes = {};
  let idCounter = 0;
  // Filter out hidden / secret events whose `when(state)` predicate
  // doesn't match the current run.  Open events are always in the pool;
  // secrets unlock based on layer, party comp, sigil count, etc.
  const eventPool = _shuffle(Object.keys(EVENTS).filter(eid => {
    const ev = EVENTS[eid];
    if (!ev || !ev.secret) return true;
    if (typeof ev.when !== 'function') return true;
    try { return !!ev.when(state); } catch (_) { return false; }
  }));

  for (let lvl = 1; lvl <= numLevels; lvl++) {
    let countAndTypes; // array of types for the level
    if (lvl === numLevels) {
      countAndTypes = ['boss'];
    } else if (lvl === numLevels - 1) {
      // Gate level: 1 elite + 1 rest (player heals OR risks more reward)
      countAndTypes = Math.random() < 0.5 ? ['elite', 'rest'] : ['rest', 'elite'];
    } else if (lvl === 1) {
      const c = 2 + Math.floor(Math.random() * 2);   // 2-3
      countAndTypes = Array(c).fill('combat');
    } else if (lvl === 2) {
      // L2: 2 combat + 1 event (variety)
      countAndTypes = _shuffle(['combat', 'combat', 'event']);
    } else if (lvl === 3) {
      // L3: elite + combat + (event or rest) — three-way choice
      const extra = Math.random() < 0.5 ? 'event' : 'rest';
      countAndTypes = _shuffle(['elite', 'combat', extra]);
    } else {
      const c = 2 + Math.floor(Math.random() * 2);
      countAndTypes = Array(c).fill('combat');
    }

    const ids = [];
    countAndTypes.forEach((type, i) => {
      const id = `n${idCounter++}`;
      const node = { id, level: lvl, col: i, type, next: [] };
      if (type === 'boss')        node.enc = genBossEncounter();
      else if (type === 'elite')  node.enc = genEliteEncounter(lvl, usedNames);
      else if (type === 'combat') node.enc = genCombatEncounter(lvl, usedNames);
      else if (type === 'event')  node.eventId = eventPool[(i + lvl) % eventPool.length];
      // rest nodes need no extra data
      nodes[id] = node;
      ids.push(id);
    });
    levels.push(ids);
  }

  // Wire connections.  Each node prefers next-level neighbors close to its
  // own column, then we patch coverage so every next-level node has at least
  // one parent.
  for (let lvl = 0; lvl < levels.length - 1; lvl++) {
    const cur = levels[lvl];
    const nxt = levels[lvl + 1];
    cur.forEach((id, i) => {
      const node = nodes[id];
      const candidates = nxt.slice().sort((a, b) => {
        const ia = nxt.indexOf(a), ib = nxt.indexOf(b);
        return Math.abs(ia - i) - Math.abs(ib - i);
      });
      // 1-2 connections; 50/50 unless only one candidate
      const want = Math.min(candidates.length, 1 + (Math.random() < 0.55 ? 1 : 0));
      node.next = candidates.slice(0, want);
    });
    const reached = new Set();
    cur.forEach(id => nodes[id].next.forEach(nx => reached.add(nx)));
    nxt.forEach(id => {
      if (!reached.has(id)) {
        const picker = cur[Math.floor(Math.random() * cur.length)];
        if (!nodes[picker].next.includes(id)) nodes[picker].next.push(id);
      }
    });
  }

  return { nodes, entries: levels[0], maxLevel: numLevels };
}

// Helpers that used to read from constant MAP_NODES — now go through state.run.map.
function _runMap()              { return (state && state.run && state.run.map) || null; }
function getMapNode(id)         { return (_runMap()?.nodes || {})[id]; }
function mapEntryNodes()        { return _runMap()?.entries || []; }
function mapMaxLevel()          { return _runMap()?.maxLevel || 0; }

function mapNodeStatus(s, nodeId) {
  if (!s || !s.run) return 'locked';
  if ((s.run.completedNodes || []).includes(nodeId)) return 'completed';
  if (isMapNodeReachable(s, nodeId)) return 'reachable';
  return 'locked';
}
function isMapNodeReachable(s, nodeId) {
  if (!s || !s.run || !s.run.map) return false;
  const completed = s.run.completedNodes || [];
  if (!completed.length) return s.run.map.entries.includes(nodeId);
  const last = s.run.map.nodes[completed[completed.length - 1]];
  return !!(last && last.next.includes(nodeId));
}
function mapEdges() {
  const map = _runMap();
  if (!map) return [];
  const edges = [];
  Object.values(map.nodes).forEach(n => n.next.forEach(nx => edges.push({ from: n.id, to: nx })));
  return edges;
}

const RESOLVE_CARRY_CAP = 3;

// Pool of characters the player can encounter mid-run.
// Default starting party is the first three; the rest are recruitable between fights.
const ROSTER = ['kai', 'cassia', 'elin', 'branwen', 'korin', 'ash', 'mira', 'garron', 'lirien', 'vasha', 'hask'];

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

  // === Cassia — fills mid + back slot variants ===
  'cassia.mid.basic.bearer': {
    id: 'cassia.mid.basic.bearer', charId: 'cassia', slot: 'mid', kind: 'basic',
    name: 'Standard Bearer', desc: '4 dmg front + 2 armor party', dmg: 4,
    reach: ['front'], pattern: 'front-most',
    // note: no advance — Standard Bearer holds her ground
    fn: (s, t) => {
      if (t[0]) applyDmgToEnemy(s, t[0], 4);
      partyArmor(s, 2);
    },
  },
  'cassia.mid.sig.crusader': {
    id: 'cassia.mid.sig.crusader', charId: 'cassia', slot: 'mid', kind: 'sig',
    name: "Crusader's Charge", desc: '7 dmg + advance + 2 retaliate party', dmg: 7, move: 'advance',
    reach: ['front'], pattern: 'front-most',
    fn: (s, t) => {
      if (t[0]) applyDmgToEnemy(s, t[0], 7);
      advance(s, 'cassia');
      aliveParty(s).forEach(c => { c.retaliate += 2; });
    },
  },
  'cassia.back.basic.iron': {
    id: 'cassia.back.basic.iron', charId: 'cassia', slot: 'back', kind: 'basic',
    name: 'Iron Banner', desc: '+3 armor party · +1 retaliate party',
    fn: (s) => {
      aliveParty(s).forEach(c => {
        c.armor += 3;
        c.retaliate += 1;
        spawnPopupId(c.id, '+3⛨', 'armor', 'party');
        fireAdjacencyHook(s, 'onArmorGrant', s.currentActorId, c.id, 3);
      });
    },
  },
  'cassia.back.sig.hymn': {
    id: 'cassia.back.sig.hymn', charId: 'cassia', slot: 'back', kind: 'sig',
    name: 'Hymn of Glory', desc: 'Heal 6 party · cleanse · +2 Resolve', heal: 6, healTarget: 'all',
    fn: (s) => {
      partyHeal(s, 6);
      aliveParty(s).forEach(c => { c.bleed = 0; c.weak = 0; });
      gainResolve(s, 2);
    },
  },

  // === Elin — fills front sig, mid sig, back basic ===
  'elin.front.sig.radiant': {
    id: 'elin.front.sig.radiant', charId: 'elin', slot: 'front', kind: 'sig',
    name: 'Radiant Veil', desc: '8 holy dmg + retreat + cleanse self', dmg: 8, move: 'retreat',
    reach: ['front'], pattern: 'front-most',
    fn: (s, t) => {
      if (t[0]) applyDmgToEnemy(s, t[0], 8);
      retreat(s, 'elin');
      const e = s.party.chars.elin;
      if (e && !e.downed) { e.bleed = 0; e.weak = 0; }
    },
  },
  'elin.mid.sig.aegis': {
    id: 'elin.mid.sig.aegis', charId: 'elin', slot: 'mid', kind: 'sig',
    name: 'Aegis Bond', desc: 'Heal 8 party · +1 armor party', heal: 8, healTarget: 'all',
    fn: (s) => {
      partyHeal(s, 8);
      aliveParty(s).forEach(c => {
        c.armor += 1;
        fireAdjacencyHook(s, 'onArmorGrant', s.currentActorId, c.id, 1);
      });
    },
  },
  'elin.back.basic.chant': {
    id: 'elin.back.basic.chant', charId: 'elin', slot: 'back', kind: 'basic',
    name: 'Pious Chant', desc: '+1 Resolve · cleanse party',
    fn: (s) => {
      gainResolve(s, 1);
      aliveParty(s).forEach(c => { c.bleed = 0; c.weak = 0; });
    },
  },

  // === Branwen — fills front basic, back sig ===
  'branwen.front.basic.quickdraw': {
    id: 'branwen.front.basic.quickdraw', charId: 'branwen', slot: 'front', kind: 'basic',
    name: 'Quickdraw', desc: '5 dmg + bleed 2 (no retreat)', dmg: 5,
    reach: ['front'], pattern: 'front-most',
    fn: (s, t) => {
      if (t[0]) { applyDmgToEnemy(s, t[0], 5); if (!t[0].dead) t[0].bleed = Math.max(t[0].bleed, 2); }
    },
  },
  'branwen.back.sig.hunters': {
    id: 'branwen.back.sig.hunters', charId: 'branwen', slot: 'back', kind: 'sig',
    name: "Hunter's Mark", desc: '11 dmg lowest + 3 vuln · ignore armor', dmg: 11,
    reach: ['front','mid','back'], pattern: 'lowest',
    fn: (s, t) => {
      if (!t[0]) return;
      s.ignoreArmor = true;
      applyDmgToEnemy(s, t[0], 11);
      s.ignoreArmor = false;
      if (!t[0].dead) t[0].vuln += 3;
    },
  },

  // === Korin — fills front sig, back sig ===
  'korin.front.sig.embrace': {
    id: 'korin.front.sig.embrace', charId: 'korin', slot: 'front', kind: 'sig',
    name: 'Death Embrace', desc: '14 dmg + 4 self-dmg + heal 3 self', dmg: 14,
    reach: ['front'], pattern: 'front-most', heal: 3, healTarget: 'self',
    fn: (s, t) => {
      if (t[0]) applyDmgToEnemy(s, t[0], 14);
      applySelfDmg(s, 'korin', 4);
      const k = s.party.chars.korin;
      if (k && !k.downed) {
        const before = k.hp; k.hp = Math.min(k.maxHp, k.hp + 3);
        const got = k.hp - before;
        if (got > 0) {
          spawnPopupId('korin', `+${got}`, 'heal', 'party');
          if (s.fightStats && s.currentActorId) {
            s.fightStats.healingDone[s.currentActorId] = (s.fightStats.healingDone[s.currentActorId] || 0) + got;
          }
        }
      }
    },
  },
  'korin.back.sig.eternal': {
    id: 'korin.back.sig.eternal', charId: 'korin', slot: 'back', kind: 'sig',
    name: 'Eternal Trance', desc: '+5 retaliate party · +4 armor party',
    fn: (s) => {
      aliveParty(s).forEach(c => {
        c.retaliate += 5;
        c.armor += 4;
        spawnPopupId(c.id, '+4⛨', 'armor', 'party');
        fireAdjacencyHook(s, 'onArmorGrant', s.currentActorId, c.id, 4);
      });
    },
  },

  // === Mira — fills front sig ===
  'mira.front.sig.cyclone': {
    id: 'mira.front.sig.cyclone', charId: 'mira', slot: 'front', kind: 'sig',
    name: 'Blood Cyclone', desc: '6 dmg all + bleed 1 all + retreat full', dmg: 6, move: 'retreatFull',
    reach: ['front','mid','back'], pattern: 'all',
    fn: (s, t) => {
      t.forEach(e => applyDmgToEnemy(s, e, 6));
      t.forEach(e => { if (!e.dead) e.bleed = Math.max(e.bleed, 1); });
      retreatFull(s, 'mira');
    },
  },

  // === Kai — mid home (default starter; covers solo opener) ===
  'kai.mid.basic.flurry': {
    id: 'kai.mid.basic.flurry', charId: 'kai', slot: 'mid', kind: 'basic',
    name: 'Flurry', desc: '4 dmg twice (lowest) + bleed 1 · advance', dmg: 4, hits: 2, move: 'advance',
    reach: ['front','mid'], pattern: 'lowest',
    fn: (s, t) => {
      if (t[0]) {
        applyDmgToEnemy(s, t[0], 4);
        if (!t[0].dead) {
          applyDmgToEnemy(s, t[0], 4);
          if (!t[0].dead) t[0].bleed = Math.max(t[0].bleed, 1);
        }
      }
      advance(s, 'kai');
    },
  },
  'kai.mid.sig.executioner': {
    id: 'kai.mid.sig.executioner', charId: 'kai', slot: 'mid', kind: 'sig',
    name: 'Executioner', desc: '5 dmg twice lowest (+3 each if target ≤ ½ HP)', dmg: 5, hits: 2,
    reach: ['front','mid'], pattern: 'lowest',
    fn: (s, t) => {
      if (!t[0]) return;
      const bonus = (t[0].hp * 2 <= t[0].maxHp) ? 3 : 0;
      applyDmgToEnemy(s, t[0], 5 + bonus);
      if (!t[0].dead) applyDmgToEnemy(s, t[0], 5 + bonus);
    },
  },

  // === Garron — front home (warden/tank) ===
  'garron.front.basic.brace': {
    id: 'garron.front.basic.brace', charId: 'garron', slot: 'front', kind: 'basic',
    name: 'Brace', desc: '4 dmg + self-taunt + 2 self armor', dmg: 4,
    reach: ['front'], pattern: 'front-most',
    fn: (s, t) => {
      if (t[0]) applyDmgToEnemy(s, t[0], 4);
      const g = s.party.chars.garron;
      if (g && !g.downed) { g.taunt = true; addArmor(s, 'garron', 2); }
    },
  },
  'garron.front.sig.aegis': {
    id: 'garron.front.sig.aegis', charId: 'garron', slot: 'front', kind: 'sig',
    name: 'Aegis Wall', desc: 'Party +4⛨ + 1 retaliate party + self-taunt',
    fn: (s) => {
      partyArmor(s, 4);
      aliveParty(s).forEach(c => { c.retaliate += 1; });
      const g = s.party.chars.garron;
      if (g && !g.downed) g.taunt = true;
    },
  },

  // === Lirien — back home (vuln stacker / songbinder) ===
  'lirien.back.basic.dirge': {
    id: 'lirien.back.basic.dirge', charId: 'lirien', slot: 'back', kind: 'basic',
    name: 'Dirge', desc: '1 dmg all + 2 vuln lowest', dmg: 1,
    reach: ['front','mid','back'], pattern: 'all',
    fn: (s, t) => {
      t.forEach(e => applyDmgToEnemy(s, e, 1));
      const lowest = aliveEnemies(s).slice().sort((a, b) => a.hp - b.hp)[0];
      if (lowest) lowest.vuln += 2;
    },
  },
  'lirien.back.sig.requiem': {
    id: 'lirien.back.sig.requiem', charId: 'lirien', slot: 'back', kind: 'sig',
    name: 'Requiem', desc: '2♦ · Vuln 2 all + party +1 atk next attack',
    fn: (s) => {
      aliveEnemies(s).forEach(e => { e.vuln += 2; });
      aliveParty(s).forEach(c => c.pendingEffects.push({ kind: 'attackBonus', amt: 1, source: 'lirien-requiem' }));
    },
  },

  // === Vasha — back home (lightspeaker; AoE + healing) ===
  'vasha.back.basic.dawnsong': {
    id: 'vasha.back.basic.dawnsong', charId: 'vasha', slot: 'back', kind: 'basic',
    name: 'Dawnsong', desc: '2 dmg all + heal 2 lowest', dmg: 2, heal: 2, healTarget: 'lowest',
    reach: ['front','mid','back'], pattern: 'all',
    fn: (s, t) => {
      t.forEach(e => applyDmgToEnemy(s, e, 2));
      healLowest(s, 2);
    },
  },
  'vasha.back.sig.consecration': {
    id: 'vasha.back.sig.consecration', charId: 'vasha', slot: 'back', kind: 'sig',
    name: 'Consecration', desc: '3♦ · 5 dmg all + heal 4 party', cost: 3, dmg: 5, heal: 4, healTarget: 'all',
    reach: ['front','mid','back'], pattern: 'all',
    fn: (s, t) => {
      t.forEach(e => applyDmgToEnemy(s, e, 5));
      partyHeal(s, 4);
    },
  },

  // === Hask — front home (frostling; chain/stagger) ===
  'hask.front.basic.rime': {
    id: 'hask.front.basic.rime', charId: 'hask', slot: 'front', kind: 'basic',
    name: 'Rime Strike', desc: '4 dmg front + chain 8', dmg: 4,
    reach: ['front'], pattern: 'front-most',
    fn: (s, t) => {
      if (t[0]) {
        applyDmgToEnemy(s, t[0], 4);
        if (!t[0].dead && !t[0].staggered) {
          t[0].chain = Math.min(STAGGER_THRESHOLD, t[0].chain + 8);
          if (t[0].chain >= STAGGER_THRESHOLD) triggerStagger(s, t[0]);
        }
      }
    },
  },
  'hask.front.sig.avalanche': {
    id: 'hask.front.sig.avalanche', charId: 'hask', slot: 'front', kind: 'sig',
    name: 'Avalanche', desc: '6 dmg front + chain 14', dmg: 6,
    reach: ['front'], pattern: 'front-most',
    fn: (s, t) => {
      if (t[0]) {
        applyDmgToEnemy(s, t[0], 6);
        if (!t[0].dead && !t[0].staggered) {
          t[0].chain = Math.min(STAGGER_THRESHOLD, t[0].chain + 14);
          if (t[0].chain >= STAGGER_THRESHOLD) triggerStagger(s, t[0]);
        }
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
    // Downed heroes can't learn new techs — they're out of the fight and
    // shouldn't be growing while sidelined.
    if (c.downed) return false;
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
  // === new pool ===
  hunt:       { id: 'hunt',       name: 'Mark of the Hunt',    icon: '➤', category: 'combat',   desc: 'Staggered enemies take +3 damage from every attack.' },
  cinders:    { id: 'cinders',    name: 'Pact of Cinders',     icon: '🜂', category: 'combat',   desc: 'Killing an enemy applies bleed 1 to all remaining enemies.' },
  doom:       { id: 'doom',       name: 'Brand of Doom',       icon: '⊕', category: 'combat',   desc: "Vulnerable stacks aren't consumed by attacks." },
  aegis:      { id: 'aegis',      name: 'Sigil of Aegis',      icon: '◈', category: 'defense',  desc: 'Each incoming hit deals 1 less HP damage after armor.' },
  mercy:      { id: 'mercy',      name: 'Crown of Mercy',      icon: '✚', category: 'defense',  desc: 'When any ally heals, every other ally heals +1.' },
  vigil:      { id: 'vigil',      name: 'Vow of Vigil',        icon: '↻', category: 'defense',  desc: 'Retaliate strikes deal +2 damage.' },
  stillness:  { id: 'stillness',  name: 'Mantra of Stillness', icon: '★', category: 'resource', desc: 'Specials cost 0 Resolve (down from 1).' },
  memory:     { id: 'memory',     name: 'Coin of Memory',      icon: '◆', category: 'resource', desc: 'Carry up to 4 Resolve between fights (instead of 3).' },
  vigor:      { id: 'vigor',      name: 'Pact of Vigor',       icon: '⚡', category: 'resource', desc: 'Killing an enemy refunds 1 ATB this turn.' },
  vowiron:    { id: 'vowiron',    name: 'Vow of Iron',         icon: '⌖', category: 'defense',  desc: 'The Front slot starts each fight with Taunt for the first turn.' },
};

// ============================================================================
// SQUAD SIGILS — composition-based passive bonuses that activate
// automatically when specific heroes walk together.  Not part of the
// random sigil pool; they're discovered by playing certain party comps.
// ============================================================================
const SQUAD_SIGILS = {
  mercyDoubled: {
    id: 'mercyDoubled', name: 'Mercy Doubled', icon: '✚',
    requires: ['cassia', 'elin'],
    desc: 'Party heals deal +1 HP.',
  },
  crimsonPact: {
    id: 'crimsonPact', name: 'Crimson Pact', icon: '✤',
    requires: ['branwen', 'mira'],
    desc: 'Your bleed ticks deal +1 damage.',
  },
  ironWall: {
    id: 'ironWall', name: 'Iron Wall', icon: '⛨',
    requires: ['cassia', 'korin'],
    desc: 'Front slot starts each fight with +2 extra armor.',
  },
  shadowVeil: {
    id: 'shadowVeil', name: 'Shadow Veil', icon: '◐',
    requires: ['mira', 'ash'],
    desc: 'First attack each turn deals +1 (stacks with Arcane Focus).',
  },
  oldEdge: {
    id: 'oldEdge', name: 'Old Edge', icon: '★',
    requires: ['kai', 'cassia', 'elin'],
    desc: '+1 Resolve drip per turn.',
  },
};

function activeSquadSigils(s) {
  if (!s || !s.party || !s.party.chars) return [];
  const partyIds = new Set(Object.keys(s.party.chars).filter(id => s.party.chars[id] && !s.party.chars[id].downed));
  return Object.values(SQUAD_SIGILS).filter(sq =>
    sq.requires.every(id => partyIds.has(id))
  );
}
function hasSquadSigil(s, id) {
  return activeSquadSigils(s).some(sq => sq.id === id);
}

function hasSigil(s, id) {
  return !!(s && s.run && s.run.sigils && s.run.sigils.includes(id));
}

// ============================================================================
// RUN MODIFIERS — biome / weather rolled once per run; one passive effect
// that twists every fight.  Surfaces in the HUD next to the sigil tray.
// ============================================================================
const RUN_MODIFIERS = {
  veiled:    { id: 'veiled',    name: 'Veiled Hour',     desc: 'Enemies start each fight with 1 Vuln.' },
  bonetide:  { id: 'bonetide',  name: 'Bone Tide',       desc: 'Bleed ticks deal +1 damage.' },
  withered:  { id: 'withered',  name: 'Withered Land',   desc: 'All healing is reduced by 1 (min 0).' },
  burning:   { id: 'burning',   name: 'Burning Sky',     desc: 'All combatants lose 1 HP at the start of each turn.' },
  fortified: { id: 'fortified', name: 'Fortified Bones', desc: 'Enemies start each fight with +2 armor.' },
  hunger:    { id: 'hunger',    name: 'Hollow Hunger',   desc: 'Party Front position takes +1 damage taken.' },
};
function rollRunModifier() {
  const pool = Object.values(RUN_MODIFIERS);
  return pool[Math.floor(Math.random() * pool.length)].id;
}
function hasRunModifier(s, id) {
  return !!(s && s.run && s.run.modifier === id);
}
function getRunModifier(s) {
  return s && s.run && s.run.modifier ? RUN_MODIFIERS[s.run.modifier] : null;
}

// ============================================================================
// QUIRKS — Darkest-Dungeon-style affinity modifiers, per character, run-wide.
// Earned from victories; surface in the inspect menu.  Effects stack additively
// and apply at the resolver level (damage / heal / armor).
// ============================================================================
const QUIRK_CAP = 5;
const QUIRKS = {
  // Positive (green)
  precise:   { id: 'precise',   name: 'Precise',     positive: true,  desc: '+1 damage on attacks.',                dmgMod:  1 },
  brutal:    { id: 'brutal',    name: 'Brutal',      positive: true,  desc: '+2 damage on attacks.',                dmgMod:  2 },
  bulwark:   { id: 'bulwark',   name: 'Bulwark',     positive: true,  desc: '+1 armor whenever armor is gained.',   armorMod: 1 },
  gentle:    { id: 'gentle',    name: 'Gentle Hand', positive: true,  desc: '+1 to all healing dealt or received.', healMod:  1 },
  // Negative (red)
  weakened:  { id: 'weakened',  name: 'Weakened',    positive: false, desc: '−1 damage on attacks.',                dmgMod: -1 },
  shaken:    { id: 'shaken',    name: 'Shaken',      positive: false, desc: '−2 damage on attacks.',                dmgMod: -2 },
  brittle:   { id: 'brittle',   name: 'Brittle',     positive: false, desc: '−1 armor whenever armor is gained.',   armorMod: -1 },
  clumsy:    { id: 'clumsy',    name: 'Clumsy',      positive: false, desc: '−1 to all healing dealt or received.', healMod: -1 },
  cursed:    { id: 'cursed',    name: 'Cursed',      positive: false, desc: '−1 damage AND −1 healing.',            dmgMod: -1, healMod: -1 },

  // Hero-specific positive quirks — only roll on the named hero.  Themed
  // to each character's identity so the inspect view feels like a
  // build-arc, not a generic stat sheet.
  banner_bearer: { id: 'banner_bearer', heroId: 'cassia',  name: "Banner Bearer", positive: true, desc: '+1 armor whenever armor is granted (Cassia).',   armorMod: 1 },
  vow_unbroken:  { id: 'vow_unbroken',  heroId: 'elin',    name: 'Vow Unbroken',  positive: true, desc: '+1 healing dealt and received (Elin).',          healMod:  1 },
  bleed_stalker: { id: 'bleed_stalker', heroId: 'branwen', name: 'Bleed Stalker', positive: true, desc: '+1 damage on attacks (Branwen).',                dmgMod:   1 },
  warhardened:   { id: 'warhardened',   heroId: 'korin',   name: 'Warhardened',   positive: true, desc: '+2 damage on attacks (Korin).',                  dmgMod:   2 },
  veil_walker:   { id: 'veil_walker',   heroId: 'ash',     name: 'Veil Walker',   positive: true, desc: '+1 damage and +1 armor gained (Ash).',           dmgMod: 1, armorMod: 1 },
  razor_edge:    { id: 'razor_edge',    heroId: 'mira',    name: "Razor's Edge",  positive: true, desc: '+2 damage on attacks (Mira).',                   dmgMod:   2 },
};

// Read all quirks a character currently has (positive ∪ negative).
function getCharQuirks(s, charId) {
  const c = s && s.party && s.party.chars[charId];
  if (!c || !c.quirks) return [];
  return [...c.quirks.positive, ...c.quirks.negative]
    .map(id => QUIRKS[id])
    .filter(Boolean);
}

// Stat-mod accessors used by the combat resolver.
function getQuirkDmgMod(s, charId)   { return getCharQuirks(s, charId).reduce((a, q) => a + (q.dmgMod   || 0), 0); }
function getQuirkHealMod(s, charId)  { return getCharQuirks(s, charId).reduce((a, q) => a + (q.healMod  || 0), 0); }
function getQuirkArmorMod(s, charId) { return getCharQuirks(s, charId).reduce((a, q) => a + (q.armorMod || 0), 0); }

// Grant a new quirk to a character.  Skips if already at cap or already owned.
// Returns the granted quirk def, or null if no grant happened.
function grantQuirk(s, charId, quirkId) {
  const c = s && s.party && s.party.chars[charId];
  const q = QUIRKS[quirkId];
  if (!c || !q || !c.quirks) return null;
  // Hero-locked quirks refuse anyone but their named owner
  if (q.heroId && q.heroId !== charId) return null;
  const side = q.positive ? 'positive' : 'negative';
  if (c.quirks[side].length >= QUIRK_CAP) return null;
  if (c.quirks.positive.includes(quirkId) || c.quirks.negative.includes(quirkId)) return null;
  c.quirks[side].push(quirkId);
  // Fanfare reveal (skipped during simulation)
  showQuirkAward(charId, quirkId);
  return q;
}

// Per-hero affinity reactions — short barks for the gained/lost fanfare.
// Picked at random when an affinity award fires.  Generic across quirks
// (it's the act of gaining/losing one that matters, not the specific
// quirk) so the line set stays small and each hero has a recognisable
// voice.
const AFFINITY_BARKS = {
  kai:     { gained: ["Sharper now.", "I'll take it.", "Useful."],
             lost:   ["Tch.", "...slipped.", "I'll work without."] },
  cassia:  { gained: ["Earned, then.", "The line strengthens.", "Mark it."],
             lost:   ["A piece given.", "It is the cost.", "The line still holds."] },
  elin:    { gained: ["Steadier.", "Light still finds me.", "I will spend it well."],
             lost:   ["Less to give.", "...I will mend with what's left.", "It will mend back."] },
  branwen: { gained: ["One more arrow in the quiver.", "I'll use it.", "Notch it."],
             lost:   ["Quiver lighter.", "I had too many anyway.", "It happens."] },
  korin:   { gained: ["(He nods, once.)", "Stronger.", "Wall holds."],
             lost:   ["(He grunts, sets his shield.)", "...still standing.", "It will pass."] },
  ash:     { gained: ["...quieter.", "Veil thickens.", "Useful."],
             lost:   ["...thinner.", "Less hidden.", "Tch."] },
  mira:    { gained: ["Sharp.", "I'll cut better.", "Good."],
             lost:   ["Dull.", "Annoying.", "I'll deal."] },
  garron:  { gained: ["The wall is wider.", "Hold the line.", "Good."],
             lost:   ["The wall is thinner.", "Hold anyway.", "...still here."] },
  lirien:  { gained: ["A new note.", "The chord deepens.", "Sing it."],
             lost:   ["A note dropped.", "...the chord thins.", "I will hum without it."] },
  vasha:   { gained: ["Light remembers.", "It shines clearer.", "Marked."],
             lost:   ["Dimmer.", "...the light still finds.", "It will return."] },
  hask:    { gained: ["Colder.", "Sharper.", "Good."],
             lost:   ["Warmer than I want.", "Tch.", "I'll freeze again."] },
};

// Brief full-screen reveal when a hero earns or loses an affinity (quirk).
// Wrapped in a dim backdrop so the focus is the award, not the
// battlefield underneath.  Tap the backdrop to dismiss early; auto-fades
// after a longer hold.  No-ops during simulation.
function showQuirkAward(charId, quirkId) {
  if (typeof __simulating !== 'undefined' && __simulating) return;
  const def = CHARS[charId]; const q = QUIRKS[quirkId];
  if (!def || !q) return;
  const bank = AFFINITY_BARKS[charId];
  const lines = bank && bank[q.positive ? 'gained' : 'lost'];
  const bark = (lines && lines.length) ? lines[Math.floor(Math.random() * lines.length)] : null;
  _showAwardBackdrop({
    cls: q.positive ? 'qa-positive' : 'qa-negative',
    eyebrow: `${q.positive ? '+' : '−'} ${q.positive ? 'AFFINITY GAINED' : 'AFFINITY LOST'}`,
    name: `${def.name} · ${q.name}`,
    desc: q.desc,
    portraitId: charId,
    bark,
  });
}

// Brief full-screen reveal when the player binds a sigil.  Same shape as
// the quirk award so the two read as one family of feedback.
function showSigilAward(sigilId) {
  if (typeof __simulating !== 'undefined' && __simulating) return;
  const sg = SIGILS[sigilId];
  if (!sg) return;
  _showAwardBackdrop({
    cls: `qa-sigil cat-${sg.category || 'resource'}`,
    eyebrow: '+ SIGIL BOUND',
    name: `<span class="qa-glyph">${sg.icon || '◆'}</span>${sg.name}`,
    desc: sg.desc,
  });
}

// Shared award presenter.  Builds the backdrop + centered #quirk-award block,
// wires the dismiss flow (tap anywhere or auto after a hold).  When a
// portraitId + bark are supplied, renders a small hero portrait with a
// chat bubble above the card — same visual register as combat barks.
function _showAwardBackdrop({ cls, eyebrow, name, desc, portraitId, bark }) {
  const old = document.getElementById('quirk-award-backdrop');
  if (old) old.remove();
  const backdrop = document.createElement('div');
  backdrop.id = 'quirk-award-backdrop';
  backdrop.className = 'qa-backdrop';
  const portraitMarkup = (portraitId && PORTRAITS[portraitId])
    ? `<div class="qa-vignette">
         ${bark ? `<div class="qa-bubble">${bark}</div>` : ''}
         <div class="qa-portrait">${PORTRAITS[portraitId]}</div>
       </div>`
    : '';
  backdrop.innerHTML = `
    <div id="quirk-award" class="qa ${cls}">
      ${portraitMarkup}
      <div class="qa-eyebrow">${eyebrow}</div>
      <div class="qa-name">${name}</div>
      <div class="qa-desc">${desc}</div>
    </div>
  `;
  document.body.appendChild(backdrop);
  if (Audio && typeof Audio.ui === 'function') Audio.ui();
  let dismissed = false;
  const dismiss = () => {
    if (dismissed || !backdrop.isConnected) return;
    dismissed = true;
    backdrop.classList.add('qa-out');
    setTimeout(() => { if (backdrop.isConnected) backdrop.remove(); }, 450);
  };
  backdrop.addEventListener('click', dismiss);
  // Hold longer when a vignette portrait is shown so the bark reads.
  setTimeout(dismiss, portraitId ? 3400 : 2600);
}

// Pick a random quirk of a given polarity (positive | negative | any).
function randomQuirk(polarity) {
  const pool = Object.values(QUIRKS).filter(q =>
    polarity === 'positive' ? q.positive
      : polarity === 'negative' ? !q.positive
      : true);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Award a quirk to a random alive party member after a victory.
//   - Elite wins:   100% chance, positive quirk
//   - Normal wins:  40% positive, 25% negative, 35% nothing
//   - Boss wins:    skipped (run-end)
// Skips characters at cap or who already own the rolled quirk; logs the
// grant so the player sees what happened.
function awardQuirkAfterWin(s, completedNode) {
  if (!completedNode || completedNode.type === 'boss') return;
  const aliveIds = Object.values(s.party.chars).filter(c => !c.downed).map(c => c.id);
  if (!aliveIds.length) return;
  let polarity = null;
  if (completedNode.type === 'elite') {
    polarity = 'positive';
  } else {
    const roll = Math.random();
    if (roll < 0.40) polarity = 'positive';
    else if (roll < 0.65) polarity = 'negative';
  }
  if (!polarity) return;
  // Try up to 3 random characters before giving up (handles caps + duplicates)
  for (let attempt = 0; attempt < 3; attempt++) {
    const targetId = aliveIds[Math.floor(Math.random() * aliveIds.length)];
    const c = s.party.chars[targetId];
    if (!c || !c.quirks) continue;
    if (c.quirks[polarity].length >= QUIRK_CAP) continue;
    const taken = new Set([...c.quirks.positive, ...c.quirks.negative]);
    const pool = Object.values(QUIRKS).filter(q =>
      (polarity === 'positive') === !!q.positive
      && !taken.has(q.id)
      && (!q.heroId || q.heroId === targetId));
    if (!pool.length) continue;
    const q = pool[Math.floor(Math.random() * pool.length)];
    grantQuirk(s, targetId, q.id);
    const verb = polarity === 'positive' ? 'gains' : 'is afflicted with';
    log(`<i><b>${CHARS[targetId].name}</b> ${verb} <b>${q.name}</b> — ${q.desc}</i>`);
    return;
  }
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

// ============================================================================
// RESONANCE — Chrono-Trigger-style combo attacks.
// When the queue contains a specific combination of (hero, action-kind)
// items, a Resonance becomes available.  Tapping its chip in the Resonance
// Rail splices those queue items into a single 'combo' item that resolves
// with a louder VFX.  Each combo's `requires` is a list of role tuples;
// matching consumes one queue item per role.
// ============================================================================
// Combos exchange total damage for a different SHAPE.  Each is balanced so
// the individual actions remain viable: fusing trades raw output for
// utility (armor strip, AoE pressure, defensive setup, healing).  Players
// should sometimes choose NOT to fuse — that's the whole point.
const COMBOS = {
  // ---- Duos ----
  banner_volley: {
    id: 'banner_volley', name: 'Banner Volley', tier: 'duo',
    desc: 'Strip front armor · AoE bleed 2 (less raw dmg, more pressure)',
    requires: [
      { heroId: 'cassia', kind: 'attack' },
      { heroId: 'branwen', kind: 'attack' },
    ],
    fn: (s) => {
      const front = enemyBySlot(s, 'front');
      if (front && !front.dead) { front.armor = 0; applyDmgToEnemy(s, front, 4); }
      aliveEnemies(s).forEach(e => e.bleed = Math.max(e.bleed, 2));
    },
  },
  twin_strike: {
    id: 'twin_strike', name: 'Twin Strike', tier: 'duo',
    desc: 'Focus fire — two heavy hits on lowest-HP target (single target)',
    requires: [
      { heroId: 'branwen', kind: 'attack' },
      { heroId: 'mira', kind: 'attack' },
    ],
    fn: (s) => {
      const t = aliveEnemies(s).slice().sort((a, b) => a.hp - b.hp)[0];
      if (t) { applyDmgToEnemy(s, t, 6); if (!t.dead) { applyDmgToEnemy(s, t, 6); if (!t.dead) t.bleed = Math.max(t.bleed, 2); } }
    },
  },
  crossblade_dance: {
    id: 'crossblade_dance', name: 'Crossblade Dance', tier: 'duo',
    desc: 'Stack bleed deep on the front-most (small chip, large bleed)',
    requires: [
      { heroId: 'kai', kind: 'attack' },
      { heroId: 'mira', kind: 'attack' },
    ],
    fn: (s) => {
      const front = enemyBySlot(s, 'front');
      if (front && !front.dead) {
        for (let i = 0; i < 3; i++) { if (!front.dead) applyDmgToEnemy(s, front, 3); }
        if (!front.dead) front.bleed = Math.max(front.bleed, 4);
      }
    },
  },
  wall_charge: {
    id: 'wall_charge', name: 'Wall Charge', tier: 'duo',
    desc: 'Trade dmg for full defensive setup (Korin taunt + retal + party armor)',
    requires: [
      { heroId: 'cassia', kind: 'attack' },
      { heroId: 'korin', kind: 'attack' },
    ],
    fn: (s) => {
      const front = enemyBySlot(s, 'front');
      if (front && !front.dead) applyDmgToEnemy(s, front, 6);
      const k = s.party.chars.korin;
      if (k && !k.downed) { k.taunt = true; k.retaliate = 3; k.armor += 4; }
      aliveParty(s).forEach(c => { if (c.id !== 'korin') c.armor += 2; });
    },
  },
  quiet_volley: {
    id: 'quiet_volley', name: 'Quiet Volley', tier: 'duo',
    desc: 'Spread bleed across all enemies + buff party for next turn',
    requires: [
      { heroId: 'ash', kind: 'attack' },
      { heroId: 'branwen', kind: 'attack' },
    ],
    fn: (s) => {
      dmgAllEnemies(s, 3);
      aliveEnemies(s).forEach(e => e.bleed = Math.max(e.bleed, 2));
      aliveParty(s).forEach(c => c.pendingEffects.push({ kind: 'attackBonus', amt: 1, source: 'quiet_volley' }));
    },
  },
  hush_of_blades: {
    id: 'hush_of_blades', name: 'Hush of Blades', tier: 'duo',
    desc: 'AoE chip + set up the lowest-HP ally for a big next turn',
    requires: [
      { heroId: 'ash', kind: 'attack' },
      { heroId: 'mira', kind: 'attack' },
    ],
    fn: (s) => {
      dmgAllEnemies(s, 2);
      aliveEnemies(s).forEach(e => e.bleed = Math.max(e.bleed, 1));
      const t = aliveParty(s).slice().sort((a,b) => a.hp - b.hp)[0];
      if (t) t.pendingEffects.push({ kind: 'attackBonus', amt: 3, source: 'hush' });
    },
  },
  sister_mend: {
    id: 'sister_mend', name: "Sister's Mend", tier: 'duo',
    desc: 'No damage — heal party 6 + +4⛨ all + cleanse',
    requires: [
      { heroId: 'cassia', kind: 'attack' },
      { heroId: 'elin', kind: 'attack' },
    ],
    fn: (s) => {
      aliveParty(s).forEach(c => {
        const b = c.hp; c.hp = Math.min(c.maxHp, c.hp + 6);
        if (c.hp > b) spawnPopupId(c.id, `+${c.hp - b}`, 'heal', 'party');
        c.armor += 4; c.bleed = 0; c.weak = 0;
      });
    },
  },
  veiled_flame: {
    id: 'veiled_flame', name: 'Veiled Flame', tier: 'duo',
    desc: 'Hybrid — light AoE + heal lowest ally to full (or +8)',
    requires: [
      { heroId: 'ash', kind: 'attack' },
      { heroId: 'elin', kind: 'attack' },
    ],
    fn: (s) => {
      dmgAllEnemies(s, 3);
      const t = aliveParty(s).slice().sort((a,b) => a.hp - b.hp)[0];
      if (t) {
        const b = t.hp; t.hp = Math.min(t.maxHp, t.hp + 8);
        if (t.hp > b) spawnPopupId(t.id, `+${t.hp - b}`, 'heal', 'party');
      }
    },
  },
  // ---- Triples ----
  sacred_triad: {
    id: 'sacred_triad', name: 'Sacred Triad', tier: 'triple',
    desc: 'AoE 6 + cleanse + heal all 6 + party +2⛨',
    requires: [
      { heroId: 'cassia', kind: 'attack' },
      { heroId: 'elin', kind: 'attack' },
      { heroId: 'branwen', kind: 'attack' },
    ],
    fn: (s) => {
      dmgAllEnemies(s, 6);
      aliveParty(s).forEach(c => {
        const b = c.hp; c.hp = Math.min(c.maxHp, c.hp + 6);
        if (c.hp > b) spawnPopupId(c.id, `+${c.hp - b}`, 'heal', 'party');
        c.bleed = 0; c.weak = 0; c.armor += 2;
      });
    },
  },
  three_blades: {
    id: 'three_blades', name: 'Three Blades', tier: 'triple',
    desc: 'AoE 4 + bleed 4 all (long pressure, less burst)',
    requires: [
      { heroId: 'kai', kind: 'attack' },
      { heroId: 'mira', kind: 'attack' },
      { heroId: 'branwen', kind: 'attack' },
    ],
    fn: (s) => {
      dmgAllEnemies(s, 4);
      aliveEnemies(s).forEach(e => e.bleed = Math.max(e.bleed, 4));
      gainResolve(s, 1);
    },
  },
  front_phalanx: {
    id: 'front_phalanx', name: 'Front Phalanx', tier: 'triple',
    desc: '9 dmg front + party +5⛨ + cleanse (trade burst for defense)',
    requires: [
      { heroId: 'cassia', kind: 'attack' },
      { heroId: 'korin', kind: 'attack' },
      { heroId: 'mira', kind: 'attack' },
    ],
    fn: (s) => {
      const front = enemyBySlot(s, 'front');
      if (front && !front.dead) applyDmgToEnemy(s, front, 9);
      aliveParty(s).forEach(c => { c.armor += 5; c.bleed = 0; c.weak = 0; });
    },
  },

  // ---- Sig-tier ----
  // Combos built from queued SPECIALS (kind: 'sig').  Gated naturally by
  // Resolve cost — specials don't queue without economy — so these are
  // slower, rarer, and showier than attack-tier resonance.
  hallowed_cleave: {
    id: 'hallowed_cleave', name: 'Hallowed Cleave', tier: 'duo', sigTier: true,
    desc: 'Sunder + Greater Mend — strip front armor · party heal 8 + cleanse · +2⛨ all',
    requires: [
      { heroId: 'cassia', kind: 'sig' },
      { heroId: 'elin',   kind: 'sig' },
    ],
    fn: (s) => {
      const front = enemyBySlot(s, 'front');
      if (front && !front.dead) { front.armor = 0; applyDmgToEnemy(s, front, 6); front.vuln = Math.max(front.vuln, 2); }
      aliveParty(s).forEach(c => {
        const b = c.hp; c.hp = Math.min(c.maxHp, c.hp + 8);
        if (c.hp > b) spawnPopupId(c.id, `+${c.hp - b}`, 'heal', 'party');
        c.armor += 2; c.bleed = 0; c.weak = 0;
      });
    },
  },
  phantom_crescent: {
    id: 'phantom_crescent', name: 'Phantom Crescent', tier: 'duo', sigTier: true,
    desc: 'Vanish Strike + Twin Daggers — 5 dmg ×3 on lowest (ignore armor) · bleed 3 all',
    requires: [
      { heroId: 'mira', kind: 'sig' },
      { heroId: 'ash',  kind: 'sig' },
    ],
    fn: (s) => {
      const t = aliveEnemies(s).slice().sort((a, b) => a.hp - b.hp)[0];
      if (t) {
        const wasIgnore = s.ignoreArmor;
        s.ignoreArmor = true;
        for (let i = 0; i < 3; i++) { if (t && !t.dead) applyDmgToEnemy(s, t, 5); }
        s.ignoreArmor = wasIgnore;
      }
      aliveEnemies(s).forEach(e => e.bleed = Math.max(e.bleed, 3));
    },
  },
  stormwall: {
    id: 'stormwall', name: 'Stormwall', tier: 'duo', sigTier: true,
    desc: 'Battle Trance + Sunder — 8 dmg front + strip · Korin taunt + retal 4 · party +4⛨',
    requires: [
      { heroId: 'korin',  kind: 'sig' },
      { heroId: 'cassia', kind: 'sig' },
    ],
    fn: (s) => {
      const front = enemyBySlot(s, 'front');
      if (front && !front.dead) { front.armor = 0; applyDmgToEnemy(s, front, 8); front.vuln = Math.max(front.vuln, 2); }
      const k = s.party.chars.korin;
      if (k && !k.downed) { k.taunt = true; k.retaliate += 4; }
      aliveParty(s).forEach(c => { c.armor += 4; });
    },
  },
  wakeling_volley: {
    id: 'wakeling_volley', name: 'Wakeling Volley', tier: 'duo', sigTier: true,
    desc: 'Arrow Storm + Riposte — 7 dmg all + bleed 3 all · +1 Resolve banked',
    requires: [
      { heroId: 'branwen', kind: 'sig' },
      { heroId: 'kai',     kind: 'sig' },
    ],
    fn: (s) => {
      dmgAllEnemies(s, 7);
      aliveEnemies(s).forEach(e => e.bleed = Math.max(e.bleed, 3));
      gainResolve(s, 1);
    },
  },
  sacred_wakening: {
    id: 'sacred_wakening', name: 'Sacred Wakening', tier: 'triple', sigTier: true,
    desc: '10 AoE + cleanse · party to full HP · +2 Resolve banked',
    requires: [
      { heroId: 'cassia',  kind: 'sig' },
      { heroId: 'elin',    kind: 'sig' },
      { heroId: 'branwen', kind: 'sig' },
    ],
    fn: (s) => {
      dmgAllEnemies(s, 10);
      aliveParty(s).forEach(c => {
        const b = c.hp; c.hp = c.maxHp;
        if (c.hp > b) spawnPopupId(c.id, `+${c.hp - b}`, 'heal', 'party');
        c.bleed = 0; c.weak = 0;
      });
      gainResolve(s, 2);
    },
  },
};

// Find which combos can be assembled from the current queue.  Returns each
// matching combo together with the queue indices that satisfy each role
// (so commitCombo can splice them out).
function matchingCombos(queue) {
  const spent = (state && state.usedCombos) || new Set();
  return Object.values(COMBOS).map(combo => {
    // Resonance is once-per-encounter — a fired combo is locked out for the
    // rest of the fight, even if the queue could assemble it again.
    if (spent.has(combo.id)) return null;
    const used = new Set();
    const indices = [];
    const ok = combo.requires.every(req => {
      const idx = queue.findIndex((q, i) =>
        !used.has(i) && q.charId === req.heroId && q.kind === req.kind);
      if (idx < 0) return false;
      used.add(idx);
      indices.push(idx);
      return true;
    });
    return ok ? { combo, indices } : null;
  }).filter(Boolean);
}

// Returns combos that are ONE action away from completion — the queue
// satisfies N-1 of the requires, and the missing hero is alive and not the
// already-spent one.  Each entry: { combo, missing: { heroId, kind } }.
// Used by the Resonance Rail to show near-misses so players can SEE the
// path to a combo as they build the queue.
function partialCombos(queue) {
  const spent = (state && state.usedCombos) || new Set();
  const completed = matchingCombos(queue).map(m => m.combo.id);
  const seen = new Set();
  const out = [];
  Object.values(COMBOS).forEach(combo => {
    if (spent.has(combo.id)) return;
    if (completed.includes(combo.id)) return;
    for (let i = 0; i < combo.requires.length; i++) {
      const missing = combo.requires[i];
      const remaining = combo.requires.filter((_, idx) => idx !== i);
      const used = new Set();
      const ok = remaining.every(r => {
        const qi = queue.findIndex((q, j) =>
          !used.has(j) && q.charId === r.heroId && q.kind === r.kind);
        if (qi < 0) return false;
        used.add(qi);
        return true;
      });
      if (!ok) continue;
      const heroDef = state.party.chars[missing.heroId];
      if (!heroDef || heroDef.downed) continue;
      const key = `${combo.id}:${missing.heroId}:${missing.kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ combo, missing });
      break; // only one missing-slot suggestion per combo
    }
  });
  return out;
}

function commitCombo(comboId) {
  const s = state;
  if (s.executing || s.over) return;
  const match = matchingCombos(s.queue).find(m => m.combo.id === comboId);
  if (!match) return;
  // Sum the costs of the consumed items so the combo is cost-neutral.
  let atbTotal = 0, resolveTotal = 0;
  match.indices.forEach(i => {
    atbTotal += s.queue[i].atb || 0;
    resolveTotal += s.queue[i].resolveCost || 0;
  });
  // Splice out the matched indices in descending order so earlier indices stay valid.
  const drop = match.indices.slice().sort((a, b) => b - a);
  drop.forEach(i => s.queue.splice(i, 1));
  // Push the combo item.  It cost-neutrally replaces the inputs.
  s.queue.push({
    kind: 'combo',
    comboId,
    label: match.combo.name,
    desc: match.combo.desc,
    atb: atbTotal,
    resolveCost: resolveTotal,
  });
  // Lock the combo for the rest of the encounter — first echo lands, no
  // second echo.  Forces variety across turns.
  if (!s.usedCombos) s.usedCombos = new Set();
  s.usedCombos.add(comboId);
  Audio.ui();
  render();
}

function getSpecialCost(s, tech) {
  // Mantra of Stillness drops Specials to 0 Resolve regardless of base cost
  if (hasSigil(s, 'stillness')) return 0;
  // Per-tech cost override — sigs can declare `cost: 1 | 2 | 3` for variety.
  // Cheap sigs are utility/support; expensive sigs are the showy payoffs.
  if (tech && typeof tech.cost === 'number') return tech.cost;
  return SPECIAL_COST;
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
  // --- Friction pairs ---
  // Cassia + Mira — knight vs shadow: their styles cut against each other.
  'cassia+mira': {
    fm: {
      name: 'Hollow Vow', type: 'friction',
      // Cassia attacking from front while Mira is mid loses 1 dmg.
      dmgMod: -1, dmgModFor: 'cassia',
    },
    mb: {
      name: 'Stained Banner', type: 'friction',
      // Mira attacking from mid while Cassia is back loses 1 dmg.
      dmgMod: -1, dmgModFor: 'mira',
    },
  },
  // Korin + Mira — paladin vs cutpurse: oil and water.
  'korin+mira': {
    fm: {
      name: 'Crossed Oaths', type: 'friction',
      dmgMod: -1, dmgModFor: 'korin',
    },
  },
  // Ash + Branwen — both range styles; they crowd each other.
  'ash+branwen': {
    mb: {
      name: 'Tangled Sight', type: 'friction',
      dmgMod: -1, dmgModFor: 'branwen',
    },
  },
};

// ============================================================================
// STATE
// ============================================================================

let state;

// Meta-progression: heroes the player has walked with become available as
// future starters.  Kai is the default starter (the one who awakens in
// the Abyss).  Everyone else is unlocked by recruiting them in a run.
const UNLOCKED_KEY = 'kizuna.unlockedStarters';
const DEFAULT_STARTERS = ['kai'];
function getUnlockedStarters() {
  try {
    const raw = localStorage.getItem(UNLOCKED_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr.filter(id => ROSTER.includes(id));
    }
  } catch (_) {}
  return DEFAULT_STARTERS.slice();
}
function unlockStarter(id) {
  if (!ROSTER.includes(id)) return false;
  const cur = getUnlockedStarters();
  if (cur.includes(id)) return false;
  cur.push(id);
  try { localStorage.setItem(UNLOCKED_KEY, JSON.stringify(cur)); } catch (_) {}
  return true; // signal "newly unlocked"
}
// Heroes whose kit can carry a solo run.  Healers and party-buff specialists
// (Elin) can be RECRUITED but never roll as the solo starter — without a
// front-liner to keep alive, their kit has nothing to do.
const SOLO_VIABLE = new Set(['kai', 'cassia', 'korin', 'branwen', 'mira', 'ash', 'garron', 'lirien', 'vasha', 'hask']);
function _pickStarter() {
  const pool = getUnlockedStarters().filter(id => SOLO_VIABLE.has(id));
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : 'kai';
}
// Called whenever a recruit successfully joins — walking with someone
// unlocks them as a future starter.  Returns true if this is the first
// time they've been unlocked.
function rememberRecruited(id) { return unlockStarter(id); }

function newState(forcedStarter) {
  // Solo start — the player awakens at the bottom of the Abyss with one
  // hero.  Companions are met along the way and asked into the party.
  // Unlocked starter pool is meta-progression: heroes the player has
  // walked with in past runs become available as starters.
  const startSolo = (forcedStarter && CHARS[forcedStarter]) ? forcedStarter : _pickStarter();

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
      currentNodeId: null,   // id of the node player is currently fighting (or null between fights)
      completedNodes: [],    // ids of cleared map nodes, in completion order
      currentEnc: null,      // spec of the active encounter (set by startEncounter)
      sigils: [],            // ids of acquired sigils (run-wide modifiers)
      lastVictoryElite: false, // did the most recent victory come from an elite encounter? (gates sigil reward size)
      layer: getCurrentLayer(),     // which Abyss layer this run is climbing
      map: generateMap(),    // freshly generated branching graph for this run
      modifier: rollRunModifier(), // biome modifier — passive effect for the whole run
      stats: { damageDealt: {}, damageTaken: {}, healingDone: {}, kills: 0, synergies: [], turns: 0, reaches: 0 },
      rumoredHeroes: [],     // hero ids heard about in prior vignettes — recruit picker prefers these
      nodesSinceRecruit: 0,  // cleared-node counter gating how often recruit rolls fire
      recruitPending: false, // set when a hero falls — next recruit roll is forced (Vigil for the fallen)
    },

    // Solo start: starter goes in their HOME slot; the other two slots are empty.
    // Companions met along the path fill the remaining slots.
    party: (() => {
      // Carried party from a previous layer's win takes precedence — the
      // same team climbs together, with HP / quirks / upgrades intact.
      const carried = consumeCarriedParty();
      if (carried && carried.chars && carried.chars.length) {
        const chars = {};
        carried.chars.forEach(c => {
          const fresh = newCharState(c.id);
          // Restore persistent run-level state
          fresh.maxHp   = c.maxHp || fresh.maxHp;
          fresh.hp      = Math.max(1, Math.min(fresh.maxHp, c.hp || fresh.maxHp));
          fresh.quirks  = c.quirks || fresh.quirks;
          fresh.upgrades= c.upgrades || {};
          chars[c.id] = fresh;
        });
        return { slots: carried.slots || {}, chars };
      }
      const home = CHARS[startSolo].home;
      const slots = { front: null, mid: null, back: null };
      slots[home] = startSolo;
      return { slots, chars: { [startSolo]: newCharState(startSolo) } };
    })(),

    // populated by startEncounter — set when the player picks an entry node
    enemies: { slots: {}, chars: {} },

    messages: [],
  };
}

// Begin (or restart on a new slot) a fight. Resets per-fight state but preserves
// run-level state: HP, downed status, pendingEffects, run.slotIdx, run.completed.
// Resolve is preserved up to RESOLVE_CARRY_CAP between fights (not capped on the very first fight).
// Takes an encounter SPEC ({ name, slots, elite?, sigilCategory?, boss? }).
// Map nodes carry their own freshly-generated spec; the boss enc is also
// a spec (built by genBossEncounter).
function startEncounter(encSpec) {
  if (!encSpec || !encSpec.slots) return;
  const isFirstFight = !state.run.currentEnc;
  applyBiomeBackground();
  // Boss flag drives full-width visual + dramatic HP bar
  if (encSpec.boss) document.body.classList.add('boss-fight');
  else              document.body.classList.remove('boss-fight');

  // reset per-fight party statuses; keep hp, downed, pendingEffects
  Object.values(state.party.chars).forEach(c => {
    c.armor = 0;
    c.bleed = 0;
    c.weak = 0;
    c.vuln = 0;
    c.taunt = false;
    c.retaliate = 0;
  });

  // rebuild enemies fresh from the encounter spec
  state.enemies.slots = { ...encSpec.slots };
  state.enemies.chars = {};
  SLOTS.forEach(sl => {
    const id = encSpec.slots[sl];
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
  // Encounter objective (Ringleader / etc) — copied off the encSpec so the
  // checkEnd hook can resolve early-win conditions and the UI can render
  // the objective banner.  Cleared if the encSpec doesn't carry one.
  state.run.objective = encSpec.objective ? { ...encSpec.objective, fired: false } : null;
  // Each Resonance can fire at most once per encounter — keeps the moment
  // special and forces players to mix combos across turns instead of
  // spamming the same chain.  Reset every encounter, persisted across the
  // save snapshot.
  state.usedCombos = new Set();
  state.fightStats = { damageDealt: {}, damageTaken: {}, healingDone: {}, kills: 0, synergies: [], turns: 0 };
  state.run.currentEnc = encSpec;

  // Apply biome modifier seasoning to fresh enemies
  if (hasRunModifier(state, 'veiled'))    Object.values(state.enemies.chars).forEach(e => { e.vuln += 1; });
  if (hasRunModifier(state, 'fortified')) Object.values(state.enemies.chars).forEach(e => { e.armor += 2; });

  if (!isFirstFight) {
    const cap = RESOLVE_CARRY_CAP + (hasSigil(state, 'memory') ? 1 : 0);
    state.resolve = Math.min(cap, state.resolve);
  }
  // Crown of Patience — start every fight with at least 2 Resolve
  if (hasSigil(state, 'patience')) state.resolve = Math.max(state.resolve, 2);
  // Sigil of Steel — start each fight with +2 armor on each party member
  if (hasSigil(state, 'steel')) {
    Object.values(state.party.chars).forEach(c => { if (!c.downed) c.armor += 2; });
  }
  // Squad Sigil — Iron Wall (Cassia + Korin together) — front slot wakes
  // each fight with +2 extra armor on top of any other source.
  if (hasSquadSigil(state, 'ironWall')) {
    const frontId = state.party.slots.front;
    const front = frontId && state.party.chars[frontId];
    if (front && !front.downed) front.armor += 2;
  }
  // Vow of Iron — front slot wakes the fight with Taunt for turn 1.  The
  // startTurn cleanup runs AFTER this, so we set the taunt to survive the
  // first cycle by deferring via a flag and re-applying inside startTurn.
  if (hasSigil(state, 'vowiron')) {
    state._vowIronPending = true;
  }

  startTurn(state);
  // First-encounter tutorial kicks in after the battlefield has rendered.
  if (isFirstFight && !tutorialSeen()) setTimeout(maybeShowTutorial, 600);
}

function newCharState(id) {
  const def = CHARS[id];
  return {
    id, hp: def.maxHp, maxHp: def.maxHp,
    armor: 0, bleed: 0, weak: 0, taunt: false, retaliate: 0, vuln: 0,
    downed: false,
    pendingEffects: [], // { kind: 'attackBonus'|'healBonus', amt, source } — consumed on use
    upgrades: {},       // map of `${slot}.${kind}` → upgrade id (persists across fights within a run)
    // Darkest-Dungeon-style affinity quirks — persistent run-wide modifiers.
    // Earned from victories; positive quirks buff combat output, negative
    // quirks penalize.  Capped at QUIRK_CAP per side.
    quirks: { positive: [], negative: [] },
  };
}
function newEnemyState(id) {
  const def = ENEMIES[id];
  // Layer-scaled HP — Layer 2+ enemies are slightly tougher per LAYER_CONTENT.
  const bonus = (typeof state !== 'undefined' && state && state.run && LAYER_CONTENT[state.run.layer])
    ? (def.boss ? LAYER_CONTENT[state.run.layer].hpBonus * 4 : LAYER_CONTENT[state.run.layer].hpBonus)
    : 0;
  const mhp = def.maxHp + bonus;
  return {
    id, hp: mhp, maxHp: mhp,
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
  // Affinity quirks
  amt += getQuirkDmgMod(s, actorId);
  if (actorId === 'kai' && Object.keys(s.party.chars).length === 1) amt += 2;
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
    if (hasSigil(s, 'hunt')) amt += 3;
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
// Mirrors applyDmgToParty's modifier stack (Cassia Steadfast, vuln, armor,
// Sigil of Aegis) without mutating state. opts.armor / opts.vuln override
// current state so the caller can simulate sequential hits within a turn.
function previewIncomingDmg(s, c, baseAmt, opts) {
  if (!c || c.downed || !(baseAmt > 0)) return { amt: 0, toHp: 0 };
  let amt = baseAmt;
  if (c.id === 'cassia' && slotOfChar(s, 'cassia') === 'front') amt = Math.max(0, amt - 1);
  const vuln = (opts && typeof opts.vuln === 'number') ? opts.vuln : c.vuln;
  if (vuln > 0 && amt > 0) amt += 2;
  const baseArmor = (opts && typeof opts.armor === 'number') ? opts.armor : c.armor;
  const effArmor = (opts && opts.stripArmor) ? 0 : baseArmor;
  const absorbed = Math.min(effArmor, amt);
  let toHp = Math.max(0, amt - absorbed);
  if (hasSigil(s, 'aegis') && toHp > 0) toHp = Math.max(0, toHp - 1);
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
  // Affinity quirks — run-wide per-character damage modifier
  amt += getQuirkDmgMod(s, s.currentActorId);
  // Kai's Lone Walker — +2 dmg when alone in the abyss (solo party)
  if (s.currentActorId === 'kai' && Object.keys(s.party.chars).length === 1) { amt += 2; spawnPassivePopup('kai', 'LONE WALKER'); }
  // Branwen Bleed Hunter passive
  if (s.currentActorId === 'branwen' && e.bleed > 0) { amt += 2; spawnPassivePopup('branwen', 'BLEED HUNTER'); }
  // Mira Eviscerate passive — bigger crit on bleeding enemies
  if (s.currentActorId === 'mira' && e.bleed > 0) { amt += 3; spawnPassivePopup('mira', 'EVISCERATE'); }
  // Korin Bloodlust passive — scaling damage based on missing HP %
  if (s.currentActorId === 'korin') {
    const k = s.party.chars.korin;
    if (k) {
      const missingPct = (k.maxHp - k.hp) / k.maxHp;
      if (missingPct >= 0.6)      { amt += 4; spawnPassivePopup('korin', 'BLOODLUST'); }
      else if (missingPct >= 0.3) { amt += 2; spawnPassivePopup('korin', 'BLOODLUST'); }
    }
  }
  // Ash Arcane Focus passive — first attack each turn deals +2
  if (s.currentActorId === 'ash') {
    const a = s.party.chars.ash;
    if (a && !a.firstAttackUsed) {
      amt += 2;
      a.firstAttackUsed = true;
      spawnPassivePopup('ash', 'ARCANE FOCUS');
    }
  }
  // Squad Sigil — Shadow Veil (Mira + Ash together) — every party member's
  // first attack each turn deals +1 (stacks with Ash's Arcane Focus on her
  // own opener).  Per-character: each hero's first hit gets the bonus.
  if (hasSquadSigil(s, 'shadowVeil') && s.currentActorId) {
    const c = s.party.chars[s.currentActorId];
    if (c && !c.shadowVeilUsed) {
      amt += 1;
      c.shadowVeilUsed = true;
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
      // press-turn loop: weakness hit banks +1 ATB for next turn (capped at +1)
      s.pendingBonusAtb = Math.min(1, (s.pendingBonusAtb || 0) + 1);
    } else if (resists.includes(actorDef.school)) {
      amt = Math.max(1, Math.floor(amt * 0.5));
      schoolBadge = 'RESIST';
    }
  }

  // staggered = +50% damage taken, plus +3 flat from Mark of the Hunt sigil
  if (e.staggered && amt > 0) {
    amt = Math.floor(amt * STAGGER_DMG_MULT);
    if (hasSigil(s, 'hunt')) amt += 3;
  }

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
  // Brand of Doom — vuln stacks aren't consumed by attacks
  if (vulnConsumed && !hasSigil(s, 'doom')) e.vuln = Math.max(0, e.vuln - 1);

  // chain build-up (skipped if already staggered or no HP damage)
  if (!e.staggered && toHp > 0) {
    let chainGain = toHp;
    if (vulnConsumed) chainGain *= 2;
    e.chain = Math.min(STAGGER_THRESHOLD, e.chain + chainGain);
    if (e.chain >= STAGGER_THRESHOLD) triggerStagger(s, e);
  }

  // Lirien Lingering Note passive — her first attack each turn applies
  // vuln 1 to whichever target she hit.  Fires after the damage lands so
  // it stacks on for the NEXT incoming hit, not this one.
  if (s.currentActorId === 'lirien' && !e.dead) {
    const lir = s.party.chars.lirien;
    if (lir && !lir.lingeringUsed) {
      e.vuln += 1;
      lir.lingeringUsed = true;
      spawnPassivePopup('lirien', 'LINGERING NOTE');
    }
  }
  // Vasha Litany passive — every time she damages an enemy, the lowest-HP
  // ally heals 1.  Light triage that ticks alongside her offence.  Skips
  // when no allies need a heal or when she herself is the only target.
  if (s.currentActorId === 'vasha' && toHp > 0) {
    const ally = aliveParty(s).slice().sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
    if (ally && ally.hp < ally.maxHp) {
      const before = ally.hp;
      ally.hp = Math.min(ally.maxHp, ally.hp + 1);
      if (ally.hp > before) {
        spawnPopupId(ally.id, `+${ally.hp - before}`, 'heal', 'party');
        spawnPassivePopup('vasha', 'LITANY');
      }
    }
  }

  const popupType = e.staggered ? 'crit' : (schoolBadge === 'WEAK!' ? 'crit' : 'dmg');
  spawnPopupId(e.id, `-${toHp}`, popupType, 'enemy');
  if (schoolBadge) {
    setTimeout(() => spawnPopupId(e.id, schoolBadge, schoolBadge === 'WEAK!' ? 'crit' : 'miss', 'enemy'), 80);
  }
  flashCardId(e.id, 'hit', 'enemy');
  // Game feel: shake the struck card; screen shake on big hits; SFX
  shakeCardId(e.id, 'enemy', toHp);
  if (toHp >= 6) shakeScreen(toHp >= 10 ? 3 : 2);
  // Per-school hit colour: physical thud, stealth hiss, ranged twang,
  // arcane chime, holy bell.
  const actorSchool = s.currentActorId && CHARS[s.currentActorId] && CHARS[s.currentActorId].school;
  Audio.hitSchool(Math.min(2, 0.6 + toHp / 8), actorSchool);
  // Attacker lunges toward the target for a beat
  if (s.currentActorId) lungeCardId(s.currentActorId, 'party');
  log(`<b>${ENEMIES[e.id].name}</b> takes ${toHp} damage${e.staggered ? ' (stagger!)' : ''}${schoolBadge ? ` — ${schoolBadge.toLowerCase()}` : ''}.`);
  if (s.currentActorId && toHp > 0) fireAdjacencyHook(s, 'onAttack', s.currentActorId, e, toHp);
  if (s.fightStats && s.currentActorId && toHp > 0) {
    s.fightStats.damageDealt[s.currentActorId] = (s.fightStats.damageDealt[s.currentActorId] || 0) + toHp;
  }
  if (e.hp === 0) { hitPause(120); killEnemy(s, e); }
}

function triggerStagger(s, e) {
  e.staggered = true;
  e.staggerTurns = STAGGER_DURATION;
  spawnPopupId(e.id, 'STAGGER', 'stagger', 'enemy');
  flashCardId(e.id, 'hit', 'enemy');
  log(`<b>${ENEMIES[e.id].name}</b> is STAGGERED!`);
  // Hask Shatter passive — every stagger while he's alive grants +1 Resolve.
  // Rewards his chain-building kit AND parties that lean into stagger
  // (Frostball, Mark of the Hunt, etc) when Hask is on the bench.
  const h = s && s.party && s.party.chars && s.party.chars.hask;
  if (h && !h.downed) {
    gainResolve(s, 1);
    spawnPassivePopup('hask', 'SHATTER');
  }
}

function killEnemy(s, e) {
  e.dead = true;
  log(`<b>${ENEMIES[e.id].name}</b> falls.`);
  Audio.kill();
  shakeScreen(2);
  // Boss death is climactic — slow time + screen flash, hold the moment
  // before the run-summary cascade fires.
  if (ENEMIES[e.id] && ENEMIES[e.id].boss) {
    shakeScreen(3);
    playBossDeath();
  }
  gainResolve(s, KILL_RESOLVE + (hasSigil(s, 'reaver') ? 1 : 0));
  if (s.fightStats) {
    s.fightStats.kills += 1;
    // Per-actor kill tally for vignette triggers (who got the killing blow)
    if (s.currentActorId) {
      s.fightStats.killsBy = s.fightStats.killsBy || {};
      s.fightStats.killsBy[s.currentActorId] = (s.fightStats.killsBy[s.currentActorId] || 0) + 1;
    }
  }
  // Kai's Adept — heal 2 on kill (was 1; bumped to make solo runs survivable)
  if (s.currentActorId === 'kai') {
    const k = s.party.chars.kai;
    if (k && !k.downed) {
      const before = k.hp;
      k.hp = Math.min(k.maxHp, k.hp + 2);
      if (k.hp > before) {
        spawnPopupId('kai', `+${k.hp - before}`, 'heal', 'party');
        spawnPassivePopup('kai', 'ADEPT');
      }
    }
  }
  // Branwen's Bleed Hunter — heal 1 on a bleeding kill, once per turn.  Gives
  // her solo runs a small life-steal feedback loop tied to her core kit.
  if (s.currentActorId === 'branwen' && e.bleed > 0) {
    const b = s.party.chars.branwen;
    if (b && !b.downed && !b.bleedKillUsed) {
      const before = b.hp;
      b.hp = Math.min(b.maxHp, b.hp + 1);
      if (b.hp > before) {
        spawnPopupId('branwen', `+${b.hp - before}`, 'heal', 'party');
        spawnPassivePopup('branwen', 'BLEED HUNTER');
      }
      b.bleedKillUsed = true;
    }
  }
  // Emoji reaction over the actor for the kill
  if (s.currentActorId) spawnReaction(s.currentActorId, '💀', 'party');
  spawnKillSparks(e.id, 'enemy', s.currentActorId && CHARS[s.currentActorId] && CHARS[s.currentActorId].school);
  // The killing hero may bark
  if (s.currentActorId && CHARS[s.currentActorId]) spawnBark(s.currentActorId, 'kill');
  // Pact of Cinders — every surviving enemy starts bleeding
  if (hasSigil(s, 'cinders')) {
    aliveEnemies(s).forEach(en => { if (en !== e && !en.dead) en.bleed = Math.max(en.bleed, 1); });
    if (s.currentActorId) spawnSigilPopup(s.currentActorId, 'cinders');
  }
  // Sigil of the Reaver — already adds +1 Resolve on kill in gainResolve;
  // surface the trigger so the player sees the contribution.
  if (hasSigil(s, 'reaver') && s.currentActorId) spawnSigilPopup(s.currentActorId, 'reaver');
  // Pact of Vigor — refund 1 ATB this turn (carried via bonusAtb until startTurn resets)
  if (hasSigil(s, 'vigor')) {
    s.bonusAtb = (s.bonusAtb || 0) + 1;
    if (s.currentActorId) spawnSigilPopup(s.currentActorId, 'vigor');
  }
  // Slide remaining enemies forward so a kill never strands an attacker
  // who can't reach the back slot.  Quiet rearrangement — no log line.
  enemyAdvanceFill(s);
}

// If the front slot is empty, the next enemy back shuffles into it.  This
// guarantees front-reach attacks always have something to hit so long as
// any enemy is alive — closes a reachability hole where a back-only
// survivor could leave a solo attacker stuck.
function enemyAdvanceFill(s) {
  const slots = s.enemies && s.enemies.slots;
  if (!slots) return;
  const isLive = (id) => id && s.enemies.chars[id] && !s.enemies.chars[id].dead;
  // Helper that shifts the next live id forward when a slot is empty.
  if (!isLive(slots.front)) {
    if (isLive(slots.mid))       { slots.front = slots.mid; slots.mid = null; }
    else if (isLive(slots.back)) { slots.front = slots.back; slots.back = null; }
  }
  if (!isLive(slots.mid)) {
    if (isLive(slots.back)) { slots.mid = slots.back; slots.back = null; }
  }
}

function applyDmgToParty(s, c, amt) {
  if (!c || c.downed) return;
  // Cassia "Steadfast" — -1 dmg when in Front
  if (c.id === 'cassia' && slotOfChar(s, 'cassia') === 'front' && amt > 0) {
    amt = Math.max(0, amt - 1);
    spawnPassivePopup('cassia', 'STEADFAST');
  }
  // Garron "Sentinel" — while he holds the front, every other party
  // member takes -1 damage (Garron himself takes full so the cost lands
  // on the warden).  Stacks below armor / vuln.
  const garron = s.party.chars.garron;
  if (garron && !garron.downed && c.id !== 'garron' && slotOfChar(s, 'garron') === 'front' && amt > 0) {
    amt = Math.max(0, amt - 1);
    spawnPassivePopup('garron', 'SENTINEL');
  }
  // Run modifier — "Hunger" twists Front-position damage taken upward
  if (hasRunModifier(s, 'hunger') && slotOfChar(s, c.id) === 'front') amt += 1;
  // Vulnerable on party
  if (c.vuln > 0 && amt > 0) { amt += 2; c.vuln = Math.max(0, c.vuln - 1); }

  const absorbed = Math.min(c.armor, amt);
  c.armor = Math.max(0, c.armor - amt);
  let toHp = amt - absorbed;
  // Sigil of Aegis — each incoming hit deals 1 less HP after armor
  if (hasSigil(s, 'aegis') && toHp > 0) toHp = Math.max(0, toHp - 1);
  c.hp = Math.max(0, c.hp - toHp);

  spawnPopupId(c.id, `-${toHp}`, 'dmg', 'party');
  flashCardId(c.id, 'hit', 'party');
  shakeCardId(c.id, 'party', toHp);
  if (toHp >= 5) shakeScreen(toHp >= 9 ? 3 : 2);
  Audio.hit(Math.min(2, 0.6 + toHp / 8));
  log(`<b>${CHARS[c.id].name}</b> takes ${toHp} damage.`);

  if (s.fightStats && toHp > 0) {
    s.fightStats.damageTaken[c.id] = (s.fightStats.damageTaken[c.id] || 0) + toHp;
    // Track each character's lowest HP this fight (for vignette triggers)
    s.fightStats.minHp = s.fightStats.minHp || {};
    if (s.fightStats.minHp[c.id] === undefined || c.hp < s.fightStats.minHp[c.id]) {
      s.fightStats.minHp[c.id] = c.hp;
    }
  }
  // Near-death emoji reaction — once per character per drop into the danger zone
  if (toHp > 0 && c.hp > 0 && c.hp <= 4) spawnReaction(c.id, '😵', 'party');
  // Hero may bark when their HP crosses ~30% (and isn't downed)
  if (toHp > 0 && c.hp > 0 && c.hp <= Math.ceil(c.maxHp * 0.3)) spawnBark(c.id, 'lowHp');
  fireAdjacencyHook(s, 'onPartyDamaged', c.id, toHp);

  // Retaliate (Vow of Vigil sigil adds +2 to each retaliate strike)
  if (c.retaliate > 0 && toHp > 0) {
    log(`<b>${CHARS[c.id].name}</b> retaliates!`);
    const target = firstAliveEnemyFrom(s, 0);
    if (target) applyDmgToEnemy(s, target, c.retaliate + (hasSigil(s, 'vigil') ? 2 : 0));
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
  if (c.hp === 0) { c.downed = true; c.pendingEffects = []; if (s.fightStats) { s.fightStats.downed = s.fightStats.downed || []; if (!s.fightStats.downed.includes(charId)) s.fightStats.downed.push(charId); } log(`<b>${CHARS[charId].name}</b> falls.`); }
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
  // Receiver's quirk shifts armor gained (Bulwark / Brittle).
  const recvMod = getQuirkArmorMod(s, id);
  const granted = Math.max(0, amt + recvMod);
  c.armor += granted;
  fireAdjacencyHook(s, 'onArmorGrant', s.currentActorId, id, granted);
}
function partyArmor(s, amt) {
  aliveParty(s).forEach(c => {
    const recvMod = getQuirkArmorMod(s, c.id);
    const granted = Math.max(0, amt + recvMod);
    c.armor += granted;
    spawnPopupId(c.id, `+${granted}⛨`, 'armor', 'party');
    fireAdjacencyHook(s, 'onArmorGrant', s.currentActorId, c.id, granted);
  });
}
function partyHeal(s, amt) {
  const bonus = consumePendingBonus(s, s.currentActorId, 'healBonus');
  // Caster's "gentle hand" / "clumsy" quirks shift heals dealt; receiver's
  // own healMod stacks on top inside the loop so positive/negative quirks
  // on the receiver also matter.
  const casterMod = getQuirkHealMod(s, s.currentActorId);
  const witherMod = hasRunModifier(s, 'withered') ? -1 : 0;
  // Squad Sigil — Mercy Doubled (Cassia + Elin together) bumps every
  // party heal by +1.
  const squadHeal = hasSquadSigil(s, 'mercyDoubled') ? 1 : 0;
  const total = amt + bonus + casterMod + witherMod + squadHeal;
  aliveParty(s).forEach(c => {
    const recvMod = getQuirkHealMod(s, c.id);
    const heal = Math.max(0, total + recvMod);
    const before = c.hp;
    c.hp = Math.min(c.maxHp, c.hp + heal);
    const got = c.hp - before;
    if (got > 0) {
      spawnPopupId(c.id, `+${got}`, 'heal', 'party');
      Audio.heal();
      fireAdjacencyHook(s, 'onHeal', s.currentActorId, c.id, got);
      if (s.fightStats && s.currentActorId) {
        s.fightStats.healingDone[s.currentActorId] = (s.fightStats.healingDone[s.currentActorId] || 0) + got;
      }
      mercyTickle(s, c.id, got);
    }
  });
}

// Crown of Mercy — every other alive ally heals +1 when an ally lands a heal.
// Guarded against re-entry so the bonus heal doesn't itself re-trigger.
function mercyTickle(s, healedId, got) {
  if (!hasSigil(s, 'mercy') || !got || s.__mercyActive) return;
  s.__mercyActive = true;
  try {
    aliveParty(s).forEach(o => {
      if (o.id === healedId) return;
      const before = o.hp;
      o.hp = Math.min(o.maxHp, o.hp + 1);
      const inc = o.hp - before;
      if (inc > 0) {
        spawnPopupId(o.id, `+${inc}`, 'heal', 'party');
        if (s.fightStats && s.currentActorId) {
          s.fightStats.healingDone[s.currentActorId] = (s.fightStats.healingDone[s.currentActorId] || 0) + inc;
        }
      }
    });
  } finally { s.__mercyActive = false; }
}
function healLowest(s, amt) {
  const alive = aliveParty(s); if (alive.length === 0) return null;
  alive.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
  const c = alive[0];
  const bonus = consumePendingBonus(s, s.currentActorId, 'healBonus');
  // Caster + receiver quirk mods stack on the heal amount.
  const casterMod = getQuirkHealMod(s, s.currentActorId);
  const recvMod   = getQuirkHealMod(s, c.id);
  const witherMod = hasRunModifier(s, 'withered') ? -1 : 0;
  const squadHeal = hasSquadSigil(s, 'mercyDoubled') ? 1 : 0;
  const total = Math.max(0, amt + bonus + casterMod + recvMod + witherMod + squadHeal);
  const before = c.hp;
  c.hp = Math.min(c.maxHp, c.hp + total);
  const got = c.hp - before;
  if (got > 0) {
    spawnPopupId(c.id, `+${got}`, 'heal', 'party');
    Audio.heal();
    flashCardId(c.id, 'heal', 'party');
    fireAdjacencyHook(s, 'onHeal', s.currentActorId, c.id, got);
    if (s.fightStats && s.currentActorId) {
      s.fightStats.healingDone[s.currentActorId] = (s.fightStats.healingDone[s.currentActorId] || 0) + got;
    }
    mercyTickle(s, c.id, got);
  }
  // Elin passive: heal self 1 when healing an ally
  if (s.currentActorId === 'elin' && c.id !== 'elin') {
    const e = s.party.chars.elin;
    const eb = e.hp; e.hp = Math.min(e.maxHp, e.hp + 1);
    const got2 = e.hp - eb;
    if (got2 > 0) {
      spawnPopupId('elin', `+${got2}`, 'heal', 'party');
      spawnPassivePopup('elin', 'MERCY');
      if (s.fightStats) s.fightStats.healingDone.elin = (s.fightStats.healingDone.elin || 0) + got2;
      mercyTickle(s, 'elin', got2);
    }
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
  const gained = s.resolve - before;
  if (gained > 0) {
    flashResolve();
    floatResolveGain(gained);
  }
}

// Small floating "+N" near the Resolve pips when the player charges up.
function floatResolveGain(n) {
  if (__simulating) return;
  const anchor = document.getElementById('hud-resolve') || document.getElementById('resolve-pips');
  if (!anchor) return;
  const layer = $('#popup-layer');
  const stage = $('#stage');
  if (!layer || !stage) return;
  const r = anchor.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'popup heal resolve-pop';
  el.textContent = `+${n}♦`;
  el.style.left = (r.left + r.width / 2 - s.left) + 'px';
  el.style.top  = (r.top - s.top - 4) + 'px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// Enemy → party effects (slot-targeted)
// Layer-scaled intent damage: deeper layers add +N to every enemy hit.
function _layerIntentBonus(s) {
  return (s && s.run && LAYER_CONTENT[s.run.layer])
    ? (LAYER_CONTENT[s.run.layer].intentDmgBonus || 0)
    : 0;
}
function dmgPartyAt(s, slot, amt) {
  amt = amt + _layerIntentBonus(s);
  const tauntee = aliveParty(s).find(c => c.taunt);
  let target = tauntee || charBySlot(s, slot);
  if (!target || target.downed) target = aliveParty(s)[0];
  if (target) applyDmgToParty(s, target, amt);
}
function dmgLowestParty(s, amt) {
  amt = amt + _layerIntentBonus(s);
  const tauntee = aliveParty(s).find(c => c.taunt);
  if (tauntee) return applyDmgToParty(s, tauntee, amt);
  const alive = aliveParty(s); if (alive.length === 0) return;
  alive.sort((a, b) => a.hp - b.hp);
  applyDmgToParty(s, alive[0], amt);
}
function dmgAllParty(s, amt) { const a = amt + _layerIntentBonus(s); aliveParty(s).forEach(c => applyDmgToParty(s, c, a)); }
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
  // Slide-in animation on the next render: queue the moved id(s) so
  // makePartyCard tags them with .figure-sliding.
  if (!__simulating) {
    pendingSlideIds.add(charId);
    if (other) pendingSlideIds.add(other);
  }
}
// Set of hero ids that need a slide-in animation on the next render.
// makePartyCard reads + clears entries when it renders.
const pendingSlideIds = new Set();
// Lunge-on-attack: triggered from applyDmgToEnemy via lungeCardId helper.
function lungeCardId(id, side) {
  if (__simulating) return;
  const cardEl = document.querySelector(`#${side === 'enemy' ? 'enemy' : 'party'}-half [data-id="${id}"]`);
  if (!cardEl) return;
  cardEl.classList.remove('lunging');
  void cardEl.offsetWidth;
  cardEl.classList.add('lunging');
  setTimeout(() => cardEl.classList.remove('lunging'), 360);
}
function advance(s, charId) {
  const slot = slotOfChar(s, charId);
  if (slot === 'mid')  { swapWith(s, charId, 'front'); spawnReaction(charId, '💨', 'party'); }
  else if (slot === 'back') { swapWith(s, charId, 'mid'); spawnReaction(charId, '💨', 'party'); }
}
function retreat(s, charId) {
  const slot = slotOfChar(s, charId);
  if (slot === 'front') { swapWith(s, charId, 'mid'); spawnReaction(charId, '🌀', 'party'); }
  else if (slot === 'mid') { swapWith(s, charId, 'back'); spawnReaction(charId, '🌀', 'party'); }
}
function retreatFull(s, charId) {
  const slot = slotOfChar(s, charId);
  if (slot === 'front') { swapWith(s, charId, 'back'); spawnReaction(charId, '🌀', 'party'); }
  else if (slot === 'mid') { swapWith(s, charId, 'back'); spawnReaction(charId, '🌀', 'party'); }
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

// Spawn the synergy's effect popup, then EVERY trigger also flashes the
// synergy NAME above the receiver in bond (green) or friction (red) color.
// First-fire-per-fight is still tracked separately for the post-fight stats.
function fireSynergyFeedback(s, name, receiverId, effectText, effectType) {
  if (__simulating) return;
  spawnPopupId(receiverId, effectText, effectType, 'party');
  if (!s) return;
  // Track first fires for the run/fight summary AND a running per-run count
  // (the count powers the bondFiredCount catalyst — vignettes that grant
  // quirks now wait until a bond has fired several times before triggering).
  if (s.firedSynergies && !s.firedSynergies.has(name)) {
    s.firedSynergies.add(name);
    if (s.fightStats) s.fightStats.synergies.push(name);
  }
  if (s.run) {
    s.run.synergyCounts = s.run.synergyCounts || {};
    s.run.synergyCounts[name] = (s.run.synergyCounts[name] || 0) + 1;
  }
  // Look up bond/friction type from the active adjacency pair
  const pair = getAdjacencyPairs(s).find(p => p.synergy.name === name);
  const popupClass = pair ? pair.synergy.type : 'synergy';
  setTimeout(() => spawnPopupId(receiverId, name, popupClass, 'party'), 180);
  // Manga-style emoji reaction: bonds get sparkles, frictions get an angry mark.
  // Fires on both members of the pair when discoverable, otherwise just receiver.
  const emoji = pair && pair.synergy.type === 'friction' ? '💢' : '✨';
  spawnReaction(receiverId, emoji, 'party');
  // Receiver may bark on bond fires (skip frictions to keep it positive)
  if (pair && pair.synergy.type === 'bond') spawnBark(receiverId, 'bond');
  if (pair && Array.isArray(pair.ids)) {
    pair.ids.forEach(other => {
      if (other !== receiverId) setTimeout(() => spawnReaction(other, emoji, 'party'), 120);
    });
  }
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
  s.bonusAtb = Math.min(1, s.pendingBonusAtb || 0);
  s.pendingBonusAtb = 0;
  // clear single-turn buffs that survived the enemy phase
  aliveParty(s).forEach(c => { c.taunt = false; c.retaliate = 0; c.firstAttackUsed = false; c.bleedKillUsed = false; c.shadowVeilUsed = false; c.lingeringUsed = false; });
  // Vow of Iron — front slot wakes turn 1 with Taunt.  Applied AFTER the
  // taunt-clear so it survives this single turn; the next startTurn clears
  // it normally.  The _vowIronPending flag was set in initEncounter so
  // this only fires on the first turn of the fight.
  if (s._vowIronPending) {
    const frontId = s.party.slots.front;
    const front = frontId && s.party.chars[frontId];
    if (front && !front.downed) {
      front.taunt = true;
      spawnSigilPopup(frontId, 'vowiron');
    }
    s._vowIronPending = false;
  }
  log(`<span class="msg-strong">— Turn ${s.turn} —</span>`);
  if (s.bonusAtb > 0) log(`<i>Weakness exploited — +${s.bonusAtb} ATB this turn.</i>`);

  // bleed tick — base 2 per turn, +1 if Bloodborne Sigil owned, +1 if Bone Tide modifier
  const bleedTick = 2 + (hasSigil(s, 'bloodborne') ? 1 : 0) + (hasRunModifier(s, 'bonetide') ? 1 : 0);
  // Squad Sigil — Crimson Pact (Branwen + Mira together) bumps the bleed
  // YOUR party deals to enemies by +1.  Doesn't affect bleed taken.
  const enemyBleedTick = bleedTick + (hasSquadSigil(s, 'crimsonPact') ? 1 : 0);

  // Run modifier — "Burning Sky" pings every combatant for 1 HP at turn start.
  if (hasRunModifier(s, 'burning')) {
    aliveParty(s).forEach(c => {
      c.hp = Math.max(0, c.hp - 1);
      spawnPopupId(c.id, '-1', 'dmg', 'party');
      if (c.hp === 0) { c.downed = true; c.pendingEffects = []; if (s.fightStats) { s.fightStats.downed = s.fightStats.downed || []; if (!s.fightStats.downed.includes(c.id)) s.fightStats.downed.push(c.id); } log(`<b>${CHARS[c.id].name}</b> falls.`); }
    });
    aliveEnemies(s).forEach(e => {
      e.hp = Math.max(0, e.hp - 1);
      spawnPopupId(e.id, '-1', 'dmg', 'enemy');
      if (e.hp === 0) killEnemy(s, e);
    });
  }
  aliveParty(s).forEach(c => {
    if (c.bleed > 0) {
      c.hp = Math.max(0, c.hp - bleedTick); c.bleed -= 1;
      spawnPopupId(c.id, `-${bleedTick}`, 'dmg', 'party');
      flashCardId(c.id, 'hit', 'party');
      log(`<b>${CHARS[c.id].name}</b> bleeds (${bleedTick}).`);
      if (c.hp === 0) { c.downed = true; c.pendingEffects = []; if (s.fightStats) { s.fightStats.downed = s.fightStats.downed || []; if (!s.fightStats.downed.includes(c.id)) s.fightStats.downed.push(c.id); } log(`<b>${CHARS[c.id].name}</b> falls.`); }
    }
  });
  aliveEnemies(s).forEach(e => {
    if (e.bleed > 0) {
      const dmg = Math.max(0, enemyBleedTick - (s.ignoreArmor ? 0 : e.armor));
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
  // Squad Sigil — Old Edge (Kai + Cassia + Elin together) — extra Resolve drip
  if (hasSquadSigil(s, 'oldEdge')) gainResolve(s, 1);

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
// A reach-targeted tech has "no effect" if there's no alive enemy in any of
// its reach slots.  Party-targeted techs (no `reach`) always have an effect.
function techWouldMiss(s, tech) {
  if (!tech || !tech.reach || !Array.isArray(tech.reach)) return false;
  return !tech.reach.some(reachSlot => {
    const eid = s.enemies && s.enemies.slots && s.enemies.slots[reachSlot];
    if (!eid) return false;
    const e = s.enemies.chars && s.enemies.chars[eid];
    return e && !e.dead;
  });
}

function previewTile(kind, charId, dir) {
  // Use the queue-aware snapshot so tile names match the slot the character
  // will actually occupy when this action would fire.
  const s = getPreviewState();
  const c = s.party.chars[charId];
  if (!c || c.downed) return { valid: false };
  const slot = slotOfChar(s, charId);
  if (!slot) return { valid: false };

  const atb = ACTION_ATB[kind] || 0;

  if (kind === 'attack') {
    const tech = getTech(s, charId, slot, 'basic');
    return { kind, valid: true, label: tech.name, desc: tech.desc, atb, resolveCost: 0, slot, noEffect: techWouldMiss(s, tech) };
  }
  if (kind === 'special') {
    const tech = getTech(s, charId, slot, 'sig');
    // Per-sig cost flows through: getSpecialCost picks up tech.cost or
    // falls back to SPECIAL_COST.
    return { kind, valid: true, label: tech.name, desc: tech.desc, atb, resolveCost: getSpecialCost(s, tech), slot, noEffect: techWouldMiss(s, tech) };
  }
  if (kind === 'move') {
    const idx = SLOTS.indexOf(slot);
    const ti = idx + dir;
    if (ti < 0 || ti > 2) return { kind, valid: false, label: 'Move', desc: 'no room', atb, slot };
    const target = SLOTS[ti];
    const otherId = s.party.slots[target];
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
  // Cap each character at ACTIONS_PER_CHAR distinct actions per turn (team
  // special excluded — no charId).  Also reject duplicates: each exact
  // (kind, dir) tuple may only be queued once per character per turn, so
  // a character can attack + special + move, but not attack twice.
  if (item.charId) {
    const charActions = s.queue.filter(q => q.charId === item.charId).length;
    if (charActions >= ACTIONS_PER_CHAR) {
      flashMsg(`${CHARS[item.charId].name} has already done ${ACTIONS_PER_CHAR} things this turn.`);
      return;
    }
    // Move is one per turn regardless of direction (you can't shuffle
     // forward and back to teleport).  Attack / special / brace dedup on
     // their kind alone since they have no dir.
    const dup = s.queue.some(q => q.charId === item.charId && q.kind === item.kind);
    if (dup) {
      flashMsg(`${CHARS[item.charId].name} already used ${item.kind} this turn.`);
      return;
    }
  }
  s.queue.push(item);
  Audio.queue();
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

// Press a figure and drag toward an arrow to queue a move. Drag activates
// immediately on the first few pixels of motion — no hold delay — so the
// gesture feels like a direct click-and-drag. A still press (no motion) for
// ~200ms still enters "inspecting" mode so the figure's name is revealed.
// Release with the pointer aimed at an arrow commits the move; release
// elsewhere is a no-op.
function bindFigureHold(fig, charId, isParty) {
  const HOLD_MS = 200;
  const DRAG_THRESHOLD = 6;    // px of motion that triggers immediate drag mode
  let timer = null;
  let active = false;
  let holding = false;
  let aimArrow = null;
  let startX = 0, startY = 0;

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

  const enterHold = () => {
    if (holding) return;
    holding = true;
    // close other inspecting figures so only one is open at a time
    document.querySelectorAll('.figure.inspecting').forEach(f => { if (f !== fig) f.classList.remove('inspecting'); });
    fig.classList.add('inspecting');
  };

  const start = (e) => {
    if (!isUsable()) return;
    active = true;
    holding = false;
    startX = e.clientX; startY = e.clientY;
    try { fig.setPointerCapture(e.pointerId); } catch (_) {}
    // still-press timer reveals the inspecting state (name) without requiring motion
    timer = setTimeout(() => { if (active) enterHold(); }, HOLD_MS);
    e.preventDefault();
  };

  const move = (e) => {
    if (!active) return;
    // first sign of motion → enter drag mode immediately (don't wait for the timer)
    if (!holding) {
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (dx + dy < DRAG_THRESHOLD) return;
      enterHold();
    }
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

// (queueTeamSpecial removed — Resonance system commits combos directly via
// commitCombo() splicing matched queue items into a single combo entry.)

// ============================================================================
// FIGHT — resolve queue, then enemies
// ============================================================================

function onFight() {
  const s = state;
  if (s.over || s.executing) return;
  if (s.queue.length === 0) { flashMsg('Queue at least one action.'); return; }
  Audio.attack();
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
          spawnSigilPopup(c.id, 'mending');
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
  // Telegraph the acting hero before the hit fires so the eye can find
  // them; then run the action; then pause before the next step.
  if (item.charId) flashCardId(item.charId, 'hit', 'party');
  setTimeout(() => {
    executeQueueItem(s, item);
    if (checkEnd(s)) { s.executing = false; render(); return; }
    render();
    setTimeout(() => resolveQueueStep(i + 1), 720 + consumeHitPause());
  }, 200);
}

function executeQueueItem(s, item) {
  if (item.kind === 'combo') {
    const combo = COMBOS[item.comboId];
    if (!combo) return;
    log(`<span class="msg-strong">★ ${combo.name} ★</span>`);
    if (!__simulating) {
      showTeamSpecialBanner(combo.name);
      // Flash every participating hero
      combo.requires.forEach(req => { if (s.party.chars[req.heroId] && !s.party.chars[req.heroId].downed) flashCardId(req.heroId, 'hit', 'party'); });
      shakeScreen(combo.tier === 'triple' ? 3 : 2);
      Audio.attack(); Audio.kill();
    }
    s.currentActorId = null;
    try { combo.fn(s); }
    finally { s.outgoingDmgMod = 0; s.ignoreArmor = false; s.currentActorId = null; }
    return;
  }

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
    // Front-slot brace also draws fire — Taunt for this turn so the player
    // can plant a wall on demand without needing a Korin resonance setup.
    if (slotOfChar(state, item.charId) === 'front') {
      c.taunt = true;
      spawnPopupId(item.charId, 'TAUNT', 'synergy', 'party');
      log(`<b>${CHARS[item.charId].name}</b> braces (+${BRACE_ARMOR} armor · taunt).`);
    } else {
      log(`<b>${CHARS[item.charId].name}</b> braces (+${BRACE_ARMOR} armor).`);
    }
    return;
  }
}

// ============================================================================
// (Old formation-based TEAM_SPECIALS system removed.  Replaced by the
// Resonance combo system above — see COMBOS and matchingCombos.)
// ============================================================================
// Banner reveal used by Resonance combos when they fire.
function showTeamSpecialBanner(name) {
  const old = document.getElementById('ts-banner');
  if (old) old.remove();
  const b = document.createElement('div');
  b.id = 'ts-banner';
  b.innerHTML = `<span class="tsb-flank">★</span><span class="tsb-name">${name}</span><span class="tsb-flank">★</span>`;
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 1400);
}


// Resolve the enemy phase one enemy at a time so each action's popups +
// log line are visible before the next fires.  Previously this was a
// synchronous for-loop and everything blasted at once.
function resolveEnemyTurn(s) {
  // Snapshot the acting order so mid-resolution kills don't skip enemies
  // or accidentally re-process newly-spawned ones.
  s._enemyTurnOrder = aliveEnemies(s).map(e => e.id);
  resolveEnemyStep(s, 0);
}

// End-of-enemy-turn objective tick.  Each objective kind handles its own
// timer here:
//   - ticking: decrement charge unless the catalyst is staggered/dead;
//              detonate when it hits zero.
//   - survive: decrement the turn count; when it hits zero, the sins
//              break off and victory triggers via the all-dead drain
//              (same pattern as Ringleader).
//   - priority: handled in checkEnd (kill-the-marked-enemy).
function tickObjectiveCharge(s) {
  const obj = s.run && s.run.objective;
  if (!obj || obj.fired) return;
  if (obj.kind === 'ticking') {
    const targetId = s.enemies.slots[obj.targetSlot];
    const target = targetId && s.enemies.chars[targetId];
    if (!target || target.dead) return; // disarmed elsewhere
    if (target.staggered) {
      log('<i>The catalyst staggers — the charge holds.</i>');
      return;
    }
    obj.charge = Math.max(0, (obj.charge || 0) - 1);
    if (obj.charge <= 0) {
      obj.fired = true;
      log('<b>The catalyst detonates!</b>');
      shakeScreen(3);
      dmgAllParty(s, obj.dmg || 7);
    }
    return;
  }
  if (obj.kind === 'survive') {
    obj.turns = Math.max(0, (obj.turns || 0) - 1);
    if (obj.turns <= 0) {
      obj.fired = true;
      const survivors = aliveEnemies(s);
      if (survivors.length) {
        survivors.forEach(e => { e.hp = 0; e.dead = true; });
      }
      log('<i>You held.  The sins lose interest and slip back into the dark.</i>');
    }
    return;
  }
}
function resolveEnemyStep(s, i) {
  if (s.over) { s.executing = false; render(); return; }
  const order = s._enemyTurnOrder || [];
  if (i >= order.length) {
    delete s._enemyTurnOrder;
    if (s.over) { s.executing = false; render(); return; }
    // Ticking Threat objective — count down at the end of the enemy turn.
    // If the marked enemy is alive and not staggered, the charge falls; if
    // it reaches zero, the catalyst detonates for big AoE damage and the
    // objective fires (clears so the banner disappears).
    tickObjectiveCharge(s);
    if (s.over) { s.executing = false; render(); return; }
    s.turn += 1;
    startTurn(s);
    return;
  }
  // Refetch by id — enemies in arrays may have shifted, and some may have
  // died between steps from bleed/retaliate effects.
  const eid = order[i];
  const e = Object.values(s.enemies.chars).find(en => en.id === eid && !en.dead);
  if (!e) { resolveEnemyStep(s, i + 1); return; }

  if (e.staggered) {
    log(`<b>${ENEMIES[e.id].name}</b> is staggered — cannot act.`);
    e.staggerTurns -= 1;
    if (e.staggerTurns <= 0) {
      e.staggered = false;
      e.chain = 0;
      log(`<b>${ENEMIES[e.id].name}</b> recovers.`);
    }
    render();
    setTimeout(() => resolveEnemyStep(s, i + 1), 420);
    return;
  }

  const def = ENEMIES[e.id];
  const intent = def.intents[e.intentIdx % def.intents.length];
  log(`<b>${def.name}</b> uses <b>${intent.name}</b>.`);
  // Telegraph: briefly highlight the acting enemy card before the hit lands.
  flashCardId(e.id, 'hit', 'enemy');
  setTimeout(() => {
    intent.fn(s);
    if (checkEnd(s)) { s.executing = false; render(); return; }
    e.intentIdx = (e.intentIdx + 1) % def.intents.length;
    render();
    setTimeout(() => resolveEnemyStep(s, i + 1), 700 + consumeHitPause());
  }, 240);
}

function checkEnd(s) {
  if (s.over) return true;
  // Objective check — if the encounter has a "Ringleader" priority target
  // and they fall, the rest flee and the fight ends in victory.  Drains
  // the remaining enemies' HP so the existing all-dead-enemies branch
  // below picks it up cleanly.
  if (s.run && s.run.objective && s.run.objective.kind === 'priority' && !s.run.objective.fired) {
    const targetId = s.enemies.slots[s.run.objective.targetSlot];
    const target = targetId && s.enemies.chars[targetId];
    if (target && target.dead) {
      s.run.objective.fired = true;
      const survivors = aliveEnemies(s);
      if (survivors.length) {
        survivors.forEach(e => { e.hp = 0; e.dead = true; });
        log('<i>The marked one falls.  The rest break and flee into the dark.</i>');
      }
    }
  }
  // Ticking objective — disarm when the catalyst dies (objective banner
  // clears via fired flag; remaining enemies still need to be cleared).
  if (s.run && s.run.objective && s.run.objective.kind === 'ticking' && !s.run.objective.fired) {
    const targetId = s.enemies.slots[s.run.objective.targetSlot];
    const target = targetId && s.enemies.chars[targetId];
    if (target && target.dead) {
      s.run.objective.fired = true;
      log('<i>The catalyst breaks.  The pressure goes out of the air.</i>');
    }
  }
  if (aliveEnemies(s).length === 0) {
    s.over = true;
    // Mark the current MAP_NODE as completed; the next reachable nodes
    // will be whatever this node's `next` lists.
    if (s.run.currentNodeId) s.run.completedNodes.push(s.run.currentNodeId);
    if (s.fightStats) s.fightStats.turns = s.turn;
    // Frequency counter — recruit rolls are gated by how many nodes have
    // passed since the last successful recruit.  Counts combat + non-combat.
    s.run.nodesSinceRecruit = (s.run.nodesSinceRecruit || 0) + 1;
    // Vigil for the fallen — if anyone went down in this fight, the next
    // recruit moment is forced and reframed as a replacement.
    if (s.fightStats && s.fightStats.downed && s.fightStats.downed.length > 0) {
      s.run.recruitPending = true;
    }
    const completedEnc = s.run.currentEnc;
    const completedNode = s.run.currentNodeId ? getMapNode(s.run.currentNodeId) : null;
    s.run.lastVictoryElite = !!(completedNode && completedNode.type === 'elite');
    const isBoss = !!(completedNode && completedNode.type === 'boss');
    // Affinity progression — roll a quirk grant before the post-fight UI fires
    awardQuirkAfterWin(s, completedNode);
    if (isBoss) {
      // Boss kill — try a "Wakeling slain" vignette before the run summary.
      const bossCtx = captureFightContext(s);
      bossCtx.phase = 'bossDefeated';
      const bossMatches = matchVignettes(s, bossCtx);
      // After the run summary, surface the World Map so the player sees
      // they've cleared a layer of the Abyss with more layers above.
      // Also snapshot the surviving party so the next layer's run starts
      // with the same heroes intact (HP / quirks / upgrades carried).
      const continueToSummary = () => showVictorySummary(completedEnc, () => {
        markLayerCleared(getCurrentLayer());
        saveCarriedParty(state);
        showRunSummary('boss', { afterClose: () => showWorldMap() });
      });
      // Hold for the slo-mo death effect before the run-summary cascade.
      const BOSS_DEATH_HOLD = 1600;
      if (bossMatches.length) {
        const pick = bossMatches[Math.floor(Math.random() * bossMatches.length)];
        setTimeout(() => showVignette(pick, bossCtx, continueToSummary), BOSS_DEATH_HOLD);
      } else {
        setTimeout(continueToSummary, BOSS_DEATH_HOLD);
      }
    } else {
      // Snapshot fight context for vignette triggers (firedSynergies, minHp etc.)
      // BEFORE the next encounter resets them.
      const fightCtx = captureFightContext(s);
      // Between fights: recap -> maybe a vignette -> recruit -> upgrade -> sigil -> map
      setTimeout(() => showVictorySummary(completedEnc, () => offerVignetteOrPath(fightCtx)), 480);
    }
    return true;
  }
  if (aliveParty(s).length === 0) {
    s.over = true;
    // Defeat spectacle — mirror of the boss-kill moment.  Party silhouettes
    // dim, screen desaturates, a quiet flash fades in.  Then the vignette
    // (if any) plays; then the run summary.
    playDefeatIntro();
    const HOLD = 1700;
    // Try a run-defeat vignette before the run-summary screen.  If none match
    // (or it's already fired), fall straight through.
    const defeatCtx = captureFightContext(s);
    defeatCtx.phase = 'runDefeat';
    defeatCtx.alive = Object.keys(s.party.chars);
    const defeatMatches = matchVignettes(s, defeatCtx);
    if (defeatMatches.length) {
      const pick = defeatMatches[Math.floor(Math.random() * defeatMatches.length)];
      setTimeout(() => showVignette(pick, defeatCtx, () => showRunSummary('defeat')), HOLD);
      return true;
    }
    setTimeout(() => showRunSummary('defeat'), HOLD);
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
  // Critical-HP screen vignette: when any alive hero is at <=3 HP, body
  // gets .party-critical so a faint red edge glow pulses around the
  // viewport.  Cleared otherwise.
  const anyCritical = state && state.party && Object.values(state.party.chars)
    .some(c => c && !c.downed && c.hp > 0 && c.hp <= 3);
  document.body.classList.toggle('party-critical', !!anyCritical);
  // Persist after every UI tick so a refresh resumes near-exactly.
  if (!__simulating) saveState();
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
  // glanceable resolve readout in the HUD line (no interaction, just a count)
  const hudNum = $('#hud-resolve-num');
  if (hudNum) hudNum.textContent = String(state.resolve);
  const hudMax = $('#hud-resolve-max');
  if (hudMax) hudMax.textContent = `/${RESOLVE_MAX}`;
  const hudResolve = $('#hud-resolve');
  if (hudResolve) {
    if (reserved > 0) hudResolve.classList.add('has-reserved');
    else hudResolve.classList.remove('has-reserved');
  }
  renderSigilTray();
  renderRunModifier();
}

// Run modifier badge — shows the biome rolled at run start.  Tap to inspect.
function renderRunModifier() {
  const el = document.getElementById('run-modifier');
  if (!el) return;
  const mod = getRunModifier(state);
  if (!mod) { el.innerHTML = ''; el.classList.add('empty'); return; }
  el.classList.remove('empty');
  el.innerHTML = `<button type="button" class="run-mod-chip" title="${mod.name} — ${mod.desc}" aria-label="${mod.name}">
    <span class="run-mod-icon">◈</span>
    <span class="run-mod-name">${mod.name}</span>
  </button>`;
}

// Slay-the-Spire-style persistent sigil tray.  One chip per acquired sigil,
// colored by category (combat/defense/resource); tap to surface the
// name + description via the shared chip-tooltip pattern.
function renderSigilTray() {
  const tray = document.getElementById('sigil-tray');
  if (!tray) return;
  const owned = (state.run && state.run.sigils) || [];
  const squad = activeSquadSigils(state);
  if (!owned.length && !squad.length) {
    tray.innerHTML = '';
    tray.classList.add('empty');
    return;
  }
  tray.classList.remove('empty');
  const ownedChips = owned.map(id => {
    const s = SIGILS[id];
    if (!s) return '';
    const titleText = `${s.name} — ${s.desc}`;
    return `<button type="button" class="sigil-chip cat-${s.category}" data-sigil="${s.id}" title="${titleText}" aria-label="${s.name}"><span class="sigil-chip-icon">${s.icon}</span></button>`;
  }).join('');
  // Squad bond chips — distinct styling so the player can tell they were
  // earned through party composition, not bound from a node.
  const squadChips = squad.map(sq =>
    `<button type="button" class="sigil-chip sigil-chip-squad" data-squad="${sq.id}" title="${sq.name} — ${sq.desc}" aria-label="${sq.name}"><span class="sigil-chip-icon">${sq.icon}</span></button>`
  ).join('');
  tray.innerHTML = ownedChips + squadChips;
  // Bind tap / press-and-hold AFTER each render — innerHTML reset wipes
  // prior bindings.  Both gestures surface the chip's description as a
  // persistent chip tooltip.  No more "tap to open a panel that covers the
  // tooltip you just opened".
  Array.from(tray.querySelectorAll('.sigil-chip')).forEach(chip => {
    bindSigilChipReveal(chip);
  });
}

// Tap or press-and-hold a sigil chip to surface its name + effect as a
// persistent tooltip.  Tapping elsewhere dismisses (handled by
// bindChipExplainers's outside-tap branch).
function bindSigilChipReveal(chip) {
  const tooltipText = () => {
    const sid = chip.dataset.sigil;
    const sqid = chip.dataset.squad;
    if (sid && SIGILS[sid]) return `${SIGILS[sid].name} — ${SIGILS[sid].desc}`;
    if (sqid) {
      const sq = activeSquadSigils(state).find(x => x.id === sqid);
      if (sq) return `${sq.name} — ${sq.desc}`;
    }
    return chip.getAttribute('title') || '';
  };
  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    showChipTooltip(chip, tooltipText());
  });
}

// Note: the old all-sigils floating panel was replaced by per-chip
// tooltips (bindSigilChipReveal) — the panel + outside-click handler
// previously living here have been removed.

function flashResolve() {
  $('#resolve-pips').animate(
    [{ filter: 'brightness(2)' }, { filter: 'brightness(1)' }],
    { duration: 350 }
  );
}

function renderObjectiveBanner() {
  const el = document.getElementById('objective-banner');
  if (!el) return;
  const obj = state.run && state.run.objective;
  if (!obj || obj.fired) {
    el.classList.add('hidden');
    el.classList.remove('ob-ticking', 'ob-survive');
    el.innerHTML = '';
    return;
  }
  el.classList.remove('hidden');
  el.classList.toggle('ob-ticking', obj.kind === 'ticking');
  el.classList.toggle('ob-survive', obj.kind === 'survive');
  const glyph = obj.kind === 'ticking' ? '✸'
              : obj.kind === 'survive' ? '⏳'
              : '◆';
  let counter = '';
  if (obj.kind === 'ticking' && typeof obj.charge === 'number') {
    counter = `<span class="ob-counter">${obj.charge}</span>`;
  } else if (obj.kind === 'survive' && typeof obj.turns === 'number') {
    counter = `<span class="ob-counter">${obj.turns}</span>`;
  }
  // Keep the banner slim — label + counter only.  The full hint moves to
  // the title attribute so press-and-hold (or hover) reveals it without
  // taking battlefield width.
  el.title = obj.hint ? `${obj.label} — ${obj.hint}` : obj.label;
  el.innerHTML = `
    <span class="ob-glyph" aria-hidden="true">${glyph}</span>
    <span class="ob-label">${obj.label}</span>
    ${counter}
  `;
}

function renderBattlefield() {
  renderObjectiveBanner();
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
  const pairs = getAdjacencyPairs(state);
  pairs.forEach(p => {
    p.ids.forEach(id => {
      if (!adjMap[id]) adjMap[id] = {};
      adjMap[id][p.line] = { name: p.synergy.name, type: p.synergy.type };
      if (!adjMap[id].type || p.synergy.type === 'friction') adjMap[id].type = p.synergy.type;
    });
  });
  // Active edges keyed by line ('fm' or 'mb') for the visual connector.
  const edgeByLine = {};
  pairs.forEach(p => { edgeByLine[p.line] = p.synergy; });

  // PARTY: three cards in display order (back / mid / front)
  const partyHalf = $('#party-half'); partyHalf.innerHTML = '';
  PARTY_DISPLAY_ORDER.forEach(slot => {
    const c = charBySlot(state, slot);
    const incoming = c ? incomingByChar[c.id] : null;
    partyHalf.appendChild(makePartyCard(c, slot, threatened.has(slot), adjMap, incoming));
  });
  // Bond / friction edges — small connector dots between adjacent cards.
  // Display order is back / mid / front, so the MB pair sits between
  // columns 1-2 and the FM pair between columns 2-3.
  ['mb', 'fm'].forEach(line => {
    const syn = edgeByLine[line];
    if (!syn) return;
    const edge = document.createElement('div');
    const kind = syn.type === 'friction' ? 'friction' : 'bond';
    edge.className = `adj-edge adj-edge-${line} adj-edge-${kind}`;
    edge.title = syn.name;
    edge.innerHTML = `<span class="adj-edge-glyph">${kind === 'friction' ? '✕' : '◆'}</span>`;
    partyHalf.appendChild(edge);
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

    // Column header — small portrait + name + slot.  Makes it unmistakable
    // which moveset belongs to which hero when the action tray crowds up.
    const head = document.createElement('div');
    head.className = 'char-col-head';
    head.innerHTML = `
      <div class="cch-portrait" aria-hidden="true">${PORTRAITS[charId] || ''}</div>
      <div class="cch-meta">
        <span class="cch-name">${def.name}</span>
        <span class="cch-slot">${SLOT_LABELS[simSlot] || '—'}</span>
      </div>
    `;
    col.appendChild(head);

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
  // Slide-in tag if this hero just moved this turn
  if (c && pendingSlideIds.has(c.id)) {
    fig.classList.add('figure-sliding');
    pendingSlideIds.delete(c.id);
  }
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
  if (incoming && incoming.lethal && !c.downed) fig.classList.add('targeted-lethal');

  // Persistent adjacency glyphs above the head are hidden — bonds/frictions
  // surface only as transient popups when they actually trigger
  // (see fireSynergyFeedback).
  const synStack = '';

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
  const queuedMoveGlyph = queuedMove ? (queuedMove.dir > 0 ? '‹' : '›') : '';
  if (queuedMove) fig.classList.add('has-queued-move');

  // Telegraph (no exact-damage chip): targeted figures glow red via the
  // .targeted-by-enemy class; lethal hits glow brighter via .targeted-lethal.
  // Some uncertainty preserved — players see WHO is threatened, not the
  // precise number.
  // Quirk dots — small icons under the name showing earned affinities.
  // Positive = gold ✦; Negative = blood ✦; each tap reveals the name/desc
  // via the existing chip-tooltip pattern.
  const quirks = c.quirks || { positive: [], negative: [] };
  const quirkDots = [
    ...quirks.positive.map(qid => ({ qid, polarity: 'positive' })),
    ...quirks.negative.map(qid => ({ qid, polarity: 'negative' })),
  ].map(({ qid, polarity }) => {
    const q = QUIRKS[qid];
    if (!q) return '';
    return `<span class="fig-quirk fig-quirk-${polarity}" title="${q.name} — ${q.desc}" data-tip="${q.name} — ${q.desc}">✦</span>`;
  }).join('');

  fig.innerHTML = `
    ${synStack}
    <div class="figure-portrait">
      ${PORTRAITS[c.id] || ''}
      <div class="figure-statuses">${renderStatuses(c)}</div>
      <div class="figure-hp">
        <div class="hp-fill ${hpPct < 35 ? 'low' : ''}" style="width:${hpPct}%"></div>
        <div class="hp-text">${c.hp}/${c.maxHp}</div>
      </div>
    </div>
    <div class="figure-shadow"></div>
    <div class="figure-info">
      <div class="figure-name${isHome ? ' home' : ''}">${def.name}</div>
      ${quirkDots ? `<div class="fig-quirks">${quirkDots}</div>` : ''}
    </div>
    ${canMoveBack  ? `<button class="move-arrow move-arrow-left"  data-dir="1"  aria-label="Move toward back">‹</button>`  : ''}
    ${canMoveFront ? `<button class="move-arrow move-arrow-right" data-dir="-1" aria-label="Move toward front">›</button>` : ''}
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
  // Objective-target markers — Ringleader gets a gold crown; Catalyst gets
  // a red flame ring with the remaining charge count overhead.
  const obj = state.run && state.run.objective;
  if (obj && obj.targetSlot === slot && !obj.fired) {
    if (obj.kind === 'priority')  fig.classList.add('priority-target');
    if (obj.kind === 'ticking')   { fig.classList.add('ticking-target'); fig.dataset.chargeLeft = obj.charge; }
  }
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
  // Threat tier — colorizes the intent bubble so the player can see at a
  // glance whether this enemy's next move would kill someone (lethal),
  // hurt badly (heavy >= 40% maxHp), or chip (mild).
  let threat = 'mild';
  if (typeof intent.dmg === 'number' && intent.dmg > 0) {
    const targets = intentTargetCharIds(state, intent);
    let maxRatio = 0, lethal = false;
    targets.forEach(id => {
      const c = state.party.chars[id];
      if (!c || c.downed) return;
      const pred = previewIncomingDmg(state, c, intent.dmg, { armor: c.armor, vuln: c.vuln, stripArmor: !!intent.stripArmor });
      const toHp = pred.toHp || 0;
      if (toHp >= c.hp) lethal = true;
      maxRatio = Math.max(maxRatio, toHp / c.maxHp);
    });
    threat = lethal ? 'lethal' : maxRatio >= 0.4 ? 'heavy' : 'mild';
  }

  const staggerBanner = e.staggered ? `<div class="staggered-banner">STAGGERED</div>` : '';
  // Minimal intent: just kind icon + the primary number. Targeting is conveyed by
  // the .targeted-by-enemy glow on the party figures it threatens.
  const intentBubble = e.staggered ? '' : `
    <div class="intent-bubble ${intentClass} threat-${threat}" title="${intent.name}: ${intent.tag} → ${targetTag}">
      <span class="intent-icon">${icon}</span>
      ${num ? `<span class="intent-num">${num}</span>` : ''}
    </div>`;

  // (Affinity row removed — W/R schools no longer surfaced on the figure.
  // Weakness / resistance still affect damage; they're just not telegraphed.)

  fig.innerHTML = `
    ${staggerBanner}
    <div class="figure-portrait">
      ${PORTRAITS[e.id] || ''}
      <div class="figure-statuses">${renderStatuses(e)}</div>
      <div class="figure-hp">
        <div class="hp-fill ${hpPct < 35 ? 'low' : ''}" style="width:${hpPct}%"></div>
        <div class="hp-text">${e.hp}/${e.maxHp}</div>
      </div>
      ${intentBubble}
    </div>
    <div class="figure-shadow"></div>
    <div class="figure-info">
      <div class="figure-name">${def.name}</div>
      <div class="chain-bar"><div class="chain-fill" style="width:${chainPct}%"></div></div>
    </div>
  `;
  bindFigureHold(fig, e.id, false);
  return fig;
}

function renderStatuses(ent) {
  const c = [];
  // Each chip carries data-status so the press-and-hold tooltip handler can
  // resolve its explanation from STATUS_TOOLTIPS without re-parsing classes.
  const chip = (statusId, icon, num, title) =>
    `<span class="status-chip status-${statusId}" data-status="${statusId}"${num != null ? ` data-value="${num}"` : ''} title="${title}"><span class="status-icon">${icon}</span>${num != null ? `<span class="status-num">${num}</span>` : ''}</span>`;
  if (ent.armor > 0)     c.push(chip('armor', '⛨', ent.armor,    `Armor ${ent.armor} — absorbs ${ent.armor} damage before HP. Wears off as it absorbs.`));
  if (ent.bleed > 0)     c.push(chip('bleed', '✤', ent.bleed,    `Bleed ${ent.bleed} — takes 2 damage at the start of each turn (3 with Bloodborne Sigil), then the stack decreases by 1.`));
  if (ent.taunt)         c.push(chip('taunt', '⌖', null,         'Taunt — enemies single-target attacks redirect to this character instead of the original slot.'));
  if (ent.weak > 0)      c.push(chip('weak',  '↓', ent.weak,     `Weak ${ent.weak} — this character's outgoing damage is reduced by 2 for the next ${ent.weak} attack(s).`));
  if (ent.vuln > 0)      c.push(chip('vuln',  '⊕', ent.vuln,     `Vulnerable ${ent.vuln} — next ${ent.vuln} incoming attacks deal +2 damage (+4 with Ember of Wrath Sigil) and consume one stack.`));
  if (ent.retaliate > 0) c.push(chip('retal', '↻', ent.retaliate,`Retaliate ${ent.retaliate} — when hit, counter-attack the front-most enemy for ${ent.retaliate} damage.`));
  if (ent.pendingEffects) ent.pendingEffects.forEach(e => {
    if (e.kind === 'attackBonus')      c.push(chip('pending', '⚔', `+${e.amt}`, `Next attack +${e.amt} damage (one-shot, consumed on use).`));
    else if (e.kind === 'healBonus')   c.push(chip('pending', '✚', `+${e.amt}`, `Next heal +${e.amt} (one-shot, consumed on use).`));
    else                                c.push(chip('pending', '✦', `+${e.amt}`, `Pending +${e.amt}`));
  });
  return c.join('');
}

// Mobile-friendly explanation surface for status chips.  The desktop `title`
// attribute does the job there, but on touch you need press-and-hold.  Bound
// once at boot via event delegation so re-renders don't need rebinding.
const STATUS_TOOLTIPS = {
  armor:    { name: 'Armor',       text: 'Absorbs incoming damage 1:1 before HP. Wears off as it absorbs. Does not regenerate.' },
  bleed:    { name: 'Bleed',       text: 'Takes 2 damage at the start of each turn (+1 with Bloodborne / Bone Tide). Decays by 1 per turn. Ignores armor.' },
  taunt:    { name: 'Taunt',       text: 'Enemy single-target attacks redirect to this hero. Clears at the start of the next turn.' },
  weak:     { name: 'Weak',        text: 'Outgoing attacks deal -2 damage. Consumes 1 stack per attack.' },
  vuln:     { name: 'Vulnerable',  text: 'Incoming hits deal +2 damage per stack (+2 more with Ember of Wrath). One stack is consumed per hit (unless Brand of Doom).' },
  retal:    { name: 'Retaliate',   text: 'When hit, counter-attacks the front-most enemy for this value (+2 with Vow of Vigil). Clears at the start of the next turn.' },
  pending:  { name: 'Pending',     text: 'A one-shot bonus from a synergy. Consumed by the next matching action.' },
};

let _statusTooltipState = null;
function _hideStatusTooltip() {
  const tt = document.getElementById('status-tooltip-active');
  if (tt) tt.remove();
  if (_statusTooltipState && _statusTooltipState.timer) {
    clearTimeout(_statusTooltipState.timer);
  }
  _statusTooltipState = null;
}
function _showStatusTooltip(chip) {
  _hideStatusTooltip();
  const statusId = chip.dataset.status;
  const info = STATUS_TOOLTIPS[statusId];
  if (!info) return;
  const value = chip.dataset.value || '';
  const tt = document.createElement('div');
  tt.id = 'status-tooltip-active';
  tt.className = 'status-tooltip';
  tt.innerHTML = `<div class="st-name">${info.name}${value ? ` <span class="st-val">${value}</span>` : ''}</div><div class="st-text">${info.text}</div>`;
  document.body.appendChild(tt);
  const rect = chip.getBoundingClientRect();
  const tw = tt.offsetWidth;
  const th = tt.offsetHeight;
  let left = rect.left + rect.width / 2 - tw / 2;
  left = Math.max(6, Math.min(left, window.innerWidth - tw - 6));
  let top = rect.top - th - 8;
  if (top < 6) top = rect.bottom + 8;
  tt.style.left = `${left}px`;
  tt.style.top  = `${top}px`;
}
function setupStatusTooltips() {
  if (window._statusTipsBound) return;
  window._statusTipsBound = true;
  const HOLD_MS = 280;
  document.addEventListener('pointerdown', (e) => {
    const chip = e.target.closest && e.target.closest('.status-chip[data-status]');
    if (!chip) return;
    if (_statusTooltipState && _statusTooltipState.timer) clearTimeout(_statusTooltipState.timer);
    _statusTooltipState = {
      chip,
      timer: setTimeout(() => { _showStatusTooltip(chip); }, HOLD_MS),
    };
  }, true);
  const release = () => {
    if (_statusTooltipState) {
      if (_statusTooltipState.timer) clearTimeout(_statusTooltipState.timer);
      setTimeout(_hideStatusTooltip, 80);
    }
  };
  document.addEventListener('pointerup',     release, true);
  document.addEventListener('pointercancel', release, true);
  document.addEventListener('pointerleave',  release, true);
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
  // Combo-eligibility highlight: pull the union of matched-item indices
  // across every available combo so the queue can glow them gold.
  const matchedIdx = new Set();
  if (!state.executing && !state.over) {
    matchingCombos(state.queue).forEach(({ indices }) => indices.forEach(i => matchedIdx.add(i)));
  }
  let used = 0;
  state.queue.forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = `queue-slot filled kind-${item.kind}`;
    if (matchedIdx.has(idx)) el.classList.add('combo-matched');
    el.dataset.atb = String(item.atb || 1);
    const portraitSvg = item.charId ? (PORTRAITS[item.charId] || '') : '';
    // combo items (Resonance) get a glyph stack instead of a single portrait
    const teamGlyph = item.kind === 'combo'
      ? '<svg class="qs-team" viewBox="0 0 24 24" aria-hidden="true"><path d="M 12 3 L 21 12 L 12 21 L 3 12 Z" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>'
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
    // Mark the trailing N cells as "bonus" when bonus ATB is active.  The
    // bonus comes from exploiting an enemy weakness last turn (free ATB
    // this turn).  Title tooltip explains it on hover/long-tap.
    const cellIdx = used + i;
    if (bonus && cellIdx >= (atbMax - bonus)) {
      ph.classList.add('bonus');
      ph.title = 'Bonus ATB — earned last turn by exploiting a weakness';
    }
    ph.dataset.atb = '1';
    ph.innerHTML = `<span class="qs-name">${ph.classList.contains('bonus') ? '★' : '·'}</span>`;
    strip.appendChild(ph);
  }
}

// Resonance Rail — surfaces any Combos available from the current queue.
// Each chip is a tap-to-fuse button.  When the queue is empty or has no
// matches, the rail is hidden so it never crowds combat.
function renderTeamSpecial() {
  const area = $('#ts-area');
  if (!area) return;
  area.innerHTML = '';
  // Don't show during resolution
  if (state.executing || state.over) { area.classList.add('hidden'); return; }
  const matches = matchingCombos(state.queue);
  const partials = partialCombos(state.queue).slice(0, 3); // cap so the rail doesn't flood
  if (matches.length === 0 && partials.length === 0) { area.classList.add('hidden'); return; }
  area.classList.remove('hidden');
  area.classList.add('resonance-rail');
  matches.forEach(({ combo }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `resonance-chip resonance-${combo.tier}${combo.sigTier ? ' resonance-sig' : ''}`;
    const tierLabel = combo.sigTier
      ? (combo.tier === 'triple' ? 'SIG TRIPLE' : 'SIG DUO')
      : (combo.tier === 'triple' ? 'TRIPLE' : 'DUO');
    btn.innerHTML = `
      <span class="rc-label">${combo.name}</span>
      <span class="rc-tier">${tierLabel}</span>
      <span class="rc-desc">${combo.desc}</span>
    `;
    btn.title = `Resonance · ${combo.name}: ${combo.desc}`;
    btn.addEventListener('click', () => commitCombo(combo.id));
    area.appendChild(btn);
  });
  // Near-miss chips — combos one action away.  Non-clickable indicators that
  // surface the SETUP, not the payoff.  Sig-tier partials keep the cool-blue
  // palette so the player can tell which class of combo is on offer.
  partials.forEach(({ combo, missing }) => {
    const heroName = CHARS[missing.heroId]?.name || missing.heroId;
    const kindLabel = missing.kind === 'sig' ? 'Special' : 'Attack';
    const chip = document.createElement('div');
    chip.className = `resonance-chip resonance-partial resonance-${combo.tier}${combo.sigTier ? ' resonance-sig' : ''}`;
    const tierLabel = combo.sigTier
      ? (combo.tier === 'triple' ? 'SIG TRIPLE' : 'SIG DUO')
      : (combo.tier === 'triple' ? 'TRIPLE' : 'DUO');
    chip.innerHTML = `
      <span class="rc-label">${combo.name}</span>
      <span class="rc-tier">${tierLabel}</span>
      <span class="rc-desc">+ ${heroName} ${kindLabel}</span>
    `;
    chip.title = `One action away · ${combo.name}: ${combo.desc}`;
    area.appendChild(chip);
  });
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
  // Each action KIND (attack/special/move/brace) may only be queued once
  // per character per turn — moves dedup on kind only so a char can't
  // shuffle forward + backward to bypass the rule.
  const alreadyQueuedThisAction = state.queue.some(q => q.charId === charId && q.kind === kind);
  t.disabled = !preview.valid || c.downed || state.executing || state.over || teamLocked
    || atbCost > queueAtbAvailable()
    || resolveCost > queueAvailableResolve()
    || atCharCap
    || alreadyQueuedThisAction;
  if (atCharCap && !c.downed) t.classList.add('char-capped');
  if (alreadyQueuedThisAction && !c.downed) t.classList.add('action-used');
  // De-emphasize when the action would land but produce no effect (e.g. an
  // attack whose reach holds only empty slots).  Still clickable.
  if (preview.noEffect && !t.disabled) t.classList.add('no-effect');
  // Combo-ready glow — queueing THIS tile would complete a fresh Resonance
  // that isn't already on offer.  Maps tile.kind to combo.kind:
  //   attack → 'attack', special → 'sig'.  Move/brace never trigger.
  if (!t.disabled && (kind === 'attack' || kind === 'special')) {
    const comboKind = kind === 'special' ? 'sig' : 'attack';
    const simulated = state.queue.concat([{ charId, kind: comboKind, atb: atbCost }]);
    const existingIds = new Set(matchingCombos(state.queue).map(m => m.combo.id));
    const wouldComplete = matchingCombos(simulated).filter(m => !existingIds.has(m.combo.id));
    if (wouldComplete.length) {
      const combo = wouldComplete[0].combo;
      t.classList.add('tile-combo-ready');
      if (combo.sigTier) t.classList.add('tile-combo-sig');
      t.dataset.combo = combo.name;
    }
  }
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

// reach-label shown statically on damaging tiles ("F" / "MB" / "FMB" / "low").
// Uses the queue-aware snapshot so a queued Move shifts the slot's reach.
function previewReachLabel(kind, charId, dir) {
  if (kind !== 'attack' && kind !== 'special') return '';
  const s = getPreviewState();
  const slot = slotOfChar(s, charId);
  if (!slot) return '';
  const variant = getTech(s, charId, slot, kind === 'special' ? 'sig' : 'basic');
  if (!variant || !variant.reach) return '';
  const letters = variant.reach.map(r => r[0].toUpperCase()).join('');
  if (variant.pattern === 'all')    return `hit ${letters}`;
  if (variant.pattern === 'lowest') return `low ${letters}`;
  return letters;
}

// Dry-run the entire current queue on a deep clone of state, suppressing
// DOM side-effects. Returns the post-queue clone. Callers should treat the
// clone as the "what does the world look like right before this held action
// would fire?" snapshot for queue-aware damage/heal previews.
function getPreviewState() {
  if (!state.queue || state.queue.length === 0) return state;
  let clone;
  try { clone = structuredClone(state); }
  catch (_) { return state; }  // fall back to live state if structuredClone unsupported
  const real = state;
  state = clone;
  __simulating = true;
  try {
    clone.queue.forEach(item => {
      try { executeQueueItem(clone, item); } catch (_) {}
    });
    clone.queue = [];
  } finally {
    state = real;
    __simulating = false;
  }
  return clone;
}

// Where does the actor end up if a movement-tagged tech fires from `fromSlot`?
function moveDestSlotFor(fromSlot, moveType) {
  if (!fromSlot || !moveType) return null;
  const idx = SLOTS.indexOf(fromSlot);
  if (idx < 0) return null;
  if (moveType === 'advance')     return idx > 0 ? SLOTS[idx - 1] : fromSlot;
  if (moveType === 'retreat')     return idx < 2 ? SLOTS[idx + 1] : fromSlot;
  if (moveType === 'retreatFull') return SLOTS[2];
  return null;
}

// returns the set of enemy slot names that would be hit if the tile fired now,
// plus a per-target damage prediction (dmg + WEAK!/RESIST/STG badge) for damaging tiles,
// plus a move destination if the tech repositions the actor.
// Reads from a queue-aware snapshot so chains like Cleave→Sunder reflect compounded vuln.
function previewTargetsForTile(kind, charId, dir) {
  const s = getPreviewState();
  if (kind === 'attack' || kind === 'special') {
    const slot = slotOfChar(s, charId);
    if (!slot) return { enemySlots: [], partySlots: [], enemyHits: [], partyHeals: [], moveSlots: [] };
    const variant = getTech(s, charId, slot, kind === 'special' ? 'sig' : 'basic');
    const targets = resolveTargets(s, variant) || [];
    const enemyHits = targets.map(e => {
      const sl = SLOTS.find(sl => s.enemies.slots[sl] === e.id);
      if (!sl) return null;
      if (typeof variant.dmg !== 'number') return { slot: sl };
      const r = previewMultiHit(s, e, variant.dmg, charId, variant.hits || 1);
      const kill = !e.dead && r.dmg >= e.hp;
      return { slot: sl, dmg: r.dmg, badge: r.badge, kill };
    }).filter(Boolean);
    const enemySlots = enemyHits.map(h => h.slot);
    const partyHeals = resolveHealTargets(s, variant, charId).map(c => {
      const sl = slotOfChar(s, c.id);
      if (!sl) return null;
      return { slot: sl, heal: previewHeal(s, c, variant.heal, charId) };
    }).filter(Boolean);
    const partySlots = partyHeals.map(h => h.slot);
    const moveSlots = [];
    if (variant.move) {
      const dest = moveDestSlotFor(slot, variant.move);
      if (dest && dest !== slot) moveSlots.push({ from: slot, to: dest });
    }
    return { enemySlots, partySlots, enemyHits, partyHeals, moveSlots };
  }
  if (kind === 'move') {
    const slot = slotOfChar(s, charId);
    if (!slot) return { enemySlots: [], partySlots: [], enemyHits: [], moveSlots: [] };
    const idx = SLOTS.indexOf(slot);
    const ti = idx + dir;
    if (ti < 0 || ti > 2) return { enemySlots: [], partySlots: [], enemyHits: [], moveSlots: [] };
    return { enemySlots: [], partySlots: [SLOTS[ti]], enemyHits: [], moveSlots: [{ from: slot, to: SLOTS[ti] }] };
  }
  return { enemySlots: [], partySlots: [], enemyHits: [], moveSlots: [] };
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

function applyPreviewHighlight({ enemySlots, partySlots, enemyHits, partyHeals, moveSlots }) {
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
  // Don't double-mark a slot if it's both a heal target AND a move destination
  const moveDestSet = new Set((moveSlots || []).map(m => m.to));
  (partySlots || []).forEach(sl => {
    if (moveDestSet.has(sl)) return; // move dest is rendered below with a distinct marker
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
  // Move destination — soft gold halo on the destination figure + a directional
  // tag below it. Source figure dims so the journey reads as "from here → to there".
  (moveSlots || []).forEach(({ from, to }) => {
    const dest = document.querySelector(`#party-half .figure[data-slot="${to}"]`);
    if (dest) {
      dest.classList.add('move-dest');
      const fromIdx = SLOTS.indexOf(from);
      const toIdx = SLOTS.indexOf(to);
      // back-display has back on left, so toIdx > fromIdx = visually moving left
      const movingLeft = toIdx > fromIdx;
      const glyph = movingLeft ? '‹' : '›';
      const tag = document.createElement('div');
      tag.className = 'target-move-tag';
      tag.innerHTML = `<span class="move-glyph">${glyph}</span><span class="move-text">${SLOT_LABELS[to] || ''}</span>`;
      dest.appendChild(tag);
    }
    const src = document.querySelector(`#party-half .figure[data-slot="${from}"]`);
    if (src) {
      src.classList.add('move-src');
      // Big direction arrow anchored to the source, pointing toward the
      // destination.  Side of the figure is determined by movement direction
      // (back-display puts back on left, so advance = arrow on right).
      const fromIdx2 = SLOTS.indexOf(from);
      const toIdx2 = SLOTS.indexOf(to);
      const movingLeft2 = toIdx2 > fromIdx2;
      const arrow = document.createElement('div');
      arrow.className = `move-from-arrow ${movingLeft2 ? 'arrow-left' : 'arrow-right'}`;
      arrow.textContent = movingLeft2 ? '‹' : '›';
      src.appendChild(arrow);
    }
  });
}
function clearPreviewHighlight() {
  document.querySelectorAll('.target-marker').forEach(el => el.classList.remove('target-marker'));
  document.querySelectorAll('.move-dest').forEach(el => el.classList.remove('move-dest'));
  document.querySelectorAll('.move-src').forEach(el => el.classList.remove('move-src'));
  document.querySelectorAll('.target-dmg-label, .target-heal-label, .target-move-tag, .move-from-arrow').forEach(el => el.remove());
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

// (Old team-special tile builder removed — replaced by the Resonance Rail
// in renderTeamSpecial.  Combos are surfaced as fuse chips when the
// queue contains matching ingredients.)

function renderFightButton() {
  const btn = $('#btn-fight');
  const canFight = state.queue.length > 0 && !state.executing && !state.over;
  btn.disabled = !canFight;
}

// Message log was retired — popups + chips carry per-action info now.
// log() is kept as a no-op so existing engine call sites stay quiet.
function log(_html) { /* intentionally empty */ }
function flashMsg(_text) { /* intentionally empty */ }

// ============================================================================
// POPUPS + FLASHES — visual juice
// ============================================================================

// Global flag set during dry-run simulation (queue-aware previews) so
// DOM-mutating helpers (popups, flashes) no-op without touching the page.
let __simulating = false;

function spawnPopupId(id, text, type, side) {
  if (__simulating) return;
  // resolve side automatically if not given
  let cardEl;
  if (side) cardEl = document.querySelector(`#${side === 'enemy' ? 'enemy' : 'party'}-half [data-id="${id}"]`);
  if (!cardEl) cardEl = document.querySelector(`#battlefield [data-id="${id}"]`);
  if (!cardEl) return;
  spawnPopup(cardEl, text, type);
}

// Tiny floating emoji reaction over a character — used for bond/friction
// triggers, kills, and other manga-style beats.  Looks similar to a popup
// but its own CSS class so we can style it bigger / fluffier.
// Kill confetti — 8 small sparks fly outward from the dying card and
// fade.  Called from killEnemy for that "this one is gone" beat.
// Optional `actorSchool` tints the sparks per the killer's school so
// each character's kills feel slightly different.
const SPARK_TINT = {
  physical: 'rgba(255,220,160,0.95)',
  stealth:  'rgba(160,200,255,0.95)',
  ranged:   'rgba(220,190,140,0.95)',
  arcane:   'rgba(200,160,240,0.95)',
  holy:     'rgba(255,240,180,0.95)',
};
function spawnKillSparks(id, side, actorSchool) {
  if (__simulating) return;
  let cardEl;
  if (side) cardEl = document.querySelector(`#${side === 'enemy' ? 'enemy' : 'party'}-half [data-id="${id}"]`);
  if (!cardEl) cardEl = document.querySelector(`#battlefield [data-id="${id}"]`);
  if (!cardEl) return;
  const layer = $('#popup-layer');
  const stage = $('#stage');
  if (!layer || !stage) return;
  const r = cardEl.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  const cx = r.left + r.width / 2 - s.left;
  const cy = r.top  + r.height * 0.5 - s.top;
  const tint = SPARK_TINT[actorSchool] || SPARK_TINT.physical;
  for (let i = 0; i < 8; i++) {
    const el = document.createElement('div');
    el.className = 'kill-spark';
    const ang = (Math.PI * 2 * i / 8) + (Math.random() - 0.5) * 0.5;
    const dist = 40 + Math.random() * 28;
    el.style.background = tint;
    el.style.left = cx + 'px';
    el.style.top  = cy + 'px';
    el.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    el.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
    layer.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }
}

// Per-hero combat barks — short lines that fire occasionally on key
// moments (low HP, kill, bond fire).  Heavily deduped via _barkCooldown
// so the same hero doesn't repeat a line too often.
const BARKS = {
  kai: {
    lowHp: ["I'm not done.", "Keep climbing.", "Hold."],
    kill:  ["Clean.", "Next.", "Forward."],
    bond:  ["Ready.", "With you."],
  },
  cassia: {
    lowHp: ["Hold the line.", "I have stood through worse.", "I do not yield."],
    kill:  ["The line holds.", "For the banner.", "One more."],
    bond:  ["I see you.", "Together."],
  },
  elin: {
    lowHp: ["Mercy still has weight.", "I will mend if I can.", "Do not fall."],
    kill:  ["A small mercy.", "May they rest."],
    bond:  ["I am here.", "Carry on."],
  },
  branwen: {
    lowHp: ["Quiver is light.", "I need a moment.", "Cover me."],
    kill:  ["One arrow.", "Counted.", "Back to the quiver."],
    bond:  ["Mark them.", "Loose."],
  },
  korin: {
    lowHp: ["I will not break.", "Strike me again.", "Come on, then."],
    kill:  ["Stand down.", "That's one.", "Down."],
    bond:  ["I have you.", "Wall stands."],
  },
  ash: {
    lowHp: ["...quietly now.", "Less seen.", "Veil closer."],
    kill:  ["...gone.", "Quiet.", "Unseen."],
    bond:  ["...with you.", "Veiled."],
  },
  mira: {
    lowHp: ["Bleed me later.", "I am still here.", "Tch."],
    kill:  ["Done.", "Clean."],
    bond:  ["Step lightly.", "Move."],
  },
};
const _barkCooldown = new Map(); // key: `${id}|${trigger}` -> last-fire ts
const BARK_COOLDOWN_MS = 4000;
function spawnBark(charId, trigger) {
  if (typeof __simulating !== 'undefined' && __simulating) return;
  const lines = BARKS[charId] && BARKS[charId][trigger];
  if (!lines || !lines.length) return;
  const key = `${charId}|${trigger}`;
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const last = _barkCooldown.get(key);
  if (last && (now - last) < BARK_COOLDOWN_MS) return;
  _barkCooldown.set(key, now);
  const text = lines[Math.floor(Math.random() * lines.length)];
  const cardEl = document.querySelector(`#party-half [data-id="${charId}"]`);
  if (!cardEl) return;
  const stage = $('#stage'); const layer = $('#popup-layer');
  if (!stage || !layer) return;
  const r = cardEl.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'combat-bark';
  el.textContent = text;
  el.style.left = (r.left + r.width / 2 - s.left) + 'px';
  el.style.top  = (r.top - s.top + Math.max(28, r.height * 0.16)) + 'px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function spawnReaction(id, emoji, side) {
  if (__simulating) return;
  let cardEl;
  if (side) cardEl = document.querySelector(`#${side === 'enemy' ? 'enemy' : 'party'}-half [data-id="${id}"]`);
  if (!cardEl) cardEl = document.querySelector(`#battlefield [data-id="${id}"]`);
  if (!cardEl) return;
  const layer = $('#popup-layer');
  const stage = $('#stage');
  if (!layer || !stage) return;
  const r = cardEl.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'reaction-bubble';
  el.textContent = emoji;
  el.style.left = (r.left + r.width / 2 - s.left) + 'px';
  // Start near the head — same logic as spawnPopup
  el.style.top  = (r.top - s.top + Math.max(28, r.height * 0.18)) + 'px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

// Small popup labeled with the passive name when one fires.  Goes through
// the same dedup window as other popups so multi-hit attacks don't spam.
function spawnPassivePopup(id, name) {
  if (__simulating) return;
  spawnPopupId(id, name, 'passive', 'party');
}

// Small popup naming a sigil when its on-trigger effect fires (kill, post-
// turn heal, damage reduction).  Reuses the passive popup style so the
// visual language for "something in your build proc'd" is consistent.
function spawnSigilPopup(id, sigilId) {
  if (__simulating) return;
  const sg = SIGILS[sigilId];
  if (!sg) return;
  spawnPopupId(id, sg.name.toUpperCase(), 'passive', 'party');
}

// Sequential popup pacing: damage / heal numbers fired in rapid succession
// (multi-hit attacks, AoE) used to land at the same instant on the same
// pixel and looked like one number.  Stagger them so each pops in turn.
// Also dedupe — if the same text was just spawned on the same target
// (e.g., a synergy that fires once per ally hit, applied 3x to the same
// character), suppress the repeats within a short window.
let _popupNextDue = 0;
const POPUP_STAGGER_MS = 130;
const POPUP_DEDUP_MS = 900;
const _popupRecent = new Map(); // key: `${id}|${text}` -> last fire timestamp
function spawnPopup(cardEl, text, type='dmg') {
  const layer = $('#popup-layer');
  const stage = $('#stage');
  if (!cardEl || !layer || !stage) return;
  // Dedup window — same target + same exact text fires at most once per
  // POPUP_DEDUP_MS.  Damage numbers won't ever collide (they include the
  // hit value), but status / synergy name spam will.
  const dedupKey = `${cardEl.dataset.id || ''}|${text}`;
  const now = performance.now();
  const last = _popupRecent.get(dedupKey);
  if (last && (now - last) < POPUP_DEDUP_MS) return;
  _popupRecent.set(dedupKey, now);
  // Keep the dedup map from growing unbounded — sweep expired entries.
  if (_popupRecent.size > 64) {
    for (const [k, t] of _popupRecent) if ((now - t) > POPUP_DEDUP_MS) _popupRecent.delete(k);
  }

  const r = cardEl.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  const due = Math.max(_popupNextDue, now);
  _popupNextDue = due + POPUP_STAGGER_MS;
  const delay = due - now;
  // Snapshot positions NOW so a card that moves/dies during the delay
  // doesn't drag the popup off-screen.
  const left = (r.left + r.width / 2 - s.left);
  const top  = (r.top - s.top + Math.max(36, r.height * 0.22));
  const fire = () => {
    const el = document.createElement('div');
    el.className = `popup ${type}`;
    el.textContent = text;
    el.style.left = left + 'px';
    el.style.top  = top + 'px';
    layer.appendChild(el);
    setTimeout(() => el.remove(), 950);
  };
  if (delay <= 0) fire(); else setTimeout(fire, delay);
}

function flashCardId(id, type, side) {
  if (__simulating) return;
  let cardEl;
  if (side) cardEl = document.querySelector(`#${side === 'enemy' ? 'enemy' : 'party'}-half [data-id="${id}"]`);
  if (!cardEl) cardEl = document.querySelector(`#battlefield [data-id="${id}"]`);
  if (!cardEl) return;
  cardEl.classList.add(`${type}-flash`);
  setTimeout(() => cardEl.classList.remove(`${type}-flash`), 600);
}

// Paint the active biome layer.  Reads state.run.modifier and applies one
// of the biome-* classes; null modifier wipes the layer.  Safe to call
// repeatedly (idempotent).
// Press-and-hold detection for map nodes.  Holding for 350ms surfaces a
// tooltip with the node's details and SUPPRESSES the tap (so the player
// doesn't accidentally commit while browsing the path).  A short tap
// triggers onCommit() if the node is reachable.
function bindNodeHoldOrTap(el, node, onCommit) {
  const HOLD_MS = 350;
  let timer = null;
  let triggered = false;
  let downPos = null;
  el.addEventListener('pointerdown', (e) => {
    triggered = false;
    downPos = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => {
      triggered = true;
      showNodeTooltip(el, node);
      timer = null;
    }, HOLD_MS);
  });
  const cancelTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };
  el.addEventListener('pointerup', (e) => {
    cancelTimer();
    if (triggered) { e.preventDefault(); e.stopPropagation(); return; }
    if (typeof onCommit === 'function') onCommit();
  });
  el.addEventListener('pointerleave', () => { cancelTimer(); });
  el.addEventListener('pointercancel', () => { cancelTimer(); });
  // If the pointer drags more than ~10px, treat it as a scroll, not a tap.
  el.addEventListener('pointermove', (e) => {
    if (!downPos) return;
    const dx = e.clientX - downPos.x, dy = e.clientY - downPos.y;
    if (dx*dx + dy*dy > 100) { cancelTimer(); }
  });
}

// Anchor a floating tooltip near the held node with name, type, enemies,
// and reward hints.  Dismissed when the user taps elsewhere or scrolls.
function showNodeTooltip(anchorEl, node) {
  hideNodeTooltip();
  const tt = document.createElement('div');
  tt.id = 'node-tooltip';
  const enc = node.enc;
  const status = mapNodeStatus(state, node.id);
  const typeLabel = ({
    elite:  'Elite',
    boss:   'Boss',
    combat: 'Combat',
    rest:   'Rest',
    event:  'Event',
  })[node.type] || node.type;
  const sigilCat = node.type === 'elite' && enc && enc.sigilCategory ? enc.sigilCategory : null;
  const name = node.type === 'rest'  ? 'Hollow Rest'
             : node.type === 'event' ? (EVENTS[node.eventId]?.name || 'Strange Encounter')
             : (enc?.name || node.type);
  const enemyChips = (node.type === 'rest' || node.type === 'event')
    ? ''
    : SLOTS.map(sl => {
        const eid = enc && enc.slots ? enc.slots[sl] : null;
        if (!eid) return '';
        const def = ENEMIES[eid];
        return `<span class="nt-enemy">${def?.name || eid}</span>`;
      }).join('');
  const rewardLine = node.type === 'rest'
    ? 'Heal · Hone an upgrade · Or bind a sigil — choose one.'
    : node.type === 'event' ? 'Choice with consequences.'
    : node.type === 'boss' ? 'The Wakeling.  No escape but through.'
    : node.type === 'elite' ? `Tech upgrade.${sigilCat ? ` Themed: ${sigilCat}.` : ''}`
    : 'Affinity progression.';
  tt.innerHTML = `
    <div class="nt-name">${name}</div>
    <div class="nt-type">${typeLabel}${status !== 'reachable' ? ` · ${status}` : ''}</div>
    ${enemyChips ? `<div class="nt-enemies">${enemyChips}</div>` : ''}
    <div class="nt-reward">${rewardLine}</div>
  `;
  document.body.appendChild(tt);
  const r = anchorEl.getBoundingClientRect();
  const ttRect = tt.getBoundingClientRect();
  // Try to place above the node; flip below if it'd clip the top.
  let top  = r.top - ttRect.height - 10;
  if (top < 8) top = r.bottom + 10;
  let left = r.left + r.width / 2 - ttRect.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - ttRect.width - 8));
  tt.style.top  = top + 'px';
  tt.style.left = left + 'px';
  // Auto-dismiss on the next outside tap or after 6 seconds.
  setTimeout(hideNodeTooltip, 6000);
  setTimeout(() => {
    document.addEventListener('pointerdown', _ttDismissHandler, true);
  }, 0);
}
function _ttDismissHandler(e) {
  const tt = document.getElementById('node-tooltip');
  if (tt && !tt.contains(e.target)) hideNodeTooltip();
}
function hideNodeTooltip() {
  const tt = document.getElementById('node-tooltip');
  if (tt) tt.remove();
  document.removeEventListener('pointerdown', _ttDismissHandler, true);
}

// Boss intro: name reveal with darken + fade.  Calls `then` after ~1.4s.
// Used for entering The Wakeling fight.
function showBossIntro(opts, then) {
  const root = document.getElementById('boss-intro');
  if (!root) { if (then) then(); return; }
  const ey = document.getElementById('bi-eyebrow');
  const nm = document.getElementById('bi-name');
  const tg = document.getElementById('bi-tag');
  if (ey) ey.textContent = opts?.eyebrow || 'SIN OF THE DAWN';
  if (nm) nm.textContent = opts?.name    || 'THE WAKELING';
  if (tg) tg.textContent = opts?.tag     || 'It does not flinch.';
  root.classList.remove('hidden');
  root.classList.add('intro');
  Audio.kill(); // low ominous stinger reused
  setTimeout(() => {
    root.classList.add('out');
    setTimeout(() => {
      root.classList.add('hidden');
      root.classList.remove('intro', 'out');
      if (then) then();
    }, 500);
  }, 1300);
}

// Defeat moment: mirrors the boss-kill spectacle in reverse — the stage
// desaturates and dims, a slow blood-tinted flash washes across the
// screen, and a brief "FALLEN" title is hinted before the run summary
// cascade fires.  Called from checkEnd when the party wipes.
function playDefeatIntro() {
  if (__simulating) return;
  document.body.classList.add('party-fallen');
  Audio.kill();
  setTimeout(() => {
    // Linger the desaturate; the body class is removed when the player
    // dismisses the run summary back to the title.
    shakeScreen(2);
  }, 320);
  // Quietly clear the class when returning to title later — wired into
  // hideOverlay so the next screen starts clean.
}

// Boss death slow-mo: dim the screen, slow CSS animations, brief flash.
// Called from killEnemy when a boss falls.  Calls `then` after the
// effect completes (so the run-summary cascade still fires).
function playBossDeath(then) {
  const stage = $('#stage');
  if (stage) stage.classList.add('boss-slowmo');
  document.body.classList.add('boss-killed');
  setTimeout(() => {
    if (stage) stage.classList.remove('boss-slowmo');
    document.body.classList.remove('boss-killed');
    if (then) then();
  }, 1400);
}

function applyBiomeBackground() {
  const layer = document.getElementById('biome-layer');
  if (!layer) return;
  const biomes = ['burning','bonetide','withered','veiled','fortified','hunger'];
  biomes.forEach(b => layer.classList.remove(`biome-${b}`));
  const mod = state && state.run && state.run.modifier;
  if (mod) layer.classList.add(`biome-${mod}`);
  // Start the matching ambient drone (or a default one) so the silence
  // between actions has weight.  Mute toggle mutes everything.
  if (Audio && typeof Audio.startAmbient === 'function') Audio.startAmbient(mod);
}

// ============================================================================
// GAME FEEL — shake / flash / hit-pause / move ghost trail
// ============================================================================

// Per-card hit shake; remove + re-add the class so the animation restarts
// even on rapid successive hits.
function shakeCardId(id, side, intensity) {
  if (__simulating) return;
  let cardEl;
  if (side) cardEl = document.querySelector(`#${side === 'enemy' ? 'enemy' : 'party'}-half [data-id="${id}"]`);
  if (!cardEl) cardEl = document.querySelector(`#battlefield [data-id="${id}"]`);
  if (!cardEl) return;
  const cls = intensity >= 6 ? 'hit-shake-hard' : 'hit-shake';
  cardEl.classList.remove(cls);
  // Force a reflow so the animation restarts when the class is re-added.
  void cardEl.offsetWidth;
  cardEl.classList.add(cls);
  setTimeout(() => cardEl.classList.remove(cls), 320);
}

// Whole-stage shake on big hits / kills.  intensity 1-3 scales magnitude.
function shakeScreen(intensity) {
  if (__simulating) return;
  const stage = $('#stage');
  if (!stage) return;
  const cls = intensity >= 3 ? 'stage-shake-hard' : intensity >= 2 ? 'stage-shake' : 'stage-shake-soft';
  stage.classList.remove('stage-shake-soft', 'stage-shake', 'stage-shake-hard');
  void stage.offsetWidth;
  stage.classList.add(cls);
  setTimeout(() => stage.classList.remove(cls), 360);
}

// Hit-pause — briefly freeze the resolution clock for a beat after a lethal
// or massive hit so the moment lands.  Resolution loops respect this by
// adding `_hitPauseMs` to their next-step timeout.
let _hitPauseMs = 0;
function hitPause(ms) { _hitPauseMs = Math.max(_hitPauseMs, ms || 80); }
function consumeHitPause() {
  const v = _hitPauseMs;
  _hitPauseMs = 0;
  return v;
}

// ============================================================================
// AUDIO — Web Audio API synth-only sfx so we don't ship any sample files.
// Lazily creates an AudioContext on the first user gesture so mobile browsers
// don't block playback.  Toggleable via Audio.toggleMute().
// ============================================================================
const Audio = (() => {
  let ctx = null;
  let masterGain = null;
  let muted = false;
  try { muted = localStorage.getItem('kizuna.muted') === '1'; } catch (_) {}

  function ensure() {
    if (ctx) return ctx;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : 0.5;
      masterGain.connect(ctx.destination);
    } catch (_) { ctx = null; }
    return ctx;
  }
  function isMuted() { return muted; }
  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem('kizuna.muted', muted ? '1' : '0'); } catch (_) {}
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
    return muted;
  }
  function _tone({ freq=440, type='sine', dur=0.12, attack=0.005, decay=0.08, gain=0.2, sweep=0 }) {
    const c = ensure();
    if (!c || muted) return;
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), c.currentTime + dur);
    env.gain.setValueAtTime(0, c.currentTime);
    env.gain.linearRampToValueAtTime(gain, c.currentTime + attack);
    env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + attack + decay);
    osc.connect(env);
    env.connect(masterGain);
    osc.start();
    osc.stop(c.currentTime + dur + 0.05);
  }
  function _noise({ dur=0.08, gain=0.15, hp=200, lp=4000 }) {
    const c = ensure();
    if (!c || muted) return;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = c.createBufferSource(); src.buffer = buf;
    const hpF = c.createBiquadFilter(); hpF.type = 'highpass'; hpF.frequency.value = hp;
    const lpF = c.createBiquadFilter(); lpF.type = 'lowpass';  lpF.frequency.value = lp;
    const env = c.createGain();
    env.gain.setValueAtTime(0, c.currentTime);
    env.gain.linearRampToValueAtTime(gain, c.currentTime + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(hpF); hpF.connect(lpF); lpF.connect(env); env.connect(masterGain);
    src.start();
    src.stop(c.currentTime + dur + 0.02);
  }
  return {
    isMuted, toggleMute, ensure,
    attack() { _noise({ dur: 0.09, gain: 0.10, hp: 800, lp: 6000 }); },
    hit(intensity = 1) {
      // A short low thump + a slap of noise
      _tone({ freq: 90 + Math.random()*10, type: 'sine', dur: 0.14, gain: 0.22 * Math.min(1.4, intensity * 0.6), sweep: -30 });
      _noise({ dur: 0.05 + 0.02*intensity, gain: 0.08 * intensity, hp: 600, lp: 3500 });
    },
    heal() {
      _tone({ freq: 660, type: 'triangle', dur: 0.18, gain: 0.12, sweep: 200 });
      setTimeout(() => _tone({ freq: 990, type: 'triangle', dur: 0.14, gain: 0.10, sweep: 100 }), 80);
    },
    kill() {
      _tone({ freq: 220, type: 'sawtooth', dur: 0.22, gain: 0.18, sweep: -120 });
      _noise({ dur: 0.18, gain: 0.10, hp: 200, lp: 1800 });
    },
    armor() { _tone({ freq: 380, type: 'square', dur: 0.10, gain: 0.10, sweep: 80 }); },
    queue() { _tone({ freq: 720, type: 'triangle', dur: 0.05, gain: 0.06 }); },
    ui()    { _tone({ freq: 540, type: 'sine',     dur: 0.06, gain: 0.05 }); },

    // ===== Per-school hit variations =====
    // Layered ON TOP of the generic Audio.hit() base so existing call
    // sites still produce a thump; the school-specific call adds the
    // distinguishing color (chime / hiss / twang / bell).
    hitSchool(intensity = 1, school) {
      // Base thump (same as Audio.hit)
      _tone({ freq: 90 + Math.random()*10, type: 'sine', dur: 0.14, gain: 0.22 * Math.min(1.4, intensity * 0.6), sweep: -30 });
      _noise({ dur: 0.05 + 0.02*intensity, gain: 0.08 * intensity, hp: 600, lp: 3500 });
      // School flavor
      switch (school) {
        case 'physical':
          _noise({ dur: 0.06, gain: 0.06 * intensity, hp: 200, lp: 1500 });
          break;
        case 'stealth':
          _noise({ dur: 0.08, gain: 0.05 * intensity, hp: 2400, lp: 8000 });
          break;
        case 'ranged':
          _tone({ freq: 480 + Math.random()*120, type: 'square', dur: 0.06, gain: 0.06, sweep: -180 });
          break;
        case 'arcane':
          _tone({ freq: 880, type: 'triangle', dur: 0.18, gain: 0.07, sweep: 220 });
          setTimeout(() => _tone({ freq: 1320, type: 'triangle', dur: 0.14, gain: 0.05, sweep: 100 }), 30);
          break;
        case 'holy':
          _tone({ freq: 660, type: 'sine', dur: 0.22, gain: 0.08, sweep: 60 });
          _tone({ freq: 990, type: 'sine', dur: 0.16, gain: 0.05, sweep: 40 });
          break;
      }
    },

    // ===== Ambient drone — biome-tuned background pad =====
    // Long-tailed sine + fifth + filtered noise.  startAmbient is idempotent
    // (replaces any prior layer); stopAmbient fades out cleanly.
    _ambient: null,
    startAmbient(biome) {
      const c = ensure();
      if (!c) return;
      this.stopAmbient();
      if (muted) return; // respect mute; resumes on toggle via stopAmbient/start cycle
      const presets = {
        // Title screen — slow rising low pad with a slight chime tier
        title:     { root: 73,  fifth: 110, lp: 800,  noiseGain: 0.018,gain: 0.04, type: 'sine' },
        burning:   { root: 110, fifth: 165, lp: 600,  noiseGain: 0.04, gain: 0.05, type: 'sawtooth' },
        bonetide:  { root: 80,  fifth: 120, lp: 400,  noiseGain: 0.05, gain: 0.045,type: 'sine' },
        withered:  { root: 90,  fifth: 0,   lp: 1200, noiseGain: 0.07, gain: 0.04, type: 'triangle' },
        veiled:    { root: 220, fifth: 330, lp: 800,  noiseGain: 0.025,gain: 0.04, type: 'triangle' },
        fortified: { root: 65,  fifth: 98,  lp: 320,  noiseGain: 0.03, gain: 0.05, type: 'sawtooth' },
        hunger:    { root: 75,  fifth: 113, lp: 380,  noiseGain: 0.04, gain: 0.05, type: 'sine' },
      };
      const p = presets[biome] || { root: 100, fifth: 150, lp: 700, noiseGain: 0.03, gain: 0.04, type: 'sine' };
      const out = c.createGain(); out.gain.value = 0;
      out.connect(masterGain);
      // Two oscillators: root + fifth (skip fifth if 0)
      const o1 = c.createOscillator(); o1.type = p.type; o1.frequency.value = p.root;
      const o2 = p.fifth ? c.createOscillator() : null;
      if (o2) { o2.type = p.type; o2.frequency.value = p.fifth; }
      // Soft LFO on the gain so the drone "breathes"
      const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.13;
      const lfoG = c.createGain(); lfoG.gain.value = p.gain * 0.4;
      lfo.connect(lfoG); lfoG.connect(out.gain);
      // Filtered noise pad
      const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
      const noise = c.createBufferSource(); noise.buffer = buf; noise.loop = true;
      const lpF = c.createBiquadFilter(); lpF.type = 'lowpass'; lpF.frequency.value = p.lp;
      const noiseGain = c.createGain(); noiseGain.gain.value = p.noiseGain;
      noise.connect(lpF); lpF.connect(noiseGain); noiseGain.connect(out);
      o1.connect(out); if (o2) o2.connect(out);
      o1.start(); if (o2) o2.start(); lfo.start(); noise.start();
      // Fade in
      out.gain.cancelScheduledValues(c.currentTime);
      out.gain.setValueAtTime(0, c.currentTime);
      out.gain.linearRampToValueAtTime(p.gain, c.currentTime + 1.2);
      this._ambient = { o1, o2, lfo, noise, out, baseGain: p.gain };
    },
    stopAmbient() {
      const c = ensure();
      const a = this._ambient;
      if (!c || !a) { this._ambient = null; return; }
      const fade = 0.6;
      try {
        a.out.gain.cancelScheduledValues(c.currentTime);
        a.out.gain.setValueAtTime(a.out.gain.value || a.baseGain, c.currentTime);
        a.out.gain.linearRampToValueAtTime(0, c.currentTime + fade);
        const stopAt = c.currentTime + fade + 0.05;
        a.o1.stop(stopAt);
        if (a.o2) a.o2.stop(stopAt);
        a.lfo.stop(stopAt);
        a.noise.stop(stopAt);
      } catch (_) {}
      this._ambient = null;
    },
  };
})();

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
  bindChipExplainers();
  bindMuteButton();
  bindInfoButton();
}

function bindInfoButton() {
  const btn = document.getElementById('info-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!state || !state.party || !state.party.chars) return;
    Audio.ui();
    showRunInfoPanel();
  });
}

// In-combat info pull-out — surfaces the moment-to-moment build state:
// each hero's quirks, the bound sigils, the active biome.  Owns its own
// DOM (#info-panel) so it doesn't conflict with the main #overlay system.
function showRunInfoPanel() {
  const panel = document.getElementById('info-panel');
  if (!panel) return;
  const body = document.getElementById('info-panel-body');
  if (!body || !state || !state.party) return;
  const mod = getRunModifier(state);
  const sigilIds = (state.run && state.run.sigils) || [];
  const sigilBlock = sigilIds.length
    ? `<div class="info-sigils">${sigilIds.map(id => {
        const sg = SIGILS[id]; if (!sg) return '';
        return `<span class="sigil-chip cat-${sg.category}" title="${sg.name} — ${sg.desc}" data-tip="${sg.name} — ${sg.desc}">${sg.icon || '◆'} ${sg.name}</span>`;
      }).join('')}</div>`
    : `<div class="info-empty">No sigils bound yet.</div>`;
  const heroBlocks = Object.keys(state.party.chars).map(id => {
    const c = state.party.chars[id];
    const def = CHARS[id];
    if (!c || !def) return '';
    const pos = (c.quirks && c.quirks.positive) || [];
    const neg = (c.quirks && c.quirks.negative) || [];
    const chips = [...pos.map(qid => ({ qid, pol: 'positive' })),
                   ...neg.map(qid => ({ qid, pol: 'negative' }))]
      .map(({ qid, pol }) => {
        const q = QUIRKS[qid]; if (!q) return '';
        return `<span class="hero-quirk hero-quirk-${pol}" title="${q.name} — ${q.desc}" data-tip="${q.name} — ${q.desc}">${q.name}</span>`;
      }).join('');
    return `
      <div class="info-hero ${c.downed ? 'info-hero-downed' : ''}">
        <div class="info-hero-portrait">${PORTRAITS[id] || ''}</div>
        <div class="info-hero-body">
          <div class="info-hero-name">${def.name}${c.downed ? ' · downed' : ''}</div>
          <div class="info-hero-hp">HP ${c.hp} / ${c.maxHp}</div>
          ${chips ? `<div class="info-hero-quirks">${chips}</div>` : `<div class="info-hero-quirks info-hero-quirks-empty">No affinities yet.</div>`}
        </div>
      </div>`;
  }).join('');
  body.innerHTML = `
    ${mod ? `<div class="info-biome"><span class="info-label">Biome</span><span class="info-biome-name">${mod.name}</span><span class="info-biome-desc">${mod.desc}</span></div>` : ''}
    <div class="info-section">
      <div class="info-label">Sigils</div>
      ${sigilBlock}
    </div>
    <div class="info-section">
      <div class="info-label">Heroes</div>
      <div class="info-heroes">${heroBlocks}</div>
    </div>
  `;
  panel.classList.remove('hidden');
  panel.setAttribute('aria-hidden', 'false');
  const closeBtn = document.getElementById('info-close');
  if (closeBtn) closeBtn.onclick = () => hideRunInfoPanel();
  bindBackdropDismiss(panel, '.ip-card', hideRunInfoPanel);
}
// One-time bind for the shared #overlay so that opt-in screens
// (credits, settings — anything tagged .overlay-dismissable) close on
// backdrop tap.  Vignettes / recruit / etc. don't get the class so
// they keep requiring an explicit choice.
function bindOverlayBackdropDismiss() {
  const ov = $('#overlay');
  if (!ov || ov._dismissBound) return;
  ov._dismissBound = true;
  ov.addEventListener('pointerdown', (e) => {
    if (!ov.classList.contains('overlay-dismissable')) return;
    const content = ov.querySelector('#overlay-content');
    if (content && content.contains(e.target)) return;
    hideOverlay();
  });
}

// Wire backdrop tap → close on standalone-DOM modals.  Safe for screens
// where dismissal has no destructive effect (info, codex, world map).
// `closer` is invoked when the user taps OUTSIDE the inner card.
function bindBackdropDismiss(rootEl, innerSelector, closer) {
  if (!rootEl || rootEl._backdropBound) return;
  rootEl._backdropBound = true;
  rootEl.addEventListener('pointerdown', (e) => {
    const inner = innerSelector ? rootEl.querySelector(innerSelector) : null;
    if (inner && inner.contains(e.target)) return;
    closer();
  });
}

function hideRunInfoPanel() {
  const panel = document.getElementById('info-panel');
  if (!panel) return;
  panel.classList.add('hidden');
  panel.setAttribute('aria-hidden', 'true');
}

function bindMuteButton() {
  const btn = $('#mute-btn');
  if (!btn) return;
  const sync = () => {
    if (Audio.isMuted()) { btn.classList.add('muted'); btn.textContent = '♪̸'; btn.title = 'Unmute'; }
    else                  { btn.classList.remove('muted'); btn.textContent = '♪';  btn.title = 'Mute'; }
  };
  sync();
  btn.addEventListener('click', () => {
    Audio.ensure(); // first click initializes the context (mobile policy)
    Audio.toggleMute();
    sync();
  });
}

// ============================================================================
// TUTORIAL — short hints, shown on the first fight of a run so the loop
// is teachable without a long onboarding screen.  Tracked PER-HINT (not
// a single flag) so adding new mechanics later only shows the new hints
// to returning players, not the whole sequence again.
// ============================================================================
const TUTORIAL_HINTS = [
  // Define ATB up-front — the tap hint used to handwave "Each action costs
  // ATB" without saying what ATB is.  Number on an action tile = its ATB
  // cost; you get 3 per turn.
  { id: 'tap_v2',     text: '<b>Tap</b> an action to queue it.  Each turn you have <b>3 ATB</b> (your action budget).  The number on each tile is what it costs.' },
  { id: 'hold',       text: '<b>Hold</b> an action to see its reach and predicted damage.' },
  // Define Resolve here — Specials cost ♦ on top of ATB, and Resolve carries
  // between fights (up to 3 by default).
  { id: 'resolve',    text: 'Specials also cost <b>Resolve</b> (♦) on top of ATB.  You earn ♦ from kills and synergies; up to 3 carry between fights.' },
  // New: explain reach labels (F / M / FM / MB etc).  Players were guessing
  // what those letters on a tile meant.
  { id: 'reach',      text: 'Each action has a <b>reach</b> — the enemy slots it can hit.  Letters on the tile (F·M·B) show which slots; if no enemy stands in any of them, the action fizzles.' },
  { id: 'commit',     text: 'Spend your ATB, then tap <b>Play ▶</b> to commit the turn.' },
  { id: 'enemies',    text: 'Enemies show their <b>intent</b> above their card.  Plan around it.' },
  { id: 'move_v2',    text: '<b>Press and hold</b> a hero on the battlefield — gold arrows appear.  Drag onto an arrow (or release and tap one) to swap them between <b>Front · Mid · Back</b>.  Costs 1 ATB.' },
  // Resonance hint — explain WHEN it appears (matching tags between queued
  // actions) and WHERE the chip lives, plus the once-per-fight gate.
  { id: 'resonance_v2', text: 'Queue actions whose tags line up (e.g. two attacks, or a heal + a shield) and a <b>Resonance</b> chip lights up the rail above your action tray.  Tap it to fuse the queue into a stronger team move.  Once per fight.' },
];

const TUT_KEY = 'kizuna.tutorialSeen.v2';
function getTutorialSeen() {
  // Migration — if the old single-flag exists, mark every hint that
  // shipped before v2 as already seen so returning players only see the
  // newly-added hints (move + resonance), not the whole sequence again.
  try {
    if (localStorage.getItem('kizuna.tutorialSeen') === '1' && !localStorage.getItem(TUT_KEY)) {
      const baseline = ['tap', 'hold', 'commit', 'enemies'];
      localStorage.setItem(TUT_KEY, JSON.stringify(baseline));
    }
  } catch (_) {}
  try { return new Set(JSON.parse(localStorage.getItem(TUT_KEY) || '[]')); }
  catch (_) { return new Set(); }
}
function markTutorialHintSeen(id) {
  const s = getTutorialSeen(); s.add(id);
  try { localStorage.setItem(TUT_KEY, JSON.stringify(Array.from(s))); } catch (_) {}
}
function tutorialSeen() {
  // True only once every defined hint has been dismissed.
  const seen = getTutorialSeen();
  return TUTORIAL_HINTS.every(h => seen.has(h.id));
}
function maybeShowTutorial() {
  const seen = getTutorialSeen();
  const next = TUTORIAL_HINTS.find(h => !seen.has(h.id));
  if (!next) return;
  showTutorialToast(next.text, () => {
    markTutorialHintSeen(next.id);
    setTimeout(maybeShowTutorial, 220);
  });
}
function showTutorialToast(html, onDismiss) {
  const old = document.getElementById('tutorial-toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.id = 'tutorial-toast';
  el.innerHTML = `<span class="tut-text">${html}</span><br><button type="button" class="tut-ok">Got it</button>`;
  el.querySelector('.tut-ok').addEventListener('click', () => {
    el.remove();
    if (typeof onDismiss === 'function') onDismiss();
  });
  document.body.appendChild(el);
}

// Mobile-friendly chip tooltips: tap any status/affinity/synergy/incoming chip
// to surface its explanation. Capture-phase so the figure's setPointerCapture
// (pickup gesture) doesn't swallow the tap.
function bindChipExplainers() {
  const CHIP_SEL = '.status-chip, .affinity-chip, .adj-chip, .incoming-chip, .sigil-chip, .hero-quirk, .run-mod-chip, .fig-quirk';
  document.addEventListener('pointerdown', (e) => {
    const chip = e.target.closest(CHIP_SEL);
    if (chip && chip.getAttribute('title')) {
      e.stopPropagation();
      e.preventDefault();
      const text = chip.getAttribute('title');
      showChipTooltip(chip, text);
    } else if (!e.target.closest('#chip-tooltip')) {
      hideChipTooltip();
    }
  }, true);
}

let chipTooltipTimer = null;
function showChipTooltip(anchor, text) {
  let tip = document.getElementById('chip-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'chip-tooltip';
    document.body.appendChild(tip);
  }
  tip.textContent = text;
  tip.classList.add('visible');
  // Position above the chip, centered, clamped to viewport
  const r = anchor.getBoundingClientRect();
  // Ensure layout is current before measuring tip
  tip.style.left = '0px'; tip.style.top = '0px';
  const tr = tip.getBoundingClientRect();
  let left = r.left + r.width / 2 - tr.width / 2;
  left = Math.max(8, Math.min(window.innerWidth - tr.width - 8, left));
  let top = r.top - tr.height - 8;
  let arrowDown = true;
  if (top < 8) { top = r.bottom + 8; arrowDown = false; }
  tip.classList.toggle('arrow-up', !arrowDown);
  tip.classList.toggle('arrow-down', arrowDown);
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  // Auto-dismiss
  if (chipTooltipTimer) clearTimeout(chipTooltipTimer);
  chipTooltipTimer = setTimeout(hideChipTooltip, 4000);
}
function hideChipTooltip() {
  const tip = document.getElementById('chip-tooltip');
  if (!tip) return;
  tip.classList.remove('visible');
  if (chipTooltipTimer) { clearTimeout(chipTooltipTimer); chipTooltipTimer = null; }
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

// Branching map between fights — renders the whole 3×2 tree so the player
// sees what awaits behind every choice. Completed nodes mark the path
// they walked; the current-tier nodes are clickable; future nodes are
// visible but not interactive.
// showPathChoice() retained as a thin alias so existing callers still work
// after the map redesign.  All the rendering now lives in renderMap().
function showPathChoice() { renderMap(); }

function renderMap() {
  applyBiomeBackground();
  // Path map is a full-bleed scene — clear any prior frame class then mark.
  $('#overlay').classList.remove('overlay-vignette', 'overlay-runsummary');
  $('#overlay').classList.add('overlay-full', 'overlay-path');
  $('#overlay-title').textContent = 'The Path';
  $('#overlay-body').textContent = (state.run.completedNodes || []).length === 0
    ? 'Pick your entry point.'
    : 'Choose the next stretch.';
  const choices = $('#overlay-choices');
  choices.innerHTML = '';
  choices.classList.add('path-map');
  choices.classList.remove('party-inspect');

  // Group nodes by level from this run's generated map
  const map = state.run.map;
  if (!map) { choices.innerHTML = '<div class="path-empty">No map yet.</div>'; return; }
  const byLevel = {};
  for (let lvl = 1; lvl <= map.maxLevel; lvl++) byLevel[lvl] = [];
  Object.values(map.nodes).forEach(n => { byLevel[n.level].push(n); });
  // Sort each level by col so vertical order in the column is stable
  Object.values(byLevel).forEach(arr => arr.sort((a, b) => a.col - b.col));

  for (let lvl = 1; lvl <= map.maxLevel; lvl++) {
    const col = document.createElement('div');
    col.className = 'path-col';
    const head = document.createElement('div');
    head.className = 'path-col-head';
    head.textContent = lvl === map.maxLevel ? 'Final' : `Stretch ${lvl}`;
    col.appendChild(head);
    const slotsWrap = document.createElement('div');
    slotsWrap.className = 'path-col-slots';
    byLevel[lvl].forEach(node => {
      const status = mapNodeStatus(state, node.id);
      const enc = node.enc;
      const isClickable = status === 'reachable';
      const el = document.createElement(isClickable ? 'button' : 'div');
      el.className = `path-node node-${node.type} node-${status}`;
      el.dataset.nodeId = node.id;
      const typeGlyph = ({
        elite:  '★',
        boss:   '☠',
        combat: '⚔',
        rest:   '⌂',
        event:  '?',
      })[node.type] || '⚔';
      // Compact icon-node markup: a single glyph in a glowing dot.  Pulse
      // ring renders only on reachable nodes (CSS-side selector).
      el.innerHTML = `
        <span class="pn-pulse" aria-hidden="true"></span>
        <span class="pn-icon">${typeGlyph}</span>
        ${status === 'completed' ? '<span class="pn-check" aria-hidden="true">✓</span>' : ''}
      `;

      // Press-and-hold reveals a tooltip with the node's details; quick tap
      // navigates.  pointerdown starts a timer, pointerup before the timer
      // fires the click handler, pointerup after suppresses the click.
      const onCommit = () => {
        hideOverlay();
        choices.classList.remove('path-map');
        state.run.currentNodeId = node.id;
        if (node.type === 'rest')        return showRestOverlay();
        if (node.type === 'event')       return showEventOverlay(node.eventId);
        if (node.type === 'boss') {
          const layerInfo = LAYER_CONTENT[state.run.layer] || LAYER_CONTENT[1];
          const startBoss = () => showBossIntro({
            eyebrow: layerInfo.bossSubtitle,
            name:    (layerInfo.bossName || '').toUpperCase(),
            tag:     layerInfo.bossTag,
          }, () => startEncounter(node.enc));
          const ctx = captureFightContext(state); ctx.phase = 'bossPrep';
          const matches = matchVignettes(state, ctx);
          if (matches.length) {
            const pick = matches[Math.floor(Math.random() * matches.length)];
            return showVignette(pick, ctx, startBoss);
          }
          return startBoss();
        }
        startEncounter(node.enc);
      };
      bindNodeHoldOrTap(el, node, isClickable ? onCommit : null);
      slotsWrap.appendChild(el);
    });
    col.appendChild(slotsWrap);
    choices.appendChild(col);
  }

  choices.classList.remove('hidden');
  resetOverlayBtn();
  const btn = $('#overlay-btn');
  btn.textContent = 'Heroes';
  btn.onclick = showPartyInspect;
  btn.classList.remove('hidden');
  $('#overlay').classList.remove('hidden');

  // Defer connector lines to next frame so layout positions are settled
  requestAnimationFrame(() => drawMapConnectors(choices));
}

// Render a vignette as a light-novel beat: portrait + dialogue lines + 2-3
// choices.  When the chosen resolver finishes, call `done()` to continue the
// post-fight cascade (recruit/upgrade/sigil/map).
function showVignette(v, ctx, done) {
  const titleEl = $('#overlay-title');
  const bodyEl  = $('#overlay-body');
  const choicesEl = $('#overlay-choices');

  // Pick the actual speaker for portrait + line resolution.  Several
  // wildcards are supported so vignettes don't need to hard-code IDs.
  const aliveIds = (ctx && ctx.alive && ctx.alive.length)
    ? ctx.alive
    : Object.values(state.party.chars).filter(c => !c.downed).map(c => c.id);
  // "Guests" — hero IDs that should render even though they're not yet in
  // state.party.chars.  Used by the recruit-vignette flow so the incoming
  // hero appears on stage before the player commits to accepting them.
  const guests = (ctx && Array.isArray(ctx.guests)) ? ctx.guests : [];
  const isOnStage = (id) => !!(id && (state.party.chars[id] || guests.includes(id)));
  // Variant resolution — a vignette can declare alternate scripted exchanges
  // gated by which heroes are on stage.  Pick the first variant whose
  // `requires` is fully satisfied; that variant's lines/choices/title
  // override the base vignette's.  Falls through to the base if none match.
  if (Array.isArray(v.variants) && v.variants.length) {
    const aliveSet = new Set(aliveIds);
    const matched = v.variants.find(va =>
      Array.isArray(va.requires) && va.requires.every(id => aliveSet.has(id) && isOnStage(id)));
    if (matched) {
      v = {
        ...v,
        lines:   matched.lines   || v.lines,
        choices: matched.choices || v.choices,
        title:   matched.title   || v.title,
      };
    }
  }
  let speakerId = v.speaker;
  if (v.speakerFromLowestHp)    speakerId = _lowestHpAliveId(state);
  if (v.speakerFromFirstAlive)  speakerId = aliveIds[0];
  if (speakerId && !isOnStage(speakerId) && v.speakerFallback) speakerId = v.speakerFallback;
  if (speakerId && !isOnStage(speakerId)) {
    speakerId = aliveIds[0] || null;
  }
  // Resolve helper for line.who wildcards
  const resolveWho = (who) => {
    if (who === '_lowest') return _lowestHpAliveId(state);
    if (who === '_first')  return aliveIds[0] || null;
    if (who === '_last')   return aliveIds[aliveIds.length - 1] || null;
    return who;
  };

  titleEl.textContent = v.title || 'A moment';
  bodyEl.classList.remove('victory-summary-body', 'welcome-body', 'run-summary-body');
  bodyEl.classList.add('vignette-body');
  bodyEl.innerHTML = '';
  // Full-bleed cinematic frame for the vignette overlay
  $('#overlay').classList.remove('overlay-path', 'overlay-runsummary');
  $('#overlay').classList.add('overlay-full', 'overlay-vignette');

  // Pre-scan lines to find unique speakers.  First two unique speakers
  // become the left/right portraits in the VN layout.  speakerId always
  // gets the left side so the player has a consistent anchor.
  const uniq = [];
  // Reactive lines: each entry can declare an optional `if(s, ctx)` predicate
  // that must return truthy for the line to render.  Lets vignettes layer in
  // commentary based on who's alive, current biome, or HP state without
  // authoring a new vignette per permutation.
  const visibleLines = v.lines.filter(line =>
    typeof line.if !== 'function' || !!line.if(state, ctx));
  visibleLines.forEach(line => {
    let id = resolveWho(line.who);
    if (id && !isOnStage(id) && line.altWho && isOnStage(line.altWho)) id = line.altWho;
    if (id && !isOnStage(id)) id = null;
    if (id && !uniq.includes(id)) uniq.push(id);
  });
  const leftId  = speakerId && uniq.includes(speakerId) ? speakerId
                : uniq[0] || speakerId || null;
  const rightId = uniq.find(id => id !== leftId) || null;

  // VN stage: dialogue rail at top, portraits standing at the bottom.
  const stage = document.createElement('div');
  stage.className = `vignette-stage vn-stage ${rightId ? 'two-actors' : 'one-actor'}`;

  // Dialogue rail
  const dlg = document.createElement('div');
  dlg.className = 'vn-dialogue';
  visibleLines.forEach(line => {
    let whoId = resolveWho(line.who);
    if (whoId && !isOnStage(whoId) && line.altWho && isOnStage(line.altWho)) whoId = line.altWho;
    if (whoId && !isOnStage(whoId)) whoId = null;
    const row = document.createElement('div');
    if (whoId) {
      const side = whoId === rightId ? 'right' : 'left';
      const name = CHARS[whoId]?.name || whoId;
      row.className = `vn-line bubble ${side}`;
      row.innerHTML = `
        <span class="vn-who">${name}</span>
        <span class="vn-text">${line.text}</span>
      `;
    } else {
      row.className = 'vn-line thought';
      row.innerHTML = `<span class="vn-text">${line.text}</span>`;
    }
    dlg.appendChild(row);
  });
  stage.appendChild(dlg);

  // Portrait row — one or two figures standing at the bottom.
  const portraitRow = document.createElement('div');
  portraitRow.className = 'vn-portraits';
  const mkPortrait = (id, side) => {
    const wrap = document.createElement('div');
    wrap.className = `vn-portrait vn-portrait-${side}`;
    if (id && PORTRAITS[id]) wrap.innerHTML = PORTRAITS[id];
    else wrap.classList.add('empty');
    return wrap;
  };
  portraitRow.appendChild(mkPortrait(leftId, 'left'));
  if (rightId) portraitRow.appendChild(mkPortrait(rightId, 'right'));
  stage.appendChild(portraitRow);

  bodyEl.appendChild(stage);

  // Choices — slim, single row of text-link buttons.  Each is one chip:
  // an action label with a small tag chip.
  choicesEl.innerHTML = '';
  choicesEl.classList.remove('path-map', 'party-inspect', 'event-choices');
  choicesEl.classList.add('vignette-choices');
  v.choices.forEach(ch => {
    const card = document.createElement('button');
    card.className = 'vignette-choice';
    card.innerHTML = `
      <span class="vc-label">${ch.label}</span>
      ${ch.tag ? `<span class="vc-tag">${ch.tag}</span>` : ''}
    `;
    card.addEventListener('click', () => {
      ch.resolve(state);
      if (v.oneShot) markVignetteFired(v.id);
      hideOverlay();
      bodyEl.classList.remove('vignette-body');
      choicesEl.classList.remove('vignette-choices');
      if (typeof done === 'function') done();
    });
    choicesEl.appendChild(card);
  });

  choicesEl.classList.remove('hidden');
  resetOverlayBtn();
  $('#overlay-btn').classList.add('hidden');
  $('#overlay').classList.remove('hidden');
}

// Resolve a non-combat node visit: mark complete, run any post-completion
// flow (recruit/upgrade/sigil/path), exactly like the post-fight cascade.
function _completeNonCombatNode() {
  if (state.run.currentNodeId) state.run.completedNodes.push(state.run.currentNodeId);
  state.run.lastVictoryElite = false;
  state.run.nodesSinceRecruit = (state.run.nodesSinceRecruit || 0) + 1;

  // Stranger event hand-off — the wanderer event sets this flag in its
  // resolve.  Fire a recruit beat before returning to the map; if the
  // party is full, offer a strategic swap instead of just walking on.
  if (state.run._pendingStrangerRecruit) {
    state.run._pendingStrangerRecruit = false;
    const pickable = ROSTER.filter(id => !state.party.chars[id]);
    if (pickable.length) {
      const rumored = (state.run.rumoredHeroes || []).filter(id => pickable.includes(id));
      const pool = rumored.length ? rumored : pickable;
      const heroId = pool[Math.floor(Math.random() * pool.length)];
      const hasOpenSlot = ['front','mid','back'].some(sl => !state.party.slots[sl]);
      if (hasOpenSlot) {
        showRecruitVignette(heroId, 'stranger', () => renderMap());
      } else {
        showSwapOverlay(heroId, () => renderMap());
      }
      return;
    }
  }
  renderMap();
}

// REST overlay — heals the alive party for half their missing HP and returns
// to the map.  No choice; tap Continue.
// Rest node — pick ONE thing to do here.  Heal sits next to upgrade and
// sigil so the choice is a real one and not just "tap Continue".
function showRestOverlay() {
  $('#overlay-title').textContent = 'Hollow Rest';
  $('#overlay').classList.remove('overlay-path', 'overlay-vignette', 'overlay-runsummary');
  $('#overlay').classList.add('overlay-full', 'overlay-rest');
  const body = $('#overlay-body');
  body.classList.remove('victory-summary-body', 'welcome-body', 'run-summary-body');
  body.innerHTML = '';

  // Campfire scene: party portraits arranged around a fire.  Reuses the
  // title screen's flame CSS for the central fire.
  const sceneIds = Object.keys(state.party.chars).filter(id => !state.party.chars[id].downed);
  const scene = document.createElement('div');
  scene.className = 'rest-scene';
  // Split heroes roughly evenly left/right of the fire so the composition reads.
  const left  = sceneIds.slice(0, Math.ceil(sceneIds.length / 2));
  const right = sceneIds.slice(Math.ceil(sceneIds.length / 2));
  const mkHero = (id, side) => `<div class="rest-hero rest-hero-${side}">${PORTRAITS[id] || ''}</div>`;
  scene.innerHTML = `
    <div class="rest-row rest-row-left">${left.map(id => mkHero(id, 'left')).join('')}</div>
    <div class="rest-fire" aria-hidden="true">
      <div class="ts-sparks"><span></span><span></span><span></span><span></span></div>
      <div class="ts-flame"></div>
      <div class="ts-flame f2"></div>
      <div class="ts-flame f3"></div>
      <div class="ts-fire-logs"></div>
    </div>
    <div class="rest-row rest-row-right">${right.map(id => mkHero(id, 'right')).join('')}</div>
  `;
  body.appendChild(scene);

  const flavor = document.createElement('p');
  flavor.className = 'event-flavor rest-flavor';
  flavor.textContent = 'You set down your weight.  Breath returns.  But you can only do one of these things before the climb resumes.';
  body.appendChild(flavor);

  const choices = $('#overlay-choices');
  choices.innerHTML = '';
  choices.classList.remove('path-map', 'party-inspect');
  choices.classList.add('event-choices');

  const mkChoice = (label, tag, fn) => {
    const card = document.createElement('button');
    card.className = 'encounter-choice event-choice';
    card.innerHTML = `<div class="enc-name">${label}</div><div class="sigil-desc">${tag}</div>`;
    card.addEventListener('click', fn);
    choices.appendChild(card);
  };

  // 1. Rest — heal half of all missing HP across the party.
  mkChoice('Rest', 'Heal half', () => {
    const lines = [];
    aliveParty(state).forEach(c => {
      const missing = c.maxHp - c.hp;
      const heal = Math.ceil(missing * 0.5);
      if (heal > 0) { c.hp = Math.min(c.maxHp, c.hp + heal); lines.push(`<b>${CHARS[c.id].name}</b> +${heal} HP`); }
    });
    if (lines.length) log(lines.join(' · '));
    hideOverlay();
    choices.classList.remove('event-choices');
    _completeNonCombatNode();
  });

  // 2. Hone — upgrade one tech.  Only shown if any upgrades remain.
  const upPool = availableUpgrades(state);
  if (upPool.length > 0) {
    mkChoice('Hone the edge', 'Choose a tech upgrade', () => {
      hideOverlay();
      choices.classList.remove('event-choices');
      const shuffled = upPool.slice().sort(() => Math.random() - 0.5);
      const offers = shuffled.slice(0, Math.min(2, shuffled.length));
      showUpgradeOverlay(offers, () => _completeNonCombatNode());
    });
  }

  // 3. Sigil — bind one new sigil.  Only shown if any remain unbound.
  const sgPool = availableSigils(state);
  if (sgPool.length > 0) {
    mkChoice('Reach for a sigil', 'Bind a run-wide power', () => {
      hideOverlay();
      choices.classList.remove('event-choices');
      offerSigilFromNode(() => _completeNonCombatNode());
    });
  }

  resetOverlayBtn();
  $('#overlay-btn').classList.add('hidden');
  choices.classList.remove('hidden');
  $('#overlay').classList.remove('hidden');
}

// EVENT overlay — show flavor + a list of choice buttons.  Each choice's
// resolver mutates state, then we mark the node complete and return to map.
function showEventOverlay(eventId) {
  const ev = EVENTS[eventId];
  if (!ev) { _completeNonCombatNode(); return; }
  $('#overlay-title').textContent = ev.name;
  const body = $('#overlay-body');
  body.classList.remove('victory-summary-body', 'welcome-body', 'run-summary-body');
  body.innerHTML = '';
  const flavor = document.createElement('p');
  flavor.className = 'event-flavor';
  flavor.textContent = ev.flavor;
  body.appendChild(flavor);

  const choices = $('#overlay-choices');
  choices.innerHTML = '';
  choices.classList.remove('path-map', 'party-inspect');
  choices.classList.add('event-choices');
  ev.choices.forEach(ch => {
    const card = document.createElement('button');
    card.className = 'encounter-choice event-choice';
    card.innerHTML = `
      <div class="enc-name">${ch.label}</div>
      <div class="sigil-desc">${ch.tag || ''}</div>
    `;
    card.addEventListener('click', () => {
      ch.resolve(state);
      hideOverlay();
      choices.classList.remove('event-choices');
      _completeNonCombatNode();
    });
    choices.appendChild(card);
  });
  choices.classList.remove('hidden');
  resetOverlayBtn();
  $('#overlay-btn').classList.add('hidden');
  $('#overlay').classList.remove('hidden');
}

function drawMapConnectors(choices) {
  // remove any previous overlay
  const prev = choices.querySelector('.map-connectors');
  if (prev) prev.remove();

  const cRect = choices.getBoundingClientRect();
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'map-connectors');
  svg.style.position = 'absolute';
  svg.style.left = '0';
  svg.style.top = '0';
  svg.style.width = cRect.width + 'px';
  svg.style.height = cRect.height + 'px';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '0';

  mapEdges().forEach(({ from, to }) => {
    const aEl = choices.querySelector(`[data-node-id="${from}"]`);
    const bEl = choices.querySelector(`[data-node-id="${to}"]`);
    if (!aEl || !bEl) return;
    const aR = aEl.getBoundingClientRect();
    const bR = bEl.getBoundingClientRect();
    const x1 = aR.right - cRect.left;
    const y1 = aR.top + aR.height / 2 - cRect.top;
    const x2 = bR.left - cRect.left;
    const y2 = bR.top + bR.height / 2 - cRect.top;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    let cls = 'map-connector';
    const completed = (state.run.completedNodes || []).includes(from);
    if (completed && (state.run.completedNodes || []).includes(to)) {
      cls += ' completed';
    } else if (completed && isMapNodeReachable(state, to)) {
      cls += ' reachable';
    } else {
      cls += ' locked';
    }
    line.setAttribute('class', cls);
    svg.appendChild(line);
  });

  choices.appendChild(svg);
}

// ============================================================================
// PARTY INSPECT — between-fights view of each hero's moves and identity.
// Lays the groundwork for affinity progression later (positive/negative
// affinity quirks per character, etc.).
// ============================================================================
function showPartyInspect() {
  const titleEl = $('#overlay-title');
  const bodyEl = $('#overlay-body');
  const choices = $('#overlay-choices');
  titleEl.textContent = 'Heroes';
  bodyEl.innerHTML = '';
  bodyEl.classList.remove('victory-summary-body', 'welcome-body', 'run-summary-body');
  choices.innerHTML = '';
  choices.classList.remove('path-map');
  choices.classList.add('party-inspect');

  const charIds = Object.keys(state.party.chars || {});
  if (!charIds.length) {
    choices.classList.remove('hidden');
    return;
  }

  // FFT-style party menu — the focused character's full silhouette sits
  // in the LEFT column with the small switcher row beneath, and all the
  // text info (passive, affinities, abilities) sits in the RIGHT column
  // so the layout fits one screen with no scrolling.
  const layout = document.createElement('div');
  layout.className = 'hero-inspect-party';
  layout.innerHTML = `
    <div class="hip-focus-column">
      <div class="hip-focus-figure"></div>
      <div class="hip-strip"></div>
    </div>
    <div class="hip-focus-info"></div>
  `;
  choices.appendChild(layout);
  const figureEl = layout.querySelector('.hip-focus-figure');
  const stripEl  = layout.querySelector('.hip-strip');
  const infoEl   = layout.querySelector('.hip-focus-info');

  const techRow = (kind, tech) => {
    if (!tech) return '';
    const label = kind === 'sig' ? 'S' : 'A';
    return `<div class="hip-tech-row${kind === 'sig' ? ' sig' : ''}"><span class="hip-tech-kind${kind === 'sig' ? ' sig' : ''}">${label}</span><div class="hip-tech-body"><div class="hip-tech-name">${tech.name}</div><div class="hip-tech-desc">${tech.desc || ''}</div></div></div>`;
  };
  const techSection = (id, def, pos) => {
    const basic = getTech(state, id, pos, 'basic');
    const sig   = getTech(state, id, pos, 'sig');
    const isHome = def.home === pos;
    return `
      <div class="hip-tech-col${isHome ? ' home' : ''}">
        <div class="hip-tech-pos">${pos.toUpperCase()}${isHome ? ' <span class="hip-home-mark">◆</span>' : ''}</div>
        ${techRow('basic', basic)}
        ${techRow('sig', sig)}
      </div>`;
  };

  const renderDetail = (id) => {
    const c = state.party.chars[id];
    const def = CHARS[id];
    if (!c || !def) { figureEl.innerHTML = ''; infoEl.innerHTML = ''; return; }
    const schoolTag = (def.school || '').slice(0, 3).toUpperCase();
    const slotNow = slotOfChar(state, id) || def.home;
    const pos = (c.quirks && c.quirks.positive) || [];
    const neg = (c.quirks && c.quirks.negative) || [];
    const quirkChip = (qid, polarity) => {
      const q = QUIRKS[qid];
      if (!q) return '';
      return `<span class="hero-quirk hero-quirk-${polarity}" title="${q.name} — ${q.desc}">${q.name}</span>`;
    };
    const hasAffinities = pos.length || neg.length;
    // Compact formation diagram — three dots ordered to match how the
    // party reads in combat (PARTY_DISPLAY_ORDER: back → mid → front,
    // left-to-right).  The hero's current slot is lit; their home slot
    // is marked.
    const formation = PARTY_DISPLAY_ORDER.map(slot =>
      `<span class="hip-form-dot${slot === slotNow ? ' hip-form-dot-on' : ''}${slot === def.home ? ' hip-form-dot-home' : ''}"></span>`
    ).join('');
    figureEl.innerHTML = `
      <div class="hip-focus-silhouette" aria-hidden="true">${PORTRAITS[id] || ''}</div>
      <div class="hip-focus-name">${def.name}${c.downed ? ' · downed' : ''}</div>
      <div class="hip-focus-title">${def.title || ''}</div>
      <div class="hip-focus-stats">
        <span class="hip-stat hip-stat-hp"><span class="hip-stat-label">HP</span><span class="hip-stat-val">${c.hp}/${c.maxHp}</span></span>
        <span class="hip-stat hip-stat-school school-${def.school}"><span class="hip-stat-label">CLS</span><span class="hip-stat-val">${schoolTag}</span></span>
        <span class="hip-stat hip-stat-slot"><span class="hip-stat-label">POS</span><span class="hip-form">${formation}</span></span>
      </div>
    `;
    infoEl.innerHTML = `
      ${def.passive ? `
        <div class="hip-section">
          <div class="hip-section-label">Passive</div>
          <div class="hip-passive"><b>${def.passive.name}</b><span> — ${def.passive.desc}</span></div>
        </div>` : ''}
      ${hasAffinities ? `
        <div class="hip-section">
          <div class="hip-section-label">Affinities</div>
          <div class="hip-affinities">${pos.map(qid => quirkChip(qid, 'positive')).join('')}${neg.map(qid => quirkChip(qid, 'negative')).join('')}</div>
        </div>` : ''}
      <div class="hip-section">
        <div class="hip-section-label">Abilities</div>
        <div class="hip-tech-grid">
          ${PARTY_DISPLAY_ORDER.map(slot => techSection(id, def, slot)).join('')}
        </div>
      </div>
    `;
  };

  const setFocus = (focusId) => {
    stripEl.querySelectorAll('.hip-avatar').forEach(a => {
      const on = a.dataset.heroId === focusId;
      a.classList.toggle('hip-avatar-focused', on);
      a.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    renderDetail(focusId);
  };

  charIds.forEach((id, idx) => {
    const c = state.party.chars[id];
    const def = CHARS[id];
    if (!c || !def) return;
    const slotNow = slotOfChar(state, id) || def.home;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hip-avatar' + (c.downed ? ' hip-avatar-downed' : '');
    btn.dataset.heroId = id;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-label', def.name);
    btn.innerHTML = `
      <div class="hip-avatar-portrait" aria-hidden="true">${PORTRAITS[id] || ''}</div>
      <div class="hip-avatar-name">${def.name}</div>
      <div class="hip-avatar-slot">${(SLOT_LABELS[slotNow] || slotNow || '').toUpperCase()}</div>
    `;
    btn.addEventListener('click', () => { Audio.ui(); setFocus(id); });
    stripEl.appendChild(btn);
    if (idx === 0) setFocus(id);
  });
  // A solo party doesn't need a switcher row.  Hide it so the column
  // doesn't show a single orphan avatar.
  if (charIds.length <= 1) stripEl.classList.add('hidden');

  choices.classList.remove('hidden');
  resetOverlayBtn();
  const btn = $('#overlay-btn');
  btn.textContent = 'Back';
  btn.onclick = () => {
    choices.classList.remove('party-inspect');
    renderMap();
  };
  btn.classList.remove('hidden');
  $('#overlay').classList.remove('hidden');
}

function hideOverlay() {
  const ov = $('#overlay');
  ov.classList.add('hidden');
  ov.classList.remove('overlay-full', 'overlay-cinematic',
                      'overlay-path', 'overlay-vignette',
                      'overlay-runsummary', 'overlay-rest',
                      'overlay-recruit', 'overlay-upgrade', 'overlay-sigil',
                      'overlay-starter', 'overlay-dismissable');
  const ch = $('#overlay-choices');
  if (ch) {
    ch.classList.remove('path-map', 'party-inspect', 'event-choices',
                        'vignette-choices', 'starter-choices', 'title-choices');
    ch.innerHTML = '';
  }
}

// ============================================================================
// RECRUIT — between-fight character draft
// ============================================================================

// Decide whether to show recruit, then proceed to upgrade-or-path.
// Run-ending summary (victory, boss win, or defeat). Shows accumulated run
// totals across every reach and replaces the plain flavor overlay.
function showRunSummary(outcome, opts) {
  // On defeat, the active fight's stats haven't been folded into run totals yet
  if (outcome === 'defeat' && state.fightStats) accumulateRunStats(state.fightStats);
  const rs = state.run.stats || { damageDealt: {}, damageTaken: {}, healingDone: {}, kills: 0, synergies: [], turns: 0, reaches: 0 };
  const partyIds = Object.keys(state.party.chars);

  const charRows = partyIds.map(id => {
    const def = CHARS[id];
    const c = state.party.chars[id];
    const dealt = rs.damageDealt[id] || 0;
    const healed = rs.healingDone[id] || 0;
    const taken = rs.damageTaken[id] || 0;
    return `
      <div class="vs-row ${c.downed ? 'vs-downed' : ''}">
        <span class="vs-name">${def.name}${c.downed ? ' · downed' : ''}</span>
        <span class="vs-stats">
          ${dealt > 0 ? `<span class="vs-stat vs-dealt"><b>${dealt}</b> dealt</span>` : ''}
          ${healed > 0 ? `<span class="vs-stat vs-healed"><b>${healed}</b> healed</span>` : ''}
          ${taken > 0 ? `<span class="vs-stat vs-taken"><b>${taken}</b> taken</span>` : ''}
          ${dealt === 0 && healed === 0 && taken === 0 ? '<span class="vs-stat vs-quiet">—</span>' : ''}
        </span>
      </div>`;
  }).join('');

  const synList = rs.synergies.length
    ? `<div class="vs-syn"><span class="vs-syn-label">Bonds witnessed</span> ${rs.synergies.map(n => `<span class="vs-syn-chip">${n}</span>`).join('')}</div>`
    : '';

  let title, flavor, outcomeClass;
  if (outcome === 'boss') { title = 'The Wakeling Falls'; flavor = 'The Sin of Dawn is unmade.  The triad endures, and the world breathes again.'; outcomeClass = 'rs-boss'; }
  else if (outcome === 'victory') { title = 'Victory'; flavor = 'The reaches are quiet.  For a moment, the sins rest.'; outcomeClass = 'rs-victory'; }
  else { title = 'Defeat'; flavor = 'The reach takes you back.  Your story is told elsewhere now.'; outcomeClass = 'rs-defeat'; }

  // Fallen this run — heroes who went down in a fight and were never lifted.
  // They get a tombstone memorial below the stats.
  const fallenIds = partyIds.filter(id => state.party.chars[id] && state.party.chars[id].downed);

  $('#overlay-title').textContent = title;
  $('#overlay').classList.remove('overlay-path', 'overlay-vignette');
  $('#overlay').classList.add('overlay-full', 'overlay-runsummary');
  const body = $('#overlay-body');
  body.classList.add('victory-summary-body', 'run-summary-body');
  // Silhouette montage of the party at the top of the summary.  Downed
  // heroes render dimmed.  Mirrors the visual language we use everywhere.
  const montageIds = partyIds.length ? partyIds : Object.keys(state.party.chars);
  const montage = montageIds.map(id => {
    const c = state.party.chars[id];
    const downed = c && c.downed;
    return `<div class="rs-portrait ${downed ? 'rs-portrait-downed' : ''}">${PORTRAITS[id] || ''}</div>`;
  }).join('');

  // Cinematic ascent — a glowing stairway behind the survivors on boss win.
  const ascentHtml = outcome === 'boss' ? `
    <div class="rs-ascent" aria-hidden="true">
      <div class="rs-ascent-glow"></div>
      <div class="rs-steps"><span></span><span></span><span></span><span></span><span></span></div>
    </div>` : '';

  // Tombstone memorial — only renders when at least one hero fell.
  const memorialHtml = fallenIds.length ? `
    <div class="rs-memorial">
      <span class="rs-memorial-label">In memory</span>
      <div class="rs-graves">
        ${fallenIds.map(id => `
          <div class="rs-grave">
            <div class="rs-grave-stone">
              <span class="rs-grave-mark">+</span>
              <span class="rs-grave-name">${(CHARS[id]?.name || id).toUpperCase()}</span>
            </div>
          </div>`).join('')}
      </div>
    </div>` : '';

  body.innerHTML = `
    <div class="rs-card ${outcomeClass}">
      <div class="rs-montage ${outcome === 'boss' ? 'rs-with-ascent' : ''}">
        ${ascentHtml}
        ${montage}
      </div>
      <div class="rs-flavor">${flavor}</div>
      <div class="rs-stats">
        <span class="rs-stat"><b>${rs.reaches}</b> <em>${rs.reaches === 1 ? 'reach' : 'reaches'}</em></span>
        <span class="rs-stat"><b>${rs.turns}</b> <em>${rs.turns === 1 ? 'turn' : 'turns'}</em></span>
        <span class="rs-stat"><b>${rs.kills}</b> <em>${rs.kills === 1 ? 'kill' : 'kills'}</em></span>
      </div>
      <div class="rs-rows">${charRows}</div>
      ${synList}
      ${memorialHtml}
    </div>
  `;
  $('#overlay-choices').classList.add('hidden');
  const btn = $('#overlay-btn');
  btn.textContent = (opts && opts.afterClose) ? 'Ascend' : 'Return to Title';
  btn.classList.remove('hidden');
  btn.onclick = () => {
    // Ascend cinematic — on boss win the survivors' silhouettes rise up
    // the stairway behind them, the stats fade out, then the world map
    // appears.  The summary itself becomes the carry-over transition
    // instead of dumping straight to the map.
    const card = body.querySelector('.rs-card');
    const isAscend = outcome === 'boss' && card;
    const finish = () => {
      body.classList.remove('victory-summary-body', 'run-summary-body');
      body.innerHTML = '';
      document.body.classList.remove('party-fallen', 'boss-killed');
      hideOverlay();
      resetOverlayBtn();
      clearSave();
      // On defeat there's no team left to carry to the next layer — strip
      // any stale carry so the title screen's "New Game" doesn't silently
      // re-spawn the dead party.  Boss-win keeps the carry for ascend.
      if (outcome !== 'boss') clearCarriedParty();
      if (opts && typeof opts.afterClose === 'function') opts.afterClose();
      else showTitleScreen();
    };
    if (isAscend) {
      btn.classList.add('hidden');
      card.classList.add('rs-ascending');
      // Match the longest CSS animation duration (rs-ascend-rise) below.
      setTimeout(finish, 1400);
      return;
    }
    finish();
  };
  $('#overlay').classList.remove('hidden');
}

// Roll a finished fight's stats into the running run totals.
function accumulateRunStats(fs) {
  const rs = state.run.stats;
  if (!rs || !fs) return;
  Object.keys(fs.damageDealt).forEach(id => { rs.damageDealt[id] = (rs.damageDealt[id] || 0) + fs.damageDealt[id]; });
  Object.keys(fs.damageTaken).forEach(id => { rs.damageTaken[id] = (rs.damageTaken[id] || 0) + fs.damageTaken[id]; });
  Object.keys(fs.healingDone).forEach(id => { rs.healingDone[id] = (rs.healingDone[id] || 0) + fs.healingDone[id]; });
  rs.kills += fs.kills;
  rs.turns += fs.turns;
  rs.reaches += 1;
  fs.synergies.forEach(name => { if (!rs.synergies.includes(name)) rs.synergies.push(name); });
}

// Post-fight recap: show damage / healing / kills / synergies, then continue.
function showVictorySummary(completedEnc, onContinue) {
  const fs = state.fightStats || { damageDealt: {}, damageTaken: {}, healingDone: {}, kills: 0, synergies: [], turns: state.turn };
  accumulateRunStats(fs);
  const partyIds = Object.keys(state.party.chars);

  const charRows = partyIds.map(id => {
    const def = CHARS[id];
    const c = state.party.chars[id];
    const dealt = fs.damageDealt[id] || 0;
    const healed = fs.healingDone[id] || 0;
    const taken = fs.damageTaken[id] || 0;
    const downed = c.downed;
    return `
      <div class="vs-row ${downed ? 'vs-downed' : ''}">
        <span class="vs-name">${def.name}${downed ? ' · downed' : ''}</span>
        <span class="vs-stats">
          ${dealt > 0 ? `<span class="vs-stat vs-dealt"><b>${dealt}</b> dealt</span>` : ''}
          ${healed > 0 ? `<span class="vs-stat vs-healed"><b>${healed}</b> healed</span>` : ''}
          ${taken > 0 ? `<span class="vs-stat vs-taken"><b>${taken}</b> taken</span>` : ''}
          ${dealt === 0 && healed === 0 && taken === 0 ? '<span class="vs-stat vs-quiet">—</span>' : ''}
        </span>
      </div>`;
  }).join('');

  const synList = fs.synergies.length
    ? `<div class="vs-syn"><span class="vs-syn-label">Bonds fired</span> ${fs.synergies.map(n => `<span class="vs-syn-chip">${n}</span>`).join('')}</div>`
    : '';

  const encName = completedEnc?.name || 'The Reach';
  const isBoss = !!(completedEnc && completedEnc.boss);
  const isElite = !!(completedEnc && completedEnc.elite);
  const subtitle = isBoss ? 'Boss reach cleared' : (isElite ? 'Elite reach cleared' : 'Reach cleared');

  $('#overlay-title').textContent = encName;
  const body = $('#overlay-body');
  body.classList.add('victory-summary-body');
  body.innerHTML = `
    <div class="vs-subtitle">${subtitle} · turn ${fs.turns}</div>
    <div class="vs-meta">
      <span class="vs-meta-stat"><b>${fs.kills}</b> ${fs.kills === 1 ? 'kill' : 'kills'}</span>
    </div>
    <div class="vs-rows">${charRows}</div>
    ${synList}
  `;
  const choices = $('#overlay-choices');
  choices.classList.remove('path-map', 'party-inspect', 'event-choices', 'vignette-choices', 'starter-choices');
  choices.innerHTML = '';
  choices.classList.add('hidden');
  const btn = $('#overlay-btn');
  btn.textContent = 'Continue';
  btn.classList.remove('hidden');
  btn.onclick = () => {
    body.classList.remove('victory-summary-body');
    body.innerHTML = '';
    hideOverlay();
    resetOverlayBtn();
    if (typeof onContinue === 'function') onContinue();
  };
  $('#overlay').classList.remove('hidden');
}

// Between-fight chain entry: roll a vignette (if any triggers fire), then
// flow into the recruit/upgrade/sigil/map cascade.  ~55% chance of a beat
// when at least one vignette matches, so the player isn't bombarded.
function offerVignetteOrPath(fightCtx) {
  const matches = matchVignettes(state, fightCtx);
  // Three categories:
  //   priority — a hero fell, or a first-clear milestone landed.  These
  //              are big narrative beats and should never be dropped in
  //              favor of a random rumor or bond reflection.
  //   rumor    — plant a hero's name before the next recruit moment.
  //   ambient  — bond / friction / low-HP / biome reflections; gated
  //              behind a probability so they don't fire every fight.
  // Up to two vignettes can chain in one post-fight beat: a priority
  // (always) + a rumor (always if matched), OR a single ambient under
  // the gate.  The cap of two keeps the cascade snappy.
  const isPriority = v => {
    const w = v.when || {};
    return !!(w.heroDowned || w.firstClearOf);
  };
  const isRumor = v => v.id && v.id.startsWith('rumor_');
  const priorityMatches = matches.filter(v => !isRumor(v) && isPriority(v));
  const rumorMatches    = matches.filter(isRumor);
  const ambientMatches  = matches.filter(v => !isRumor(v) && !isPriority(v));
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const queue = [];
  if (priorityMatches.length) queue.push(pickOne(priorityMatches));
  if (rumorMatches.length)    queue.push(pickOne(rumorMatches));
  if (!queue.length && ambientMatches.length && Math.random() < 0.55) {
    queue.push(pickOne(ambientMatches));
  } else if (queue.length === 1 && ambientMatches.length && Math.random() < 0.35) {
    // Allow a low-probability second beat alongside a priority/rumor when
    // there's also an ambient match — keeps the run feeling reactive
    // without turning every fight into a cascade.
    queue.push(pickOne(ambientMatches));
  }
  const playNext = () => {
    if (!queue.length) { offerRecruitOrPath(); return; }
    const next = queue.shift();
    showVignette(next, fightCtx, playNext);
  };
  playNext();
}

// Post-fight cascade — designed to be SHORT after normal combat so each click
// feels earned.  Order:
//   1. Recruit only if there's an OPEN SLOT (party-not-full forces the meet-
//      a-companion beat).  Full-party swap is moved to events.
//   2. Upgrade only after elite or boss kills.
//   3. Sigils are NO LONGER offered after combat — they live on rest nodes
//      and events.
// Effect: a typical combat win is one overlay (vignette, sometimes) plus
// a recruit when applicable.
// Frequency + pressure gate for the post-combat recruit roll.  Recruits
// shouldn't fire after every fight — they should feel earned and timely —
// but the original gate was too stingy and players were getting stuck with
// open slots for stretches.  The dial is more generous now, with an
// open-slot pressure bonus so a solo party gets filled faster.
//   - Never twice on the same cleared node
//   - 1 cleared node since:  40% base chance
//   - 2 cleared nodes since: 70% base chance
//   - 3+ cleared nodes:      95% base chance
//   - +25% chance when the party has 2+ open slots
//   - If a hero fell this fight, the next roll is forced (Vigil)
function shouldOfferRecruit() {
  const pickable = ROSTER.filter(id => !state.party.chars[id]);
  if (!pickable.length) return false;
  const openSlots = ['front','mid','back'].filter(sl => !state.party.slots[sl]).length;
  if (openSlots === 0) return false;
  if (state.run.recruitPending) return true;
  const since = state.run.nodesSinceRecruit || 0;
  if (since < 1) return false;
  const baseChance = since >= 3 ? 0.95 : since >= 2 ? 0.7 : 0.4;
  const slotBoost = openSlots >= 2 ? 0.25 : 0;
  return Math.random() < Math.min(1, baseChance + slotBoost);
}

function offerRecruitOrPath() {
  if (!shouldOfferRecruit()) { offerUpgradeOrPath(); return; }
  const pickable = ROSTER.filter(id => !state.party.chars[id]);
  // Prefer heroes whose names have been heard in earlier vignettes — makes
  // recruits feel like the world wove them in rather than a draft.  When
  // no rumored hero is available, fall back to random.
  const rumored = (state.run.rumoredHeroes || []).filter(id => pickable.includes(id));
  const pool = rumored.length ? rumored : pickable;
  const heroId = pool[Math.floor(Math.random() * pool.length)];
  // Flavor — vigil takes precedence (a hero just fell), otherwise a 1-in-3
  // chance for "battlefield mercy" framing (a survivor turns coat), else
  // the default authored intro.
  const wasVigil = !!state.run.recruitPending;
  state.run.recruitPending = false;
  const flavor = wasVigil ? 'vigil'
               : Math.random() < 0.33 ? 'survivor'
               : 'default';
  showRecruitVignette(heroId, flavor, () => offerUpgradeOrPath());
}

function offerUpgradeOrPath() {
  // Only elite kills + boss kills hand out upgrades from combat.  Everywhere
  // else, upgrades come from rest nodes and events.
  const lastNodeId = state.run.completedNodes[state.run.completedNodes.length - 1];
  const lastNode = lastNodeId && getMapNode(lastNodeId);
  const eligible = lastNode && (lastNode.type === 'elite' || lastNode.type === 'boss');
  if (!eligible) { renderMap(); return; }
  const pool = availableUpgrades(state);
  if (pool.length === 0) { renderMap(); return; }
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  const offers = shuffled.slice(0, Math.min(2, shuffled.length));
  showUpgradeOverlay(offers);
}

// Direct sigil offer — invoked from rest nodes and events, not from combat.
function offerSigilFromNode(onDone) {
  let pool = availableSigils(state);
  if (pool.length === 0) { onDone && onDone(); return; }
  const count = 3;
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  const offers = shuffled.slice(0, Math.min(count, shuffled.length));
  showSigilOverlay(offers, onDone);
}

function showSigilOverlay(offers, onDone) {
  const continueAfter = onDone || (() => renderMap());
  $('#overlay').classList.remove('overlay-path', 'overlay-vignette', 'overlay-runsummary', 'overlay-rest', 'overlay-recruit', 'overlay-upgrade');
  $('#overlay').classList.add('overlay-full', 'overlay-cinematic', 'overlay-sigil');
  $('#overlay-title').textContent = 'A sigil flickers into reach';
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
    card.addEventListener('click', () => commitSigil(sg.id, continueAfter));
    choices.appendChild(card);
  });
  const btn = $('#overlay-btn');
  btn.textContent = 'Pass';
  btn.onclick = () => {
    hideOverlay();
    resetOverlayBtn();
    continueAfter();
  };
  btn.classList.remove('hidden');
  choices.classList.remove('hidden');
  $('#overlay').classList.remove('hidden');
}

function commitSigil(sigilId, onDone) {
  if (!SIGILS[sigilId]) return;
  bindSigil(state, sigilId);
  hideOverlay();
  resetOverlayBtn();
  if (typeof onDone === 'function') onDone(); else renderMap();
}

function showUpgradeOverlay(offers, onDone) {
  const continueAfter = onDone || (() => renderMap());
  $('#overlay').classList.remove('overlay-path', 'overlay-vignette', 'overlay-runsummary', 'overlay-rest', 'overlay-recruit', 'overlay-sigil');
  $('#overlay').classList.add('overlay-full', 'overlay-cinematic', 'overlay-upgrade');
  $('#overlay-title').textContent = 'Hone your edge';
  $('#overlay-body').textContent = 'Pick an upgrade — or pass.';
  const choices = $('#overlay-choices');
  choices.innerHTML = '';
  offers.forEach(up => {
    const char = CHARS[up.charId];
    const baseTech = char.techs[up.slot][up.kind];
    const card = document.createElement('button');
    card.className = 'encounter-choice upgrade-choice';
    // Layout reads top-down:
    //   1. bracketed meta line  — hero, slot, kind
    //   2. upgrade name         — the answer to "what is this card?"
    //   3. FROM block           — old tech name + its desc, dimmed
    //   4. chevron separator    — clear visual delta
    //   5. TO block             — new effect, bright
    // The avatar tucks into the meta line so it doesn't compete with the
    // body, and the name lives ONCE inside the card (no enc-name dupe).
    card.innerHTML = `
      <div class="upgrade-meta-row">
        <div class="upgrade-avatar">${PORTRAITS[up.charId] || ''}</div>
        <div class="upgrade-meta-label">${char.name} · ${SLOT_LABELS[up.slot]} · ${up.kind === 'sig' ? 'Special' : 'Attack'}</div>
      </div>
      <div class="upgrade-title">${up.name}</div>
      <div class="upgrade-delta">
        <div class="upgrade-from">
          <span class="upgrade-from-name">${baseTech.name}</span>
          <span class="upgrade-from-desc">${baseTech.desc}</span>
        </div>
        <div class="upgrade-chevron" aria-hidden="true">›</div>
        <div class="upgrade-to">
          <span class="upgrade-to-desc">${up.desc}</span>
        </div>
      </div>
    `;
    card.addEventListener('click', () => commitUpgrade(up.id, continueAfter));
    choices.appendChild(card);
  });
  const btn = $('#overlay-btn');
  btn.textContent = 'Pass';
  btn.onclick = () => {
    hideOverlay();
    resetOverlayBtn();
    continueAfter();
  };
  btn.classList.remove('hidden');
  choices.classList.remove('hidden');
  $('#overlay').classList.remove('hidden');
}

function commitUpgrade(upgradeId, onDone) {
  const up = UPGRADES[upgradeId];
  if (!up) return;
  const c = state.party.chars[up.charId];
  if (!c) return;
  // Defensive guard — downed heroes don't learn techs.  availableUpgrades
  // already filters them out, but a stale offer could still land here.
  if (c.downed) return;
  if (!c.upgrades) c.upgrades = {};
  c.upgrades[`${up.slot}.${up.kind}`] = upgradeId;
  log(`<b>${CHARS[up.charId].name}</b> learns <b>${up.name}</b>.`);
  hideOverlay();
  resetOverlayBtn();
  if (typeof onDone === 'function') onDone(); else renderMap();
}

// Pick an empty slot for an incoming recruit — prefer their home, otherwise
// any open slot.  Returns null if the party is full.
function findEmptySlotForRecruit(recruitId) {
  const home = CHARS[recruitId].home;
  if (!state.party.slots[home]) return home;
  return ['front','mid','back'].find(sl => !state.party.slots[sl]) || null;
}

// Pick an empty slot for an incoming recruit — prefer their home, otherwise
// any open slot.  Returns null if the party is full.
function findEmptySlotForRecruit(recruitId) {
  const home = CHARS[recruitId].home;
  if (!state.party.slots[home]) return home;
  return ['front','mid','back'].find(sl => !state.party.slots[sl]) || null;
}

// Short greeting line per hero — used in the recruit overlay's chat bubble.
const RECRUIT_GREETINGS = {
  kai:     "I have done this stretch alone too long.",
  cassia:  "What I have left, I spend down here.",
  elin:    "Mercy still has weight.  I will carry it.",
  branwen: "I name every arrow before I loose it.",
  korin:   "I do not run.  Say so now or never.",
  ash:     "I do not promise to be seen.  Only useful.",
  mira:    "I prefer to finish before they notice.",
  garron:  "Stand behind me.  I will know when to step aside.",
  lirien:  "I am told my songs are a kind of weapon.  Let us see if it's true.",
  vasha:   "Light does not forgive.  But it remembers.  I can carry both.",
  hask:    "I bring the cold with me.  Do not stand still.",
};

// Recruit moment — single hero appears in a mini-vignette.  Re-uses the
// existing showVignette stage so the recruit gets real dialogue with an
// existing party member (via _first wildcard).  Welcome them or walk on.
// `flavor` selects the framing:
//   default  — authored recruit_X intro (rare meeting in the dark)
//   vigil    — fires after a party-mate fell this fight
//   survivor — battlefield mercy; a wounded enemy reveals as a hero
//   stranger — path encounter; the wanderer event hand-off
function showRecruitVignette(heroId, flavor, onDone) {
  const def = CHARS[heroId];
  const base = VIGNETTES[`recruit_${heroId}`];
  let title, lines;
  if (flavor === 'vigil') {
    title = `${def.name} steps into the gap`;
    lines = [
      { who: null,     text: 'The silence after the fall is heavier than the fall.' },
      { who: heroId,   text: 'I heard the shape of it on the wind.  I came as fast as feet allow.' },
      { who: '_first', text: 'You came at the right hour.' },
    ];
  } else if (flavor === 'survivor') {
    title = 'One of them was not theirs';
    lines = [
      { who: null,     text: 'A wounded shape lifts both hands in the dust.  Not surrender — a request.' },
      { who: heroId,   text: 'I walked with them because I had to.  Let me walk with you instead.' },
      { who: '_first', text: 'Prove it before the next reach.' },
    ];
  } else if (flavor === 'stranger') {
    title = 'A stranger on the path';
    lines = [
      { who: null,     text: 'Footsteps in the dust that are not yours.  Whoever they are, they stop when you stop.' },
      { who: heroId,   text: RECRUIT_GREETINGS[heroId] || `${def.name} eyes you in the dark.` },
      { who: '_first', text: 'Speak before we keep walking.' },
    ];
  } else {
    lines = base ? base.lines.slice() : [
      { who: heroId,   text: RECRUIT_GREETINGS[heroId] || `${def.name} eyes you in the dark.` },
      { who: '_first', text: 'Speak quickly.  The reach is hungry.' },
    ];
    title = base ? base.title : `${def.name} steps from the dark`;
  }
  const vig = {
    id: `recruit_event_${heroId}_${flavor || 'default'}`,
    title,
    speaker: heroId,
    lines,
    choices: [
      {
        label: 'Welcome them',
        tag: `${def.name} joins · HP restored`,
        resolve: (s) => {
          const slot = findEmptySlotForRecruit(heroId);
          if (!slot) return;
          s.party.chars[heroId] = newCharState(heroId);
          s.party.slots[slot] = heroId;
          const c = s.party.chars[heroId];
          if (c) c.hp = c.maxHp;
          if (rememberRecruited(heroId)) log(`<i>${def.name} is now available as a starter for future runs.</i>`);
          log(`<b>${def.name}</b> joins the party.`);
          // Reset the frequency counter — a real recruit just landed, so
          // the gate resets and the next one needs a fresh cadence.
          s.run.nodesSinceRecruit = 0;
        },
      },
      {
        label: 'Walk on',
        tag: `${def.name} walks alone`,
        resolve: () => { log(`<b>${def.name}</b> walks on alone.`); },
      },
    ],
  };
  const ctx = captureFightContext(state);
  // Mark the incoming hero as a "guest" so showVignette renders their
  // portrait + named lines even though they aren't in state.party.chars yet.
  ctx.guests = [heroId];
  showVignette(vig, ctx, onDone || (() => offerUpgradeOrPath()));
}

function showSwapOverlay(recruitId, onDone) {
  const def = CHARS[recruitId];
  const cleanup = onDone || (() => offerUpgradeOrPath());
  $('#overlay-title').textContent = `Recruit ${def.name}`;
  $('#overlay-body').textContent = 'Your party is full.  Choose who walks the other way — or refuse and continue alone.';
  const choices = $('#overlay-choices');
  choices.innerHTML = '';
  // Each current party member is a swap candidate (downed too — recruits
  // replace them too).
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
    card.addEventListener('click', () => commitRecruit(currentId, recruitId, cleanup));
    choices.appendChild(card);
  });
  // Refuse — recruit walks away, party continues with the upgrade flow.
  const refuse = document.createElement('button');
  refuse.className = 'encounter-choice swap-choice swap-refuse';
  refuse.innerHTML = `
    <div class="enc-name">Refuse</div>
    <div class="recruit-meta">
      <div class="recruit-title">${def.name} walks on alone.</div>
    </div>
  `;
  refuse.addEventListener('click', () => {
    log(`<b>${def.name}</b> walks on alone.`);
    hideOverlay();
    resetOverlayBtn();
    cleanup();
  });
  choices.appendChild(refuse);

  const btn = $('#overlay-btn');
  btn.textContent = '← Back';
  btn.onclick = () => {
    resetOverlayBtn();
    cleanup();
  };
}

function commitRecruit(removeId, recruitId, onDone) {
  const cleanup = onDone || (() => offerUpgradeOrPath());
  // Empty-slot path: removeId is one of 'front'|'mid'|'back' (a slot name)
  // and the recruit drops in without ejecting anyone.
  if (!removeId || ['front','mid','back'].includes(removeId)) {
    const slot = removeId || CHARS[recruitId].home;
    state.party.chars[recruitId] = newCharState(recruitId);
    state.party.slots[slot] = recruitId;
    if (rememberRecruited(recruitId)) log(`<i>${CHARS[recruitId].name} is now available as a starter for future runs.</i>`);
    log(`<b>${CHARS[recruitId].name}</b> joins the party.`);
    state.run.nodesSinceRecruit = 0;
    hideOverlay();
    resetOverlayBtn();
    cleanup();
    return;
  }
  // Swap path: removeId is a hero id to eject.
  const slot = slotOfChar(state, removeId);
  if (!slot) return;
  delete state.party.chars[removeId];
  state.party.chars[recruitId] = newCharState(recruitId);
  state.party.slots[slot] = recruitId;
  if (rememberRecruited(recruitId)) log(`<i>${CHARS[recruitId].name} is now available as a starter for future runs.</i>`);
  log(`<b>${CHARS[recruitId].name}</b> joins the party.`);
  state.run.nodesSinceRecruit = 0;
  hideOverlay();
  resetOverlayBtn();
  cleanup();
}

// ============================================================================
// BOOT
// ============================================================================

function init() {
  // Make sure the full-bleed title isn't lingering behind the game.
  hideTitleScreen();
  // If the player just cleared a layer, a carried party snapshot is
  // waiting in localStorage.  Skip the starter chooser entirely — same
  // team climbs.  newState() consumes the snapshot from inside.
  const hasCarry = !!(function peek(){ try { return localStorage.getItem(CARRIED_KEY); } catch (_) { return null; } })();
  // Show the starter chooser if the player has more than one solo-viable
  // hero unlocked.  Otherwise auto-pick (Kai by default).
  const pool = getUnlockedStarters().filter(id => SOLO_VIABLE.has(id));
  const afterStart = () => {
    const ctx = captureFightContext(state);
    ctx.phase = 'runStart';
    const matches = matchVignettes(state, ctx);
    if (matches.length) {
      const pick = matches[Math.floor(Math.random() * matches.length)];
      // The wake vignette stashes the player's boon pick on state.run; the
      // resolver opens the matching sub-screen (sigil / upgrades / rumor)
      // before handing off to the map.  Other runStart vignettes set no tag
      // and the resolver is a no-op pass-through.
      showVignette(pick, ctx, () => resolveOpeningBoon(() => renderMap()));
      return;
    }
    renderMap();
  };
  const proceed = (starterId) => {
    state = newState(starterId);
    afterStart();
  };
  if (hasCarry || pool.length <= 1) {
    proceed(pool[0] || 'kai');
    return;
  }
  showStarterChooser(pool, proceed);
}

// Pick a starter from the unlocked solo-viable pool.  Visually a slim grid
// of portrait cards; click to begin the climb with that hero.
// Starter chooser — horizontal lineup of standing silhouettes against the
// void.  Short tap selects.  Press-and-hold reveals a floating detail
// card (HP / home slot / passive) — same pattern as the path map's
// node-tooltip.
function showStarterChooser(pool, onPick) {
  $('#overlay').classList.remove('overlay-path', 'overlay-vignette', 'overlay-runsummary', 'overlay-rest', 'overlay-recruit', 'overlay-upgrade', 'overlay-sigil');
  $('#overlay').classList.add('overlay-full', 'overlay-starter');
  $('#overlay-title').textContent = 'Who wakes here?';
  const body = $('#overlay-body');
  body.classList.remove('victory-summary-body', 'welcome-body', 'run-summary-body', 'title-screen-body');
  body.innerHTML = `<p class="starter-flavor">You can only carry one breath at the bottom.  Choose who draws it.</p>`;
  const choices = $('#overlay-choices');
  choices.innerHTML = '';
  choices.classList.remove('path-map', 'party-inspect', 'event-choices', 'title-choices', 'vignette-choices');
  choices.classList.add('starter-choices');

  // Render the lineup as a single flexible row of standing silhouettes.
  const lineup = document.createElement('div');
  lineup.className = 'starter-lineup';
  pool.forEach((id, idx) => {
    const def = CHARS[id];
    const fig = document.createElement('button');
    fig.type = 'button';
    fig.className = 'starter-fig';
    fig.dataset.id = id;
    fig.innerHTML = `
      <div class="starter-portrait">${PORTRAITS[id] || ''}</div>
      <div class="starter-name">${def.name}</div>
    `;
    bindStarterHoldOrTap(fig, def, () => {
      hideOverlay();
      choices.classList.remove('starter-choices');
      resetOverlayBtn();
      onPick(id);
    });
    lineup.appendChild(fig);
  });
  choices.appendChild(lineup);

  resetOverlayBtn();
  $('#overlay-btn').classList.add('hidden');
  choices.classList.remove('hidden');
  $('#overlay').classList.remove('hidden');
}

// Tap-or-hold detection for the starter lineup, mirroring the map nodes'
// bindNodeHoldOrTap.  Hold reveals a detail tooltip; short tap selects.
function bindStarterHoldOrTap(el, def, onPick) {
  const HOLD_MS = 350;
  let timer = null;
  let triggered = false;
  let downPos = null;
  el.addEventListener('pointerdown', (e) => {
    triggered = false;
    downPos = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => { triggered = true; showStarterTooltip(el, def); timer = null; }, HOLD_MS);
  });
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  el.addEventListener('pointerup', (e) => {
    cancel();
    if (triggered) { e.preventDefault(); e.stopPropagation(); return; }
    onPick();
  });
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointermove', (e) => {
    if (!downPos) return;
    const dx = e.clientX - downPos.x, dy = e.clientY - downPos.y;
    if (dx*dx + dy*dy > 100) cancel();
  });
}

function showStarterTooltip(anchorEl, def) {
  hideStarterTooltip();
  const tt = document.createElement('div');
  tt.id = 'starter-tooltip';
  tt.innerHTML = `
    <div class="st-name">${def.name}</div>
    <div class="st-title">${def.title || ''}</div>
    <div class="st-stats">
      <span class="st-stat">HP ${def.maxHp}</span>
      <span class="st-stat">Home ${SLOT_LABELS[def.home] || '—'}</span>
      <span class="st-stat">${(def.school || '').toUpperCase()}</span>
    </div>
    <div class="st-passive"><b>${def.passive?.name || ''}</b> — ${def.passive?.desc || ''}</div>
  `;
  document.body.appendChild(tt);
  const r = anchorEl.getBoundingClientRect();
  const ttRect = tt.getBoundingClientRect();
  let top  = r.top - ttRect.height - 10;
  if (top < 8) top = r.bottom + 10;
  let left = r.left + r.width / 2 - ttRect.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - ttRect.width - 8));
  tt.style.top = top + 'px';
  tt.style.left = left + 'px';
  setTimeout(hideStarterTooltip, 6000);
  setTimeout(() => document.addEventListener('pointerdown', _stDismissHandler, true), 0);
}
function _stDismissHandler(e) {
  const tt = document.getElementById('starter-tooltip');
  if (tt && !tt.contains(e.target)) hideStarterTooltip();
}
function hideStarterTooltip() {
  const tt = document.getElementById('starter-tooltip');
  if (tt) tt.remove();
  document.removeEventListener('pointerdown', _stDismissHandler, true);
}

// ============================================================================
// OPENING BOON — the "you wake at the bottom" vignette offers three choices,
// each of which stashes a tag on state.run._openingBoon.  resolveOpeningBoon
// (called by init's afterStart after the vignette finishes) reads that tag
// and opens the matching sub-screen: sigil offer, two starter upgrades, or
// a rumor pick from the recruitable pool.
// ============================================================================
function resolveOpeningBoon(onDone) {
  const after = onDone || (() => renderMap());
  const which = state && state.run && state.run._openingBoon;
  if (state && state.run) state.run._openingBoon = null;

  // Both sub-screens (sigil + rumor) tag the choices container so the layout
  // forces 3 compact tiles in a single horizontal row — landscape-safe and
  // dodging the global flex-wrap rule at max-height: 480px.  Cleared on the
  // way back out.
  const choicesEl = $('#overlay-choices');
  const dropSubClass = (done) => () => { choicesEl.classList.remove('boon-sub'); done(); };

  if (which === 'sigil') {
    choicesEl.classList.add('boon-sub');
    offerSigilFromNode(dropSubClass(after));
    return;
  }
  if (which === 'upgrade') {
    const grantOne = (remaining, done) => {
      const pool = availableUpgrades(state);
      if (!pool.length || remaining <= 0) { done(); return; }
      const shuffled = pool.slice().sort(() => Math.random() - 0.5);
      const offers = shuffled.slice(0, Math.min(2, shuffled.length));
      showUpgradeOverlay(offers, () => grantOne(remaining - 1, done));
    };
    grantOne(2, after);
    return;
  }
  if (which === 'rumor') {
    const recruitable = ROSTER.filter(id => !state.party.chars[id]);
    if (!recruitable.length) { after(); return; }
    const shuffled = recruitable.slice().sort(() => Math.random() - 0.5);
    const offers = shuffled.slice(0, Math.min(3, shuffled.length));
    choicesEl.classList.add('boon-sub');
    showOpeningRumorChooser(offers, dropSubClass(after));
    return;
  }
  after();
}

function showOpeningRumorChooser(heroIds, onDone) {
  const continueAfter = onDone || (() => renderMap());
  const $overlay = $('#overlay');
  $overlay.classList.remove('overlay-path','overlay-vignette','overlay-runsummary','overlay-rest','overlay-recruit','overlay-upgrade','overlay-sigil','overlay-starter');
  $overlay.classList.add('overlay-full','overlay-cinematic','overlay-recruit');
  $('#overlay-title').textContent = 'Whose name carries down here?';
  const body = $('#overlay-body');
  body.classList.remove('victory-summary-body','welcome-body','run-summary-body','title-screen-body','vignette-body');
  body.innerHTML = `<p class="boon-flavor">Mark one — the next recruit will favor them.</p>`;
  const choices = $('#overlay-choices');
  choices.innerHTML = '';
  choices.classList.remove('path-map','party-inspect','event-choices','vignette-choices','starter-choices');
  choices.classList.add('rumor-choices');
  heroIds.forEach(id => {
    const def = CHARS[id];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'encounter-choice rumor-choice';
    card.innerHTML = `
      <div class="rumor-portrait">${PORTRAITS[id] || ''}</div>
      <div class="enc-name">${def.name}</div>
      <div class="sigil-desc">${def.title || ''}</div>
    `;
    card.addEventListener('click', () => {
      Audio.ui();
      (state.run.rumoredHeroes = state.run.rumoredHeroes || []).push(id);
      log(`<i>Word reaches you of <b>${def.name}</b>, somewhere below.</i>`);
      hideOverlay();
      choices.classList.remove('rumor-choices');
      continueAfter();
    });
    choices.appendChild(card);
  });
  resetOverlayBtn();
  $('#overlay-btn').classList.add('hidden');
  choices.classList.remove('hidden');
  $overlay.classList.remove('hidden');
}

// ============================================================================
// SAVE / LOAD — basic localStorage snapshot of the active run state.
// Sets are serialized to arrays and rehydrated on load.
// ============================================================================
const SAVE_KEY = 'kizuna.save';

function saveState() {
  if (!state || state.over) { try { localStorage.removeItem(SAVE_KEY); } catch (_) {} return; }
  try {
    const snap = { ...state };
    // Sets / runtime caches don't survive JSON
    snap.firedSynergies = Array.from(state.firedSynergies || []);
    snap.usedCombos     = Array.from(state.usedCombos || []);
    delete snap.__simulating;
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
  } catch (_) {}
}
function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (_) { return false; }
}
function loadStateOrNull() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    snap.firedSynergies = new Set(snap.firedSynergies || []);
    snap.usedCombos     = new Set(snap.usedCombos || []);
    return snap;
  } catch (_) { return null; }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (_) {} }

// ============================================================================
// TITLE SCREEN — KIZUNA | Resonance
// New Game / Continue / Credits
// ============================================================================
// Full-bleed JRPG-style title screen.  Lives in its own #title-screen
// container outside the standard #overlay, so it gets the whole viewport
// and isn't constrained by the modal card.  A hero silhouette stands in
// the abyss while drifting motes rise behind them.
// ============================================================================
// THE ABYSS — multi-layer meta-progression.  The abyss has 9 layers (echoes
// of Dante / Yggdrasil); each completed boss unlocks the next.  The world
// map screen surfaces this between runs.  Only Layer 1 has full content
// authored; the rest are teasers / locked placeholders.
// ============================================================================
const ABYSS_LAYERS = [
  { id: 1, name: 'The Hollow Reach',     subtitle: 'Where breath returns slow', desc: 'The abyss floor.  Sins of stillness, of recall, of cinders.', boss: 'The Wakeling' },
  { id: 2, name: 'The Veil of Names',    subtitle: 'Where the dead remember',   desc: 'Sins that hold the names of who you used to be.', boss: 'The Listener' },
  { id: 3, name: 'The Spire of Glass',   subtitle: 'Where every blade reflects',desc: 'Sins of mirrors and of pride.', boss: 'The Twin' },
  { id: 4, name: 'The Floodlit Hall',    subtitle: 'Where the sky was buried',  desc: 'Sins of weight, of drowning oaths.', boss: 'The Drowned Choir' },
  { id: 5, name: 'The Cinder Garden',    subtitle: 'Where roots eat the dead',  desc: 'Sins of cycles and of buried fires.', boss: 'The Slow Bloom' },
  { id: 6, name: 'The Iron Forest',      subtitle: 'Where every tree is a name',desc: 'Sins of vows broken and re-sworn.', boss: 'The Nameless Knight' },
  { id: 7, name: 'The Cold Reach',       subtitle: 'Where light forgets how',   desc: 'Sins of distance, of silence.', boss: 'The Last Star' },
  { id: 8, name: 'The Tide of Wakes',    subtitle: 'Where the dawn never rose', desc: 'Sins of every morning the world refused.', boss: 'The Unwaking' },
  { id: 9, name: 'The Crown of Echoes',  subtitle: 'Where the abyss looks back',desc: 'The summit.  What is climbing toward you.', boss: '???' },
];
const LAYER_KEY = 'kizuna.layer';
const CLEARED_KEY = 'kizuna.clearedLayers';
function getCurrentLayer() {
  try { return Math.max(1, parseInt(localStorage.getItem(LAYER_KEY) || '1', 10)); } catch (_) { return 1; }
}
function setCurrentLayer(n) {
  try { localStorage.setItem(LAYER_KEY, String(n)); } catch (_) {}
}
function getClearedLayers() {
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; }
  } catch (_) {}
  return [];
}
function markLayerCleared(layerId) {
  const cur = getClearedLayers();
  if (!cur.includes(layerId)) {
    cur.push(layerId);
    try { localStorage.setItem(CLEARED_KEY, JSON.stringify(cur)); } catch (_) {}
  }
}

// Party persistence across layers — when ascending, snapshot the current
// team so the next layer's run starts with the same heroes (HP / quirks /
// upgrades intact).  consumeCarriedParty() reads + clears the snapshot.
const CARRIED_KEY = 'kizuna.carriedParty';
function saveCarriedParty(s) {
  if (!s || !s.party) return;
  try {
    // Only the survivors climb.  Fallen heroes are mourned in the memorial
    // and don't carry to the next layer — their slot opens for a recruit.
    const survivors = Object.values(s.party.chars).filter(c => !c.downed);
    const carriedIds = new Set(survivors.map(c => c.id));
    const chars = survivors.map(c => ({
      id: c.id,
      hp: c.hp, maxHp: c.maxHp,
      quirks: c.quirks || { positive: [], negative: [] },
      upgrades: c.upgrades || {},
    }));
    // Strip dead heroes from the slot map so their position opens for a
    // future recruit on the next layer.
    const slots = {};
    ['front', 'mid', 'back'].forEach(sl => {
      const id = s.party.slots[sl];
      slots[sl] = (id && carriedIds.has(id)) ? id : null;
    });
    const data = { chars, slots };
    localStorage.setItem(CARRIED_KEY, JSON.stringify(data));
  } catch (_) {}
}
function consumeCarriedParty() {
  try {
    const raw = localStorage.getItem(CARRIED_KEY);
    if (!raw) return null;
    localStorage.removeItem(CARRIED_KEY);
    return JSON.parse(raw);
  } catch (_) { return null; }
}
function clearCarriedParty() {
  try { localStorage.removeItem(CARRIED_KEY); } catch (_) {}
}
function isLayerUnlocked(layerId) {
  if (layerId === 1) return true;
  return getClearedLayers().includes(layerId - 1);
}

// World Map — surfaced after a boss-cleared run summary.  Shows the abyss
// as a vertical climb of 9 layers; current ones glow, cleared ones recede,
// locked ones are dim placeholders that hint at what's above.
function showWorldMap() {
  if (Audio && typeof Audio.stopAmbient === 'function') Audio.stopAmbient();
  hideOverlay();
  hideTitleScreen();
  const root = document.getElementById('world-map');
  if (!root) {
    // Lazy build the container on first show
    buildWorldMapContainer();
    return showWorldMap();
  }
  const list = document.getElementById('wm-list');
  list.innerHTML = '';
  const cleared = getClearedLayers();
  // Render top-down so the highest layer is at the top of the screen
  ABYSS_LAYERS.slice().reverse().forEach(layer => {
    const isCleared = cleared.includes(layer.id);
    const isUnlocked = isLayerUnlocked(layer.id);
    const isCurrent = (layer.id === Math.min(9, Math.max.apply(null, [1, ...cleared.map(c => c + 1)])));
    const row = document.createElement('div');
    row.className = 'wm-row' + (isCleared ? ' wm-cleared' : '') + (isUnlocked && !isCleared ? ' wm-unlocked' : '') + (!isUnlocked ? ' wm-locked' : '') + (isCurrent ? ' wm-current' : '');
    const hasContent = !!LAYER_CONTENT[layer.id];
    row.innerHTML = `
      <span class="wm-num">${layer.id}</span>
      <div class="wm-meta">
        <div class="wm-name">${layer.name}</div>
        <div class="wm-sub">${layer.subtitle}</div>
        ${isUnlocked ? `<div class="wm-desc">${layer.desc}</div>` : ''}
        ${isUnlocked ? `<div class="wm-boss">Boss · ${layer.boss}${hasContent ? '' : ' · <i>(coming soon)</i>'}</div>` : `<div class="wm-locked-tag">— sealed —</div>`}
      </div>
    `;
    // Clickable iff unlocked AND content exists.  Tapping starts a fresh
    // run on that layer.
    if (isUnlocked && hasContent) {
      row.classList.add('wm-clickable');
      row.addEventListener('click', () => {
        Audio.ui();
        setCurrentLayer(layer.id);
        root.classList.add('hidden');
        clearSave();
        init();
      });
    }
    list.appendChild(row);
  });
  root.classList.remove('hidden');
  // Cinematic intro — start scrolled to the top of the abyss (highest
  // layers visible first), pause a beat so the player gets the panorama,
  // then ease down until the next-playable layer sits at the top.  Skip
  // the slide if there's no current row (every layer cleared) or the
  // current row is already at the top.
  const currentRow = list.querySelector('.wm-current');
  list.scrollTop = 0;
  if (currentRow) {
    const target = Math.max(0, currentRow.offsetTop - list.offsetTop);
    if (target > 4) {
      setTimeout(() => _smoothScrollList(list, target, 1100), 520);
    }
  }
  const btn = document.getElementById('wm-continue');
  const close = () => { root.classList.add('hidden'); showTitleScreen(); };
  if (btn) btn.onclick = close;
  bindBackdropDismiss(root, '.wm-content', close);
}

// Cubic ease-out scroll on a container.  Used by the world map's intro
// slide; kept generic in case other scroll-on-reveal flows want it.
function _smoothScrollList(el, targetTop, duration) {
  if (!el) return;
  const startTop = el.scrollTop;
  const delta = targetTop - startTop;
  if (Math.abs(delta) < 1) return;
  const startTime = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.scrollTop = startTop + delta * eased;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function buildWorldMapContainer() {
  const root = document.createElement('div');
  root.id = 'world-map';
  root.className = 'hidden';
  root.innerHTML = `
    <div class="wm-bg"></div>
    <div class="wm-content">
      <header class="wm-header">
        <h2 class="wm-title">THE ABYSS</h2>
        <p class="wm-subtitle">Each layer climbed reveals what waits above</p>
      </header>
      <div class="wm-list" id="wm-list"></div>
      <button type="button" class="wm-continue" id="wm-continue">Return to Title</button>
    </div>
  `;
  document.body.appendChild(root);
}

function showTitleScreen() {
  if (Audio && typeof Audio.startAmbient === 'function') Audio.startAmbient('title');
  // Ensure the in-game overlay isn't competing
  hideOverlay();
  const root = document.getElementById('title-screen');
  if (!root) return;

  // Hero figure — show the player's most recently unlocked starter so the
  // meta-progression is visible at the title screen.  Default: Kai.
  const unlocked = getUnlockedStarters().filter(id => SOLO_VIABLE.has(id));
  const heroId = unlocked.length ? unlocked[unlocked.length - 1] : 'kai';
  const heroEl = document.getElementById('ts-hero');
  if (heroEl) heroEl.innerHTML = PORTRAITS[heroId] || '';

  // Menu
  const menuEl = document.getElementById('ts-menu');
  menuEl.innerHTML = '';
  const mkBtn = (label, onClick, disabled) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ts-menu-btn' + (disabled ? ' disabled' : '');
    b.textContent = label;
    if (!disabled) b.addEventListener('click', () => { Audio.ui(); onClick(); });
    return b;
  };
  menuEl.appendChild(mkBtn('New Game', () => {
    // Wipe both the in-flight save AND any layer-to-layer carry team.
    // The carry only exists for the boss-win → ascend handoff; outside
    // that path it must not silently pre-populate a "new" run.
    clearSave();
    clearCarriedParty();
    // Always start a New Game from layer 1, ignoring meta-progression's
    // current-layer pointer.  Cleared layers stay unlocked in the World
    // Map — that's the path to start higher.
    setCurrentLayer(1);
    hideTitleScreen();
    init();
  }));
  const canContinue = hasSave();
  menuEl.appendChild(mkBtn('Continue', () => {
    const loaded = loadStateOrNull();
    if (!loaded) { showTitleScreen(); return; }
    state = loaded;
    hideTitleScreen();
    renderMap();
  }, !canContinue));
  menuEl.appendChild(mkBtn('Heroes',  () => showHeroCodex()));
  menuEl.appendChild(mkBtn('Credits', () => showCreditsScreen()));
  menuEl.appendChild(mkBtn('Settings', () => showSettingsScreen()));

  // Unlocks badge
  const metaEl = document.getElementById('ts-meta');
  metaEl.innerHTML = `Starters unlocked · <b>${unlocked.length || 1}</b> / ${ROSTER.length}`;

  root.classList.remove('hidden');
  root.setAttribute('aria-hidden', 'false');
}

function hideTitleScreen() {
  const root = document.getElementById('title-screen');
  if (!root) return;
  root.classList.add('hidden');
  root.setAttribute('aria-hidden', 'true');
}

// Settings — small overlay over the title with toggles for audio,
// tutorial, save reset, and meta-unlock reset.
function showSettingsScreen() {
  $('#overlay').classList.add('overlay-dismissable');
  bindOverlayBackdropDismiss();
  $('#overlay-title').textContent = 'Settings';
  const body = $('#overlay-body');
  body.classList.remove('welcome-body', 'title-screen-body', 'victory-summary-body', 'run-summary-body');
  body.innerHTML = `
    <div class="settings-grid">
      <button type="button" class="settings-row" data-action="mute">
        <span class="settings-label">Audio</span>
        <span class="settings-value" id="settings-mute-val"></span>
      </button>
      <button type="button" class="settings-row" data-action="tutorial">
        <span class="settings-label">First-run tutorial</span>
        <span class="settings-value">Show again on next run</span>
      </button>
      <button type="button" class="settings-row settings-danger" data-action="clearsave">
        <span class="settings-label">Active run</span>
        <span class="settings-value">Clear save</span>
      </button>
      <button type="button" class="settings-row settings-danger" data-action="resetprogress">
        <span class="settings-label">Meta progression</span>
        <span class="settings-value">Reset all unlocks</span>
      </button>
    </div>
  `;
  const syncMute = () => {
    const el = document.getElementById('settings-mute-val');
    if (el) el.textContent = Audio.isMuted() ? 'Muted' : 'On';
  };
  syncMute();
  body.querySelectorAll('.settings-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      Audio.ui();
      if (action === 'mute') {
        Audio.ensure();
        Audio.toggleMute();
        // Sync the floating #mute-btn icon too
        const m = document.getElementById('mute-btn');
        if (m) {
          if (Audio.isMuted()) { m.classList.add('muted'); m.textContent = '♪̸'; m.title = 'Unmute'; }
          else                  { m.classList.remove('muted'); m.textContent = '♪'; m.title = 'Mute'; }
        }
        syncMute();
      } else if (action === 'tutorial') {
        try { localStorage.removeItem('kizuna.tutorialSeen'); } catch (_) {}
        _tutCursor = 0;
        flashSettings('Tutorial will replay next run.');
      } else if (action === 'clearsave') {
        confirmDestructive('Clear the active run?', 'This deletes your in-progress save.', () => {
          clearSave();
          clearCarriedParty();
          flashSettings('Active run cleared.');
          setTimeout(() => { hideOverlay(); showTitleScreen(); }, 600);
        });
      } else if (action === 'resetprogress') {
        confirmDestructive('Reset meta progression?', 'Starter unlocks, world-map progress, and the cleared-layer chain will be wiped.', () => {
          try { localStorage.removeItem(UNLOCKED_KEY); } catch (_) {}
          try { localStorage.removeItem(LAYER_KEY); } catch (_) {}
          try { localStorage.removeItem(CLEARED_KEY); } catch (_) {}
          clearCarriedParty();
          flashSettings('Meta progression reset.');
          setTimeout(() => { hideOverlay(); showTitleScreen(); }, 600);
        });
      }
    });
  });

  const choicesEl = $('#overlay-choices');
  choicesEl.innerHTML = '';
  choicesEl.classList.remove('title-choices');
  choicesEl.classList.add('hidden');
  resetOverlayBtn();
  const btn = $('#overlay-btn');
  btn.textContent = 'Back';
  btn.onclick = () => { hideOverlay(); };
  btn.classList.remove('hidden');
  $('#overlay').classList.remove('hidden');
}
// Two-button confirm modal for destructive actions.  Builds a small
// element on top of everything else; the user must explicitly confirm.
function confirmDestructive(title, body, onConfirm) {
  const old = document.getElementById('confirm-modal');
  if (old) old.remove();
  const m = document.createElement('div');
  m.id = 'confirm-modal';
  m.innerHTML = `
    <div class="cm-card">
      <div class="cm-title">${title}</div>
      <div class="cm-body">${body}</div>
      <div class="cm-actions">
        <button type="button" class="cm-cancel">Cancel</button>
        <button type="button" class="cm-confirm">Confirm</button>
      </div>
    </div>
  `;
  document.body.appendChild(m);
  m.querySelector('.cm-cancel').addEventListener('click', () => { Audio.ui(); m.remove(); });
  m.querySelector('.cm-confirm').addEventListener('click', () => { Audio.ui(); m.remove(); onConfirm(); });
}

function flashSettings(msg) {
  const note = document.createElement('div');
  note.className = 'settings-flash';
  note.textContent = msg;
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 1100);
}

// Credits — kept as an overlay since it's a "back" screen on top of the
// title.  The title screen stays visible behind the dimmed overlay.
// Hero Codex — title-screen lore screen showing every hero in the ROSTER.
// Unlocked starters render with full info (portrait, title, school, HP,
// home, passive, quirks-they-can-earn).  Locked heroes show a silhouette
// with a "walk with them in a run to unlock" hint.
function showHeroCodex() {
  Audio.ui();
  const root = document.getElementById('hero-codex') || _buildHeroCodexContainer();
  const list = document.getElementById('hc-list');
  list.innerHTML = '';
  const unlocked = new Set(getUnlockedStarters());
  // Each row collapses by default to just portrait + name + title.  Tapping
  // a row expands its details (stats / passive / affinities); opening one
  // closes any other open row so the menu reads one focus at a time.
  ROSTER.forEach(id => {
    const def = CHARS[id];
    if (!def) return;
    const isUnlocked = unlocked.has(id);
    const quirks = Object.values(QUIRKS).filter(q => q.heroId === id);
    const quirkList = quirks.length
      ? `<div class="hc-quirks">${quirks.map(q => `<span class="hc-quirk">${q.name}</span>`).join('')}</div>`
      : '';
    const row = document.createElement('div');
    row.className = 'hc-row' + (isUnlocked ? '' : ' hc-locked');
    row.dataset.heroId = id;
    row.innerHTML = `
      <button type="button" class="hc-row-head" aria-expanded="false">
        <div class="hc-portrait">${PORTRAITS[id] || ''}</div>
        <div class="hc-row-meta">
          <span class="hc-name">${def.name}</span>
          <span class="hc-title">${isUnlocked ? (def.title || '') : '— sealed —'}</span>
        </div>
        <span class="hc-chev" aria-hidden="true">›</span>
      </button>
      <div class="hc-row-body" hidden>
        ${isUnlocked ? `
          <div class="hc-stats">
            <span class="hc-stat">HP ${def.maxHp}</span>
            <span class="hc-stat">Home ${SLOT_LABELS[def.home] || '—'}</span>
            <span class="hc-stat">${(def.school || '').toUpperCase()}</span>
          </div>
          ${def.passive ? `<div class="hc-passive"><b>${def.passive.name}</b> · ${def.passive.desc}</div>` : ''}
          ${quirkList ? `<div class="hc-section">Affinities</div>${quirkList}` : ''}
        ` : `
          <div class="hc-locked-hint">Walk with this hero in a run to remember them.</div>
        `}
      </div>
    `;
    const head = row.querySelector('.hc-row-head');
    const body = row.querySelector('.hc-row-body');
    head.addEventListener('click', () => {
      const open = !row.classList.contains('hc-open');
      // Single-expand: close any sibling that's open first.
      list.querySelectorAll('.hc-row.hc-open').forEach(r => {
        if (r === row) return;
        r.classList.remove('hc-open');
        const rb = r.querySelector('.hc-row-body');
        const rh = r.querySelector('.hc-row-head');
        if (rb) rb.hidden = true;
        if (rh) rh.setAttribute('aria-expanded', 'false');
      });
      row.classList.toggle('hc-open', open);
      body.hidden = !open;
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
      Audio.ui();
    });
    list.appendChild(row);
  });
  root.classList.remove('hidden');
  const close = document.getElementById('hc-close');
  const closer = () => root.classList.add('hidden');
  if (close) close.onclick = closer;
  bindBackdropDismiss(root, '.hc-content', closer);
}
function _buildHeroCodexContainer() {
  const root = document.createElement('div');
  root.id = 'hero-codex';
  root.className = 'hidden';
  root.innerHTML = `
    <div class="hc-bg"></div>
    <div class="hc-content">
      <header class="hc-header">
        <h2 class="hc-title-h">HEROES</h2>
        <button type="button" class="hc-close" id="hc-close" aria-label="Close">×</button>
      </header>
      <div class="hc-list" id="hc-list"></div>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

function showCreditsScreen() {
  $('#overlay').classList.add('overlay-dismissable');
  bindOverlayBackdropDismiss();
  $('#overlay-title').textContent = 'Credits';
  const body = $('#overlay-body');
  body.classList.remove('welcome-body', 'title-screen-body');
  body.innerHTML = `
    <p class="title-flavor">
      <b>KIZUNA | Resonance</b><br>
      A 3-position tactical roguelite.<br><br>
      You wake alone in the abyss and begin to climb.<br>
      Bonds and frictions ripple through whoever walks with you.<br>
      The reach remembers what you did, and what you didn't.
    </p>
  `;
  const choicesEl = $('#overlay-choices');
  choicesEl.innerHTML = '';
  choicesEl.classList.remove('title-choices');
  choicesEl.classList.add('hidden');
  resetOverlayBtn();
  const btn = $('#overlay-btn');
  btn.textContent = 'Back';
  btn.onclick = () => { hideOverlay(); /* title screen still visible behind */ };
  btn.classList.remove('hidden');
  $('#overlay').classList.remove('hidden');
}

// ============================================================================
// PASSWORD GATE — soft (frontend-only) lock so the page isn't openly browsable.
// Token cached in localStorage once entered correctly.
// ============================================================================
const PASSWORD_KEY = 'kizuna.unlocked';
const PASSWORD     = 'keeter';
function isUnlocked() {
  try { return localStorage.getItem(PASSWORD_KEY) === '1'; } catch (_) { return false; }
}
function showPasswordGate(onUnlock) {
  // Build the gate as a full-screen overlay separate from #overlay (so it
  // can't be dismissed by other game flows).
  const gate = document.createElement('div');
  gate.id = 'password-gate';
  gate.innerHTML = `
    <div class="password-card">
      <div class="password-title">KIZUNA</div>
      <div class="password-subtitle">Resonance</div>
      <input type="password" id="password-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="…">
      <button type="button" id="password-submit">Enter</button>
      <div id="password-error"></div>
    </div>
  `;
  document.body.appendChild(gate);
  const input = gate.querySelector('#password-input');
  const submit = gate.querySelector('#password-submit');
  const err = gate.querySelector('#password-error');
  const tryUnlock = () => {
    if ((input.value || '').toLowerCase() === PASSWORD) {
      try { localStorage.setItem(PASSWORD_KEY, '1'); } catch (_) {}
      gate.remove();
      onUnlock();
    } else {
      err.textContent = 'incorrect';
      input.value = '';
      input.focus();
    }
  };
  submit.addEventListener('click', tryUnlock);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });
  setTimeout(() => input.focus(), 50);
}

function bootGame() {
  // Password gate first — if locked, nothing else runs.
  if (!isUnlocked()) {
    showPasswordGate(() => bootGame());
    return;
  }
  bindUI();
  setupStatusTooltips();
  // Title screen on every load.  "Continue" is enabled iff a save exists.
  showTitleScreen();
}

document.addEventListener('DOMContentLoaded', bootGame);
