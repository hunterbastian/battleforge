import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import COLORS from "@/constants/colors";
import {
  ActiveSynergy,
  BoardUnit,
  DEFAULT_STATS,
  GamePhase,
  MAX_BENCH_SIZE,
  MAX_BOARD_SIZE,
  MatchRecord,
  PlayerStats,
  RankInfo,
  STARTING_HP,
  ShopItem,
  TOTAL_ROUNDS,
  UNIT_CLASSES,
  UNIT_TEMPLATES,
  UnitTemplate,
  calcXpGain,
  computeSynergies,
  generateEnemyUnits,
  generateShop,
  getRankInfo,
  getRoundGold,
  simulateBattle,
  tryMergeUnit,
} from "@/constants/game";

function makeId() {
  return Date.now().toString() + Math.random().toString(36).slice(2, 9);
}

const STATS_KEY = "battleforge_stats";

async function loadStats(): Promise<PlayerStats> {
  try {
    const raw = await AsyncStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { ...DEFAULT_STATS };
}

async function saveStats(stats: PlayerStats) {
  try {
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {}
}

function BlobEye({ size, scared }: { size: number; scared?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: scared ? size * 1.2 : size,
        borderRadius: size / 2,
        backgroundColor: "white",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: scared ? size * 0.3 : size * 0.45,
          height: scared ? size * 0.3 : size * 0.45,
          borderRadius: size * 0.25,
          backgroundColor: "#2A1F14",
        }}
      />
    </View>
  );
}

function StarDots({ stars, size = 5 }: { stars: number; size?: number }) {
  if (stars <= 1) return null;
  return (
    <View style={{ flexDirection: "row", gap: 2, marginBottom: 1 }}>
      {Array.from({ length: stars }).map((_, i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: stars === 3 ? COLORS.gold : "#A08840",
          }}
        />
      ))}
    </View>
  );
}

function BlobCharacter({
  template,
  size = 48,
  isDead = false,
  stars = 1,
  scared = false,
}: {
  template: UnitTemplate;
  size?: number;
  isDead?: boolean;
  stars?: number;
  scared?: boolean;
}) {
  const c = isDead ? "#444" : template.color;
  const eyeSize = Math.round(size * 0.21);
  const eyeGap = Math.round(size * 0.12);
  const glowColor = stars >= 3 ? COLORS.gold + "66" : stars >= 2 ? "#A0884044" : "transparent";
  const showBadge = size >= 36 && !isDead;

  return (
    <View style={{ width: size, alignItems: "center" }}>
      <StarDots stars={stars} size={Math.max(4, size * 0.09)} />
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "flex-end" }}>
        <View
          style={{
            position: "absolute",
            bottom: -4,
            width: size * 0.7,
            height: size * 0.18,
            borderRadius: size * 0.12,
            backgroundColor: "rgba(0,0,0,0.3)",
          }}
        />
        <View
          style={{
            width: size,
            height: size * 0.92,
            borderRadius: size * 0.46,
            backgroundColor: c,
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: size * 0.06,
            borderWidth: stars >= 2 ? 2 : 0,
            borderColor: glowColor,
          }}
        >
          <View
            style={{
              position: "absolute",
              top: size * 0.1,
              right: size * 0.16,
              width: size * 0.14,
              height: size * 0.14,
              borderRadius: size * 0.07,
              backgroundColor: "rgba(255,255,255,0.45)",
            }}
          />
          <View style={{ flexDirection: "row", gap: eyeGap, marginBottom: size * 0.05 }}>
            <BlobEye size={eyeSize} scared={scared} />
            <BlobEye size={eyeSize} scared={scared} />
          </View>
          {scared ? (
            <View style={{ width: size * 0.18, height: size * 0.1, borderRadius: size * 0.09, borderWidth: 1.5, borderColor: "rgba(0,0,0,0.35)", backgroundColor: "transparent" }} />
          ) : (
            <View style={{ width: size * 0.28, height: size * 0.09, borderRadius: size * 0.05, backgroundColor: "rgba(0,0,0,0.2)" }} />
          )}
          <View style={{ position: "absolute", bottom: size * 0.18, left: size * 0.06, width: size * 0.15, height: size * 0.09, borderRadius: size * 0.05, backgroundColor: isDead ? "transparent" : template.color + "88", opacity: 0.6 }} />
          <View style={{ position: "absolute", bottom: size * 0.18, right: size * 0.06, width: size * 0.15, height: size * 0.09, borderRadius: size * 0.05, backgroundColor: isDead ? "transparent" : template.color + "88", opacity: 0.6 }} />
        </View>
        {showBadge && (
          <View style={{
            position: "absolute",
            top: -2,
            right: -3,
            width: size * 0.34,
            height: size * 0.34,
            borderRadius: size * 0.17,
            backgroundColor: template.color,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1.5,
            borderColor: "#1A1510",
          }}>
            <Ionicons name={template.icon as keyof typeof Ionicons.glyphMap} size={Math.round(size * 0.17)} color="#fff" />
          </View>
        )}
      </View>
    </View>
  );
}

interface FloatingDmgEntry {
  id: string;
  damage: number;
  isHeal?: boolean;
  isFlee?: boolean;
}

function FloatingDamage({ damage, isHeal, isFlee, onDone }: { damage: number; isHeal?: boolean; isFlee?: boolean; onDone: () => void }) {
  const y = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(y, { toValue: -40, duration: isFlee ? 1000 : 700, useNativeDriver: false }),
      Animated.sequence([
        Animated.delay(isFlee ? 500 : 300),
        Animated.timing(opacity, { toValue: 0, duration: isFlee ? 500 : 400, useNativeDriver: false }),
      ]),
    ]).start(onDone);
  }, []);

  const color = isFlee ? COLORS.gold : isHeal ? COLORS.green : COLORS.red;
  const label = isFlee ? "FLED!" : isHeal ? `+${damage}` : `-${damage}`;

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        alignItems: "center",
        transform: [{ translateY: y }],
        opacity,
        zIndex: 10,
      }}
    >
      <Text style={[styles.dmgNumber, { color, fontSize: isFlee ? 11 : 12 }]}>
        {label}
      </Text>
    </Animated.View>
  );
}

interface AttackInfoEntry {
  signal: number;
  targetId: string;
  targetX: number;
  targetY: number;
  isFlee?: boolean;
}

const ARENA_H = 280;
const BLOB_SZ = 38;

function computePositions(
  playerBoard: BoardUnit[],
  enemyBoard: BoardUnit[],
  arenaW: number
): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  const layout = (units: BoardUnit[], yPos: number) => {
    const count = units.length;
    if (count === 0) return;
    const unitW = BLOB_SZ + 18;
    const totalW = count * unitW;
    const startX = (arenaW - totalW) / 2 + unitW / 2 - BLOB_SZ / 2;
    units.forEach((u, i) => {
      pos[u.id] = { x: startX + i * unitW, y: yPos };
    });
  };
  layout(enemyBoard, 18);
  layout(playerBoard, ARENA_H - BLOB_SZ - 45);
  return pos;
}

function ArenaUnit({
  unit,
  homeX,
  homeY,
  currentHp,
  isDead,
  attackInfo,
  isPrepPhase,
  onPress,
}: {
  unit: BoardUnit;
  homeX: number;
  homeY: number;
  currentHp: number;
  isDead: boolean;
  attackInfo?: AttackInfoEntry;
  isPrepPhase: boolean;
  onPress?: () => void;
}) {
  const posX = useRef(new Animated.Value(homeX)).current;
  const posY = useRef(new Animated.Value(homeY)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const idleX = useRef(new Animated.Value(0)).current;
  const idleY = useRef(new Animated.Value(0)).current;
  const recoilX = useRef(new Animated.Value(0)).current;
  const recoilY = useRef(new Animated.Value(0)).current;
  const prevSignal = useRef(0);
  const prevDead = useRef(false);
  const prevHp = useRef(unit.template.maxHp);
  const [dmgPops, setDmgPops] = useState<FloatingDmgEntry[]>([]);
  const homeRef = useRef({ x: homeX, y: homeY });
  const animatingRef = useRef(false);
  const idleAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const walkDurationRef = useRef(460);
  const fledRef = useRef(false);

  useEffect(() => {
    homeRef.current = { x: homeX, y: homeY };
    if (!animatingRef.current) {
      posX.setValue(homeX);
      posY.setValue(homeY);
    }
  }, [homeX, homeY]);

  useEffect(() => {
    if (isPrepPhase || isDead) {
      idleX.setValue(0);
      idleY.setValue(0);
      if (idleAnimRef.current) idleAnimRef.current.stop();
      return;
    }
    const dur = 900 + Math.random() * 700;
    const rx = 3 + Math.random() * 4;
    const ry = 2 + Math.random() * 3;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(idleX, { toValue: rx, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(idleY, { toValue: -ry, duration: dur * 0.8, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(idleX, { toValue: -rx * 0.7, duration: dur * 1.1, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(idleY, { toValue: ry * 0.6, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(idleX, { toValue: 0, duration: dur * 0.7, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(idleY, { toValue: 0, duration: dur * 0.6, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ]),
      ])
    );
    idleAnimRef.current = anim;
    anim.start();
    return () => anim.stop();
  }, [isPrepPhase, isDead]);

  const walkBob = useRef(new Animated.Value(0)).current;

  const makeWalkSteps = (duration: number, steps: number) => {
    const stepDur = duration / (steps * 2);
    const bobSeq: Animated.CompositeAnimation[] = [];
    for (let i = 0; i < steps; i++) {
      bobSeq.push(
        Animated.timing(walkBob, { toValue: -4, duration: stepDur, easing: Easing.out(Easing.sin), useNativeDriver: false }),
        Animated.timing(walkBob, { toValue: 0, duration: stepDur, easing: Easing.in(Easing.sin), useNativeDriver: false }),
      );
    }
    return Animated.sequence(bobSeq);
  };

  useEffect(() => {
    if (!attackInfo || attackInfo.signal <= prevSignal.current) return;
    prevSignal.current = attackInfo.signal;

    const hx = homeRef.current.x;
    const hy = homeRef.current.y;

    if (idleAnimRef.current) {
      idleAnimRef.current.stop();
      idleX.setValue(0);
      idleY.setValue(0);
    }

    if (attackInfo.isFlee) {
      animatingRef.current = true;
      fledRef.current = true;
      setDmgPops((p) => [...p, { id: makeId(), damage: 0, isFlee: true }]);
      const fleeY = unit.isPlayer ? ARENA_H + 60 : -60;
      const fleeX = hx + (Math.random() > 0.5 ? 80 : -80);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(posX, { toValue: fleeX, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: false }),
          Animated.timing(posY, { toValue: fleeY, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: false }),
          Animated.timing(scale, { toValue: 0.3, duration: 700, useNativeDriver: false }),
          Animated.timing(opacity, { toValue: 0, duration: 700, useNativeDriver: false }),
          makeWalkSteps(700, 5),
        ]),
      ]).start(() => {
        animatingRef.current = false;
        walkBob.setValue(0);
      });
      return;
    }

    const dx = attackInfo.targetX - hx;
    const dy = attackInfo.targetY - hy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const stopRatio = dist > 0 ? Math.max(0, dist - 22) / dist : 0;
    const atkX = hx + dx * stopRatio;
    const atkY = hy + dy * stopRatio;
    const walkDuration = Math.min(700, Math.max(400, dist * 2.5));
    const walkSteps = Math.max(3, Math.round(walkDuration / 120));
    const returnDuration = walkDuration * 1.2;
    const returnSteps = Math.max(3, Math.round(returnDuration / 120));

    walkDurationRef.current = walkDuration;

    animatingRef.current = true;
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 100, easing: Easing.in(Easing.quad), useNativeDriver: false }),
      Animated.parallel([
        Animated.timing(posX, { toValue: atkX, duration: walkDuration, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(posY, { toValue: atkY, duration: walkDuration, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(scale, { toValue: 1.0, duration: walkDuration, useNativeDriver: false }),
        makeWalkSteps(walkDuration, walkSteps),
      ]),
      Animated.timing(scale, { toValue: 1.35, duration: 70, easing: Easing.out(Easing.back(3)), useNativeDriver: false }),
      Animated.delay(60),
      Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: false }),
      Animated.delay(80),
      Animated.parallel([
        Animated.timing(posX, { toValue: hx, duration: returnDuration, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(posY, { toValue: hy, duration: returnDuration, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        makeWalkSteps(returnDuration, returnSteps),
      ]),
    ]).start(() => {
      animatingRef.current = false;
      walkBob.setValue(0);
      if (!isDead && !isPrepPhase) {
        const dur = 900 + Math.random() * 700;
        const rx = 3 + Math.random() * 4;
        const ry = 2 + Math.random() * 3;
        const anim = Animated.loop(
          Animated.sequence([
            Animated.parallel([
              Animated.timing(idleX, { toValue: rx, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
              Animated.timing(idleY, { toValue: -ry, duration: dur * 0.8, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
            ]),
            Animated.parallel([
              Animated.timing(idleX, { toValue: -rx * 0.7, duration: dur * 1.1, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
              Animated.timing(idleY, { toValue: ry * 0.6, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
            ]),
            Animated.parallel([
              Animated.timing(idleX, { toValue: 0, duration: dur * 0.7, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
              Animated.timing(idleY, { toValue: 0, duration: dur * 0.6, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
            ]),
          ])
        );
        idleAnimRef.current = anim;
        anim.start();
      }
    });
  }, [attackInfo?.signal]);

  useEffect(() => {
    if (currentHp < prevHp.current && !isDead) {
      const dmg = prevHp.current - currentHp;
      setDmgPops((p) => [...p, { id: makeId(), damage: dmg }]);
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 80, useNativeDriver: false }),
        Animated.timing(flash, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start();
      const hpRatio = currentHp / unit.template.maxHp;
      const recoilMag = hpRatio < 0.3 ? 14 : hpRatio < 0.6 ? 8 : 4;
      const dirY = unit.isPlayer ? recoilMag : -recoilMag;
      const dirX = (Math.random() - 0.5) * recoilMag * 1.2;
      Animated.sequence([
        Animated.parallel([
          Animated.timing(recoilX, { toValue: dirX, duration: 80, useNativeDriver: false }),
          Animated.timing(recoilY, { toValue: dirY, duration: 80, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(recoilX, { toValue: 0, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(recoilY, { toValue: 0, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        ]),
      ]).start();
    } else if (currentHp > prevHp.current) {
      const heal = currentHp - prevHp.current;
      setDmgPops((p) => [...p, { id: makeId(), damage: heal, isHeal: true }]);
    }
    prevHp.current = currentHp;
  }, [currentHp]);

  useEffect(() => {
    if (isDead && !prevDead.current) {
      prevDead.current = true;
      if (idleAnimRef.current) idleAnimRef.current.stop();
      if (!fledRef.current) {
        Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: false }).start();
      }
    }
  }, [isDead]);

  const hpPct = Math.max(0, currentHp / unit.template.maxHp);
  const hpColor = hpPct > 0.5 ? COLORS.green : hpPct > 0.25 ? COLORS.gold : COLORS.red;

  const inner = (
    <>
      {dmgPops.map((pop) => (
        <FloatingDamage
          key={pop.id}
          damage={pop.damage}
          isHeal={pop.isHeal}
          isFlee={pop.isFlee}
          onDone={() => setDmgPops((p) => p.filter((d) => d.id !== pop.id))}
        />
      ))}
      <BlobCharacter template={unit.template} size={BLOB_SZ} isDead={isDead} stars={unit.stars} scared={hpPct > 0 && hpPct <= 0.25} />
      <View style={{ width: BLOB_SZ, height: 3, backgroundColor: COLORS.surfaceHigh, borderRadius: 2, marginTop: 2, overflow: "hidden" }}>
        <View style={{ height: 3, borderRadius: 2, width: `${hpPct * 100}%`, backgroundColor: hpColor }} />
      </View>
      <Text style={{ fontFamily: "Cinzel_700Bold", fontSize: 7, color: hpColor, textAlign: "center" }}>{Math.ceil(currentHp)}</Text>
    </>
  );

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: posX,
        top: posY,
        width: BLOB_SZ + 16,
        alignItems: "center",
        transform: [
          { translateX: idleX },
          { translateY: Animated.add(idleY, walkBob) },
          { translateX: recoilX },
          { translateY: recoilY },
          { scale },
        ],
        opacity,
        backgroundColor: flash.interpolate({
          inputRange: [0, 1],
          outputRange: ["transparent", COLORS.red + "55"],
        }),
        borderRadius: 10,
        padding: 2,
        zIndex: isDead ? 0 : 2,
      }}
    >
      {onPress && isPrepPhase ? (
        <Pressable onPress={onPress}>{inner}</Pressable>
      ) : (
        inner
      )}
    </Animated.View>
  );
}

function SynergyPanel({ synergies }: { synergies: ActiveSynergy[] }) {
  const visible = synergies.filter((s) => s.count > 0);
  if (visible.length === 0) return null;

  return (
    <View style={styles.synergyPanel}>
      <Text style={styles.synergyTitle}>BONDS</Text>
      <View style={styles.synergyRow}>
        {visible.map((s) => (
          <View
            key={s.def.class}
            style={[
              styles.synergyBadge,
              {
                borderColor: s.active ? s.def.color + "88" : COLORS.border,
                backgroundColor: s.active ? s.def.color + "18" : "transparent",
              },
            ]}
          >
            <Ionicons
              name={s.def.icon as keyof typeof Ionicons.glyphMap}
              size={12}
              color={s.active ? s.def.color : COLORS.textDim}
            />
            <Text style={[styles.synergyCount, { color: s.active ? s.def.color : COLORS.textDim }]}>
              {s.count}/{s.def.threshold}
            </Text>
            {s.active && (
              <Text style={[styles.synergyDesc, { color: s.def.color }]} numberOfLines={1}>
                {s.def.name}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function TopDownArena({
  playerBoard,
  enemyBoard,
  battleHp,
  deadIds,
  attackInfo,
  phase,
  onPlayerUnitPress,
}: {
  playerBoard: BoardUnit[];
  enemyBoard: BoardUnit[];
  battleHp: Record<string, number>;
  deadIds: string[];
  attackInfo: Record<string, AttackInfoEntry>;
  phase: GamePhase;
  onPlayerUnitPress?: (unit: BoardUnit) => void;
}) {
  const [arenaW, setArenaW] = useState(Dimensions.get("window").width - 28);
  const isPrepPhase = phase === "prep";

  const positions = useMemo(
    () => computePositions(playerBoard, enemyBoard, arenaW),
    [playerBoard, enemyBoard, arenaW]
  );

  const terrainDots = useMemo(() => {
    const dots: { x: number; y: number; s: number; o: number }[] = [];
    for (let i = 0; i < 18; i++) {
      dots.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        s: 2 + Math.random() * 3,
        o: 0.08 + Math.random() * 0.12,
      });
    }
    return dots;
  }, []);

  return (
    <View
      style={styles.topArena}
      onLayout={(e) => setArenaW(e.nativeEvent.layout.width)}
    >
      {terrainDots.map((d, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: d.s,
            height: d.s,
            borderRadius: d.s / 2,
            backgroundColor: i % 3 === 0 ? "#4A5C3A" : i % 3 === 1 ? "#5C4D3A" : "#3A4A3A",
            opacity: d.o,
            zIndex: 0,
          }}
        />
      ))}
      <Text style={styles.arenaLabelTop}>FOE</Text>
      <View style={styles.arenaCenterLine} />
      <Text style={styles.arenaLabelBottom}>HEARTH BAND</Text>

      {playerBoard.length === 0 && (
        <Text style={styles.arenaEmptyMsg}>Recruit folk from the tavern</Text>
      )}

      {[...enemyBoard, ...playerBoard].map((u) => {
        const p = positions[u.id];
        if (!p) return null;
        return (
          <ArenaUnit
            key={u.id}
            unit={u}
            homeX={p.x}
            homeY={p.y}
            currentHp={battleHp[u.id] ?? u.template.maxHp}
            isDead={deadIds.includes(u.id)}
            attackInfo={attackInfo[u.id]}
            isPrepPhase={isPrepPhase}
            onPress={
              u.isPlayer && onPlayerUnitPress
                ? () => onPlayerUnitPress(u)
                : undefined
            }
          />
        );
      })}
    </View>
  );
}

function HeroCard({
  template,
  cost,
  sold,
  canAfford,
  onPress,
}: {
  template: UnitTemplate;
  cost: number;
  sold?: boolean;
  canAfford: boolean;
  onPress: () => void;
}) {
  const c = template.color;
  const disabled = sold || !canAfford;

  return (
    <Pressable onPress={disabled ? undefined : onPress} disabled={disabled}>
      {({ pressed }) => (
        <View
          style={[
            styles.heroCard,
            {
              borderColor: sold ? COLORS.border : c + "66",
              opacity: sold ? 0.35 : !canAfford ? 0.55 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
        >
          <View style={[styles.costGem, { backgroundColor: canAfford && !sold ? COLORS.gold : COLORS.surfaceHigh }]}>
            <Text style={[styles.costTxt, { color: canAfford && !sold ? "#000" : COLORS.textDim }]}>{cost}</Text>
          </View>
          <View style={[styles.cardPortrait, { backgroundColor: c + "18" }]}>
            <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 20, backgroundColor: c + "10" }} />
            <BlobCharacter template={template} size={46} />
          </View>
          <View style={styles.cardNameBanner}>
            <Text style={[styles.cardName, { color: c }]} numberOfLines={1}>
              {template.name}
            </Text>
          </View>
          <Text style={styles.cardAbility} numberOfLines={1}>
            {template.ability}
          </Text>
          <View style={styles.cardStats}>
            <View style={styles.cardStat}>
              <Ionicons name="shield-outline" size={9} color={COLORS.red} />
              <Text style={[styles.cardStatNum, { color: COLORS.red }]}>{template.attack}</Text>
            </View>
            <Text style={styles.cardStatSep}>·</Text>
            <View style={styles.cardStat}>
              <Ionicons name="heart-outline" size={9} color={COLORS.green} />
              <Text style={[styles.cardStatNum, { color: COLORS.green }]}>{template.maxHp}</Text>
            </View>
          </View>
          {sold && (
            <View style={styles.soldBadge}>
              <Text style={styles.soldBadgeTxt}>HIRED</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

function MiniBlobRow({
  units,
  label,
  onPress,
  canAdd,
}: {
  units: BoardUnit[];
  label: string;
  onPress?: (u: BoardUnit) => void;
  canAdd?: boolean;
}) {
  return (
    <View style={styles.benchSection}>
      <Text style={styles.benchLabel}>{label}</Text>
      <View style={styles.benchRow}>
        {units.map((u) => (
          <Pressable
            key={u.id}
            onPress={onPress && canAdd ? () => onPress(u) : undefined}
            style={({ pressed }) => [
              styles.benchBlob,
              {
                borderColor: u.template.color + "55",
                transform: [{ scale: pressed ? 0.92 : 1 }],
              },
            ]}
          >
            <BlobCharacter template={u.template} size={32} stars={u.stars} />
            {canAdd && (
              <View style={styles.benchAddBadge}>
                <Ionicons name="add" size={8} color={COLORS.textPrimary} />
              </View>
            )}
          </Pressable>
        ))}
        {units.length === 0 && <Text style={styles.benchEmpty}>Resting</Text>}
      </View>
    </View>
  );
}

function GameHeader({ round, playerHp, gold }: { round: number; playerHp: number; gold: number }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerHp}>
        {Array.from({ length: STARTING_HP }).map((_, i) => (
          <Ionicons
            key={i}
            name={i < playerHp ? "heart" : "heart-outline"}
            size={13}
            color={i < playerHp ? COLORS.red : COLORS.border}
            style={{ marginRight: 1 }}
          />
        ))}
      </View>
      <Text style={styles.headerRound}>TRIAL {round}/{TOTAL_ROUNDS}</Text>
      <View style={styles.headerGold}>
        <Ionicons name="logo-usd" size={12} color={COLORS.gold} />
        <Text style={styles.headerGoldTxt}>{gold}</Text>
      </View>
    </View>
  );
}

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<GamePhase>("home");
  const [round, setRound] = useState(1);
  const [playerHp, setPlayerHp] = useState(STARTING_HP);
  const [gold, setGold] = useState(5);
  const [board, setBoard] = useState<BoardUnit[]>([]);
  const [bench, setBench] = useState<BoardUnit[]>([]);
  const [shop, setShop] = useState<ShopItem[]>([]);
  const [enemyBoard, setEnemyBoard] = useState<BoardUnit[]>([]);
  const [stats, setStats] = useState<PlayerStats>({ ...DEFAULT_STATS });

  const [battleHp, setBattleHp] = useState<Record<string, number>>({});
  const [deadIds, setDeadIds] = useState<string[]>([]);
  const [attackInfo, setAttackInfo] = useState<Record<string, AttackInfoEntry>>({});
  const [battleResult, setBattleResult] = useState<"win" | "lose" | "draw" | null>(null);
  const [goldEarned, setGoldEarned] = useState(0);
  const [hpChange, setHpChange] = useState(0);
  const [battleMsg, setBattleMsg] = useState("");
  const [mergeMsg, setMergeMsg] = useState("");

  const battleTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    loadStats().then(setStats);
  }, []);

  const synergies = useMemo(() => computeSynergies(board), [board]);
  const paladinSynActive = synergies.some((s) => s.def.class === "paladin" && s.active);

  const clearTimers = () => {
    battleTimers.current.forEach(clearTimeout);
    battleTimers.current = [];
  };

  const startGame = useCallback(() => {
    clearTimers();
    setRound(1);
    setPlayerHp(STARTING_HP);
    setGold(getRoundGold(1));
    setBoard([]);
    setBench([]);
    setShop(generateShop());
    setEnemyBoard(generateEnemyUnits(1));
    setBattleResult(null);
    setDeadIds([]);
    setAttackInfo({});
    setBattleHp({});
    setMergeMsg("");
    setPhase("prep");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const buyUnit = useCallback(
    (item: ShopItem) => {
      if (gold < item.template.cost) return;

      const cls = item.template.class;
      const hasMatch = [...board, ...bench].some((u) => u.template.class === cls && u.stars < 3);

      if (hasMatch) {
        const result = tryMergeUnit(cls, board, bench);
        if (result.merged) {
          setGold((g) => g - item.template.cost);
          setShop((s) => s.map((si) => (si.id === item.id ? { ...si, sold: true } : si)));
          setBoard(result.board);
          setBench(result.bench);
          setMergeMsg(`Merged into a stronger ${item.template.name}!`);
          setTimeout(() => setMergeMsg(""), 2500);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return;
        }
      }

      if (board.length >= MAX_BOARD_SIZE && bench.length >= MAX_BENCH_SIZE) return;

      const newUnit: BoardUnit = {
        id: `player_${makeId()}`,
        template: item.template,
        currentHp: item.template.maxHp,
        isPlayer: true,
        slot: 0,
        stars: 1,
      };

      setGold((g) => g - item.template.cost);
      setShop((s) => s.map((si) => (si.id === item.id ? { ...si, sold: true } : si)));
      if (board.length < MAX_BOARD_SIZE) {
        setBoard((b) => [...b, { ...newUnit, slot: b.length }]);
      } else {
        setBench((b) => [...b, { ...newUnit, slot: b.length }]);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [gold, board, bench]
  );

  const moveToBench = useCallback(
    (unit: BoardUnit) => {
      if (bench.length >= MAX_BENCH_SIZE) return;
      setBoard((b) => b.filter((u) => u.id !== unit.id));
      setBench((b) => [...b, { ...unit, slot: b.length }]);
      Haptics.selectionAsync();
    },
    [bench.length]
  );

  const moveToBoard = useCallback(
    (unit: BoardUnit) => {
      if (board.length >= MAX_BOARD_SIZE) return;
      setBench((b) => b.filter((u) => u.id !== unit.id));
      setBoard((b) => [...b, { ...unit, slot: b.length }]);
      Haptics.selectionAsync();
    },
    [board.length]
  );

  const startFight = useCallback(() => {
    if (board.length === 0) return;
    const enemy = enemyBoard;
    const activeSyn = computeSynergies(board);
    const events = simulateBattle(board, enemy, activeSyn);
    clearTimers();

    const initHp: Record<string, number> = {};
    [...board, ...enemy].forEach((u) => {
      initHp[u.id] = u.template.maxHp;
    });

    const arenaW = Dimensions.get("window").width - 28;
    const posMap = computePositions(board, enemy, arenaW);

    setBattleHp(initHp);
    setDeadIds([]);
    setAttackInfo({});
    setBattleResult(null);
    setPhase("battle");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const SPEED = 1.1;
    const deadTracker = new Set<string>();

    events.forEach((ev) => {
      const t = setTimeout(() => {
        if (ev.isFlee) {
          const fp = posMap[ev.attackerId] || { x: arenaW / 2, y: ARENA_H / 2 };
          setAttackInfo((prev) => ({
            ...prev,
            [ev.attackerId]: {
              signal: (prev[ev.attackerId]?.signal ?? 0) + 1,
              targetId: ev.targetId,
              targetX: fp.x,
              targetY: fp.y,
              isFlee: true,
            },
          }));
          const fleeTimer = setTimeout(() => {
            deadTracker.add(ev.targetId);
            setDeadIds((prev) => [...prev, ev.targetId]);
          }, 700);
          battleTimers.current.push(fleeTimer);
        } else if (!ev.isHeal) {
          const tp = posMap[ev.targetId] || { x: arenaW / 2, y: ARENA_H / 2 };
          setAttackInfo((prev) => ({
            ...prev,
            [ev.attackerId]: {
              signal: (prev[ev.attackerId]?.signal ?? 0) + 1,
              targetId: ev.targetId,
              targetX: tp.x,
              targetY: tp.y,
            },
          }));
        }
        const dmgDelay = ev.isHeal || ev.isFlee ? 0 : 520;
        const dmgTimer = setTimeout(() => {
          if (!ev.isFlee) {
            setBattleHp((prev) => ({ ...prev, [ev.targetId]: ev.targetHpAfter }));
          }
          if (ev.targetDied && !ev.isFlee) {
            deadTracker.add(ev.targetId);
            setDeadIds((prev) => [...prev, ev.targetId]);
          }
        }, dmgDelay);
        battleTimers.current.push(dmgTimer);
      }, ev.time * SPEED);
      battleTimers.current.push(t);
    });

    const lastTime = events.length > 0 ? events[events.length - 1].time : 0;
    const endT = setTimeout(() => {
      const playerAlive = board.some((u) => !deadTracker.has(u.id));
      const enemyAlive = enemy.some((u) => !deadTracker.has(u.id));
      let result: "win" | "lose" | "draw";
      let earned = 0;
      let hpDelta = 0;

      if (playerAlive && !enemyAlive) {
        result = "win";
        earned = 2;
        hpDelta = paladinSynActive ? 1 : 0;
        setBattleMsg(paladinSynActive ? "Victory! The hearthglow restores your spirit." : "The clearing falls silent. You prevail.");
      } else if (!playerAlive && enemyAlive) {
        result = "lose";
        earned = 1;
        hpDelta = -2;
        setBattleMsg("Your band retreats into the mist.");
      } else {
        result = "draw";
        earned = 1;
        hpDelta = -1;
        setBattleMsg("Neither side yields. The wind carries the stalemate.");
      }

      setBattleResult(result);
      setGoldEarned(earned);
      setHpChange(hpDelta);
      Haptics.notificationAsync(
        result === "win" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      );
      setTimeout(() => setPhase("results"), 600);
    }, lastTime * SPEED + 2200);
    battleTimers.current.push(endT);
  }, [board, enemyBoard, paladinSynActive]);

  const recordMatch = useCallback(
    (won: boolean, roundReached: number) => {
      const xpGained = calcXpGain(won, roundReached);
      const record: MatchRecord = {
        id: makeId(),
        date: new Date().toISOString(),
        result: won ? "win" : "lose",
        roundReached,
        xpGained,
      };
      const newStats: PlayerStats = {
        totalGames: stats.totalGames + 1,
        wins: stats.wins + (won ? 1 : 0),
        losses: stats.losses + (won ? 0 : 1),
        bestRound: Math.max(stats.bestRound, roundReached),
        xp: (stats.xp || 0) + xpGained,
        matchHistory: [record, ...stats.matchHistory].slice(0, 20),
      };
      setStats(newStats);
      saveStats(newStats);
    },
    [stats]
  );

  const nextRound = useCallback(() => {
    const newHp = Math.max(0, playerHp + hpChange);
    const newRound = round + 1;
    const bonusGold = goldEarned + getRoundGold(round);

    if (newHp <= 0) {
      setPlayerHp(0);
      recordMatch(false, round);
      setPhase("gameover");
      return;
    }
    if (newRound > TOTAL_ROUNDS) {
      setPlayerHp(newHp);
      recordMatch(true, TOTAL_ROUNDS);
      setPhase("victory");
      return;
    }

    setPlayerHp(newHp);
    setGold((g) => g + bonusGold);
    setRound(newRound);
    setBoard((b) => b.map((u) => ({ ...u, currentHp: u.template.maxHp })));
    setBench((b) => b.map((u) => ({ ...u, currentHp: u.template.maxHp })));
    setShop(generateShop());
    setEnemyBoard(generateEnemyUnits(newRound));
    setBattleResult(null);
    setDeadIds([]);
    setAttackInfo({});
    setMergeMsg("");
    setPhase("prep");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [playerHp, hpChange, round, goldEarned, recordMatch]);

  if (phase === "home") {
    return <HomeScreen onStart={startGame} stats={stats} insets={insets} />;
  }
  const goHome = useCallback(() => {
    clearTimers();
    setPhase("home");
  }, []);

  if (phase === "gameover" || phase === "victory") {
    return (
      <EndScreen
        won={phase === "victory"}
        round={round}
        stats={stats}
        onRestart={goHome}
        insets={insets}
      />
    );
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const isPrepPhase = phase === "prep";

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <GameHeader round={round} playerHp={playerHp} gold={gold} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <SynergyPanel synergies={synergies} />

        <TopDownArena
          playerBoard={board}
          enemyBoard={enemyBoard}
          battleHp={battleHp}
          deadIds={deadIds}
          attackInfo={attackInfo}
          phase={phase}
          onPlayerUnitPress={isPrepPhase ? moveToBench : undefined}
        />

        {mergeMsg.length > 0 && <MergeBanner msg={mergeMsg} />}

        {isPrepPhase && (
          <>
            {board.length > 0 && <Text style={styles.tapHint}>Tap a creature to send them to the campfire</Text>}
            <MiniBlobRow
              units={bench}
              label={`CAMPFIRE  ${bench.length}/${MAX_BENCH_SIZE}`}
              onPress={moveToBoard}
              canAdd={board.length < MAX_BOARD_SIZE}
            />
            <Text style={styles.sectionTitle}>TAVERN</Text>
            <View style={styles.shopRow}>
              {shop.map((item) => (
                <HeroCard
                  key={item.id}
                  template={item.template}
                  cost={item.template.cost}
                  sold={item.sold}
                  canAfford={gold >= item.template.cost}
                  onPress={() => buyUnit(item)}
                />
              ))}
            </View>
            <Pressable
              onPress={startFight}
              disabled={board.length === 0}
              style={({ pressed }) => [
                styles.fightBtn,
                { opacity: board.length === 0 ? 0.35 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              <Ionicons name="flash" size={20} color="#000" />
              <Text style={styles.fightBtnTxt}>{board.length === 0 ? "Gather your band" : "TO BATTLE!"}</Text>
            </Pressable>
          </>
        )}

        {phase === "battle" && <BattleStatusIndicator />}

        {phase === "results" && battleResult && (
          <ResultsPanel
            result={battleResult}
            goldEarned={goldEarned}
            hpChange={hpChange}
            msg={battleMsg}
            onNext={nextRound}
            round={round}
          />
        )}
      </ScrollView>
    </View>
  );
}

function MergeBanner({ msg }: { msg: string }) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scaleAnim.setValue(0.8);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 100, useNativeDriver: false }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
    ]).start();
  }, [msg]);

  return (
    <Animated.View style={[styles.mergeBanner, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <Ionicons name="arrow-up-circle" size={14} color={COLORS.gold} />
      <Text style={styles.mergeTxt}>{msg}</Text>
    </Animated.View>
  );
}

const BATTLE_MESSAGES = [
  "Blades clash in the clearing...",
  "Steel rings through the mist...",
  "The forest trembles with conflict...",
  "Spirits collide under moonlight...",
  "The hearth band stands firm...",
];

function BattleStatusIndicator() {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const [msgIdx] = useState(() => Math.floor(Math.random() * BATTLE_MESSAGES.length));

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={styles.battleStatus}>
      <Animated.View style={[styles.battlingDot, { opacity: pulseAnim, transform: [{ scale: pulseAnim.interpolate({ inputRange: [0.4, 1], outputRange: [0.8, 1.3] }) }] }]} />
      <Text style={styles.battlingTxt}>{BATTLE_MESSAGES[msgIdx]}</Text>
    </View>
  );
}

function ResultsPanel({
  result,
  goldEarned,
  hpChange,
  msg,
  onNext,
  round,
}: {
  result: "win" | "lose" | "draw";
  goldEarned: number;
  hpChange: number;
  msg: string;
  onNext: () => void;
  round: number;
}) {
  const color = result === "win" ? COLORS.green : result === "lose" ? COLORS.red : COLORS.gold;
  const bonusGold = goldEarned + getRoundGold(round);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: false }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.resultsPanel, { borderColor: color + "55", opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <Text style={[styles.resultLabel, { color }]}>
        {result === "win" ? "VICTORY" : result === "lose" ? "DEFEAT" : "DRAW"}
      </Text>
      <Text style={styles.resultMsg}>{msg}</Text>
      <View style={styles.resultStats}>
        <View style={styles.resultStat}>
          <Ionicons name="logo-usd" size={14} color={COLORS.gold} />
          <Text style={[styles.resultStatTxt, { color: COLORS.gold }]}>+{bonusGold} gold</Text>
        </View>
        {hpChange !== 0 && (
          <View style={styles.resultStat}>
            <Ionicons name={hpChange < 0 ? "heart-dislike" : "heart"} size={14} color={hpChange < 0 ? COLORS.red : COLORS.green} />
            <Text style={[styles.resultStatTxt, { color: hpChange < 0 ? COLORS.red : COLORS.green }]}>{hpChange > 0 ? "+" : ""}{hpChange} HP</Text>
          </View>
        )}
      </View>
      <Pressable
        onPress={onNext}
        style={({ pressed }) => [styles.nextBtn, { backgroundColor: color, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
      >
        <Text style={styles.nextBtnTxt}>{round >= TOTAL_ROUNDS ? "END TALE" : "ONWARD"}</Text>
        <Ionicons name="arrow-forward" size={15} color="#000" />
      </Pressable>
    </Animated.View>
  );
}

function RankBadge({ rank, size = "normal" }: { rank: RankInfo; size?: "normal" | "large" }) {
  const isLarge = size === "large";
  const iconSize = isLarge ? 28 : 18;
  const fontSize = isLarge ? 16 : 11;
  const levelSize = isLarge ? 10 : 8;
  return (
    <View style={[styles.rankBadge, isLarge && styles.rankBadgeLg, { borderColor: rank.color + "55" }]}>
      <Ionicons name={rank.icon as keyof typeof Ionicons.glyphMap} size={iconSize} color={rank.color} />
      <View>
        <Text style={[styles.rankName, { color: rank.color, fontSize }]}>{rank.name}</Text>
        <Text style={[styles.rankLevel, { fontSize: levelSize }]}>Level {rank.level}</Text>
      </View>
    </View>
  );
}

function XpProgressBar({ rank }: { rank: RankInfo }) {
  return (
    <View style={styles.xpBarContainer}>
      <View style={styles.xpBarTrack}>
        <View style={[styles.xpBarFill, { width: `${Math.max(2, rank.progress * 100)}%`, backgroundColor: rank.color }]} />
      </View>
      <Text style={styles.xpBarLabel}>{rank.xpInLevel} / {rank.xpPerLevel} XP</Text>
    </View>
  );
}

function HomeScreen({ onStart, stats, insets }: { onStart: () => void; stats: PlayerStats; insets: { top: number; bottom: number } }) {
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const winRate = stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 100) : 0;
  const rank = getRankInfo(stats.xp || 0);
  const fadeIn1 = useRef(new Animated.Value(0)).current;
  const fadeIn2 = useRef(new Animated.Value(0)).current;
  const fadeIn3 = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(fadeIn1, { toValue: 1, duration: 500, useNativeDriver: false }),
        Animated.timing(slideUp, { toValue: 0, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      ]),
      Animated.timing(fadeIn2, { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.timing(fadeIn3, { toValue: 1, duration: 400, useNativeDriver: false }),
    ]).start();
  }, []);

  return (
    <ScrollView
      contentContainerStyle={[styles.homeScroll, { paddingTop: topPad + 16, paddingBottom: bottomPad + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={{ opacity: fadeIn1, transform: [{ translateY: slideUp }], alignItems: "center" }}>
        <Text style={styles.homeTitle}>BATTLEFORGE</Text>
        <Text style={styles.homeTagline}>Tales of the Hearthlands</Text>
      </Animated.View>

      {stats.totalGames > 0 && (
        <View style={styles.rankSection}>
          <RankBadge rank={rank} size="large" />
          <XpProgressBar rank={rank} />
          <Text style={styles.totalXpTxt}>{rank.totalXp} total XP</Text>
        </View>
      )}

      <Animated.View style={{ opacity: fadeIn2 }}>
        <View style={styles.blobParade}>
          {UNIT_CLASSES.map((cls) => (
            <View key={cls} style={styles.blobParadeItem}>
              <BlobCharacter template={UNIT_TEMPLATES[cls]} size={44} />
              <Text style={[styles.blobParadeName, { color: UNIT_TEMPLATES[cls].color }]}>{UNIT_TEMPLATES[cls].name}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: fadeIn3, alignItems: "center", gap: 12 }}>
        <Text style={styles.homeDesc}>
          Gather folk at the tavern, forge bonds between kindred souls, and guide your hearth band through {TOTAL_ROUNDS} trials in the wildlands.
        </Text>

        <Pressable onPress={onStart} style={({ pressed }) => [styles.startBtn, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
          <Ionicons name="flash" size={20} color="#000" />
          <Text style={styles.startBtnTxt}>BEGIN JOURNEY</Text>
        </Pressable>
      </Animated.View>

      {stats.totalGames > 0 && (
        <View style={styles.statsSection}>
          <Text style={styles.statsTitle}>YOUR STATS</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.totalGames}</Text>
              <Text style={styles.statLabel}>Games</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: COLORS.green }]}>{stats.wins}</Text>
              <Text style={styles.statLabel}>Wins</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: COLORS.gold }]}>{winRate}%</Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: COLORS.gold }]}>{stats.bestRound}</Text>
              <Text style={styles.statLabel}>Best Round</Text>
            </View>
          </View>

          {stats.matchHistory.length > 0 && (
            <>
              <Text style={styles.historyTitle}>RECENT TALES</Text>
              {stats.matchHistory.slice(0, 5).map((m) => (
                <View key={m.id} style={styles.historyItem}>
                  <View style={[styles.historyDot, { backgroundColor: m.result === "win" ? COLORS.green : COLORS.red }]} />
                  <Text style={[styles.historyResult, { color: m.result === "win" ? COLORS.green : COLORS.red }]}>
                    {m.result === "win" ? "TRIUMPH" : "FALL"}
                  </Text>
                  <Text style={styles.historyRound}>Trial {m.roundReached}</Text>
                  <Text style={styles.historyXp}>+{m.xpGained || 0} XP</Text>
                  <Text style={styles.historyDate}>
                    {new Date(m.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function EndScreen({
  won,
  round,
  stats,
  onRestart,
  insets,
}: {
  won: boolean;
  round: number;
  stats: PlayerStats;
  onRestart: () => void;
  insets: { top: number; bottom: number };
}) {
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const color = won ? COLORS.gold : COLORS.red;
  const tmpl = { ...UNIT_TEMPLATES.warrior, color: won ? COLORS.gold : "#888" };
  const rank = getRankInfo(stats.xp || 0);
  const xpGained = calcXpGain(won, round);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const blobScale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: false }),
      Animated.spring(blobScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: false }),
    ]).start();
  }, []);

  return (
    <ScrollView
      contentContainerStyle={[styles.endScroll, { paddingTop: topPad + 16, paddingBottom: bottomPad + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={{ transform: [{ scale: blobScale }] }}>
        <BlobCharacter template={tmpl} size={80} isDead={!won} />
      </Animated.View>
      <Animated.View style={{ opacity: fadeIn, alignItems: "center", gap: 12 }}>
        <Text style={[styles.endTitle, { color }]}>{won ? "GLORY WON" : "FALLEN"}</Text>
        <Text style={styles.endSub}>{won ? `Your hearth band conquered all ${round} trials.` : `Your tale ends at trial ${round}.`}</Text>

        <View style={styles.xpGainBanner}>
          <Ionicons name="star" size={16} color={COLORS.gold} />
          <Text style={styles.xpGainTxt}>+{xpGained} XP</Text>
        </View>

        <View style={styles.rankSection}>
          <RankBadge rank={rank} size="large" />
          <XpProgressBar rank={rank} />
        </View>

        <View style={styles.endStats}>
          <View style={styles.bestBadge}>
            <Ionicons name="trophy" size={13} color={COLORS.gold} />
            <Text style={styles.bestBadgeTxt}>Best: Trial {stats.bestRound}</Text>
          </View>
          <View style={styles.bestBadge}>
            <Ionicons name="stats-chart" size={13} color={COLORS.textSecondary} />
            <Text style={styles.bestBadgeTxt}>{stats.wins}W / {stats.losses}L</Text>
          </View>
        </View>

        <Pressable
          onPress={onRestart}
          style={({ pressed }) => [styles.startBtn, { backgroundColor: color, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
        >
          <Ionicons name="refresh" size={18} color="#000" />
          <Text style={styles.startBtnTxt}>JOURNEY AGAIN</Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingTop: 10, gap: 10 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerHp: { flexDirection: "row", flex: 1 },
  headerRound: { fontFamily: "Cinzel_700Bold", fontSize: 12, color: COLORS.textPrimary, letterSpacing: 1.5 },
  headerGold: { flexDirection: "row", alignItems: "center", gap: 3, flex: 1, justifyContent: "flex-end" },
  headerGoldTxt: { fontFamily: "Cinzel_700Bold", fontSize: 15, color: COLORS.gold },

  synergyPanel: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 8, borderWidth: 1, borderColor: COLORS.border },
  synergyTitle: { fontFamily: "Cinzel_400Regular", fontSize: 9, color: COLORS.textDim, letterSpacing: 2, marginBottom: 5 },
  synergyRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  synergyBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  synergyCount: { fontFamily: "Cinzel_700Bold", fontSize: 10 },
  synergyDesc: { fontFamily: "Cinzel_400Regular", fontSize: 8, letterSpacing: 0.3 },

  topArena: {
    backgroundColor: "#1E1A12",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#4A3D2E",
    height: ARENA_H,
    overflow: "hidden",
    position: "relative" as const,
  },
  arenaCenterLine: {
    position: "absolute" as const,
    left: 16,
    right: 16,
    top: ARENA_H / 2,
    height: 1,
    backgroundColor: "#3A3024",
    borderStyle: "dashed" as const,
    borderTopWidth: 1,
    borderTopColor: "#5C4D3A",
  },
  arenaLabelTop: {
    position: "absolute" as const,
    top: 4,
    alignSelf: "center",
    left: 0,
    right: 0,
    textAlign: "center" as const,
    fontFamily: "Cinzel_400Regular",
    fontSize: 8,
    color: COLORS.textDim,
    letterSpacing: 2,
    zIndex: 0,
  },
  arenaLabelBottom: {
    position: "absolute" as const,
    bottom: 4,
    left: 0,
    right: 0,
    textAlign: "center" as const,
    fontFamily: "Cinzel_400Regular",
    fontSize: 8,
    color: COLORS.textDim,
    letterSpacing: 2,
    zIndex: 0,
  },
  arenaEmptyMsg: {
    position: "absolute" as const,
    bottom: ARENA_H / 2 - 30,
    left: 0,
    right: 0,
    textAlign: "center" as const,
    fontSize: 11,
    color: COLORS.textDim,
    fontFamily: "Cinzel_400Regular",
  },
  dmgNumber: { fontFamily: "Cinzel_700Bold", fontSize: 16 },

  heroCard: { flex: 1, borderRadius: 14, borderWidth: 1.5, backgroundColor: COLORS.surface, overflow: "hidden", alignItems: "center" },
  costGem: { position: "absolute", top: 6, left: 6, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", zIndex: 2, borderWidth: 1, borderColor: "rgba(0,0,0,0.2)" },
  costTxt: { fontFamily: "Cinzel_700Bold", fontSize: 11 },
  cardPortrait: { width: "100%", height: 76, alignItems: "center", justifyContent: "flex-end", paddingBottom: 4 },
  cardNameBanner: { paddingHorizontal: 6, paddingVertical: 3, width: "100%", alignItems: "center", backgroundColor: COLORS.surfaceHigh },
  cardName: { fontFamily: "Cinzel_700Bold", fontSize: 9, letterSpacing: 0.5 },
  cardAbility: { fontSize: 7, color: COLORS.textDim, textAlign: "center", paddingHorizontal: 4, marginTop: 2, fontStyle: "italic" },
  cardStats: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 8, width: "100%", justifyContent: "center" },
  cardStat: { flexDirection: "row", alignItems: "center", gap: 3 },
  cardStatNum: { fontFamily: "Cinzel_700Bold", fontSize: 10 },
  cardStatSep: { color: COLORS.textDim, fontSize: 10 },
  soldBadge: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20,16,10,0.7)", alignItems: "center", justifyContent: "center" },
  soldBadgeTxt: { fontFamily: "Cinzel_700Bold", fontSize: 10, color: COLORS.textDim, letterSpacing: 2 },

  benchSection: { gap: 6 },
  benchLabel: { fontFamily: "Cinzel_400Regular", fontSize: 10, color: COLORS.textSecondary, letterSpacing: 2 },
  benchRow: { flexDirection: "row", gap: 8 },
  benchBlob: { backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1, padding: 5, alignItems: "center", justifyContent: "center", position: "relative" as const },
  benchAddBadge: { position: "absolute" as const, top: -4, right: -4, width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.blue, alignItems: "center", justifyContent: "center" },
  benchEmpty: { fontSize: 11, color: COLORS.textDim },

  sectionTitle: { fontFamily: "Cinzel_400Regular", fontSize: 10, color: COLORS.gold, letterSpacing: 3, marginTop: 2 },
  shopRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  tapHint: { fontSize: 11, color: COLORS.textDim, fontFamily: "Cinzel_400Regular", textAlign: "center" },
  mergeBanner: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", paddingVertical: 5, backgroundColor: COLORS.gold + "15", borderRadius: 8, paddingHorizontal: 10 },
  mergeTxt: { fontFamily: "Cinzel_700Bold", fontSize: 11, color: COLORS.gold, letterSpacing: 0.5 },

  fightBtn: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 4, borderWidth: 1, borderColor: "#B8883A" },
  fightBtnTxt: { fontFamily: "Cinzel_700Bold", fontSize: 16, color: "#1A1510", letterSpacing: 3 },

  battleStatus: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingVertical: 8 },
  battlingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.orange },
  battlingTxt: { fontFamily: "Cinzel_400Regular", fontSize: 12, color: COLORS.textSecondary, letterSpacing: 1 },

  resultsPanel: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1.5, padding: 20, alignItems: "center", gap: 10 },
  resultLabel: { fontFamily: "Cinzel_700Bold", fontSize: 26, letterSpacing: 4 },
  resultMsg: { fontSize: 13, color: COLORS.textSecondary, textAlign: "center" },
  resultStats: { flexDirection: "row", gap: 20 },
  resultStat: { flexDirection: "row", alignItems: "center", gap: 5 },
  resultStatTxt: { fontFamily: "Cinzel_700Bold", fontSize: 14 },
  nextBtn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  nextBtnTxt: { fontFamily: "Cinzel_700Bold", fontSize: 13, color: "#1A1510", letterSpacing: 2 },

  homeScroll: { flexGrow: 1, backgroundColor: COLORS.bg, alignItems: "center", paddingHorizontal: 28, gap: 12 },
  homeTitle: { fontFamily: "Cinzel_700Bold", fontSize: 36, color: COLORS.gold, letterSpacing: 5 },
  homeTagline: { fontFamily: "Cinzel_400Regular", fontSize: 13, color: COLORS.textSecondary, letterSpacing: 4, marginTop: -8 },
  homeDesc: { fontSize: 13, color: COLORS.textDim, textAlign: "center", lineHeight: 22 },
  blobParade: { flexDirection: "row", gap: 10, flexWrap: "wrap", justifyContent: "center", marginVertical: 4 },
  blobParadeItem: { alignItems: "center", gap: 4 },
  blobParadeName: { fontFamily: "Cinzel_400Regular", fontSize: 9, letterSpacing: 0.5 },
  bestBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.border },
  bestBadgeTxt: { fontFamily: "Cinzel_400Regular", fontSize: 12, color: COLORS.gold },
  startBtn: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 36, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6, borderWidth: 1, borderColor: "#B8883A" },
  startBtnTxt: { fontFamily: "Cinzel_700Bold", fontSize: 16, color: "#1A1510", letterSpacing: 3 },

  statsSection: { width: "100%", backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 12, marginTop: 4 },
  statsTitle: { fontFamily: "Cinzel_700Bold", fontSize: 10, color: COLORS.textSecondary, letterSpacing: 3 },
  statsGrid: { flexDirection: "row", gap: 8 },
  statBox: { flex: 1, alignItems: "center", gap: 3, backgroundColor: COLORS.surfaceHigh, borderRadius: 10, paddingVertical: 10 },
  statValue: { fontFamily: "Cinzel_700Bold", fontSize: 18, color: COLORS.textPrimary },
  statLabel: { fontFamily: "Cinzel_400Regular", fontSize: 9, color: COLORS.textDim, letterSpacing: 1 },
  historyTitle: { fontFamily: "Cinzel_400Regular", fontSize: 9, color: COLORS.textDim, letterSpacing: 2 },
  historyItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  historyDot: { width: 7, height: 7, borderRadius: 4 },
  historyResult: { fontFamily: "Cinzel_700Bold", fontSize: 10, width: 34 },
  historyRound: { fontFamily: "Cinzel_400Regular", fontSize: 10, color: COLORS.textSecondary, flex: 1 },
  historyDate: { fontSize: 10, color: COLORS.textDim },

  rankSection: { width: "100%", alignItems: "center", gap: 8, paddingVertical: 4 },
  rankBadge: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, backgroundColor: COLORS.surface },
  rankBadgeLg: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 16 },
  rankName: { fontFamily: "Cinzel_700Bold", letterSpacing: 1 },
  rankLevel: { fontFamily: "Cinzel_400Regular", color: COLORS.textDim },
  xpBarContainer: { width: "100%", gap: 3 },
  xpBarTrack: { width: "100%", height: 8, backgroundColor: COLORS.surfaceHigh, borderRadius: 4, overflow: "hidden" },
  xpBarFill: { height: 8, borderRadius: 4 },
  xpBarLabel: { fontFamily: "Cinzel_400Regular", fontSize: 9, color: COLORS.textDim, textAlign: "center" },
  totalXpTxt: { fontFamily: "Cinzel_400Regular", fontSize: 10, color: COLORS.textDim },
  historyXp: { fontFamily: "Cinzel_700Bold", fontSize: 9, color: COLORS.gold, width: 45 },
  xpGainBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.gold + "18", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  xpGainTxt: { fontFamily: "Cinzel_700Bold", fontSize: 18, color: COLORS.gold, letterSpacing: 1 },
  endScroll: { flexGrow: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 12 },
  endTitle: { fontFamily: "Cinzel_700Bold", fontSize: 30, letterSpacing: 3, textAlign: "center" },
  endSub: { fontFamily: "Cinzel_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" },
  endStats: { flexDirection: "row", gap: 10, flexWrap: "wrap", justifyContent: "center" },
});
