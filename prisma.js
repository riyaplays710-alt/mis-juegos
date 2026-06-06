/* =====================================================================
   PRISMA: FLUXBORNE
   Un survivor único: tu poder nace del MOVIMIENTO (mecánica de Flujo),
   y el mundo late con ECLIPSES que invierten el riesgo y la recompensa.
   ===================================================================== */

'use strict';

// ===== CANVAS SETUP =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let VW = window.innerWidth;
let VH = window.innerHeight;

function resize() {
    VW = window.innerWidth;
    VH = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = VW * dpr;
    canvas.height = VH * dpr;
    canvas.style.width = VW + 'px';
    canvas.style.height = VH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ===== MATH HELPERS =====
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ===== INPUT =====
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'p') togglePause();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

// Soporte táctil básico (joystick virtual al tocar/arrastrar)
let touchActive = false, touchStart = { x: 0, y: 0 }, touchCur = { x: 0, y: 0 };
canvas.addEventListener('touchstart', e => {
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
    touchCur = { x: t.clientX, y: t.clientY };
    touchActive = true;
}, { passive: true });
canvas.addEventListener('touchmove', e => {
    const t = e.touches[0];
    touchCur = { x: t.clientX, y: t.clientY };
}, { passive: true });
canvas.addEventListener('touchend', () => { touchActive = false; }, { passive: true });

// ===== DOM REFERENCES =====
const el = {
    hud: document.getElementById('hud'),
    timer: document.getElementById('timer'),
    killCount: document.getElementById('killCount'),
    levelDisplay: document.getElementById('levelDisplay'),
    healthBar: document.getElementById('healthBar'),
    healthText: document.getElementById('healthText'),
    xpBar: document.getElementById('xpBar'),
    flowBar: document.getElementById('flowBar'),
    flowMult: document.getElementById('flowMult'),
    weaponSlots: document.getElementById('weaponSlots'),
    eclipseWarning: document.getElementById('eclipseWarning'),
    menuScreen: document.getElementById('menuScreen'),
    levelupScreen: document.getElementById('levelupScreen'),
    levelupLevel: document.getElementById('levelupLevel'),
    upgradeOptions: document.getElementById('upgradeOptions'),
    pauseScreen: document.getElementById('pauseScreen'),
    gameoverScreen: document.getElementById('gameoverScreen'),
    gameoverTitle: document.getElementById('gameoverTitle'),
    finalTime: document.getElementById('finalTime'),
    finalKills: document.getElementById('finalKills'),
    finalLevel: document.getElementById('finalLevel'),
};

// ===== GLOBAL GAME STATE =====
const G = {
    state: 'menu',            // menu | playing | levelup | paused | gameover
    time: 0,                  // segundos sobrevividos
    kills: 0,
    cam: { x: 0, y: 0 },
    shake: 0,
    spawnTimer: 0,
    spawnInterval: 1.2,
    // Eclipse
    eclipse: false,
    eclipseTimer: 0,
    nextEclipse: 35,          // primer eclipse a los 35s
    eclipseAlpha: 0,          // oscurecimiento visual
    // Boss
    bossTimer: 0,
    nextBoss: 120,            // primer jefe a los 2:00
    bossAlive: false,
    // estrellas de fondo (parallax)
    stars: [],
};

// Entidades
let enemies = [];
let projectiles = [];     // proyectiles del jugador
let enemyShots = [];      // proyectiles de jefes
let gems = [];
let particles = [];
let popups = [];          // números de daño / texto flotante
let pickups = [];         // objetos especiales (curación, imán)

// ===== PLAYER =====
const player = {
    x: 0, y: 0,
    vx: 0, vy: 0,
    r: 16,
    hp: 100, maxHp: 100,
    baseSpeed: 230,
    level: 1,
    xp: 0,
    xpToNext: 5,
    // Stats modificadas por mejoras
    stats: {
        damage: 1,          // multiplicador global de daño
        cooldown: 1,        // multiplicador de cadencia (menor = más rápido)
        area: 1,            // multiplicador de área/tamaño
        speedMul: 1,        // multiplicador de velocidad de movimiento
        magnet: 90,         // radio de recogida de XP
        regen: 0,           // vida por segundo
        projectiles: 0,     // proyectiles extra
        flowPower: 1,       // cuánto amplifica el flujo
        armor: 0,           // reduce daño recibido
    },
    // FLUJO (mecánica única)
    flow: 0, maxFlow: 100,
    // estado
    invuln: 0,
    facing: { x: 1, y: 0 },
    weapons: {},            // id -> nivel
    regenAcc: 0,
    trail: [],
};

// ===== DEFINICIÓN DE ARMAS =====
// Cada arma tiene: nombre, icono, descripción por nivel, función de disparo.
const WEAPONS = {
    prismBolt: {
        name: 'Saeta Prisma',
        icon: '✦',
        maxLevel: 8,
        desc: lvl => lvl === 0 ? 'Dispara una saeta de luz al enemigo más cercano.' : `Nivel ${lvl + 1}: +1 proyectil / más daño.`,
        cd: 0.7,
        fire(w) {
            const targets = nearestEnemies(player.x, player.y, 1 + Math.floor(w.level / 2) + player.stats.projectiles);
            const count = Math.max(1, targets.length);
            const dmg = (8 + w.level * 4) * dmgMul();
            for (let i = 0; i < Math.max(1, 1 + Math.floor(w.level / 2) + player.stats.projectiles); i++) {
                const t = targets[i % count];
                let ang;
                if (t) ang = Math.atan2(t.y - player.y, t.x - player.x);
                else ang = Math.atan2(player.facing.y, player.facing.x) + rand(-0.3, 0.3);
                ang += rand(-0.05, 0.05);
                spawnProjectile({
                    x: player.x, y: player.y, ang, speed: 560, dmg, r: 6 * player.stats.area,
                    life: 1.3, color: '#7df9ff', pierce: 1 + Math.floor(w.level / 3), kind: 'bolt'
                });
            }
        }
    },

    orbit: {
        name: 'Centinelas',
        icon: '◓',
        maxLevel: 6,
        desc: lvl => lvl === 0 ? 'Orbes de luz orbitan a tu alrededor dañando al contacto.' : `Nivel ${lvl + 1}: +1 orbe / más radio.`,
        cd: 999, // gestionado de forma continua, no por disparo
        continuous: true,
    },

    nova: {
        name: 'Nova',
        icon: '✸',
        maxLevel: 6,
        desc: lvl => lvl === 0 ? 'Libera una onda expansiva que daña en área.' : `Nivel ${lvl + 1}: más radio y daño.`,
        cd: 2.6,
        fire(w) {
            const radius = (90 + w.level * 28) * player.stats.area;
            const dmg = (14 + w.level * 7) * dmgMul();
            spawnNova(player.x, player.y, radius, dmg);
        }
    },

    arc: {
        name: 'Arco Voltaico',
        icon: '⚡',
        maxLevel: 6,
        desc: lvl => lvl === 0 ? 'Un rayo que salta entre enemigos cercanos.' : `Nivel ${lvl + 1}: +saltos / más daño.`,
        cd: 1.5,
        fire(w) {
            const jumps = 3 + w.level;
            const dmg = (10 + w.level * 5) * dmgMul();
            chainLightning(player.x, player.y, jumps, dmg, (120 + w.level * 12));
        }
    },

    mines: {
        name: 'Minas de Escarcha',
        icon: '❄',
        maxLevel: 6,
        desc: lvl => lvl === 0 ? 'Dejas minas que explotan y ralentizan enemigos.' : `Nivel ${lvl + 1}: más minas / radio.`,
        cd: 1.8,
        fire(w) {
            const n = 1 + Math.floor(w.level / 2);
            for (let i = 0; i < n; i++) {
                const ang = rand(0, TAU);
                const d = rand(20, 60);
                spawnMine(player.x + Math.cos(ang) * d, player.y + Math.sin(ang) * d, w.level);
            }
        }
    },

    beam: {
        name: 'Lanza Solar',
        icon: '☀',
        maxLevel: 6,
        desc: lvl => lvl === 0 ? 'Un haz giratorio de fuego solar barre el área.' : `Nivel ${lvl + 1}: más largo y potente.`,
        cd: 999,
        continuous: true,
    },
};

// ===== DEFINICIÓN DE MEJORAS PASIVAS =====
const PASSIVES = {
    amp:    { name: 'Amplificador', icon: '🔺', max: 6, desc: '+15% daño global.', apply: () => player.stats.damage += 0.15 },
    haste:  { name: 'Aceleración', icon: '⏩', max: 6, desc: '-10% tiempo de recarga.', apply: () => player.stats.cooldown *= 0.9 },
    boots:  { name: 'Botas Veloces', icon: '👟', max: 5, desc: '+12% velocidad de movimiento.', apply: () => player.stats.speedMul += 0.12 },
    vital:  { name: 'Núcleo Vital', icon: '❤', max: 6, desc: '+25 vida máxima y curación.', apply: () => { player.maxHp += 25; player.hp = Math.min(player.maxHp, player.hp + 25); } },
    regen:  { name: 'Regeneración', icon: '✚', max: 5, desc: '+1.5 vida por segundo.', apply: () => player.stats.regen += 1.5 },
    magnet: { name: 'Imán Prisma', icon: '🧲', max: 4, desc: '+50% radio de recogida.', apply: () => player.stats.magnet *= 1.5 },
    area:   { name: 'Resonancia', icon: '⬡', max: 5, desc: '+15% área de efecto.', apply: () => player.stats.area += 0.15 },
    armor:  { name: 'Coraza de Luz', icon: '🛡', max: 5, desc: '+2 armadura (reduce daño).', apply: () => player.stats.armor += 2 },
    // Pasiva ÚNICA ligada a la mecánica de Flujo
    flux:   { name: 'Condensador de Flujo', icon: '🌀', max: 5, desc: '+30% poder de Flujo y +20 Flujo máx.', apply: () => { player.stats.flowPower += 0.3; player.maxFlow += 20; } },
};

// ===== FLUJO: multiplicador de daño según movimiento =====
function flowRatio() { return player.flow / 100; }
function dmgMul() {
    // Daño = global * (1 + flujo*poder) * (eclipse ? 2 : 1)
    const flowBonus = 1 + flowRatio() * 0.9 * player.stats.flowPower;
    const eclipseBonus = G.eclipse ? 2 : 1;
    return player.stats.damage * flowBonus * eclipseBonus;
}
function cooldownMul() {
    // El flujo también acelera la cadencia (hasta -35%)
    const flowSpeed = 1 / (1 + flowRatio() * 0.55 * player.stats.flowPower);
    return player.stats.cooldown * flowSpeed;
}

// ===== HELPERS DE ENTIDADES =====
function nearestEnemy(x, y, maxD = Infinity) {
    let best = null, bestD = maxD * maxD;
    for (const e of enemies) {
        if (e.dead) continue;
        const d = dist2(x, y, e.x, e.y);
        if (d < bestD) { bestD = d; best = e; }
    }
    return best;
}
function nearestEnemies(x, y, n) {
    return enemies.filter(e => !e.dead)
        .map(e => ({ e, d: dist2(x, y, e.x, e.y) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, n)
        .map(o => o.e);
}

function spawnProjectile(o) {
    projectiles.push({
        x: o.x, y: o.y,
        vx: Math.cos(o.ang) * o.speed,
        vy: Math.sin(o.ang) * o.speed,
        dmg: o.dmg, r: o.r, life: o.life,
        color: o.color, pierce: o.pierce || 1,
        kind: o.kind || 'bolt', hits: new Set(),
    });
}

function spawnNova(x, y, radius, dmg) {
    particles.push({ kind: 'nova', x, y, r: 10, maxR: radius, life: 0.45, maxLife: 0.45, color: '#9b5de5' });
    for (const e of enemies) {
        if (e.dead) continue;
        if (dist(x, y, e.x, e.y) < radius + e.r) {
            damageEnemy(e, dmg, x, y, 240);
        }
    }
    burst(x, y, '#c77dff', 16);
    G.shake = Math.max(G.shake, 6);
}

function spawnMine(x, y, level) {
    particles.push({
        kind: 'mine', x, y, r: 8, life: 0.9, maxLife: 0.9,
        radius: (50 + level * 14) * player.stats.area,
        dmg: (12 + level * 6) * dmgMul(), color: '#7df9ff', armed: 0.25,
    });
}

function chainLightning(x, y, jumps, dmg, range) {
    let cx = x, cy = y;
    const hit = new Set();
    const points = [{ x, y }];
    for (let j = 0; j < jumps; j++) {
        let best = null, bestD = range * range;
        for (const e of enemies) {
            if (e.dead || hit.has(e)) continue;
            const d = dist2(cx, cy, e.x, e.y);
            if (d < bestD) { bestD = d; best = e; }
        }
        if (!best) break;
        hit.add(best);
        points.push({ x: best.x, y: best.y });
        damageEnemy(best, dmg, cx, cy, 120);
        cx = best.x; cy = best.y;
    }
    if (points.length > 1) {
        particles.push({ kind: 'lightning', points, life: 0.18, maxLife: 0.18, color: '#ffea00' });
    }
}

// ===== DAÑO A ENEMIGOS =====
function damageEnemy(e, dmg, fromX, fromY, knock = 0) {
    dmg = Math.round(dmg);
    e.hp -= dmg;
    e.flash = 0.1;
    if (knock > 0) {
        const a = Math.atan2(e.y - fromY, e.x - fromX);
        e.x += Math.cos(a) * knock * 0.02;
        e.y += Math.sin(a) * knock * 0.02;
    }
    popups.push({ x: e.x, y: e.y - e.r, text: dmg, life: 0.7, vy: -40, color: G.eclipse ? '#ffd166' : '#ffffff', size: 16 });
    if (e.hp <= 0 && !e.dead) killEnemy(e);
}

function killEnemy(e) {
    e.dead = true;
    G.kills++;
    burst(e.x, e.y, e.color, e.boss ? 40 : 10);
    if (e.boss) {
        G.shake = 18;
        G.bossAlive = false;
        // Lluvia de gemas al matar jefe
        for (let i = 0; i < 18; i++) {
            const a = rand(0, TAU), d = rand(10, 80);
            spawnGem(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 5);
        }
        spawnPickup(e.x, e.y, 'heal');
        popups.push({ x: e.x, y: e.y - 40, text: '¡JEFE DERROTADO!', life: 1.6, vy: -20, color: '#ffd166', size: 26 });
    } else {
        // Soltar XP (a veces objetos)
        const big = e.elite || Math.random() < 0.04;
        spawnGem(e.x, e.y, e.xp || (big ? 3 : 1));
        if (Math.random() < 0.012) spawnPickup(e.x, e.y, 'heal');
        if (Math.random() < 0.01) spawnPickup(e.x, e.y, 'magnet');
    }
}

// ===== GEMAS DE XP =====
function spawnGem(x, y, value) {
    gems.push({ x, y, value, r: 5 + Math.min(6, value), vx: rand(-40, 40), vy: rand(-40, 40), pulled: false });
}

// ===== OBJETOS ESPECIALES =====
function spawnPickup(x, y, type) {
    pickups.push({ x, y, type, r: 12, life: 18, bob: rand(0, TAU) });
}

// ===== PARTÍCULAS =====
function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
        const a = rand(0, TAU), s = rand(40, 220);
        particles.push({
            kind: 'spark', x, y,
            vx: Math.cos(a) * s, vy: Math.sin(a) * s,
            r: rand(1.5, 4), life: rand(0.3, 0.7), maxLife: 0.7, color,
        });
    }
}

// ===== ENEMIGOS =====
const ENEMY_TYPES = {
    drifter: { hp: 14, speed: 60, r: 14, color: '#8a8fb5', dmg: 8, xp: 1 },
    swarmer: { hp: 7,  speed: 115, r: 9, color: '#5de5b8', dmg: 6, xp: 1 },
    brute:   { hp: 70, speed: 42, r: 26, color: '#ff8c42', dmg: 18, xp: 3 },
    wraith:  { hp: 26, speed: 90, r: 15, color: '#c77dff', dmg: 12, xp: 2, erratic: true },
    splitter:{ hp: 30, speed: 55, r: 18, color: '#5dd0e5', dmg: 10, xp: 2, splits: true },
};

function spawnEnemy(typeKey, elite = false) {
    const base = ENEMY_TYPES[typeKey];
    // Escalado por tiempo
    const t = G.time;
    const hpScale = 1 + t / 55;
    const ang = rand(0, TAU);
    const spawnDist = Math.max(VW, VH) * 0.62 + 40;
    const ex = player.x + Math.cos(ang) * spawnDist;
    const ey = player.y + Math.sin(ang) * spawnDist;
    const e = {
        type: typeKey,
        x: ex, y: ey,
        hp: base.hp * hpScale * (elite ? 4 : 1),
        maxHp: base.hp * hpScale * (elite ? 4 : 1),
        speed: base.speed * (elite ? 0.85 : 1),
        r: base.r * (elite ? 1.5 : 1),
        color: elite ? '#b388ff' : base.color,
        dmg: base.dmg * (elite ? 1.6 : 1),
        xp: base.xp * (elite ? 4 : 1),
        erratic: base.erratic, splits: base.splits,
        elite, flash: 0, slow: 0, dead: false,
        wob: rand(0, TAU),
    };
    enemies.push(e);
    return e;
}

function spawnBoss() {
    const t = G.time;
    const ang = rand(0, TAU);
    const spawnDist = Math.max(VW, VH) * 0.6;
    const e = {
        type: 'boss', boss: true,
        x: player.x + Math.cos(ang) * spawnDist,
        y: player.y + Math.sin(ang) * spawnDist,
        hp: 1400 + t * 12, maxHp: 1400 + t * 12,
        speed: 55, r: 52, color: '#ff4d6d',
        dmg: 26, xp: 0, dead: false, flash: 0, slow: 0,
        shootTimer: 0, wob: 0,
    };
    enemies.push(e);
    G.bossAlive = true;
    popups.push({ x: player.x, y: player.y - 120, text: '⚠ EL DEVORADOR DESPIERTA ⚠', life: 2.5, vy: -10, color: '#ff4d6d', size: 28 });
    G.shake = 14;
}

function splitEnemy(e) {
    for (let i = 0; i < 2; i++) {
        const child = spawnEnemy('swarmer', false);
        child.x = e.x + rand(-12, 12);
        child.y = e.y + rand(-12, 12);
        child.hp = child.maxHp = e.maxHp * 0.35;
        child.color = '#5dd0e5';
    }
}

// ===== SPAWNING / DIRECTOR =====
function updateSpawning(dt) {
    // Dificultad: el intervalo baja con el tiempo
    G.spawnInterval = clamp(1.3 - G.time / 140, 0.18, 1.3);
    G.spawnTimer -= dt;
    if (G.spawnTimer <= 0) {
        G.spawnTimer = G.spawnInterval;
        const batch = 1 + Math.floor(G.time / 30) + (G.eclipse ? 2 : 0);
        for (let i = 0; i < batch; i++) {
            const r = Math.random();
            let type;
            if (G.time < 30) type = r < 0.7 ? 'drifter' : 'swarmer';
            else if (G.time < 75) type = r < 0.45 ? 'drifter' : r < 0.8 ? 'swarmer' : 'wraith';
            else if (G.time < 130) type = r < 0.3 ? 'swarmer' : r < 0.55 ? 'wraith' : r < 0.8 ? 'splitter' : 'brute';
            else type = r < 0.3 ? 'wraith' : r < 0.55 ? 'splitter' : r < 0.8 ? 'brute' : 'swarmer';
            // Durante eclipse, probabilidad de élite
            const elite = G.eclipse && Math.random() < 0.25;
            spawnEnemy(type, elite);
        }
    }

    // Límite de población para rendimiento
    if (enemies.length > 320) {
        enemies.sort((a, b) => dist2(player.x, player.y, b.x, b.y) - dist2(player.x, player.y, a.x, a.y));
        enemies.splice(0, enemies.length - 320);
    }
}

// ===== ECLIPSE (mecánica única) =====
function updateEclipse(dt) {
    if (!G.eclipse) {
        G.nextEclipse -= dt;
        if (G.nextEclipse <= 0) {
            G.eclipse = true;
            G.eclipseTimer = 13;          // dura 13s
            el.eclipseWarning.classList.remove('hidden');
            G.shake = 10;
            // estallido de enemigos al inicio
            for (let i = 0; i < 8; i++) spawnEnemy(pick(['wraith', 'swarmer', 'splitter']), Math.random() < 0.4);
        }
    } else {
        G.eclipseTimer -= dt;
        G.eclipseAlpha = lerp(G.eclipseAlpha, 0.55, dt * 3);
        if (G.eclipseTimer <= 0) {
            G.eclipse = false;
            G.nextEclipse = rand(40, 55);  // siguiente eclipse
            el.eclipseWarning.classList.add('hidden');
        }
    }
    if (!G.eclipse) G.eclipseAlpha = lerp(G.eclipseAlpha, 0, dt * 3);
}

// ===== ARMAS CONTINUAS (orbit, beam) =====
let orbitAngle = 0;
let beamAngle = 0;
function updateContinuousWeapons(dt) {
    // Centinelas orbitales
    if (player.weapons.orbit !== undefined) {
        const lvl = player.weapons.orbit;
        const count = 2 + lvl;
        const radius = (70 + lvl * 8) * player.stats.area;
        orbitAngle += dt * (2.2 + flowRatio() * 1.5); // el flujo acelera la órbita
        const dmg = (6 + lvl * 3) * dmgMul() * dt * 6; // daño por contacto continuo
        for (let i = 0; i < count; i++) {
            const a = orbitAngle + (TAU / count) * i;
            const ox = player.x + Math.cos(a) * radius;
            const oy = player.y + Math.sin(a) * radius;
            for (const e of enemies) {
                if (e.dead) continue;
                if (dist2(ox, oy, e.x, e.y) < (e.r + 12) * (e.r + 12)) {
                    if (!e._orbCd || e._orbCd <= 0) {
                        damageEnemy(e, dmg * 6, ox, oy, 60);
                        e._orbCd = 0.18;
                    }
                }
            }
        }
    }
    // Lanza Solar (haz giratorio)
    if (player.weapons.beam !== undefined) {
        const lvl = player.weapons.beam;
        beamAngle += dt * 1.1;
        const len = (160 + lvl * 40) * player.stats.area;
        const dmg = (5 + lvl * 3) * dmgMul();
        const bx = Math.cos(beamAngle), by = Math.sin(beamAngle);
        for (const e of enemies) {
            if (e.dead) continue;
            // proyección sobre el haz
            const rx = e.x - player.x, ry = e.y - player.y;
            const proj = rx * bx + ry * by;
            if (proj > 0 && proj < len) {
                const perp = Math.abs(rx * (-by) + ry * bx);
                if (perp < 16 + e.r) {
                    if (!e._beamCd || e._beamCd <= 0) {
                        damageEnemy(e, dmg, player.x, player.y, 0);
                        e._beamCd = 0.12;
                    }
                }
            }
        }
        player._beam = { angle: beamAngle, len };
    }
    // reducir cooldowns internos
    for (const e of enemies) {
        if (e._orbCd) e._orbCd -= dt;
        if (e._beamCd) e._beamCd -= dt;
    }
}

// ===== ACTUALIZAR ARMAS POR DISPARO =====
function updateWeapons(dt) {
    for (const id in player.weapons) {
        const def = WEAPONS[id];
        if (!def || def.continuous) continue;
        if (!player._wcd) player._wcd = {};
        if (player._wcd[id] === undefined) player._wcd[id] = 0;
        player._wcd[id] -= dt;
        if (player._wcd[id] <= 0) {
            const w = { level: player.weapons[id] };
            def.fire(w);
            player._wcd[id] = def.cd * cooldownMul();
        }
    }
    updateContinuousWeapons(dt);
}

// ===== SISTEMA DE NIVEL Y MEJORAS =====
function gainXP(v) {
    player.xp += v;
    while (player.xp >= player.xpToNext) {
        player.xp -= player.xpToNext;
        player.level++;
        player.xpToNext = Math.floor(5 + player.level * 3.5 + Math.pow(player.level, 1.4));
        openLevelUp();
    }
}

function buildUpgradePool() {
    const pool = [];
    // Armas que ya tienes (subir nivel)
    for (const id in player.weapons) {
        const def = WEAPONS[id];
        const lvl = player.weapons[id];
        if (lvl < def.maxLevel - 1) {
            pool.push({ kind: 'weapon-up', id, name: def.name, icon: def.icon, tag: 'level', tagText: `Nv ${lvl + 2}`, desc: def.desc(lvl + 1) });
        }
    }
    // Armas nuevas (si tienes menos de 6)
    const weaponCount = Object.keys(player.weapons).length;
    if (weaponCount < 6) {
        for (const id in WEAPONS) {
            if (player.weapons[id] === undefined) {
                const def = WEAPONS[id];
                pool.push({ kind: 'weapon-new', id, name: def.name, icon: def.icon, tag: 'weapon', tagText: 'Arma nueva', desc: def.desc(0) });
            }
        }
    }
    // Pasivas
    for (const id in PASSIVES) {
        const p = PASSIVES[id];
        const lvl = player._passives[id] || 0;
        if (lvl < p.max) {
            pool.push({ kind: 'passive', id, name: p.name, icon: p.icon, tag: 'passive', tagText: lvl > 0 ? `Nv ${lvl + 1}` : 'Pasiva', desc: p.desc });
        }
    }
    return pool;
}

function openLevelUp() {
    G.state = 'levelup';
    el.levelupLevel.textContent = player.level;
    const pool = buildUpgradePool();
    // Elegir 3 opciones únicas
    const options = [];
    const copy = pool.slice();
    while (options.length < 3 && copy.length) {
        const i = randInt(0, copy.length - 1);
        options.push(copy.splice(i, 1)[0]);
    }
    // Si no hay nada (todo maximizado), ofrecer curación
    if (options.length === 0) {
        options.push({ kind: 'heal', name: 'Esencia de Luz', icon: '💧', tag: 'passive', tagText: 'Bonus', desc: 'Recupera toda tu vida.' });
    }
    el.upgradeOptions.innerHTML = '';
    for (const opt of options) {
        const card = document.createElement('div');
        card.className = 'upgrade-card' + (opt.kind === 'weapon-new' ? ' new-weapon' : '');
        card.innerHTML = `
            <div class="upgrade-icon">${opt.icon}</div>
            <span class="upgrade-tag ${opt.tag}">${opt.tagText}</span>
            <div class="upgrade-name">${opt.name}</div>
            <div class="upgrade-desc">${opt.desc}</div>
        `;
        card.addEventListener('click', () => applyUpgrade(opt));
        el.upgradeOptions.appendChild(card);
    }
    el.levelupScreen.classList.remove('hidden');
}

function applyUpgrade(opt) {
    switch (opt.kind) {
        case 'weapon-new':
            player.weapons[opt.id] = 0;
            break;
        case 'weapon-up':
            player.weapons[opt.id]++;
            break;
        case 'passive':
            player._passives[opt.id] = (player._passives[opt.id] || 0) + 1;
            PASSIVES[opt.id].apply();
            break;
        case 'heal':
            player.hp = player.maxHp;
            break;
    }
    el.levelupScreen.classList.add('hidden');
    G.state = 'playing';
    renderWeaponSlots();
    lastTime = performance.now(); // evitar salto de dt tras la pausa
}

function renderWeaponSlots() {
    el.weaponSlots.innerHTML = '';
    for (const id in player.weapons) {
        const def = WEAPONS[id];
        const slot = document.createElement('div');
        slot.className = 'weapon-slot';
        slot.innerHTML = `
            <span class="w-icon">${def.icon}</span>
            <span class="w-info">
                <span class="w-name">${def.name}</span>
                <span class="w-level">Nv ${player.weapons[id] + 1}</span>
            </span>`;
        el.weaponSlots.appendChild(slot);
    }
}

// ===== UPDATE: JUGADOR =====
function updatePlayer(dt) {
    // Input direccional
    let ix = 0, iy = 0;
    if (keys['w'] || keys['arrowup']) iy -= 1;
    if (keys['s'] || keys['arrowdown']) iy += 1;
    if (keys['a'] || keys['arrowleft']) ix -= 1;
    if (keys['d'] || keys['arrowright']) ix += 1;
    // Táctil
    if (touchActive) {
        const tx = touchCur.x - touchStart.x, ty = touchCur.y - touchStart.y;
        const tl = Math.hypot(tx, ty);
        if (tl > 12) { ix = tx / tl; iy = ty / tl; }
    }
    const il = Math.hypot(ix, iy);
    const moving = il > 0.01;
    if (moving) {
        ix /= il; iy /= il;
        player.facing.x = ix; player.facing.y = iy;
    }

    const speed = player.baseSpeed * player.stats.speedMul;
    player.vx = lerp(player.vx, ix * speed, 0.25);
    player.vy = lerp(player.vy, iy * speed, 0.25);
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // ===== FLUJO =====
    const realSpeed = Math.hypot(player.vx, player.vy);
    if (realSpeed > speed * 0.35) {
        player.flow = clamp(player.flow + 38 * dt, 0, player.maxFlow > 100 ? 100 : 100);
        // permitir rebasar a 100 visual si maxFlow>100? Mantener en 0-100 para el ratio
    } else {
        player.flow = clamp(player.flow - 30 * dt, 0, 100);
    }

    // Trail visual según flujo
    if (moving && player.flow > 20) {
        player.trail.push({ x: player.x, y: player.y, life: 0.35 });
        if (player.trail.length > 24) player.trail.shift();
    }
    for (const t of player.trail) t.life -= dt;
    player.trail = player.trail.filter(t => t.life > 0);

    // Regeneración
    if (player.stats.regen > 0 && player.hp < player.maxHp) {
        player.regenAcc += player.stats.regen * dt;
        if (player.regenAcc >= 1) {
            const amt = Math.floor(player.regenAcc);
            player.hp = Math.min(player.maxHp, player.hp + amt);
            player.regenAcc -= amt;
        }
    }

    if (player.invuln > 0) player.invuln -= dt;
}

// ===== UPDATE: ENEMIGOS =====
function updateEnemies(dt) {
    for (const e of enemies) {
        if (e.dead) continue;
        if (e.flash > 0) e.flash -= dt;
        let sp = e.speed;
        if (e.slow > 0) { e.slow -= dt; sp *= 0.45; }

        let dx = player.x - e.x, dy = player.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        dx /= d; dy /= d;

        if (e.erratic) {
            e.wob += dt * 4;
            const wob = Math.sin(e.wob) * 0.6;
            const px = -dy, py = dx;
            dx += px * wob; dy += py * wob;
            const l = Math.hypot(dx, dy);
            dx /= l; dy /= l;
        }

        e.x += dx * sp * dt;
        e.y += dy * sp * dt;

        // Jefe dispara proyectiles
        if (e.boss) {
            e.shootTimer -= dt;
            if (e.shootTimer <= 0) {
                e.shootTimer = 2.2;
                const n = 10;
                for (let i = 0; i < n; i++) {
                    const a = (TAU / n) * i + rand(-0.1, 0.1);
                    enemyShots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, r: 8, life: 4, dmg: 16 });
                }
                G.shake = Math.max(G.shake, 5);
            }
        }

        // Colisión con el jugador
        const rr = (e.r + player.r);
        if (dist2(e.x, e.y, player.x, player.y) < rr * rr) {
            hurtPlayer(e.dmg * dt * 2.2); // daño por contacto continuo
        }
    }

    // Separación simple entre enemigos (evita amontonamiento total)
    // (muestreo ligero por rendimiento)
    for (let i = 0; i < enemies.length; i += 2) {
        const a = enemies[i];
        if (a.dead) continue;
        for (let j = i + 1; j < Math.min(i + 6, enemies.length); j++) {
            const b = enemies[j];
            if (b.dead) continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const dd = dx * dx + dy * dy;
            const min = (a.r + b.r) * 0.8;
            if (dd < min * min && dd > 0.01) {
                const dl = Math.sqrt(dd);
                const push = (min - dl) * 0.5;
                const nx = dx / dl, ny = dy / dl;
                a.x -= nx * push; a.y -= ny * push;
                b.x += nx * push; b.y += ny * push;
            }
        }
    }

    // Limpiar muertos + manejar splitters
    for (const e of enemies) {
        if (e.dead && e.splits && !e._didSplit) {
            e._didSplit = true;
            splitEnemy(e);
        }
    }
    enemies = enemies.filter(e => !e.dead);
}

function hurtPlayer(amount) {
    if (player.invuln > 0) return;
    const reduced = Math.max(1, amount - player.stats.armor * 0.15);
    player.hp -= reduced;
    // Recibir daño rompe el FLUJO
    player.flow *= 0.4;
    if (amount > 3) {
        player.invuln = 0.0; // contacto continuo no da i-frames; los golpes fuertes sí
    }
    if (player.hp <= 0) {
        player.hp = 0;
        gameOver(false);
    }
}

function hurtPlayerHit(amount) {
    if (player.invuln > 0) return;
    const reduced = Math.max(1, amount - player.stats.armor * 0.4);
    player.hp -= reduced;
    player.flow *= 0.3;
    player.invuln = 0.6;
    G.shake = Math.max(G.shake, 8);
    burst(player.x, player.y, '#ff4d6d', 12);
    if (player.hp <= 0) { player.hp = 0; gameOver(false); }
}

// ===== UPDATE: PROYECTILES =====
function updateProjectiles(dt) {
    for (const p of projectiles) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.life -= dt;
        for (const e of enemies) {
            if (e.dead || p.hits.has(e)) continue;
            const rr = e.r + p.r;
            if (dist2(p.x, p.y, e.x, e.y) < rr * rr) {
                damageEnemy(e, p.dmg, p.x, p.y, 100);
                p.hits.add(e);
                p.pierce--;
                if (p.pierce <= 0) { p.life = 0; break; }
            }
        }
    }
    projectiles = projectiles.filter(p => p.life > 0);

    // Proyectiles enemigos
    for (const s of enemyShots) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        const rr = s.r + player.r;
        if (dist2(s.x, s.y, player.x, player.y) < rr * rr) {
            hurtPlayerHit(s.dmg);
            s.life = 0;
        }
    }
    enemyShots = enemyShots.filter(s => s.life > 0);
}

// ===== UPDATE: GEMAS / OBJETOS =====
function updateGems(dt) {
    const mag = player.stats.magnet;
    for (const g of gems) {
        const d = dist(g.x, g.y, player.x, player.y);
        if (d < mag || g.pulled) {
            g.pulled = true;
            const a = Math.atan2(player.y - g.y, player.x - g.x);
            const pullSpeed = 320 + (mag - d);
            g.x += Math.cos(a) * pullSpeed * dt;
            g.y += Math.sin(a) * pullSpeed * dt;
        } else {
            g.x += g.vx * dt; g.y += g.vy * dt;
            g.vx *= 0.9; g.vy *= 0.9;
        }
        if (d < player.r + g.r) {
            gainXP(g.value);
            g.collected = true;
            particles.push({ kind: 'spark', x: g.x, y: g.y, vx: 0, vy: -30, r: 3, life: 0.3, maxLife: 0.3, color: '#9b5de5' });
        }
    }
    gems = gems.filter(g => !g.collected);

    // Objetos especiales
    for (const p of pickups) {
        p.life -= dt; p.bob += dt * 3;
        if (dist(p.x, p.y, player.x, player.y) < player.r + p.r) {
            if (p.type === 'heal') {
                player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.3);
                popups.push({ x: p.x, y: p.y - 10, text: '+VIDA', life: 1, vy: -40, color: '#ff4d6d', size: 18 });
            } else if (p.type === 'magnet') {
                for (const g of gems) g.pulled = true;
                popups.push({ x: p.x, y: p.y - 10, text: '¡IMÁN!', life: 1, vy: -40, color: '#7df9ff', size: 18 });
            }
            p.collected = true;
        }
    }
    pickups = pickups.filter(p => !p.collected && p.life > 0);
}

// ===== UPDATE: PARTÍCULAS =====
function updateParticles(dt) {
    for (const p of particles) {
        if (p.kind === 'spark') {
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.vx *= 0.92; p.vy *= 0.92;
            p.life -= dt;
        } else if (p.kind === 'nova') {
            p.r = lerp(p.r, p.maxR, dt * 8);
            p.life -= dt;
        } else if (p.kind === 'mine') {
            p.armed -= dt;
            p.life -= dt;
            if (p.armed <= 0 && !p.exploded) {
                // detona cuando hay un enemigo cerca o al expirar
                let trigger = p.life < 0.2;
                for (const e of enemies) {
                    if (!e.dead && dist2(p.x, p.y, e.x, e.y) < p.radius * p.radius) { trigger = true; break; }
                }
                if (trigger) {
                    p.exploded = true; p.life = 0;
                    for (const e of enemies) {
                        if (e.dead) continue;
                        if (dist(p.x, p.y, e.x, e.y) < p.radius + e.r) {
                            damageEnemy(e, p.dmg, p.x, p.y, 80);
                            e.slow = 1.5;
                        }
                    }
                    particles.push({ kind: 'nova', x: p.x, y: p.y, r: 8, maxR: p.radius, life: 0.35, maxLife: 0.35, color: '#7df9ff' });
                    burst(p.x, p.y, '#7df9ff', 12);
                }
            }
        } else if (p.kind === 'lightning') {
            p.life -= dt;
        }
    }
    particles = particles.filter(p => p.life > 0);

    // Popups de texto
    for (const t of popups) {
        t.y += t.vy * dt; t.life -= dt;
    }
    popups = popups.filter(t => t.life > 0);
}

// ===== BOSS TIMER =====
function updateBoss(dt) {
    if (!G.bossAlive) {
        G.nextBoss -= dt;
        if (G.nextBoss <= 0) {
            spawnBoss();
            G.nextBoss = rand(110, 150); // siguiente jefe
        }
    }
}

// ===== UPDATE PRINCIPAL =====
function update(dt) {
    G.time += dt;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);

    updatePlayer(dt);
    updateSpawning(dt);
    updateEclipse(dt);
    updateBoss(dt);
    updateEnemies(dt);
    updateWeapons(dt);
    updateProjectiles(dt);
    updateGems(dt);
    updateParticles(dt);

    // Cámara sigue al jugador (con leve suavizado)
    G.cam.x = lerp(G.cam.x, player.x, 0.12);
    G.cam.y = lerp(G.cam.y, player.y, 0.12);

    updateHUD();
}

// ===== HUD =====
function updateHUD() {
    const m = Math.floor(G.time / 60), s = Math.floor(G.time % 60);
    el.timer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    el.killCount.textContent = G.kills;
    el.levelDisplay.textContent = player.level;

    el.healthBar.style.width = (player.hp / player.maxHp * 100) + '%';
    el.healthText.textContent = `${Math.ceil(player.hp)}/${player.maxHp}`;
    el.xpBar.style.width = (player.xp / player.xpToNext * 100) + '%';
    el.flowBar.style.width = player.flow + '%';
    el.flowMult.textContent = 'x' + dmgMul().toFixed(1);
}

// ===== RENDER =====
function render() {
    ctx.clearRect(0, 0, VW, VH);

    // shake
    let sx = 0, sy = 0;
    if (G.shake > 0) { sx = rand(-G.shake, G.shake); sy = rand(-G.shake, G.shake); }

    const camX = G.cam.x - VW / 2 + sx;
    const camY = G.cam.y - VH / 2 + sy;

    // Fondo: rejilla del vacío
    drawGrid(camX, camY);

    ctx.save();
    ctx.translate(-camX, -camY);

    // Gemas
    for (const g of gems) {
        ctx.fillStyle = '#9b5de5';
        ctx.shadowColor = '#c77dff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(g.x, g.y - g.r);
        ctx.lineTo(g.x + g.r, g.y);
        ctx.lineTo(g.x, g.y + g.r);
        ctx.lineTo(g.x - g.r, g.y);
        ctx.closePath();
        ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Objetos especiales
    for (const p of pickups) {
        const yo = Math.sin(p.bob) * 4;
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = p.type === 'heal' ? '#ff4d6d' : '#7df9ff';
        ctx.shadowBlur = 16;
        ctx.fillText(p.type === 'heal' ? '❤' : '🧲', p.x, p.y + yo);
        ctx.shadowBlur = 0;
    }

    // Minas / novas / rayos (partículas grandes detrás de enemigos)
    for (const p of particles) {
        if (p.kind === 'nova') {
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.lineWidth = 4;
            ctx.shadowColor = p.color; ctx.shadowBlur = 20;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        } else if (p.kind === 'mine') {
            ctx.fillStyle = p.armed > 0 ? '#7df9ff' : '#ff4d6d';
            ctx.globalAlpha = 0.6 + Math.sin(G.time * 20) * 0.3;
            ctx.shadowColor = '#7df9ff'; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, TAU); ctx.fill();
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        } else if (p.kind === 'lightning') {
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.lineWidth = 3;
            ctx.shadowColor = p.color; ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.moveTo(p.points[0].x, p.points[0].y);
            for (let i = 1; i < p.points.length; i++) {
                // zig-zag entre puntos
                const a = p.points[i - 1], b = p.points[i];
                const mx = (a.x + b.x) / 2 + rand(-10, 10);
                const my = (a.y + b.y) / 2 + rand(-10, 10);
                ctx.lineTo(mx, my);
                ctx.lineTo(b.x, b.y);
            }
            ctx.stroke();
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        }
    }

    // Haz solar
    if (player._beam && player.weapons.beam !== undefined) {
        const b = player._beam;
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(b.angle);
        const grad = ctx.createLinearGradient(0, 0, b.len, 0);
        grad.addColorStop(0, 'rgba(255,209,102,0.9)');
        grad.addColorStop(1, 'rgba(255,209,102,0)');
        ctx.fillStyle = grad;
        ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 20;
        ctx.fillRect(0, -10, b.len, 20);
        ctx.restore();
        ctx.shadowBlur = 0;
    }

    // Centinelas orbitales
    if (player.weapons.orbit !== undefined) {
        const lvl = player.weapons.orbit;
        const count = 2 + lvl;
        const radius = (70 + lvl * 8) * player.stats.area;
        for (let i = 0; i < count; i++) {
            const a = orbitAngle + (TAU / count) * i;
            const ox = player.x + Math.cos(a) * radius;
            const oy = player.y + Math.sin(a) * radius;
            ctx.fillStyle = '#7df9ff';
            ctx.shadowColor = '#7df9ff'; ctx.shadowBlur = 16;
            ctx.beginPath(); ctx.arc(ox, oy, 9, 0, TAU); ctx.fill();
        }
        ctx.shadowBlur = 0;
    }

    // Enemigos
    for (const e of enemies) {
        drawEnemy(e);
    }

    // Proyectiles del jugador
    for (const p of projectiles) {
        ctx.fillStyle = p.flash ? '#fff' : p.color;
        ctx.shadowColor = p.color; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    }
    // Proyectiles enemigos
    for (const s of enemyShots) {
        ctx.fillStyle = '#ff4d6d';
        ctx.shadowColor = '#ff4d6d'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Chispas
    for (const p of particles) {
        if (p.kind === 'spark') {
            ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    // Trail del jugador (estela de flujo)
    for (const t of player.trail) {
        ctx.globalAlpha = clamp(t.life / 0.35, 0, 1) * 0.5;
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.arc(t.x, t.y, 6, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Jugador
    drawPlayer();

    // Popups de texto
    for (const t of popups) {
        ctx.globalAlpha = clamp(t.life / 0.7, 0, 1);
        ctx.fillStyle = t.color;
        ctx.font = `800 ${t.size}px ${getFont()}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4;
        ctx.fillText(t.text, t.x, t.y);
        ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // Overlay de eclipse (oscurece bordes)
    if (G.eclipseAlpha > 0.01) {
        const grad = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.2, VW / 2, VH / 2, VH * 0.75);
        grad.addColorStop(0, 'rgba(20,8,40,0)');
        grad.addColorStop(1, `rgba(10,2,25,${G.eclipseAlpha})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VW, VH);
    }

    // Barra de vida del jefe
    const boss = enemies.find(e => e.boss);
    if (boss) drawBossBar(boss);

    // Viñeta de daño (parpadeo rojo si vida baja)
    if (player.hp / player.maxHp < 0.3) {
        ctx.fillStyle = `rgba(255,77,109,${0.15 + Math.sin(G.time * 6) * 0.08})`;
        ctx.fillRect(0, 0, VW, VH);
    }
}

function getFont() { return "'Segoe UI', sans-serif"; }

function drawGrid(camX, camY) {
    const grid = 64;
    const startX = -((camX % grid) + grid) % grid;
    const startY = -((camY % grid) + grid) % grid;
    ctx.strokeStyle = G.eclipse ? 'rgba(179,136,255,0.10)' : 'rgba(125,249,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x < VW; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, VH); }
    for (let y = startY; y < VH; y += grid) { ctx.moveTo(0, y); ctx.lineTo(VW, y); }
    ctx.stroke();
}

function drawPlayer() {
    const flowGlow = 8 + flowRatio() * 28;
    const blink = player.invuln > 0 && Math.floor(G.time * 20) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.4;

    // halo de flujo
    ctx.shadowColor = player.flow > 50 ? '#ffd166' : '#7df9ff';
    ctx.shadowBlur = flowGlow;

    // cuerpo (rombo de luz)
    ctx.fillStyle = '#eafdff';
    ctx.save();
    ctx.translate(player.x, player.y);
    const ang = Math.atan2(player.facing.y, player.facing.x);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(player.r, 0);
    ctx.lineTo(0, player.r * 0.7);
    ctx.lineTo(-player.r * 0.6, 0);
    ctx.lineTo(0, -player.r * 0.7);
    ctx.closePath();
    ctx.fill();
    // núcleo
    ctx.fillStyle = player.flow > 50 ? '#ffd166' : '#7df9ff';
    ctx.beginPath(); ctx.arc(0, 0, player.r * 0.35, 0, TAU); ctx.fill();
    ctx.restore();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // anillo de imán (sutil)
    if (player.flow > 80) {
        ctx.strokeStyle = 'rgba(255,209,102,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(player.x, player.y, player.r + 6 + Math.sin(G.time * 8) * 2, 0, TAU); ctx.stroke();
    }
}

function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const col = e.flash > 0 ? '#ffffff' : e.color;
    ctx.fillStyle = col;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = e.elite || e.boss ? 18 : 8;

    if (e.boss) {
        // jefe: estrella pulsante
        e.wob += 0.05;
        const spikes = 8, outer = e.r, inner = e.r * 0.55;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outer : inner;
            const a = (Math.PI / spikes) * i + e.wob;
            ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a0b2e';
        ctx.beginPath(); ctx.arc(0, 0, e.r * 0.3, 0, TAU); ctx.fill();
    } else if (e.type === 'brute') {
        // cuadrado
        ctx.fillRect(-e.r, -e.r, e.r * 2, e.r * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-e.r * 0.4, -e.r * 0.4, e.r * 0.8, e.r * 0.8);
    } else if (e.type === 'swarmer') {
        // triángulo
        ctx.beginPath();
        ctx.moveTo(0, -e.r); ctx.lineTo(e.r, e.r); ctx.lineTo(-e.r, e.r);
        ctx.closePath(); ctx.fill();
    } else if (e.type === 'splitter') {
        // hexágono
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (TAU / 6) * i;
            ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * e.r, Math.sin(a) * e.r);
        }
        ctx.closePath(); ctx.fill();
    } else {
        // círculo (drifter, wraith)
        ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
        if (e.type === 'wraith') {
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath(); ctx.arc(0, 0, e.r * 0.5, 0, TAU); ctx.fill();
        }
    }
    ctx.restore();
    ctx.shadowBlur = 0;

    // mini barra de vida si está dañado
    if (e.hp < e.maxHp && !e.boss) {
        const w = e.r * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(e.x - w / 2, e.y - e.r - 8, w, 4);
        ctx.fillStyle = e.elite ? '#b388ff' : '#5de5b8';
        ctx.fillRect(e.x - w / 2, e.y - e.r - 8, w * (e.hp / e.maxHp), 4);
    }
}

function drawBossBar(boss) {
    const w = Math.min(VW * 0.6, 520), h = 14;
    const x = (VW - w) / 2, y = 16;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#3a1020';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ff4d6d';
    ctx.shadowColor = '#ff4d6d'; ctx.shadowBlur = 14;
    ctx.fillRect(x, y, w * clamp(boss.hp / boss.maxHp, 0, 1), h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = `800 12px ${getFont()}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('EL DEVORADOR', VW / 2, y + h / 2);
}

// ===== GAME LOOP =====
let lastTime = 0;
let rafId = null;
function loop(now) {
    rafId = requestAnimationFrame(loop);
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > 0.05) dt = 0.05; // limitar saltos (cambio de pestaña)

    if (G.state === 'playing') {
        update(dt);
        render();
    } else if (G.state === 'levelup' || G.state === 'paused') {
        // dibujar el último frame congelado (sin actualizar)
        render();
    }
}

// ===== CONTROL DE ESTADO =====
function startGame() {
    // Reset completo
    enemies = []; projectiles = []; enemyShots = [];
    gems = []; particles = []; popups = []; pickups = [];
    G.state = 'playing';
    G.time = 0; G.kills = 0;
    G.cam = { x: 0, y: 0 };
    G.shake = 0;
    G.spawnTimer = 0; G.spawnInterval = 1.2;
    G.eclipse = false; G.eclipseTimer = 0; G.nextEclipse = 35; G.eclipseAlpha = 0;
    G.bossAlive = false; G.nextBoss = 120;
    el.eclipseWarning.classList.add('hidden');

    Object.assign(player, {
        x: 0, y: 0, vx: 0, vy: 0,
        hp: 100, maxHp: 100,
        level: 1, xp: 0, xpToNext: 5,
        flow: 0, maxFlow: 100,
        invuln: 0, regenAcc: 0,
        facing: { x: 1, y: 0 },
        trail: [],
    });
    player.stats = {
        damage: 1, cooldown: 1, area: 1, speedMul: 1,
        magnet: 90, regen: 0, projectiles: 0, flowPower: 1, armor: 0,
    };
    player.weapons = { prismBolt: 0 };  // arma inicial
    player._passives = {};
    player._wcd = {};
    orbitAngle = 0; beamAngle = 0;

    renderWeaponSlots();
    el.hud.classList.remove('hidden');
    el.menuScreen.classList.add('hidden');
    el.gameoverScreen.classList.add('hidden');
    el.levelupScreen.classList.add('hidden');
    el.pauseScreen.classList.add('hidden');

    lastTime = performance.now();
    if (!rafId) rafId = requestAnimationFrame(loop);
}

function togglePause() {
    if (G.state === 'playing') {
        G.state = 'paused';
        el.pauseScreen.classList.remove('hidden');
    } else if (G.state === 'paused') {
        resumeGame();
    }
}

function resumeGame() {
    el.pauseScreen.classList.add('hidden');
    G.state = 'playing';
    lastTime = performance.now();
}

function quitToMenu() {
    G.state = 'menu';
    el.pauseScreen.classList.add('hidden');
    el.hud.classList.add('hidden');
    el.menuScreen.classList.remove('hidden');
}

function gameOver(victory) {
    G.state = 'gameover';
    const m = Math.floor(G.time / 60), s = Math.floor(G.time % 60);
    el.finalTime.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    el.finalKills.textContent = G.kills;
    el.finalLevel.textContent = player.level;
    if (victory) {
        el.gameoverTitle.textContent = '¡LUZ TRIUNFANTE!';
        el.gameoverTitle.classList.add('victory');
    } else {
        el.gameoverTitle.textContent = 'EL VACÍO TE CONSUMIÓ';
        el.gameoverTitle.classList.remove('victory');
    }
    el.hud.classList.add('hidden');
    el.gameoverScreen.classList.remove('hidden');
}

// ===== EVENTOS DE BOTONES =====
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('retryBtn').addEventListener('click', startGame);
document.getElementById('resumeBtn').addEventListener('click', resumeGame);
document.getElementById('quitBtn').addEventListener('click', quitToMenu);

// Iniciar el loop en reposo (para poder renderizar pantallas si hiciera falta)
rafId = requestAnimationFrame(loop);

// Mensaje en consola
console.log('%cPRISMA: FLUXBORNE', 'color:#7df9ff;font-size:22px;font-weight:bold;text-shadow:0 0 10px #7df9ff;');
console.log('%cMuévete sin parar para acumular FLUJO. Sobrevive a los eclipses. ¡Buena suerte!', 'color:#ffd166;');
