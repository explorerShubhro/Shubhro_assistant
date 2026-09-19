'use strict';
// Offline tools. Pure functions, no DOM, so they can be tested in Node.

// Safe calculator. Only numbers, + - * / % ^ ( ) and a fixed set of Math functions pass the whitelist.
// Trig functions use radians. % is the remainder operator.
function calc(s) {
  const x = s.toLowerCase().replace(/×/g, '*').replace(/÷/g, '/').replace(/\^/g, '**')
    .replace(/\bpi\b/g, 'Math.PI').replace(/\be\b/g, 'Math.E')
    .replace(/\b(sqrt|sin|cos|tan|log|ln|abs|exp)\(/g, (_, f) => 'Math.' + ({ log: 'log10', ln: 'log' }[f] || f) + '(');
  const rest = x.replace(/Math\.(PI|E|sqrt|sin|cos|tan|log10|log|abs|exp)/g, '');
  if (!/^[\d\s+\-*/%().,]*$/.test(rest)) return null;
  try {
    const r = Function('"use strict";return (' + x + ')')();
    return typeof r === 'number' && isFinite(r) ? +r.toPrecision(12) : null;
  } catch { return null; }
}

// Unit table: [factor to base unit, kind]. All factors are exact SI definitions.
const U = {
  m: [1, 'len'], km: [1000, 'len'], cm: [0.01, 'len'], mm: [0.001, 'len'],
  mi: [1609.344, 'len'], ft: [0.3048, 'len'], in: [0.0254, 'len'], yd: [0.9144, 'len'],
  kg: [1, 'mass'], g: [0.001, 'mass'], mg: [1e-6, 'mass'], lb: [0.45359237, 'mass'], oz: [0.028349523125, 'mass'],
  s: [1, 'time'], min: [60, 'time'], h: [3600, 'time'],
  l: [1, 'vol'], ml: [0.001, 'vol'], gal: [3.785411784, 'vol'],
  'm/s': [1, 'speed'], 'km/h': [1 / 3.6, 'speed'], mph: [0.44704, 'speed'],
};
const A = {
  miles: 'mi', mile: 'mi', kilometers: 'km', kilometres: 'km', kilometer: 'km', meters: 'm', metres: 'm', meter: 'm',
  feet: 'ft', foot: 'ft', inches: 'in', inch: 'in', pounds: 'lb', lbs: 'lb', ounces: 'oz', kgs: 'kg', grams: 'g',
  hours: 'h', hour: 'h', hr: 'h', hrs: 'h', minutes: 'min', mins: 'min', seconds: 's', sec: 's',
  litre: 'l', litres: 'l', liter: 'l', liters: 'l', gallons: 'gal', kmph: 'km/h', 'km/hr': 'km/h', kmh: 'km/h',
  celsius: 'c', fahrenheit: 'f', kelvin: 'k', '°c': 'c', '°f': 'f',
};
const nu = (u) => { u = u.toLowerCase(); return A[u] || u; };

// Returns a reply string, or null when the units are unknown (so the message can go to the AI instead).
function convert(v, a, b) {
  a = nu(a); b = nu(b);
  const out = (x) => `${v} ${a} = ${+x.toPrecision(7)} ${b}`;
  const T = { c: 1, f: 1, k: 1 };
  if (T[a] && T[b]) {
    const c = a === 'c' ? v : a === 'f' ? (v - 32) * 5 / 9 : v - 273.15;
    return out(b === 'c' ? c : b === 'f' ? c * 9 / 5 + 32 : c + 273.15);
  }
  if (!U[a] || !U[b]) return null;
  if (U[a][1] !== U[b][1]) return `Can't convert ${a} to ${b}: they measure different things.`;
  return out(v * U[a][0] / U[b][0]);
}

if (typeof module !== 'undefined') module.exports = { calc, convert };
