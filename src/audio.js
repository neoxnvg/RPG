// Original, generated arrangements. No media downloads; AudioContext is created
// only by unlock(), which the UI must call directly from a user gesture.
const STORAGE_KEY = 'aether-audio-v1';
const THEMES = {
  vespera: {bpm: 64, cutoff: 4200, pad: .025, harp: .044, flute: .026,
    chords: [[50,54,57,61],[47,50,54,57],[43,47,50,54],[45,49,52,57]],
    melody: [74,78,81,78,76,73,71,69], rhythm: 'city'},
  'map-01': {bpm: 74, cutoff: 3200, pad: .022, harp: .039, flute: .023,
    chords: [[50,53,57,60],[43,46,50,53],[48,52,55,58],[46,50,53,57]],
    melody: [74,77,76,72,69,72,74,69], rhythm: 'field'},
  'map-02': {bpm: 68, cutoff: 2700, pad: .027, harp: .035, flute: .025,
    chords: [[52,55,59,62],[48,52,55,59],[45,48,52,55],[47,51,54,57]],
    melody: [76,79,78,74,71,74,72,71], rhythm: 'wood'},
};
const midi = note => 440 * 2 ** ((note - 69) / 12);
const clamp = value => Math.min(1, Math.max(0, value));

export function createMapAudio({onState = () => {}} = {}) {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  let volume = .38, muted = false;
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || '{}');
    if (typeof saved.volume === 'number' && Number.isFinite(saved.volume)) volume = clamp(saved.volume);
    if (typeof saved.muted === 'boolean') muted = saved.muted;
  } catch { /* Storage may be disabled by the browser. */ }
  let mapId = 'vespera', context = null, master = null, dry = null, reverb = null;
  let timer = null, current = null, unlocked = false, disposed = false, unlocking = null;
  const layers = new Set();
  let noiseBuffer = null;

  const snapshot = () => ({supported: Boolean(AudioContextClass), unlocked, muted, volume, mapId,
    playing: !disposed && unlocked && !muted && volume > 0 && context?.state === 'running',
    contextState: context?.state || 'locked'});
  const emit = () => onState(snapshot());
  function persist() {
    try {globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({volume, muted}));} catch { /* Optional. */ }
  }
  function stopTimer() {if (timer !== null) {clearTimeout(timer); timer = null;}}
  function ramp(param, value, seconds) {
    const now = context.currentTime;
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
    else {param.cancelScheduledValues(now); param.setValueAtTime(param.value, now);}
    param.linearRampToValueAtTime(value, now + seconds);
  }
  function applyVolume() {if (master) ramp(master.gain, muted ? 0 : volume * volume * .75, .18);}

  function disconnectLayer(layer) {
    if (layer.disconnected) return;
    layer.disconnected = true;
    layer.filter.disconnect(); layer.bus.disconnect(); layers.delete(layer);
  }
  function stopLayer(layer, fade = .1) {
    if (layer.stopped) return;
    layer.stopped = true;
    ramp(layer.bus.gain, 0, fade);
    for (const voice of layer.voices) {
      try {voice.source.stop(context.currentTime + fade + .02);} catch { /* Already ended. */ }
    }
    if (!layer.voices.size) disconnectLayer(layer);
  }
  function stopMusic() {
    stopTimer();
    for (const layer of [...layers]) stopLayer(layer);
    current = null;
  }

  function voice(layer, start, duration, options = {}) {
    const source = options.noise ? context.createBufferSource() : context.createOscillator();
    const envelope = context.createGain();
    let filter = null;
    if (options.noise) {
      source.buffer = noiseBuffer;
      filter = context.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = options.cutoff || 2200;
      source.connect(filter); filter.connect(envelope);
    } else {
      source.type = options.type || 'sine';
      source.frequency.setValueAtTime(options.frequency, start);
      source.detune.value = options.detune || 0;
      if (options.slide) source.frequency.exponentialRampToValueAtTime(options.slide, start + duration);
      source.connect(envelope);
    }
    const amplitude = options.gain || .025, attack = options.attack || .008;
    const end = start + duration;
    const releaseAt = start + Math.max(attack + .002, duration - (options.release || duration * .9));
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(amplitude, start + attack);
    envelope.gain.setValueAtTime(amplitude * .8, releaseAt);
    if (options.soft) envelope.gain.linearRampToValueAtTime(0, end);
    else envelope.gain.exponentialRampToValueAtTime(.0001, end);
    envelope.connect(layer.filter);
    let ended = false;
    const record = {source, cleanup() {
      if (ended) return;
      ended = true; source.onended = null;
      source.disconnect(); envelope.disconnect(); filter?.disconnect(); layer.voices.delete(record);
      if (layer.stopped && !layer.voices.size) disconnectLayer(layer);
    }};
    layer.voices.add(record);
    source.onended = record.cleanup;
    source.start(start); source.stop(end + .025);
  }

  function scheduleStep(layer, time) {
    const theme = layer.theme, step = layer.step, within = step % 16;
    const beat = 60 / theme.bpm, chord = theme.chords[Math.floor(step / 16) % theme.chords.length];
    if (within === 0) {
      for (const note of chord.slice(0, 3)) {
        voice(layer, time, beat * 8.8, {frequency: midi(note), gain: theme.pad, attack: 1.2, release: 2.6, soft: true, detune: -3});
        voice(layer, time, beat * 8.8, {frequency: midi(note), gain: theme.pad * .32, attack: 1.4, release: 2.6, soft: true, detune: 3});
      }
    }
    const arp = [0,2,1,3,2,1,0,2][step % 8];
    // Leave rests so the melody stays behind the game rather than filling every beat.
    if (within % 4 !== 3) voice(layer, time, beat * 1.8, {
      frequency: midi(chord[arp] + 12), type: 'triangle', gain: theme.harp * (within % 2 ? .62 : 1),
      attack: .009, release: beat * 1.7,
    });
    if (within === 3 || within === 11) {
      const note = theme.melody[(Math.floor(step / 16) * 2 + (within === 11 ? 1 : 0)) % theme.melody.length];
      voice(layer, time, beat * 2.3, {frequency: midi(note), gain: theme.flute, attack: .15, release: .5, soft: true});
      voice(layer, time, beat * 2.1, {frequency: midi(note + 12), gain: theme.flute * .12, attack: .2, release: .5, soft: true});
    }
    if (theme.rhythm === 'city') {
      if (within === 0 || within === 8) voice(layer, time, .32, {frequency: 82, slide: 46, gain: .02, release: .3});
      if (within % 4 === 2) voice(layer, time, .13, {noise: true, gain: .008, cutoff: 3800});
    } else if (theme.rhythm === 'field') {
      if (within % 4 === 0) voice(layer, time, .35, {frequency: 90, slide: 43, gain: .037, release: .33});
      if (within % 2 === 1) voice(layer, time, .1, {noise: true, gain: .009, cutoff: 2800});
    } else {
      if ([0,6,8,14].includes(within)) voice(layer, time, .4, {frequency: 72, slide: 38, gain: .027, release: .38});
      if (within === 3 || within === 11) voice(layer, time, .24, {noise: true, gain: .011, cutoff: 1700});
    }
    layer.step++;
    layer.next += beat / 2;
  }

  function createLayer(id) {
    const bus = context.createGain(), filter = context.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = THEMES[id].cutoff;
    filter.connect(bus); bus.connect(dry); bus.connect(reverb);
    const layer = {theme: THEMES[id], bus, filter, step: 0, next: context.currentTime + .05,
      retireAt: Infinity, stopped: false, disconnected: false, voices: new Set()};
    bus.gain.setValueAtTime(0, context.currentTime);
    bus.gain.linearRampToValueAtTime(1, context.currentTime + 2.8);
    layers.add(layer);
    return layer;
  }
  function schedule() {
    timer = null;
    if (disposed || !unlocked || muted || volume === 0 || context.state !== 'running') return;
    const now = context.currentTime;
    // Browser tabs can throttle timers. Skip missed notes instead of scheduling a burst.
    if (current && current.next < now - .25) {
      current.next = now + .03;
      current.step = Math.ceil(current.step / 16) * 16;
    }
    if (current) while (current.next < now + .3) scheduleStep(current, current.next);
    for (const layer of [...layers]) if (layer !== current && now >= layer.retireAt) stopLayer(layer);
    timer = setTimeout(schedule, 120);
  }
  function ensurePlayback() {
    if (disposed || !unlocked || muted || volume === 0 || context?.state !== 'running') return;
    if (!current) current = createLayer(mapId);
    if (timer === null) schedule();
  }

  function createGraph() {
    context = new AudioContextClass();
    master = context.createGain(); master.gain.value = 0;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -22; compressor.knee.value = 18; compressor.ratio.value = 3;
    compressor.attack.value = .025; compressor.release.value = .3;
    dry = context.createGain(); dry.gain.value = .9;
    reverb = context.createConvolver();
    const impulse = context.createBuffer(2, Math.ceil(context.sampleRate * 1.8), context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3 * .45;
    }
    reverb.buffer = impulse;
    const wet = context.createGain(); wet.gain.value = .23;
    dry.connect(compressor); reverb.connect(wet); wet.connect(compressor);
    compressor.connect(master); master.connect(context.destination);
    noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * .5), context.sampleRate);
    const noise = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
    context.onstatechange = () => {
      if (disposed) return;
      if (context.state === 'running') {unlocked = true; ensurePlayback();}
      else stopTimer();
      emit();
    };
    applyVolume();
  }

  async function unlock() {
    if (disposed || !AudioContextClass) return false;
    if (unlocking) return unlocking;
    // Construct/resume synchronously in this call, before awaiting, to retain the
    // browser's transient user activation on Safari and mobile Chrome.
    try {
      if (!context) createGraph();
      const resumed = context.resume();
      unlocking = Promise.resolve(resumed).then(() => {
        if (disposed) return false;
        unlocked = context.state === 'running';
        ensurePlayback(); emit(); return unlocked;
      }).catch(() => {emit(); return false;}).finally(() => {unlocking = null;});
      return unlocking;
    } catch {emit(); return false;}
  }

  function setMap(id) {
    if (disposed) return;
    const next = Object.hasOwn(THEMES, id) ? id : 'vespera';
    if (next === mapId) return;
    mapId = next;
    if (current) {
      const previous = current;
      previous.retireAt = context.currentTime + 3;
      ramp(previous.bus.gain, 0, 2.8);
      current = null;
      // Rapid travel never accumulates an unbounded stack of fading tracks.
      const retiring = [...layers].filter(layer => !layer.stopped);
      for (const layer of retiring.slice(0, -2)) stopLayer(layer);
    }
    ensurePlayback(); emit();
  }
  function toggle() {
    if (disposed) return muted;
    muted = !muted; persist(); applyVolume();
    if (muted) stopMusic();
    else ensurePlayback();
    emit(); return muted;
  }
  function setVolume(value) {
    if (disposed || typeof value !== 'number' || !Number.isFinite(value)) return;
    volume = clamp(value); persist(); applyVolume();
    if (volume === 0) stopMusic();
    else ensurePlayback();
    emit();
  }
  function dispose() {
    if (disposed) return;
    disposed = true; stopMusic();
    if (context) {
      for (const layer of [...layers]) {
        for (const record of [...layer.voices]) record.cleanup();
        disconnectLayer(layer);
      }
      context.onstatechange = null;
      Promise.resolve(context.close()).catch(() => {});
    }
    unlocked = false; emit();
  }
  emit();
  return {unlock, setMap, toggle, setVolume, dispose, get state() {return snapshot();}};
}
