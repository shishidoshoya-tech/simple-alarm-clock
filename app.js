const clockEl   = document.getElementById('clock');
const dateEl    = document.getElementById('date');
const ampmEl    = document.getElementById('ampm');
const nextHint  = document.getElementById('next-hint');
const alarmList = document.getElementById('alarm-list');
const emptyMsg  = document.getElementById('empty-msg');
const countEl   = document.getElementById('alarm-count');
const overlay   = document.getElementById('overlay');
const overlayLabel = document.getElementById('overlay-label');
const overlayTime  = document.getElementById('overlay-time');

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

let alarms   = loadAlarms();
let firedSet = new Set();
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playBeep() {
  try {
    const ctx = getAudioContext();
    [0, 220, 440].forEach(offset => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      const t = ctx.currentTime + offset / 1000;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  } catch (_) {}
}

function pad(n) { return String(n).padStart(2, '0'); }

function tick() {
  const now  = new Date();
  const h24  = now.getHours();
  const mm   = pad(now.getMinutes());
  const ss   = pad(now.getSeconds());
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12  = h24 % 12 || 12;

  clockEl.textContent = `${pad(h12)}:${mm}:${ss}`;
  ampmEl.textContent  = ampm;
  dateEl.textContent  = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()} ${now.getFullYear()}`;

  updateNextHint(h24, now.getMinutes());

  const currentTime = `${pad(h24)}:${mm}`;
  alarms.forEach(alarm => {
    if (!alarm.active) return;
    if (alarm.time !== currentTime) return;
    if (firedSet.has(alarm.id + '-' + currentTime)) return;
    firedSet.add(alarm.id + '-' + currentTime);
    fireAlarm(alarm);
  });

  if (ss === '01') firedSet = new Set();
}

function updateNextHint(nowH, nowM) {
  const active = alarms.filter(a => a.active);
  if (!active.length) { nextHint.textContent = ''; return; }

  const nowMins = nowH * 60 + nowM;
  let best = null, bestDiff = Infinity;

  active.forEach(a => {
    const [ah, am] = a.time.split(':').map(Number);
    const alarmMins = ah * 60 + am;
    let diff = alarmMins - nowMins;
    if (diff <= 0) diff += 1440;
    if (diff < bestDiff) { bestDiff = diff; best = a; }
  });

  if (!best) { nextHint.textContent = ''; return; }

  const h = Math.floor(bestDiff / 60);
  const m = bestDiff % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  const timeStr = parts.join(' ') || 'less than a minute';
  nextHint.textContent = `Next alarm in ${timeStr}`;
}

function fireAlarm(alarm) {
  playBeep();
  overlayLabel.textContent = alarm.label || 'Alarm!';
  overlayTime.textContent  = formatDisplay(alarm.time);
  overlay.classList.remove('hidden');
  const item = document.getElementById('item-' + alarm.id);
  if (item) item.classList.add('firing');
}

function formatDisplay(time24) {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12  = h % 12 || 12;
  return `${pad(h12)}:${pad(m)} ${ampm}`;
}

document.getElementById('dismiss-btn').addEventListener('click', () => {
  overlay.classList.add('hidden');
  document.querySelectorAll('.alarm-item.firing').forEach(el => el.classList.remove('firing'));
});

document.getElementById('add-btn').addEventListener('click', addAlarm);
document.getElementById('alarm-label').addEventListener('keydown', e => { if (e.key === 'Enter') addAlarm(); });

function addAlarm() {
  const timeInput  = document.getElementById('alarm-time');
  const labelInput = document.getElementById('alarm-label');
  const time  = timeInput.value;
  const label = labelInput.value.trim();

  if (!time) { timeInput.focus(); return; }

  const alarm = { id: Date.now(), time, label, active: true };
  alarms.push(alarm);
  saveAlarms();
  renderAlarm(alarm);
  updateCount();

  timeInput.value  = '';
  labelInput.value = '';
  timeInput.focus();
}

function renderAlarm(alarm) {
  emptyMsg.style.display = 'none';

  const li = document.createElement('li');
  li.className = 'alarm-item ' + (alarm.active ? 'active' : 'inactive');
  li.id = 'item-' + alarm.id;

  const toggleId = 'toggle-' + alarm.id;
  li.innerHTML = `
    <div class="toggle-wrap">
      <input type="checkbox" id="${toggleId}" ${alarm.active ? 'checked' : ''} />
      <label class="toggle-track" for="${toggleId}"></label>
    </div>
    <div class="alarm-info">
      <div class="alarm-time-text">${formatDisplay(alarm.time)}</div>
      ${alarm.label ? `<div class="alarm-label-text">${escapeHtml(alarm.label)}</div>` : ''}
    </div>
    <button class="delete-btn" title="Delete">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;

  li.querySelector('input[type="checkbox"]').addEventListener('change', e => {
    alarm.active = e.target.checked;
    li.classList.toggle('active', alarm.active);
    li.classList.toggle('inactive', !alarm.active);
    saveAlarms();
    tick();
  });

  li.querySelector('.delete-btn').addEventListener('click', () => {
    li.style.animation = 'none';
    li.style.opacity = '0';
    li.style.transform = 'translateX(20px)';
    li.style.transition = 'opacity 0.2s, transform 0.2s';
    setTimeout(() => {
      alarms = alarms.filter(a => a.id !== alarm.id);
      li.remove();
      saveAlarms();
      updateCount();
      if (alarms.length === 0) emptyMsg.style.display = '';
      tick();
    }, 200);
  });

  alarmList.appendChild(li);
}

function updateCount() { countEl.textContent = alarms.length; }

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function saveAlarms()  { localStorage.setItem('alarms', JSON.stringify(alarms)); }
function loadAlarms()  {
  try { return JSON.parse(localStorage.getItem('alarms')) || []; }
  catch (_) { return []; }
}

function init() {
  alarms.forEach(renderAlarm);
  updateCount();
  emptyMsg.style.display = alarms.length ? 'none' : '';
  tick();
  setInterval(tick, 1000);
}

init();
