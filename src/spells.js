import * as THREE from 'three';

export const SPELLS = {
  nova: {name: 'Nova Celestial', key: '1', cost: 25, cooldown: 5, damage: 18, color: '#92edff'},
  meteor: {name: 'Queda da Fênix', key: '2', cost: 40, cooldown: 8, damage: 25, color: '#ff873f'},
  storm: {name: 'Corrente Arcana', key: '3', cost: 35, cooldown: 7, damage: 20, color: '#c798ff'},
};

const ORDER = Object.keys(SPELLS);
const COMBO_WINDOW = 4.5;
const ROTATION_INTERVAL = .65;
const BASE_REGEN = 6;
const SURGE_REGEN = 14;
const MAX_EFFECTS = 240;
const UP = new THREE.Vector3(0, 1, 0);

export function createSpellSystem({scene, player, enemies, onDamage, toast = () => {}}) {
  const effects = [];
  const cooldowns = {nova: 0, meteor: 0, storm: 0};
  const locked = {nova: false, meteor: false, storm: false};
  let mana = 100, lastSpell = null, lastResult = null, active = true;
  let sequence = [], comboWindow = 0, multiplier = 1, finisher = false, surge = 0;
  let rhythm = 0, rotationCursor = 0;
  const rotation = {waiting: 'target', nextSkill: null};

  function disposeEffect(effect) {
    scene.remove(effect.object);
    effect.object.geometry.dispose();
    effect.object.material.dispose();
  }

  function addEffect(object, position, life, extra = {}) {
    object.position.copy(position);
    scene.add(object);
    // Long fights retain a fixed upper bound on temporary draw calls.
    if (effects.length >= MAX_EFFECTS) disposeEffect(effects.shift());
    effects.push({object, life, max: life, opacity: object.material.opacity, ...extra});
    return object;
  }

  function mesh(geometry, color, position, life, extra = {}) {
    const material = new THREE.MeshBasicMaterial({color, transparent: true, opacity: .85,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide});
    return addEffect(new THREE.Mesh(geometry, material), position, life, extra);
  }

  function ring(position, color, radius = 1, life = .8, grow = 5) {
    const object = mesh(new THREE.TorusGeometry(radius, .045, 5, 48), color, position, life, {grow});
    object.rotation.x = Math.PI / 2;
    return object;
  }

  function rune(position, color, radius = 2.2, life = .9) {
    ring(position, color, radius, life, .7);
    ring(position.clone().add(new THREE.Vector3(0, .02, 0)), color, radius * .72, life, .7);
    // The rotating radial marks make a readable casting seal from an overhead camera.
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      const mark = mesh(new THREE.BoxGeometry(.07, .035, .42), color,
        position.clone().add(new THREE.Vector3(Math.sin(angle) * radius, .025, Math.cos(angle) * radius)), life);
      mark.rotation.y = angle;
    }
  }

  function crescent(position, color, radius, rotation = 0) {
    const object = mesh(new THREE.TorusGeometry(radius, .075, 5, 40, Math.PI * 1.5), color,
      position, .75, {grow: 2.2, spin: 4});
    object.rotation.set(Math.PI / 2 + .15, rotation, rotation);
    return object;
  }

  function burst(position, color, n = 24, force = 1) {
    for (let i = 0; i < n; i++) {
      const angle = i / n * Math.PI * 2, speed = (2 + Math.random() * 5) * force;
      mesh(new THREE.OctahedronGeometry(.08 * force), color, position, .7 + Math.random() * .4,
        {velocity: new THREE.Vector3(Math.cos(angle) * speed, 1 + Math.random() * 5, Math.sin(angle) * speed), gravity: 4});
    }
  }

  function beam(a, b, color, width = .055, life = .32) {
    const delta = b.clone().sub(a);
    if (delta.lengthSq() < .001) return;
    const object = mesh(new THREE.CylinderGeometry(width, width * 1.6, delta.length(), 5), color,
      a.clone().add(b).multiplyScalar(.5), life);
    object.quaternion.setFromUnitVectors(UP, delta.normalize());
  }

  function lightning(a, b, color) {
    let from = a;
    for (let i = 1; i <= 5; i++) {
      const to = a.clone().lerp(b, i / 5);
      if (i < 5) to.add(new THREE.Vector3((i % 2 ? 1 : -1) * .55, .3, (i % 2 ? -1 : 1) * .35));
      beam(from, to, color);
      from = to;
    }
    beam(a, b, '#eff9ff', .022, .16);
  }

  function nearbyEnemies(preferredTarget) {
    return enemies.filter(enemy => enemy.hp > 0 && enemy.g.position.distanceTo(player.position) <= 35)
      .sort((a, b) => (a === preferredTarget ? -1000 : a.g.position.distanceToSquared(player.position))
        - (b === preferredTarget ? -1000 : b.g.position.distanceToSquared(player.position)));
  }

  function advanceCombo(id) {
    if (comboWindow <= 0 || finisher || sequence.includes(id)) sequence = [];
    sequence.push(id);
    comboWindow = COMBO_WINDOW;
    multiplier = [1, 1, 1.15, 1.35][sequence.length];
    finisher = sequence.length === 3;
  }

  function finishCombo(center, nearby) {
    const ground = center.clone().setY(.18);
    rune(ground, '#fff0b1', 4.2, 1.35);
    for (let i = 0; i < 3; i++) {
      ring(ground.clone().add(new THREE.Vector3(0, i * .55, 0)), i === 1 ? '#b89aff' : '#8feeff', 1.4 + i, 1.2, 8);
      crescent(center.clone().add(new THREE.Vector3(0, 1.2 + i * .4, 0)), '#fff2b5', 2 + i * .4, i * Math.PI / 3);
    }
    beam(center.clone().add(new THREE.Vector3(0, 13, 0)), center, '#fff4c7', .28, .55);
    burst(center.clone().add(new THREE.Vector3(0, 1, 0)), '#d0c2ff', 28, 1.8);
    const hit = [];
    for (const enemy of nearby) {
      if (enemy.hp > 0 && enemy.g.position.distanceTo(center) <= 9) {
        onDamage(enemy, 32);
        hit.push(enemy);
      }
    }
    // Recovery is spread across time, so a chain still consumes much more mana than it recovers.
    surge = 3;
    return hit.length;
  }

  function cast(id, preferredTarget = null, options = {}) {
    const spell = SPELLS[id];
    const reject = (reason, message) => {
      lastResult = {ok: false, id, reason};
      if (!options.silent && message) toast(message);
      return false;
    };
    if (!spell) return reject('unknown');
    if (locked[id]) return reject('locked', `${spell.name}: habilidade travada. Destrave para usar.`);
    if (cooldowns[id] > 0) return reject('cooldown', `${spell.name}: ${Math.ceil(cooldowns[id])}s de recarga`);
    if (mana < spell.cost) return reject('mana', 'Mana insuficiente. Aguarde a regeneração.');
    const nearby = nearbyEnemies(preferredTarget);
    if (id !== 'nova' && !nearby.length) return reject('target', 'Aproxime-se de um monstro para lançar a magia.');
    const targets = id === 'nova' ? nearby.filter(enemy => enemy.g.position.distanceTo(player.position) <= 12)
      : id === 'meteor' ? nearby.filter(enemy => enemy.g.position.distanceTo(nearby[0].g.position) < 5)
        : nearby.slice(0, 3);
    // Empty ground casts cannot build or finish a damaging combo.
    if (targets.length) advanceCombo(id);
    const damage = Math.round(spell.damage * (targets.length ? multiplier : 1));
    mana -= spell.cost;
    cooldowns[id] = spell.cooldown;
    lastSpell = id;
    rhythm = ROTATION_INTERVAL;
    rotationCursor = (ORDER.indexOf(id) + 1) % ORDER.length;
    const base = player.position.clone().add(new THREE.Vector3(0, .18, 0));
    const center = id === 'nova' ? player.position.clone() : nearby[0].g.position.clone();
    rune(base, spell.color, 1.65, .8);

    if (id === 'nova') {
      for (let i = 0; i < 3; i++) {
        ring(base.clone().add(new THREE.Vector3(0, i * .3, 0)), spell.color, 1 + i * .4);
        crescent(base.clone().add(new THREE.Vector3(0, .8 + i * .3, 0)), spell.color, 1.5 + i * .4, i * 1.1);
      }
      burst(base.clone().add(new THREE.Vector3(0, 1, 0)), spell.color, 24);
    }
    if (id === 'meteor') {
      rune(center.clone().setY(.15), spell.color, 3, 1.1);
      for (let i = 0; i < 4; i++) {
        const high = center.clone().add(new THREE.Vector3((i - 1.5) * .5, 9 + i, 0));
        mesh(new THREE.IcosahedronGeometry(.4, 1), spell.color, high, .65, {velocity: new THREE.Vector3(0, -17, 0), spin: 3});
        beam(high, high.clone().add(new THREE.Vector3(0, 2.4, 0)), '#ffd6a0', .1, .45);
      }
      ring(center.clone().setY(.2), '#ffd3a0', 1, .9, 7);
      burst(center.clone().add(new THREE.Vector3(0, 1, 0)), spell.color, 24);
    }
    if (id === 'storm') {
      let from = player.position.clone().add(new THREE.Vector3(0, 2, 0));
      for (const enemy of targets) {
        const to = enemy.g.position.clone().add(new THREE.Vector3(0, 1.4, 0));
        lightning(from, to, spell.color);
        ring(enemy.g.position.clone().setY(.2), spell.color, .8, .6, 2.5);
        burst(to, spell.color, 8);
        from = to;
      }
    }
    for (const enemy of targets) onDamage(enemy, damage);
    const finished = targets.length > 0 && finisher;
    const finisherHits = finished ? finishCombo(center, nearby) : 0;
    lastResult = {ok: true, id, damage, targets: targets.length, finisher: finished, finisherDamage: finished ? 32 : 0, finisherHits};
    rotation.waiting = null;
    rotation.nextSkill = null;
    toast(finished ? 'ECLIPSE CELESTIAL! Combo ×3 · recuperação de mana acelerada'
      : `${spell.name}${targets.length > 0 && sequence.length > 1 ? ` · combo ×${sequence.length}` : ''} · −${spell.cost} mana`);
    return true;
  }

  // Call once per game frame while automatic combos (or the right mouse button) are enabled.
  // All waiting paths are silent and leave resources untouched.
  function rotate(preferredTarget = null) {
    if (!active) {rotation.waiting = 'paused'; return false;}
    const target = preferredTarget || nearbyEnemies(null)[0];
    rotation.nextSkill = null;
    if (!target || target.hp <= 0 || !enemies.includes(target)) {rotation.waiting = 'target'; return false;}
    const distance = target.g.position.distanceTo(player.position);
    if (distance > 35) {rotation.waiting = 'range'; return false;}
    if (rhythm > 0) {rotation.waiting = 'rhythm'; return false;}
    const candidates = ORDER.map((_, index) => ORDER[(rotationCursor + index) % ORDER.length])
      .filter(id => !locked[id] && (id !== 'nova' || distance <= 12));
    if (!candidates.length) {rotation.waiting = ORDER.some(id => !locked[id]) ? 'range' : 'locked'; return false;}
    // Prefer a new skill while the combo is live, but keep attacking if that skill must recharge.
    const fresh = comboWindow > 0 && !finisher ? candidates.filter(id => !sequence.includes(id)) : candidates;
    const ordered = [...fresh, ...candidates.filter(id => !fresh.includes(id))];
    const ready = ordered.filter(id => cooldowns[id] <= 0);
    const next = ready.find(id => mana >= SPELLS[id].cost);
    rotation.nextSkill = next || ready[0] || ordered[0];
    if (!next) {rotation.waiting = ready.length ? 'mana' : 'cooldown'; return false;}
    return cast(next, target, {silent: true});
  }

  function setLocked(id, value) {
    if (!Object.hasOwn(locked, id)) return false;
    locked[id] = Boolean(value);
    return locked[id];
  }

  function toggleLocked(id) {
    return Object.hasOwn(locked, id) ? setLocked(id, !locked[id]) : false;
  }

  function restore() {
    const base = player.position.clone().add(new THREE.Vector3(0, .1, 0));
    ring(base, '#83ffba', .8, 1);
    burst(base.clone().add(new THREE.Vector3(0, .5, 0)), '#83ffba', 16);
  }

  function update(dt, isActive = true) {
    dt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    active = isActive;
    if (active) {
      const boostedTime = Math.min(dt, surge);
      mana = Math.min(100, mana + boostedTime * SURGE_REGEN + (dt - boostedTime) * BASE_REGEN);
      surge = Math.max(0, surge - dt);
      rhythm = Math.max(0, rhythm - dt);
      comboWindow = Math.max(0, comboWindow - dt);
      if (!comboWindow) {sequence = []; multiplier = 1; finisher = false;}
      for (const key of ORDER) cooldowns[key] = Math.max(0, cooldowns[key] - dt);
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      const effect = effects[i];
      effect.life -= dt;
      if (effect.life <= 0) {disposeEffect(effect); effects.splice(i, 1); continue;}
      effect.object.material.opacity = effect.opacity * (effect.life / effect.max);
      if (effect.velocity) {
        effect.object.position.addScaledVector(effect.velocity, dt);
        if (effect.gravity) effect.velocity.y -= effect.gravity * dt;
      }
      if (effect.grow) effect.object.scale.addScalar(effect.grow * dt);
      if (effect.spin) effect.object.rotation.z += effect.spin * dt;
    }
  }

  function restoreMana(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    mana = Math.min(100, mana + amount);
    ring(player.position.clone().add(new THREE.Vector3(0, .15, 0)), '#719fff', .8, 1);
  }

  return {cast, rotate, setLocked, toggleLocked, restore, restoreMana, update,
    get state() {return {mana, cooldowns: {...cooldowns}, locked: {...locked}, lastSpell,
      lastResult: lastResult && {...lastResult}, effects: effects.length, regenRate: surge > 0 ? SURGE_REGEN : BASE_REGEN,
      combo: {count: sequence.length, multiplier, window: comboWindow, maxWindow: COMBO_WINDOW,
        finisher, sequence: [...sequence], surge},
      rotation: {...rotation, interval: ROTATION_INTERVAL, remaining: rhythm}};},
  };
}
