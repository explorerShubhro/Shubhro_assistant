'use strict';
const $ = (id) => document.getElementById(id);
const ls = { g: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, s: (k, v) => localStorage.setItem(k, JSON.stringify(v)) };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fmt = (t) => t.split('```').map((p, i) => i % 2
  ? '<pre><code>' + esc(p.replace(/^[^\n]*\n/, '')) + '</code></pre>'
  : esc(p).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')).join('');

/* ---------- state ---------- */
const PRESETS = {
  anthropic: ['Anthropic (Claude)', ''],
  openai: ['OpenAI', 'https://api.openai.com/v1'],
  gemini: ['Google Gemini', 'https://generativelanguage.googleapis.com/v1beta/openai'],
  groq: ['Groq', 'https://api.groq.com/openai/v1'],
  openrouter: ['OpenRouter', 'https://openrouter.ai/api/v1'],
  custom: ['Custom (OpenAI-style)', ''],
};
let cfg = { provider: 'anthropic', base: '', model: 'claude-sonnet-5', key: '', web: true, lang: 'en-IN', ...ls.g('cfg', {}) };
let notes = ls.g('notes', []), todos = ls.g('todos', []), hist = ls.g('hist', []);
let ctrl = null;
const save = () => { ls.s('cfg', cfg); ls.s('notes', notes); ls.s('todos', todos); ls.s('hist', hist.slice(-80)); };

const HELP = `Works offline, instantly:
• 12*(3+4)^2  or  calc sqrt(2)   (trig in radians, % is remainder)
• convert 5 km to mi  /  100 c to f
• note: idea  ·  notes
• todo: buy chalk  ·  tasks  ·  done 1
• timer 10 min  ·  remind me in 5 min to call
• time  ·  clear

Everything else goes to the AI when you're online.`;

/* ---------- chat rendering ---------- */
function bubble(m) {
  document.querySelector('.empty')?.remove();
  const d = document.createElement('div');
  if (m.role === 'user') { d.className = 'm u'; d.textContent = m.content; }
  else { d.className = 'm a'; d.innerHTML = '<div class="t">' + fmt(m.content) + '</div><div class="s ' + (m.local ? 'dev' : 'net') + '">' + esc(m.src || '') + '</div>'; }
  $('log').appendChild(d); $('log').scrollTop = 1e9;
  return d;
}
function say(text) { const m = { role: 'assistant', content: text, local: true, src: 'on device' }; hist.push(m); bubble(m); save(); }
function showEmpty() { if (!hist.length) $('log').innerHTML = '<p class="empty">Ask anything. Notes, tasks, timers and maths work without internet. Type <b>help</b> to see all commands.</p>'; }

/* ---------- lists ---------- */
const li = (k, i, t, d) => `<li class="${d ? 'done' : ''}">${k === 't' ? `<button data-k="t" data-i="${i}" data-a="t" aria-label="Toggle done">${d ? '✓' : ''}</button>` : ''}<span>${esc(t)}</span><button data-k="${k}" data-i="${i}" data-a="x" aria-label="Delete">×</button></li>`;
function renderLists() {
  $('tl').innerHTML = todos.map((x, i) => li('t', i, x.t, x.d)).join('') || '<li class="none">No tasks yet</li>';
  $('nl').innerHTML = notes.map((t, i) => li('n', i, t)).join('') || '<li class="none">No notes yet</li>';
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const i = +b.dataset.i;
  if (b.dataset.a === 'x') (b.dataset.k === 't' ? todos : notes).splice(i, 1); else todos[i].d = !todos[i].d;
  save(); renderLists();
});
const numbered = (a) => a.length ? a.map((x, i) => `${i + 1}. ${x.t ?? x}${x.d ? ' (done)' : ''}`).join('\n') : 'Nothing yet.';

/* ---------- timers ---------- */
async function ping(msg) {
  navigator.vibrate?.([250, 120, 250]);
  try {
    if (window.Notification && Notification.permission === 'granted') {
      const r = await navigator.serviceWorker.ready;
      r.showNotification('Pocket Assistant', { body: msg, tag: 't' + Date.now() });
    }
  } catch { /* notifications are optional */ }
}
function timer(n, unit, label) {
  const s = /^h/i.test(unit) ? 3600 : /^m/i.test(unit) ? 60 : /^s/i.test(unit) ? 1 : 0;
  if (!s || !(n > 0) || n * s > 86400) return null;
  window.Notification?.requestPermission?.();
  setTimeout(() => { const t = label ? 'Time is up: ' + label : 'Timer finished'; say(t); ping(t); }, n * s * 1000);
  return `Timer set for ${n} ${unit}${label ? ' (' + label + ')' : ''}. Keep this app open until it rings.`;
}

/* ---------- offline command router: returns a reply string, or null to pass to the AI ---------- */
function local(t) {
  let m;
  if (/^(help|\?|what can you do\??)$/i.test(t)) return HELP;
  if (/^(time|date|what(?:'s| is) the (?:time|date)|what time is it\??)$/i.test(t)) return new Date().toLocaleString([], { dateStyle: 'full', timeStyle: 'short' });

  const ex = (t.match(/^(?:calc(?:ulate)?|=)\s*(.+)$/i) || [])[1] || (/^[\d\s+\-*/%^().×÷]+$/.test(t) && /\d\s*[-+*/%^×÷]\s*[\d(]/.test(t) ? t : '');
  if (ex) { const r = calc(ex); if (r !== null) return ex.trim() + ' = ' + r; }

  if ((m = t.match(/^(?:convert\s+)?(-?\d*\.?\d+)\s*([a-z°/]+)\s+(?:to|in|into)\s+([a-z°/]+)$/i))) { const r = convert(+m[1], m[2], m[3]); if (r !== null) return r; }

  if (/^(?:notes|show notes)$/i.test(t)) return numbered(notes);
  if ((m = t.match(/^note[:\s]+(.+)$/i))) { notes.push(m[1]); save(); renderLists(); return 'Saved as note ' + notes.length + '.'; }
  if (/^(?:tasks|todos|task list|todo list|show tasks)$/i.test(t)) return numbered(todos);
  if ((m = t.match(/^(?:todo|task|add task|add todo)[:\s]+(.+)$/i))) { todos.push({ t: m[1], d: false }); save(); renderLists(); return 'Added task ' + todos.length + '.'; }
  if ((m = t.match(/^done (\d+)$/i))) { const x = todos[m[1] - 1]; if (!x) return 'No task ' + m[1] + '.'; x.d = !x.d; save(); renderLists(); return `Task ${m[1]} marked ${x.d ? 'done' : 'not done'}.`; }
  if ((m = t.match(/^(?:delete|remove) (note|task|todo) (\d+)$/i))) {
    const a = /^n/i.test(m[1]) ? notes : todos;
    if (!a[m[2] - 1]) return 'No item ' + m[2] + '.';
    a.splice(m[2] - 1, 1); save(); renderLists(); return 'Deleted.';
  }

  if ((m = t.match(/^(?:set\s+)?(?:a\s+)?timer(?:\s+for)?\s+(\d+(?:\.\d+)?)\s*([a-z]+)\s*(.*)$/i)) || (m = t.match(/^remind me in\s+(\d+(?:\.\d+)?)\s*([a-z]+)\s+(?:to\s+)?(.+)$/i))) {
    const r = timer(+m[1], m[2], m[3].trim()); if (r) return r;
  }
  return null;
}

/* ---------- online AI (streamed) ---------- */
async function stream(m, el) {
  const msgs = hist.filter((h) => !h.local).slice(-24).map(({ role, content }) => ({ role, content }));
  while (msgs[0] && msgs[0].role !== 'user') msgs.shift();
  const sys = `You are Pocket Assistant on the user's phone. Today is ${new Date().toDateString()}. Be accurate and concise, and say so when you are unsure. The app itself handles notes, tasks, timers, calculations and unit conversion.`;
  const an = cfg.provider === 'anthropic';
  const url = an ? 'https://api.anthropic.com/v1/messages' : cfg.base.replace(/\/$/, '') + '/chat/completions';
  const headers = an
    ? { 'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
    : { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.key };
  const body = an
    ? { model: cfg.model, max_tokens: 2048, stream: true, system: sys, messages: msgs, ...(cfg.web ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }] } : {}) }
    : { model: cfg.model, stream: true, messages: [{ role: 'system', content: sys }, ...msgs] };
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
  if (!r.ok) {
    let e = ''; try { const j = await r.json(); e = j.error?.message || JSON.stringify(j.error || j); } catch { /* no body */ }
    throw new Error(e || 'Request failed (' + r.status + ')');
  }
  const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop();
    for (const l of lines) {
      if (!l.startsWith('data:')) continue;
      const d = l.slice(5).trim(); if (!d || d === '[DONE]') continue;
      let j; try { j = JSON.parse(d); } catch { continue; }
      if (j.error) throw new Error(j.error.message || 'Provider error');
      if (an && j.type === 'content_block_start' && j.content_block?.type === 'text' && m.content) m.content += '\n\n';
      const tx = an ? (j.type === 'content_block_delta' && j.delta?.type === 'text_delta' ? j.delta.text : '') : (j.choices?.[0]?.delta?.content || '');
      if (tx) { m.content += tx; el.querySelector('.t').innerHTML = fmt(m.content); $('log').scrollTop = 1e9; }
    }
  }
}

async function send() {
  if (ctrl) { ctrl.abort(); return; }
  const t = $('in').value.trim(); if (!t) return;
  $('in').value = ''; grow();
  if (/^clear( chat)?$/i.test(t)) { clearChat(); return; }
  const loc = local(t);
  hist.push({ role: 'user', content: t, local: loc !== null }); bubble(hist.at(-1));
  if (loc !== null) { say(loc); return; }
  if (!navigator.onLine) { say("You're offline, so only on-device jobs work right now. Type help to see them."); return; }
  const an = cfg.provider === 'anthropic';
  if (!cfg.key || !cfg.model || (!an && !cfg.base)) { say('To use the AI, add your provider, model and API key in Setup.'); return; }

  const m = { role: 'assistant', content: '', src: cfg.model + (an && cfg.web ? ' + web search' : '') };
  const el = bubble(m); ctrl = new AbortController(); $('send').textContent = 'Stop';
  try { await stream(m, el); }
  catch (e) {
    if (e.name !== 'AbortError') { const p = document.createElement('div'); p.className = 'err'; p.textContent = e.message || 'Could not reach the AI.'; $('log').appendChild(p); }
  }
  if (m.content) hist.push(m); else el.remove();
  ctrl = null; $('send').textContent = 'Send'; save();
}
function clearChat() { hist = []; $('log').innerHTML = ''; save(); showEmpty(); }

/* ---------- input, voice, tabs, settings ---------- */
function grow() { const i = $('in'); i.style.height = 'auto'; i.style.height = Math.min(i.scrollHeight, 140) + 'px'; }
$('in').addEventListener('input', grow);
$('in').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && innerWidth > 720) { e.preventDefault(); send(); } });
$('send').onclick = send;
$('clr').onclick = () => { if (confirm('Clear all chat history on this device?')) clearChat(); };

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SR) $('mic').hidden = true;
else $('mic').onclick = () => {
  const r = new SR(); r.lang = cfg.lang;
  r.onresult = (e) => { $('in').value = e.results[0][0].transcript; grow(); $('in').focus(); };
  r.onerror = () => say('Voice input needs an internet connection and microphone permission.');
  r.start();
};

document.querySelectorAll('nav button').forEach((b) => b.onclick = () => {
  document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('section').forEach((s) => s.hidden = s.id !== 'v-' + b.dataset.v);
});

$('prov').innerHTML = Object.entries(PRESETS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('');
function syncSet() {
  const an = cfg.provider === 'anthropic';
  $('prov').value = cfg.provider; $('base').value = cfg.base; $('model').value = cfg.model; $('key').value = cfg.key;
  $('web').checked = cfg.web; $('lang').value = cfg.lang;
  $('rb').hidden = an; $('rw').hidden = !an;
}
$('prov').onchange = (e) => { cfg.provider = e.target.value; cfg.base = PRESETS[cfg.provider][1]; cfg.model = cfg.provider === 'anthropic' ? 'claude-sonnet-5' : ''; save(); syncSet(); };
['base', 'model', 'key', 'lang'].forEach((k) => $(k).oninput = (e) => { cfg[k] = e.target.value.trim(); save(); });
$('web').onchange = (e) => { cfg.web = e.target.checked; save(); };

$('tf').onsubmit = (e) => { e.preventDefault(); const v = $('ti').value.trim(); if (v) { todos.push({ t: v, d: false }); $('ti').value = ''; save(); renderLists(); } };
$('nf').onsubmit = (e) => { e.preventDefault(); const v = $('ni').value.trim(); if (v) { notes.push(v); $('ni').value = ''; save(); renderLists(); } };

function net() { const on = navigator.onLine; $('st').textContent = on ? 'Online' : 'Offline'; $('st').className = on ? 'net' : 'dev'; }
addEventListener('online', net); addEventListener('offline', net);

net(); syncSet(); renderLists(); hist.forEach(bubble); showEmpty();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
