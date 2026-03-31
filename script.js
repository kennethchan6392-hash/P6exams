let audioContext;
let compressor;
let woodblockBuffer;
let malletAttackBuffer;

const noteFrequencies = {
    'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46,
    '#F5': 739.99, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77, 'C6': 1046.50
};

let currentBpm = 108;
let metronomeEnabled = false;
let metronomeTimerId = null;
let nextBeatTime = 0;
let beatCount = 0;

const bpmSlider = document.getElementById('bpmSlider');
const bpmValue = document.getElementById('bpmValue');
const metronomeBtn = document.getElementById('metronomeBtn');
const xylophoneKeys = document.querySelectorAll('.xylophone-key');
const effectContainer = document.getElementById('effectContainer');

// Pre-build keyboard lookup map for O(1) key response
const keyMap = {};
document.querySelectorAll('[data-key]').forEach(el => {
    keyMap[el.getAttribute('data-key')] = el;
});

function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-6, audioContext.currentTime);
        compressor.ratio.setValueAtTime(4, audioContext.currentTime);
        compressor.knee.setValueAtTime(10, audioContext.currentTime);
        compressor.connect(audioContext.destination);
        const wbSize = Math.ceil(audioContext.sampleRate * 0.06);
        woodblockBuffer = audioContext.createBuffer(1, wbSize, audioContext.sampleRate);
        const wbData = woodblockBuffer.getChannelData(0);
        for (let i = 0; i < wbSize; i++) {
            wbData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (wbSize * 0.15));
        }
        const maSize = Math.ceil(audioContext.sampleRate * 0.012);
        malletAttackBuffer = audioContext.createBuffer(1, maSize, audioContext.sampleRate);
        const maData = malletAttackBuffer.getChannelData(0);
        for (let i = 0; i < maSize; i++) {
            maData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (maSize * 0.2));
        }
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

// Pre-warm audio context on first user interaction to eliminate delay
document.addEventListener('click', function warmUp() {
    initAudioContext();
    document.removeEventListener('click', warmUp);
}, { once: true });
document.addEventListener('keydown', function warmUp() {
    initAudioContext();
    document.removeEventListener('keydown', warmUp);
}, { once: true });

function playNote(noteName) {
    initAudioContext();
    const frequency = noteFrequencies[noteName];
    if (!frequency) return;
    const t = audioContext.currentTime;

    // Fundamental tone
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(frequency, t);
    gain1.gain.setValueAtTime(0, t);
    gain1.gain.linearRampToValueAtTime(0.7, t + 0.02);
    gain1.gain.linearRampToValueAtTime(0.45, t + 0.1);
    gain1.gain.linearRampToValueAtTime(0.2, t + 0.5);
    gain1.gain.linearRampToValueAtTime(0, t + 1.5);
    osc1.connect(gain1);
    gain1.connect(compressor);
    osc1.start(t);
    osc1.stop(t + 1.5);

    // 3rd harmonic (bright metallic shimmer)
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(frequency * 3, t);
    gain2.gain.setValueAtTime(0, t);
    gain2.gain.linearRampToValueAtTime(0.18, t + 0.01);
    gain2.gain.linearRampToValueAtTime(0.06, t + 0.15);
    gain2.gain.linearRampToValueAtTime(0, t + 0.6);
    osc2.connect(gain2);
    gain2.connect(compressor);
    osc2.start(t);
    osc2.stop(t + 0.6);

    // 5th harmonic (subtle brightness)
    const osc3 = audioContext.createOscillator();
    const gain3 = audioContext.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(frequency * 5, t);
    gain3.gain.setValueAtTime(0, t);
    gain3.gain.linearRampToValueAtTime(0.06, t + 0.005);
    gain3.gain.linearRampToValueAtTime(0.02, t + 0.1);
    gain3.gain.linearRampToValueAtTime(0, t + 0.3);
    osc3.connect(gain3);
    gain3.connect(compressor);
    osc3.start(t);
    osc3.stop(t + 0.3);

    // Mallet attack transient
    const attackNoise = audioContext.createBufferSource();
    attackNoise.buffer = malletAttackBuffer;
    const attackFilter = audioContext.createBiquadFilter();
    attackFilter.type = 'highpass';
    attackFilter.frequency.setValueAtTime(4000, t);
    const attackGain = audioContext.createGain();
    attackGain.gain.setValueAtTime(0.12, t);
    attackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
    attackNoise.connect(attackFilter);
    attackFilter.connect(attackGain);
    attackGain.connect(compressor);
    attackNoise.start(t);
    attackNoise.stop(t + 0.012);

    const keyEl = document.querySelector('.xylophone-key[data-note="' + noteName + '"]');
    if (keyEl) {
        keyEl.classList.add('active');
        setTimeout(() => keyEl.classList.remove('active'), 200);
        createHitEffect(keyEl);
    }
}

function createHitEffect(keyEl) {
    const rect = keyEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = ['#FFD700', '#FF6B6B', '#4FC3F7', '#81C784', '#CE93D8'];
    for (let i = 0; i < 7; i++) {
        const star = document.createElement('div');
        star.classList.add('hit-star');
        const angle = (i / 7) * Math.PI * 2;
        star.style.setProperty('--tx', Math.cos(angle) * 65 + 'px');
        star.style.setProperty('--ty', Math.sin(angle) * 65 + 'px');
        star.style.left = cx + 'px';
        star.style.top = cy + 'px';
        star.style.background = colors[i % colors.length];
        effectContainer.appendChild(star);
        setTimeout(() => star.remove(), 800);
    }
}

function playMetronomeTick(isStrong, time) {
    const noise = audioContext.createBufferSource();
    noise.buffer = woodblockBuffer;
    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isStrong ? 800 : 650, time);
    filter.Q.setValueAtTime(18, time);
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(isStrong ? 1.8 : 1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.055);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(compressor);
    noise.start(time);
    noise.stop(time + 0.06);
}

function pulseMetronomeBtn() {
    metronomeBtn.classList.add('beat-pulse');
    setTimeout(() => metronomeBtn.classList.remove('beat-pulse'), 120);
}

const SCHEDULE_AHEAD = 0.1;
const SCHEDULER_INTERVAL = 25;

function scheduler() {
    while (nextBeatTime < audioContext.currentTime + SCHEDULE_AHEAD) {
        const isStrong = beatCount % 4 === 0;
        playMetronomeTick(isStrong, nextBeatTime);
        const delay = Math.max(0, (nextBeatTime - audioContext.currentTime) * 1000);
        setTimeout(pulseMetronomeBtn, delay);
        beatCount++;
        nextBeatTime += 60 / currentBpm;
    }
    metronomeTimerId = setTimeout(scheduler, SCHEDULER_INTERVAL);
}

function startMetronome() {
    stopMetronome();
    initAudioContext();
    beatCount = 0;
    nextBeatTime = audioContext.currentTime;
    scheduler();
}

function stopMetronome() {
    clearTimeout(metronomeTimerId);
    metronomeTimerId = null;
}

function updateSliderFill() {
    const pct = (currentBpm - 40) / (200 - 40) * 100;
    bpmSlider.style.setProperty('--fill', pct + '%');
}
updateSliderFill();

bpmSlider.addEventListener('input', (e) => {
    currentBpm = parseInt(e.target.value);
    bpmValue.textContent = currentBpm;
    updateSliderFill();
    if (metronomeEnabled) startMetronome();
});

metronomeBtn.addEventListener('click', () => {
    initAudioContext();
    metronomeEnabled = !metronomeEnabled;
    if (metronomeEnabled) {
        startMetronome();
        metronomeBtn.classList.add('active-btn');
        metronomeBtn.textContent = 'Stop';
    } else {
        stopMetronome();
        metronomeBtn.classList.remove('active-btn');
        metronomeBtn.textContent = 'Metronome';
    }
});

xylophoneKeys.forEach(key => {
    const note = key.getAttribute('data-note');
    const handler = (e) => {
        e.preventDefault();
        if (note) playNote(note);
    };
    key.addEventListener('click', handler);
    key.addEventListener('touchstart', handler, { passive: false });
});

document.addEventListener('keydown', (e) => {
    if (e.repeat || e.isComposing) return;
    let k = e.key.toLowerCase();
    // Fallback for Chinese IME: extract key from physical key code
    if (!keyMap[k] && e.code) {
        if (e.code.startsWith('Key')) {
            k = e.code.slice(3).toLowerCase();
        } else if (e.code.startsWith('Digit')) {
            k = e.code.slice(5);
        }
    }
    const keyEl = keyMap[k];
    if (keyEl) {
        e.preventDefault();
        const note = keyEl.getAttribute('data-note');
        if (note) playNote(note);
    }
});
