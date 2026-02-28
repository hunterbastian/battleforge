# BattleForge — Auto Battler

A Hearthstone-inspired auto battler built with Expo React Native.

## Stack
- **Frontend**: Expo Router (file-based routing), React Native
- **Font**: Cinzel (fantasy/medieval feel via @expo-google-fonts/cinzel)
- **State**: useState (all local, no backend needed)
- **Persistence**: AsyncStorage (player stats + match history)
- **Animations**: React Native Animated API (blob attack lunges, damage flashes, HP bars)

## Architecture

All game logic lives in `app/index.tsx` (single screen, no tabs).
Game constants, types, and simulation in `constants/game.ts`.

### Game Loop
1. **Home Screen** — title, blob parade, player stats, match history
2. **Prep Phase** — buy units from shop (Hearthstone-style cards), arrange board/bench
3. **Battle Phase** — blobs animate attacking each other in the arena
4. **Results Phase** — win/lose/draw with gold earned and HP changes
5. **Game Over / Victory** after 10 rounds

### Unit Classes (with abilities)
- **Warrior** (orange, 1g) — Takes 15% less damage
- **Mage** (purple, 2g) — Splash: hits another enemy for 35% damage
- **Archer** (green, 2g) — 30% chance double attack
- **Paladin** (yellow, 3g) — Heals lowest ally for 15 HP after attacking
- **Rogue** (teal, 3g) — First attack is 2x critical hit

### Star Upgrade System
- Units start at 1 star
- Buying a duplicate auto-merges: 1-star -> 2-star (1.6x stats) -> 3-star (2.5x stats)
- Visual: gold dots above blob, golden border ring at 2+ stars
- `tryMergeUnit()` in game.ts handles merge logic

### Class Synergies (2+ of same class on board)
- **Iron Wall** (Warrior) — All player units take 15% less damage
- **Arcane Power** (Mage) — +25% attack to all units
- **Swift Volley** (Archer) — All units attack 15% faster
- **Holy Light** (Paladin) — +1 HP healed on victory
- **Shadow Pact** (Rogue) — +10% attack to all units
- `computeSynergies()` computes active synergies from board composition
- `applyStatSynergies()` applies attack/speed buffs before simulation
- Warrior synergy damage reduction applied in simulation damage calculation

### Battle Simulation
`simulateBattle()` runs the full battle upfront with ability effects:
- Warrior damage reduction, Mage splash, Archer double-strike, Paladin heal, Rogue crit
- Synergy stat buffs applied to player units before simulation
- Events replayed with `setTimeout` at 0.42x speed for animation

### Rank System
- 6 ranks: Bronze, Silver, Gold, Platinum, Diamond, Legend
- Each rank (except Legend) has 3 levels
- XP earned per game: Win = 25 + round*3, Loss = 10 + round*2
- XP thresholds: Bronze 0-299, Silver 300-699, Gold 700-1199, Platinum 1200-1899, Diamond 1900-2799, Legend 2800+
- `getRankInfo()` computes current rank, level, and progress from total XP
- `calcXpGain()` calculates XP earned from a match result
- Rank badge with icon + XP progress bar shown on home and end screens

### Persistent Data
- `PlayerStats` stored in AsyncStorage key `battleforge_stats`
- Tracks: total games, wins, losses, best round, total XP, last 20 match records
- Each match record includes XP gained
- Home screen displays rank badge, XP progress, stats grid, and recent match history
- End screen shows XP gained banner, rank progress, and career stats
- "Play Again" returns to home screen so player can see updated rank/stats

## Key Components
- `BlobCharacter` — blob with star dots and golden border for upgrades
- `ArenaUnit` — blob with walking (bobbing steps) attack animation, flee mechanic (units <20% HP may run away), damage flash, HP bar, floating damage/heal/fled popups
- `TopDownArena` — top-down battle arena with absolute-positioned units (enemies top, player bottom)
- `HeroCard` — Hearthstone card with ability text, cost gem, attack/health stats
- `SynergyPanel` — shows active/inactive synergy badges with count/threshold

## Theme: Cottagecore x Skyrim
Warm earthy palette — deep woodland brown (#1A1510) bg, parchment cream (#E8DCC8) text, honeyed amber (#D4A44C) accents. Unit colors: copper warrior, plum hedge witch, moss green ranger, amber hearthkeeper, teal shadowfoot. Arena is a dark forest clearing (#1E1A12). Rustic fantasy flavor text throughout (tavern, hearth band, trials, etc). Ranks: Copper, Iron, Silver, Gold, Elder, Legend.

## Workflows
- **Start Frontend**: `npm run expo:dev` — Expo dev server on port 8081
- **Start Backend**: `npm run server:dev` — Express server on port 5000 (minimal, landing page)
