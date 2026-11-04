import test from 'node:test';
import assert from 'node:assert/strict';
import {createMapAudio} from '../src/audio.js';

class Param {
  value = 0;
  events = [];
  setValueAtTime(value, time) {this.value = value; this.events.push(['set', value, time]);}
  linearRampToValueAtTime(value, time) {this.value = value; this.events.push(['linear', value, time]);}
  exponentialRampToValueAtTime(value, time) {this.value = value; this.events.push(['exponential', value, time]);}
  cancelAndHoldAtTime(time) {this.events.push(['hold', time]);}
}
class AudioNode {
  constructor(kind) {
    this.kind = kind;
    for (const name of ['gain','frequency','detune','threshold','knee','ratio','attack','release']) this[name] = new Param();
    this.connections = new Set(); this.disconnected = false;
  }
  connect(node) {this.connections.add(node); return node;}
  disconnect() {this.connections.clear(); this.disconnected = true;}
  start(time) {this.startedAt = time;}
  stop(time) {this.stoppedAt = time;}
}
function environment(t, saved = null) {
  const instances = [], timers = new Map(), storage = new Map(saved ? [['aether-audio-v1', saved]] : []);
  let nextTimer = 0;
  class Context {
    currentTime = 0;
    sampleRate = 8000;
    state = 'suspended';
    nodes = [];
    constructor() {this.destination = new AudioNode('destination'); instances.push(this);}
    node(kind) {const node = new AudioNode(kind); this.nodes.push(node); return node;}
    createGain() {return this.node('gain');}
    createBiquadFilter() {return this.node('filter');}
    createOscillator() {return this.node('oscillator');}
    createBufferSource() {return this.node('bufferSource');}
    createDynamicsCompressor() {return this.node('compressor');}
    createConvolver() {return this.node('convolver');}
    createBuffer(channels, length) {
      const data = Array.from({length: channels}, () => new Float32Array(length));
      return {getChannelData: index => data[index]};
    }
    resume() {this.state = 'running'; this.onstatechange?.(); return Promise.resolve();}
    close() {this.state = 'closed'; return Promise.resolve();}
    advance(seconds) {
      this.currentTime += seconds;
      for (const node of this.nodes) if (node.stoppedAt <= this.currentTime) node.onended?.();
    }
  }
  const original = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'AudioContext', {configurable: true, value: Context});
  Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {
    getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value),
  }});
  t.mock.method(globalThis, 'setTimeout', callback => {const id = ++nextTimer; timers.set(id, callback); return id;});
  t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'AudioContext', original); else delete globalThis.AudioContext;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage); else delete globalThis.localStorage;
  });
  const tick = () => {
    const callbacks = [...timers.values()]; timers.clear();
    for (const callback of callbacks) callback();
  };
  return {instances, timers, storage, tick};
}

test('construction, changing maps and controls do not create audio before unlock', t => {
  const env = environment(t), events = [];
  const audio = createMapAudio({onState: state => events.push(state)});
  audio.setMap('map-01'); audio.setVolume(.4); audio.toggle(); audio.toggle();
  assert.equal(env.instances.length, 0);
  assert.equal(env.timers.size, 0);
  assert.equal(audio.state.unlocked, false);
  assert.equal(audio.state.playing, false);
  assert.equal(audio.state.mapId, 'map-01');
  assert.ok(events.length > 1);
  audio.dispose();
});

test('unlock is idempotent and schedules a bounded musical phrase with one timer', async t => {
  const env = environment(t), audio = createMapAudio();
  const results = await Promise.all([audio.unlock(), audio.unlock(), audio.unlock()]);
  assert.deepEqual(results, [true,true,true]);
  assert.equal(env.instances.length, 1);
  assert.equal(env.timers.size, 1);
  assert.equal(audio.state.playing, true);
  const context = env.instances[0], sources = context.nodes.filter(node => node.startedAt !== undefined);
  assert.ok(sources.length >= 6 && sources.length <= 12);
  for (const source of sources) {
    assert.ok(source.startedAt >= 0 && source.startedAt < .3);
    assert.ok(source.stoppedAt > source.startedAt);
  }
  await audio.unlock();
  assert.equal(env.timers.size, 1);
  audio.dispose();
});

test('three maps use different harmonies and crossfade existing voices', async t => {
  const env = environment(t), audio = createMapAudio();
  await audio.unlock();
  const context = env.instances[0];
  const first = context.nodes.filter(node => node.kind === 'oscillator').map(node => node.frequency.events[0][1]);
  assert.ok(first.some(value => Math.abs(value - 440 * 2 ** ((54 - 69) / 12)) < .01));
  const before = context.nodes.length;
  audio.setMap('map-01'); env.tick();
  const second = context.nodes.slice(before).filter(node => node.kind === 'oscillator').map(node => node.frequency.events[0][1]);
  assert.ok(second.some(value => Math.abs(value - 440 * 2 ** ((53 - 69) / 12)) < .01));
  assert.notDeepEqual(first, second);
  audio.setMap('map-02'); env.tick();
  assert.equal(audio.state.mapId, 'map-02');
  const fades = context.nodes.flatMap(node => node.gain.events).filter(event => event[0] === 'linear' && event[1] === 0 && event[2] === 2.8);
  assert.ok(fades.length >= 2, 'outgoing maps fade over 2.8 seconds');
  context.advance(3.2); env.tick();
  assert.equal(env.timers.size, 1);
  audio.dispose();
});

test('mute and volume persist; zero volume cancels scheduling and unmute starts only one loop', async t => {
  const env = environment(t, '{"muted":true,"volume":0.6}');
  const audio = createMapAudio();
  await audio.unlock();
  assert.equal(audio.state.muted, true);
  assert.equal(audio.state.volume, .6);
  assert.equal(env.timers.size, 0);
  audio.toggle();
  assert.equal(audio.state.playing, true);
  assert.equal(env.timers.size, 1);
  audio.setVolume(0);
  assert.equal(audio.state.playing, false);
  assert.equal(env.timers.size, 0);
  audio.setVolume(.25);
  assert.equal(env.timers.size, 1);
  audio.toggle();
  assert.equal(env.timers.size, 0);
  assert.deepEqual(JSON.parse(env.storage.get('aether-audio-v1')), {muted: true, volume: .25});
  audio.dispose();
});

test('suspended tabs stop scheduling, resume safely, and throttled timers do not burst missed notes', async t => {
  const env = environment(t), audio = createMapAudio();
  await audio.unlock();
  const context = env.instances[0];
  context.state = 'suspended'; context.onstatechange();
  assert.equal(audio.state.playing, false);
  assert.equal(env.timers.size, 0);
  context.advance(120);
  context.state = 'running'; context.onstatechange();
  assert.equal(env.timers.size, 1);
  const before = context.nodes.length;
  context.advance(120); env.tick();
  const newSources = context.nodes.slice(before).filter(node => node.startedAt !== undefined);
  assert.ok(newSources.length <= 12, 'missing two minutes never queues two minutes of notes');
  assert.ok(newSources.every(node => node.startedAt >= context.currentTime));
  audio.dispose();
});

test('dispose closes the context, disconnects musical voices and prevents any later restart', async t => {
  const env = environment(t), audio = createMapAudio();
  await audio.unlock();
  audio.setMap('map-01'); env.tick();
  const context = env.instances[0];
  audio.dispose(); audio.dispose();
  assert.equal(env.timers.size, 0);
  assert.equal(context.state, 'closed');
  assert.equal(context.onstatechange, null);
  for (const source of context.nodes.filter(node => node.startedAt !== undefined)) assert.equal(source.disconnected, true);
  assert.equal(await audio.unlock(), false);
  audio.setMap('map-02'); audio.toggle(); audio.setVolume(.8);
  assert.equal(env.instances.length, 1);
  assert.equal(env.timers.size, 0);
  assert.equal(audio.state.playing, false);
});

test('invalid storage, map IDs and volume values fail safely', t => {
  const env = environment(t, 'null'), audio = createMapAudio();
  assert.equal(audio.state.volume, .38);
  audio.setVolume(NaN); audio.setVolume('0.2');
  assert.equal(audio.state.volume, .38);
  audio.setVolume(5); assert.equal(audio.state.volume, 1);
  audio.setVolume(-1); assert.equal(audio.state.volume, 0);
  audio.setMap('map-01'); audio.setMap('unknown');
  assert.equal(audio.state.mapId, 'vespera');
  assert.equal(env.instances.length, 0);
  audio.dispose();
});
