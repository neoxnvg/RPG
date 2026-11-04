import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSpellSystem, SPELLS} from '../src/spells.js';

function fixture(hp = 30) {
  const scene = new THREE.Scene(), player = new THREE.Group(), enemy = {hp, g: new THREE.Group()};
  enemy.g.position.set(5, 0, 0);
  scene.add(player, enemy.g);
  const messages = [], hits = [];
  const enemies = [enemy];
  const spells = createSpellSystem({scene, player, enemies,
    onDamage: (target, amount) => {hits.push({target, amount}); target.hp = Math.max(0, target.hp - amount);},
    toast: message => messages.push(message)});
  return {scene, player, enemy, enemies, spells, messages, hits};
}

function close(actual, expected) {assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≈ ${expected}`);}

test('meteor consumes mana, damages a nearby target and enforces cooldown', () => {
  const {enemy, spells} = fixture();
  assert.equal(spells.cast('meteor'), true);
  assert.equal(enemy.hp, 5);
  assert.equal(spells.state.mana, 60);
  assert.ok(spells.state.effects > 0);
  assert.equal(spells.cast('meteor'), false);
  assert.equal(enemy.hp, 5);
  assert.equal(spells.state.mana, 60);
  spells.update(8);
  assert.equal(spells.state.cooldowns.meteor, 0);
  assert.equal(spells.state.mana, 100);
  assert.equal(spells.state.effects, 0);
});

test('nova respects its radius; targeted spells reject an out-of-range enemy', () => {
  const {enemy, spells} = fixture();
  enemy.g.position.x = 40;
  assert.equal(spells.cast('storm'), false);
  assert.equal(spells.state.mana, 100);
  assert.equal(spells.cast('nova'), true);
  assert.equal(spells.state.combo.count, 0, 'empty ground cannot build a combo');
  assert.equal(enemy.hp, 30);
  enemy.g.position.x = 6;
  spells.update(5);
  assert.equal(spells.cast('nova'), true);
  assert.equal(enemy.hp, 12);
});

test('paused updates preserve mana, cooldown, rotation rhythm and combo while effects expire', () => {
  const {spells} = fixture(1000);
  spells.cast('storm');
  spells.update(2, false);
  assert.equal(spells.state.mana, 65);
  assert.equal(spells.state.cooldowns.storm, 7);
  assert.equal(spells.state.combo.window, 4.5);
  assert.equal(spells.state.rotation.remaining, .65);
  assert.equal(spells.state.effects, 0);
  assert.equal(spells.rotate(), false);
  assert.equal(spells.state.rotation.waiting, 'paused');
});

test('locking a skill blocks manual and automatic use without spending mana', () => {
  const {spells, hits, messages} = fixture(1000);
  assert.equal(spells.setLocked('nova', true), true);
  assert.equal(spells.cast('nova'), false);
  assert.equal(spells.state.lastResult.reason, 'locked');
  assert.equal(spells.state.mana, 100);
  assert.equal(hits.length, 0);
  assert.equal(spells.rotate(), true);
  assert.equal(spells.state.lastSpell, 'meteor');
  spells.setLocked('meteor', true);
  spells.setLocked('storm', true);
  spells.update(1);
  const before = messages.length;
  assert.equal(spells.rotate(), false);
  assert.equal(spells.state.rotation.waiting, 'locked');
  assert.equal(messages.length, before, 'automatic waiting must remain silent');
  assert.equal(spells.toggleLocked('nova'), false);
  assert.equal(spells.toggleLocked('missing'), false);
  assert.equal(spells.state.locked.missing, undefined);
});

test('three distinct spells amplify hits, trigger real area finisher damage and timed mana recovery', () => {
  const {spells, enemy, enemies, hits} = fixture(1000);
  const bystander = {hp: 1000, g: new THREE.Group()};
  bystander.g.position.set(12, 0, 0);
  enemies.push(bystander);
  assert.equal(spells.cast('nova', enemy), true);
  assert.equal(spells.cast('meteor', enemy), true);
  assert.equal(spells.state.combo.count, 2);
  assert.equal(spells.state.combo.multiplier, 1.15);
  assert.equal(spells.cast('storm', enemy), true);
  const state = spells.state;
  assert.deepEqual(state.combo.sequence, ['nova', 'meteor', 'storm']);
  assert.equal(state.combo.finisher, true);
  assert.equal(state.combo.multiplier, 1.35);
  assert.equal(state.lastResult.finisherDamage, 32);
  assert.equal(state.lastResult.finisherHits, 2);
  assert.equal(enemy.hp, 1000 - 18 - 29 - 27 - 32);
  assert.equal(bystander.hp, 1000 - 18 - 27 - 32);
  assert.equal(hits.filter(hit => hit.amount === 32).length, 2);
  assert.equal(state.mana, 0, 'finishing a chain is not a free mana refill');
  assert.equal(state.regenRate, 14);
  spells.update(4);
  assert.equal(spells.state.mana, 48, '3 boosted seconds plus 1 normal second');
  assert.equal(spells.state.regenRate, 6);
  spells.update(.6);
  assert.equal(spells.state.combo.count, 0);
  assert.equal(spells.state.combo.finisher, false);
});

test('a combo expires and a repeated spell starts a new chain', () => {
  const {spells} = fixture(1000);
  spells.cast('nova');
  spells.cast('meteor');
  spells.update(4.6);
  assert.equal(spells.state.combo.count, 0);
  spells.cast('storm');
  assert.equal(spells.state.combo.count, 1);
  assert.equal(spells.state.combo.multiplier, 1);
  // Once the same skill recharges its old chain has expired as well.
  spells.update(SPELLS.storm.cooldown);
  spells.cast('storm');
  assert.deepEqual(spells.state.combo.sequence, ['storm']);
  assert.equal(spells.state.combo.finisher, false);
});

test('automatic rotation spaces three distinct attacks and silently waits for cooldowns', () => {
  const {spells, messages} = fixture(1000);
  assert.equal(spells.rotate(), true);
  assert.equal(spells.state.lastSpell, 'nova');
  const mana = spells.state.mana;
  assert.equal(spells.rotate(), false);
  assert.equal(spells.state.rotation.waiting, 'rhythm');
  assert.equal(spells.state.mana, mana);
  spells.update(.65);
  assert.equal(spells.rotate(), true);
  assert.equal(spells.state.lastSpell, 'meteor');
  spells.update(.65);
  assert.equal(spells.rotate(), true);
  assert.equal(spells.state.lastSpell, 'storm');
  assert.equal(spells.state.combo.finisher, true);
  spells.update(.65);
  const before = messages.length;
  for (let i = 0; i < 20; i++) assert.equal(spells.rotate(), false);
  assert.equal(spells.state.rotation.waiting, 'cooldown');
  assert.equal(messages.length, before);
});

test('automatic rotation waits for mana and resumes as regeneration makes a ready skill affordable', () => {
  const {spells, enemy, messages} = fixture(100000);
  let waited = false;
  for (let i = 0; i < 150; i++) {
    spells.update(.2);
    spells.rotate(enemy);
    if (spells.state.rotation.waiting === 'mana') {waited = true; break;}
  }
  assert.equal(waited, true, 'a sustained rotation cannot generate infinite mana');
  const snapshot = spells.state, next = snapshot.rotation.nextSkill;
  assert.equal(snapshot.cooldowns[next], 0);
  assert.ok(snapshot.mana < SPELLS[next].cost);
  const before = messages.length;
  for (let i = 0; i < 20; i++) assert.equal(spells.rotate(enemy), false);
  assert.equal(spells.state.mana, snapshot.mana);
  assert.equal(messages.length, before, 'mana waiting does not spam feedback');
  let resumed = false;
  for (let i = 0; i < 60; i++) {
    spells.update(.1);
    if (spells.rotate(enemy)) {resumed = true; break;}
  }
  assert.equal(resumed, true);
  assert.equal(spells.state.lastResult.ok, true);
  assert.equal(messages.length, before + 1);
});

test('automatic rotation never casts without a living target or outside fixed target range', () => {
  const {spells, enemy, messages} = fixture();
  enemy.hp = 0;
  assert.equal(spells.rotate(), false);
  assert.equal(spells.state.rotation.waiting, 'target');
  assert.equal(spells.state.mana, 100);
  enemy.hp = 30;
  enemy.g.position.x = 40;
  assert.equal(spells.rotate(enemy), false);
  assert.equal(spells.state.rotation.waiting, 'range');
  assert.equal(messages.length, 0);
  assert.equal(spells.state.effects, 0);
  const removed = {hp: 30, g: new THREE.Group()};
  assert.equal(spells.rotate(removed), false);
  assert.equal(spells.state.rotation.waiting, 'target');
});

test('a distant target skips short range nova, and an explicit target receives meteor first', () => {
  const {spells, enemy, enemies} = fixture(1000);
  enemy.g.position.x = 20;
  const closeEnemy = {hp: 1000, g: new THREE.Group()};
  closeEnemy.g.position.x = 5;
  enemies.push(closeEnemy);
  assert.equal(spells.rotate(enemy), true);
  assert.equal(spells.state.lastSpell, 'meteor');
  assert.equal(enemy.hp, 975);
  assert.equal(closeEnemy.hp, 1000);
});

test('temporary effects have a fixed cap and dispose geometry and material after a long fight', () => {
  const {scene, spells} = fixture(1000);
  let geometryDisposed = 0, materialDisposed = 0;
  for (let i = 0; i < 40; i++) spells.restore();
  assert.ok(spells.state.effects <= 240);
  const temporary = scene.children.filter(child => child.isMesh);
  for (const object of temporary) {
    object.geometry.addEventListener('dispose', () => geometryDisposed++);
    object.material.addEventListener('dispose', () => materialDisposed++);
  }
  spells.update(2, false);
  assert.equal(spells.state.effects, 0);
  assert.equal(geometryDisposed, temporary.length);
  assert.equal(materialDisposed, temporary.length);
  assert.equal(scene.children.length, 2, 'player and monster stay in the scene');
});

test('state snapshots cannot mutate internal locks, cooldowns or combo sequence', () => {
  const {spells} = fixture(1000);
  spells.cast('nova');
  const state = spells.state;
  state.locked.meteor = true;
  state.cooldowns.nova = 0;
  state.combo.sequence.push('meteor');
  assert.equal(spells.state.locked.meteor, false);
  assert.equal(spells.state.cooldowns.nova, 5);
  assert.deepEqual(spells.state.combo.sequence, ['nova']);
  const before = spells.state.mana;
  spells.restoreMana(-20);
  spells.restoreMana(NaN);
  close(spells.state.mana, before);
});
