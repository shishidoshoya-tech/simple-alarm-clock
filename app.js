const clockEl   = document.getElementById('clock');
const dateEl    = document.getElementById('date');
const alarmList = document.getElementById('alarm-list');
const emptyMsg  = document.getElementById('empty-msg');
const countEl   = document.getElementById('alarm-count');
const overlay   = document.getElementById('overlay');
const overlayLabel = document.getElementById('overlay-label');
const overlayTime  = document.getElementById('overlay-time');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

let alarms = loadAlarms();
let firedSet = new Set();
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playBeep() {
  try {
    const ctx = getAudioContext();
    const beepPattern = [0, 200, 400];
    beepPattern.forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      const t = ctx.currentTime + offset / 1000;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  } catch (_) {}
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function tick() {
  const now = new Date();
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  clockEl.textContent = `${hh}:${mm}:${ss}`;
  dateEl.textContent = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()} ${now.getFullYear()}`;

  const currentTime = `${hh}:${mm}`;

  alarms.forEach(alarm => {
    if (!alarm.active) return;
    if (alarm.time !== currentTime) return;
    if (firedSet.has(alarm.id + '-' + currentTime)) return;

    firedSet.add(alarm.id + '-' + currentTime);
    fireAlarm(alarm);
  });

  // Clear firedSet entries from previous minutes so alarms can fire again next day
  if (ss === '01') {
    firedSet = new Set();
  }
}

function fireAlarm(alarm) {
  playBeep();
  overlayLabel.textContent = alarm.label || 'Alarm!';
  overlayTime.textContent = alarm.time;
  overlay.classList.remove('hidden');

  const item = document.getElementById('item-' + alarm.id);
  if (item) item.classList.add('firing');
}

document.getElementById('dismiss-btn').addEventListener('click', () => {
  overlay.classList.add('hidden');
  document.querySelectorAll('.alarm-item.firing').forEach(el => el.classList.remove('firing'));
});

document.getElementById('add-btn').addEventListener('click', addAlarm);
document.getElementById('alarm-time').addEventListener('keydown', e => {
  if (e.key === 'Enter') addAlarm();
});
document.getElementById('alarm-label').addEventListener('keydown', e => {
  if (e.key === 'Enter') addAlarm();
});

function addAlarm() {
  const timeInput  = document.getElementById('alarm-time');
  const labelInput = document.getElementById('alarm-label');
  const time  = timeInput.value;
  const label = labelInput.value.trim();

  if (!time) {
    timeInput.focus();
    return;
  }

  const alarm = {
    id: Date.now(),
    time,
    label: label || '',
    active: true,
  };

  alarms.push(alarm);
  saveAlarms();
  renderAlarm(alarm);
  updateCount();

  timeInput.value = '';
  labelInput.value = '';
  timeInput.focus();
}

function renderAlarm(alarm) {
  emptyMsg.style.display = 'none';

  const li = document.createElement('li');
  li.className = 'alarm-item' + (alarm.active ? ' active' : '');
  li.id = 'item-' + alarm.id;

  li.innerHTML = `
    <input class="alarm-toggle" type="checkbox" ${alarm.active ? 'checked' : ''} title="Enable/Disable" />
    <div class="alarm-info">
      <div class="alarm-time-text">${alarm.time}</div>
      ${alarm.label ? `<div class="alarm-label-text">${escapeHtml(alarm.label)}</div>` : ''}
    </div>
    <button class="delete-btn" title="Delete">✕</button>
  `;

  li.querySelector('.alarm-toggle').addEventListener('change', e => {
    alarm.active = e.target.checked;
    li.classList.toggle('active', alarm.active);
    saveAlarms();
  });

  li.querySelector('.delete-btn').addEventListener('click', () => {
    alarms = alarms.filter(a => a.id !== alarm.id);
    li.remove();
    saveAlarms();
    updateCount();
    if (alarms.length === 0) emptyMsg.style.display = '';
  });

  alarmList.appendChild(li);
}

function updateCount() {
  countEl.textContent = alarms.length;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function saveAlarms() {
  localStorage.setItem('alarms', JSON.stringify(alarms));
}

function loadAlarms() {
  try {
    return JSON.parse(localStorage.getItem('alarms')) || [];
  } catch (_) {
    return [];
  }
}

function init() {
  alarms.forEach(renderAlarm);
  updateCount();
  if (alarms.length === 0) emptyMsg.style.display = '';
  else emptyMsg.style.display = 'none';
  tick();
  setInterval(tick, 1000);
}

init();
