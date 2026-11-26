// Draws a SHUSH certificate on a canvas. Layout follows the supplied reference (framed border, swooping
// corner bands, title, ribbon, name in script, short text, two signature lines, seal) in the SHUSH palette.
// Everything is drawn with canvas calls, so the PNG download and the print copy are exactly what is previewed.

import { LOGO_PATHS } from './logoPaths.js';

export const CERT_W = 1754;
export const CERT_H = 1240; // A4 landscape ratio

const C = {
  orange: '#F25F13',
  orange600: '#CF470C',
  orange700: '#A63A06',
  deep: '#7A2A04',
  amber: '#F7B547',
  gold: '#F8DE8C',
  goldSoft: '#FCEBB5',
  cream: '#FFF7E8',
  creamDeep: '#FDEBCB',
  ink: '#2A1A12',
  inkSoft: '#6B4A3A',
};

const SERIF = '"Playfair Display", Georgia, "Times New Roman", serif';
const SCRIPT = '"Great Vibes", "Brush Script MT", cursive';
const SANS = 'Inter, system-ui, "Segoe UI", Arial, sans-serif';
const LIBRARY_OFFSET_MS = 8 * 60 * 60 * 1000; // library time is UTC+8
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const CATEGORY_LABEL = {
  frequent: 'Most Frequent Visitor',
  quietest: 'Quietest Visitor',
};

export function libraryDate(value) {
  const d = new Date(new Date(value).getTime() + LIBRARY_OFFSET_MS);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function periodLabel(period) {
  if (!period?.startedAt) return '';
  const from = libraryDate(period.startedAt);
  // The period ends at the instant the next one starts, so show the day before when it ends at midnight.
  const to = period.endedAt ? libraryDate(new Date(period.endedAt).getTime() - 1000) : '';
  return to && to !== from ? `${from} to ${to}` : from;
}

export function certificateText(cert) {
  const range = periodLabel(cert.period);
  const when = range ? ` from ${range}` : '';
  if (cert.category === 'quietest') {
    return `For keeping the quietest table in the SHUSH library${when}, with an average noise level of ${cert.value} across study sessions of 30 minutes or more. Thank you for helping everyone focus.`;
  }
  return `For being the most frequent visitor of the SHUSH library${when}, with ${cert.value} visit${Number(cert.value) === 1 ? '' : 's'}. Thank you for making the library a place to read, study and be quiet together.`;
}

let fontsPromise = null;
/** Loads the certificate fonts once. Falls back to system fonts if they cannot load (offline). */
export function loadCertificateFonts() {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      if (!document.fonts?.load) return;
      try {
        await Promise.all([
          document.fonts.load(`700 60px "Playfair Display"`),
          document.fonts.load(`400 60px "Great Vibes"`),
          document.fonts.load(`600 24px Inter`),
          document.fonts.load(`400 24px Inter`),
        ]);
      } catch {
        /* system fonts are used instead */
      }
    })();
  }
  return fontsPromise;
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function spaced(ctx, text, x, y, spacing) {
  // Letter-spaced centered text (canvas letterSpacing is not in every browser).
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(text, x + spacing / 2, y);
    ctx.letterSpacing = '0px';
    return;
  }
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let cx = x - total / 2;
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i];
  });
  ctx.textAlign = align;
}

function star(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
}

function drawLogo(ctx, x, y, size, color) {
  const scale = size / 100;
  ctx.save();
  ctx.translate(x, y + 14.17 * scale);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  for (const d of LOGO_PATHS) ctx.fill(new Path2D(d));
  ctx.restore();
}

function drawBackground(ctx) {
  const W = CERT_W;
  const H = CERT_H;

  // Outer frame
  const frame = ctx.createLinearGradient(0, 0, W, H);
  frame.addColorStop(0, C.deep);
  frame.addColorStop(0.5, C.orange700);
  frame.addColorStop(1, C.deep);
  ctx.fillStyle = frame;
  ctx.fillRect(0, 0, W, H);

  // Cream sheet
  const m = 46;
  const sheet = ctx.createRadialGradient(W / 2, H * 0.4, 100, W / 2, H * 0.45, W * 0.7);
  sheet.addColorStop(0, '#FFFFFF');
  sheet.addColorStop(0.6, C.cream);
  sheet.addColorStop(1, C.creamDeep);
  ctx.fillStyle = sheet;
  ctx.fillRect(m, m, W - 2 * m, H - 2 * m);

  // Top swoosh (deep orange band with gold edge), centered dip behind the title
  const band = (fill, inset, lift) => {
    ctx.beginPath();
    ctx.moveTo(m, m);
    ctx.lineTo(W - m, m);
    ctx.lineTo(W - m, 230 - lift);
    ctx.bezierCurveTo(W - 220, 330 - lift, W - 420 + inset, 120 - lift, W - 560 + inset, 190 + inset * 0.4 - lift);
    ctx.bezierCurveTo(W / 2 + 160, 300 + inset - lift, W / 2 - 160, 300 + inset - lift, 560 - inset, 190 + inset * 0.4 - lift);
    ctx.bezierCurveTo(420 - inset, 120 - lift, 220, 330 - lift, m, 230 - lift);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  band(C.amber, 0, -14);
  const topGrad = ctx.createLinearGradient(0, 0, W, 0);
  topGrad.addColorStop(0, C.deep);
  topGrad.addColorStop(0.5, C.orange600);
  topGrad.addColorStop(1, C.deep);
  band(topGrad, 0, 0);

  // Bottom swoosh mirrored
  ctx.save();
  ctx.translate(0, H);
  ctx.scale(1, -1);
  band(C.amber, 0, -14);
  band(topGrad, 0, 0);
  ctx.restore();

  // Thin gold rules down each side, like the reference
  ctx.strokeStyle = C.amber;
  ctx.lineWidth = 3;
  for (const x of [m + 70, W - m - 70]) {
    ctx.beginPath();
    ctx.moveTo(x, 300);
    ctx.lineTo(x, H - 300);
    ctx.stroke();
  }
  ctx.lineWidth = 1.5;
  for (const x of [m + 82, W - m - 82]) {
    ctx.beginPath();
    ctx.moveTo(x, 300);
    ctx.lineTo(x, H - 300);
    ctx.stroke();
  }
}

function drawSeal(ctx, cx, cy) {
  // Scalloped rosette
  ctx.save();
  ctx.translate(cx, cy);
  // ribbon tails
  ctx.fillStyle = C.orange700;
  ctx.beginPath();
  ctx.moveTo(-46, 40); ctx.lineTo(-62, 150); ctx.lineTo(-38, 130); ctx.lineTo(-20, 150); ctx.lineTo(-14, 50); ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(46, 40); ctx.lineTo(62, 150); ctx.lineTo(38, 130); ctx.lineTo(20, 150); ctx.lineTo(14, 50); ctx.closePath();
  ctx.fill();

  const scallops = 28;
  ctx.beginPath();
  for (let i = 0; i < scallops * 2; i += 1) {
    const a = (i * Math.PI) / scallops;
    const r = i % 2 === 0 ? 92 : 82;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(-90, -90, 90, 90);
  g.addColorStop(0, C.gold);
  g.addColorStop(0.5, C.amber);
  g.addColorStop(1, C.orange);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.fillStyle = C.deep;
  ctx.beginPath();
  ctx.arc(0, 0, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.stroke();

  drawLogo(ctx, -22, -52, 44, C.gold);
  ctx.fillStyle = C.gold;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 17px ${SANS}`;
  spaced(ctx, 'SHUSH', 0, 12, 3);
  ctx.font = `600 11px ${SANS}`;
  spaced(ctx, 'BEST VISITOR', 0, 29, 2);
  for (let i = -1; i <= 1; i += 1) star(ctx, i * 17, 47, 7);
  ctx.restore();
}

/**
 * Draws certificate `cert` ({ category, name, value, issuedAt, period, number }) onto `canvas`.
 * The canvas is always CERT_W x CERT_H; CSS decides how large it appears.
 */
export async function drawCertificate(canvas, cert) {
  await loadCertificateFonts();
  canvas.width = CERT_W;
  canvas.height = CERT_H;
  const ctx = canvas.getContext('2d');
  const W = CERT_W;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';

  drawBackground(ctx);

  // Title
  ctx.fillStyle = C.goldSoft;
  ctx.font = `700 84px ${SERIF}`;
  spaced(ctx, 'CERTIFICATE', W / 2, 178, 6);

  // Ribbon with the award name
  const label = (CATEGORY_LABEL[cert.category] ?? 'Appreciation').toUpperCase();
  ctx.font = `700 34px ${SANS}`;
  const ribbonW = Math.max(520, ctx.measureText(label).width + 130);
  const ribbonH = 64;
  const rx = W / 2 - ribbonW / 2;
  const ry = 236;
  const rg = ctx.createLinearGradient(rx, 0, rx + ribbonW, 0);
  rg.addColorStop(0, C.amber);
  rg.addColorStop(0.5, C.gold);
  rg.addColorStop(1, C.amber);
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.roundRect(rx, ry, ribbonW, ribbonH, 32);
  ctx.fill();
  ctx.fillStyle = C.deep;
  spaced(ctx, `OF APPRECIATION`, W / 2, ry + 43, 5);
  // Award name under the ribbon
  ctx.fillStyle = C.orange600;
  ctx.font = `700 30px ${SANS}`;
  spaced(ctx, label, W / 2, ry + ribbonH + 62, 8);

  // Presented to
  ctx.fillStyle = C.ink;
  ctx.font = `600 28px ${SANS}`;
  spaced(ctx, 'PROUDLY PRESENTED TO', W / 2, 490, 5);

  // Name, shrunk to fit
  let size = 130;
  const maxName = 1120;
  ctx.font = `400 ${size}px ${SCRIPT}`;
  while (ctx.measureText(cert.name).width > maxName && size > 54) {
    size -= 4;
    ctx.font = `400 ${size}px ${SCRIPT}`;
  }
  ctx.fillStyle = C.deep;
  ctx.fillText(cert.name, W / 2, 625);
  const rule = ctx.createLinearGradient(W / 2 - 480, 0, W / 2 + 480, 0);
  rule.addColorStop(0, 'rgba(247,181,71,0)');
  rule.addColorStop(0.5, C.amber);
  rule.addColorStop(1, 'rgba(247,181,71,0)');
  ctx.strokeStyle = rule;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 480, 658);
  ctx.lineTo(W / 2 + 480, 658);
  ctx.stroke();

  // Body text
  ctx.fillStyle = C.inkSoft;
  ctx.font = `400 28px ${SANS}`;
  const lines = wrapLines(ctx, certificateText(cert), 1000);
  lines.forEach((line, i) => ctx.fillText(line, W / 2, 718 + i * 42));

  // Signature lines
  const sy = 925;
  ctx.strokeStyle = C.inkSoft;
  ctx.lineWidth = 1.5;
  for (const x of [W / 2 - 480, W / 2 + 160]) {
    ctx.beginPath();
    ctx.moveTo(x, sy);
    ctx.lineTo(x + 320, sy);
    ctx.stroke();
  }
  ctx.fillStyle = C.ink;
  ctx.font = `600 22px ${SANS}`;
  spaced(ctx, libraryDate(cert.issuedAt).toUpperCase(), W / 2 - 320, sy - 14, 1);
  spaced(ctx, 'SHUSH LIBRARY', W / 2 + 320, sy - 14, 2);
  ctx.fillStyle = C.inkSoft;
  ctx.font = `500 18px ${SANS}`;
  spaced(ctx, 'DATE ISSUED', W / 2 - 320, sy + 30, 3);
  spaced(ctx, 'LIBRARY FACULTY', W / 2 + 320, sy + 30, 1);

  drawSeal(ctx, W / 2, 1000);

  // Certificate number
  ctx.fillStyle = C.goldSoft;
  ctx.font = `500 18px ${SANS}`;
  spaced(ctx, cert.number ?? '', W / 2, CERT_H - 70, 3);
}

export function certificateFileName(cert) {
  const who = String(cert.name ?? 'student')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return `SHUSH-${cert.category === 'quietest' ? 'Quietest' : 'Frequent'}-Visitor-${who || 'certificate'}.png`;
}

/** PNG data URL (data URLs are allowed by the app's CSP; blob: images are not). */
export async function certificateDataUrl(cert) {
  const canvas = document.createElement('canvas');
  await drawCertificate(canvas, cert);
  return canvas.toDataURL('image/png');
}

export async function downloadCertificate(cert) {
  const url = await certificateDataUrl(cert);
  const a = document.createElement('a');
  a.href = url;
  a.download = certificateFileName(cert);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Prints through the browser dialog: a hidden #shush-print div holds the image; @media print shows only that. */
export async function printCertificate(cert) {
  const url = await certificateDataUrl(cert);
  let holder = document.getElementById('shush-print');
  if (!holder) {
    holder = document.createElement('div');
    holder.id = 'shush-print';
    document.body.appendChild(holder);
  }
  holder.innerHTML = '';
  const img = new Image();
  img.alt = `${CATEGORY_LABEL[cert.category] ?? 'Certificate'} for ${cert.name}`;
  img.src = url;
  holder.appendChild(img);
  if (img.decode) await img.decode().catch(() => {});
  const cleanup = () => {
    document.body.classList.remove('printing-certificate');
    holder.innerHTML = '';
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  document.body.classList.add('printing-certificate');
  window.print();
}
