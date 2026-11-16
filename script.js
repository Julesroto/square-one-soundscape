// ---------- Elements ----------
const main = document.getElementById("main");
const playBtn = document.getElementById("play");
const seek = document.getElementById("seek");
const vol = document.getElementById("vol");
const timeLabel = document.getElementById("time");
const statusEl = document.getElementById("status");
const title = document.getElementById("title");
const stage = document.getElementById("stage");
const canvas = document.getElementById("viz");
const g = canvas.getContext("2d");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Title letters (each one glows with the music) ----------
const text = title.textContent;
title.setAttribute("aria-label", text);
title.textContent = "";
const letters = [...text].map((ch) => {
  const s = document.createElement("span");
  s.textContent = ch === " " ? "\u00a0" : ch;
  s.setAttribute("aria-hidden", "true");
  title.append(s);
  return s;
});

// ---------- Web Audio analyser ----------
let audioCtx, analyser, freqData;
function setupAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;
  audioCtx.createMediaElementSource(main).connect(analyser);
  analyser.connect(audioCtx.destination);
  freqData = new Uint8Array(analyser.frequencyBinCount);
}

// ---------- Player ----------
const fmt = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

playBtn.addEventListener("click", async () => {
  setupAudio();
  await audioCtx.resume();
  if (main.paused) {
    main.play().catch(() => { statusEl.textContent = "Couldn't play soundscape.mp3. Check the file is in the repo."; });
  } else {
    main.pause();
  }
});
main.addEventListener("play", () => { playBtn.textContent = "❚❚ Pause"; statusEl.textContent = ""; });
main.addEventListener("pause", () => { playBtn.textContent = "▶ Play soundscape"; });
main.addEventListener("ended", () => { playBtn.textContent = "▶ Play again"; });
main.addEventListener("error", () => { statusEl.textContent = "Add your audio file soundscape.mp3 to hear the soundscape."; });
["loadedmetadata", "timeupdate"].forEach((ev) => main.addEventListener(ev, () => {
  if (main.duration) seek.value = (main.currentTime / main.duration) * 1000;
  timeLabel.textContent = `${fmt(main.currentTime)} / ${fmt(main.duration)}`;
}));
seek.addEventListener("input", () => { if (main.duration) main.currentTime = (seek.value / 1000) * main.duration; });
vol.addEventListener("input", () => { main.volume = vol.value; });
main.volume = vol.value;

// ---------- Winamp-style visualizer + sound-reactive hero ----------
function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", fitCanvas);
fitCanvas();

const SEG = 6, GAP = 2, peaks = [];
let bass = 0;

function draw(t) {
  requestAnimationFrame(draw);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const playing = analyser && !main.paused;
  if (playing) analyser.getByteFrequencyData(freqData);

  g.fillStyle = "#07123a";
  g.fillRect(0, 0, w, h);
  const n = Math.max(16, Math.floor(w / 22));
  const slot = w / n;
  const maxSeg = Math.floor(h / (SEG + GAP));

  for (let i = 0; i < n; i++) {
    let v = playing
      ? Math.min(1, (freqData[Math.floor((i * freqData.length * 0.6) / n)] / 255) * 1.25)
      : reduceMotion ? 0.05 : 0.08 + 0.05 * Math.sin(t / 400 + i * 0.6);
    const lit = Math.round(v * maxSeg);
    for (let s = 0; s < lit; s++) {
      const r = s / maxSeg;
      g.fillStyle = r < 0.55 ? "#c6ff3d" : r < 0.8 ? "#ffe14d" : "#ff4fc3";
      g.fillRect(i * slot + 1, h - (s + 1) * (SEG + GAP), slot - 3, SEG);
    }
    peaks[i] = Math.max(lit, (peaks[i] || 0) - 0.15);
    g.fillStyle = "#fff";
    g.fillRect(i * slot + 1, h - (Math.floor(peaks[i]) + 1) * (SEG + GAP), slot - 3, SEG);
  }

  // bass drives the hero photo; letters glow in rainbow colors
  let b = 0;
  if (playing) {
    for (let i = 0; i < 6; i++) b += freqData[i] / 255;
    b = Math.max(0, Math.min(1, (b / 6 - 0.25) * 2.2));
  }
  bass += (b - bass) * 0.25;
  stage.style.setProperty("--bass", bass.toFixed(3));

  if (!reduceMotion) {
    letters.forEach((el, j) => {
      if (!playing) { el.style.transform = ""; el.style.filter = ""; return; }
      const v = Math.min(1, (freqData[Math.floor((j * freqData.length * 0.6) / letters.length)] / 255) * 1.25);
      el.style.transform = `translateY(${-v * 18}px)`;
      el.style.filter = `drop-shadow(0 3px 0 #0f1f55) drop-shadow(0 0 ${6 + v * 16}px hsl(${(j * 40 + t / 15) % 360} 100% 65%))`;
    });
  }
}
requestAnimationFrame(draw);

// ---------- Zone windows: tap to play a layer + animate its photo ----------
document.querySelectorAll(".zone").forEach((btn) => {
  const clip = new Audio(btn.dataset.sound);
  clip.loop = true;
  const hint = btn.querySelector(".hint");
  btn.addEventListener("click", () => {
    const on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(on));
    hint.textContent = on ? "■ playing, tap to stop" : "▶ tap to play";
    if (on) {
      clip.play().catch(() => { statusEl.textContent = `Couldn't play ${btn.dataset.sound}. Check that the file exists.`; });
    } else {
      clip.pause();
    }
  });
});

// ---------- Time-of-day slider: sunset fades into city lights ----------
const tod = document.getElementById("tod");
const todStage = document.getElementById("tod-stage");
const todLabel = document.getElementById("tod-label");
tod.addEventListener("input", () => {
  const v = tod.value / 100;
  todStage.style.setProperty("--tod", v);
  todLabel.textContent = v < 0.34 ? "Golden hour" : v < 0.67 ? "Dusk" : "City lights";
});

// ---------- Y2K sparkle cursor trail ----------
if (!reduceMotion) {
  const cols = ["#ff4fc3", "#6fd6ff", "#c6ff3d", "#ffffff"];
  let last = 0;
  addEventListener("pointermove", (e) => {
    const now = performance.now();
    if (now - last < 45) return;
    last = now;
    const s = document.createElement("span");
    s.className = "trail";
    s.textContent = "✦";
    s.style.left = e.clientX + "px";
    s.style.top = e.clientY + "px";
    s.style.color = cols[Math.floor(Math.random() * cols.length)];
    s.style.fontSize = 10 + Math.random() * 14 + "px";
    document.body.append(s);
    s.addEventListener("animationend", () => s.remove());
  });
}

// ---------- Visitor counter (counts visits in this browser) ----------
try {
  const n = (Number(localStorage.getItem("sq1-visits")) || 1336) + 1;
  localStorage.setItem("sq1-visits", n);
  document.getElementById("count").textContent = String(n).padStart(6, "0");
} catch (e) { /* keep the default number */ }
