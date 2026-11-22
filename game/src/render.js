// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Lantern light pools glow warm over the dark floor, awning shadows stay dark —
// light shows where a guard sees you well, shadow shows where you can hide. Vision cones
// are drawn in the guard's colour: calm amber, suspicious yellow, alarm red.

import { FIELD, FONT, GUARD, LIVES, PALETTE } from './config.js';
import { ZONES } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Skor ');
  const timeLabel = cachedLabel('');
  const lootLabel = cachedLabel('');
  const finalLabel = cachedLabel('Skor ');
  const bestLabel = cachedLabel('Terbaik ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawFloor(zone) {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Cobble rows, alternating shade, so the floor reads as a market lane at a glance.
    context.fillStyle = PALETTE.floorAlt;
    for (let y = 0; y < FIELD.height; y += 60) {
      for (let x = (y / 60) % 2 === 0 ? 0 : 40; x < FIELD.width; x += 80) {
        context.fillRect(x, y, 76, 56);
      }
    }
    context.fillStyle = PALETTE.plank;
    context.fillRect(0, 0, FIELD.width, 10);
    context.fillRect(0, FIELD.height - 10, FIELD.width, 10);
    context.fillRect(0, 0, 10, FIELD.height);
    context.fillRect(FIELD.width - 10, 0, 10, FIELD.height);
    // Awning shadows: dark, safe. Lamplight: warm pools, dangerous.
    for (const shadow of zone.shadow) {
      context.fillStyle = PALETTE.shadow;
      context.fillRect(shadow.x, shadow.y, shadow.w, shadow.h);
      context.strokeStyle = PALETTE.shadowEdge;
      context.lineWidth = 2;
      context.setLineDash([8, 6]);
      context.strokeRect(shadow.x, shadow.y, shadow.w, shadow.h);
      context.setLineDash([]);
    }
    for (const lamp of zone.light) {
      const glow = context.createRadialGradient(lamp.x, lamp.y, 8, lamp.x, lamp.y, lamp.r);
      glow.addColorStop(0, 'rgba(255, 179, 71, 0.30)');
      glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(lamp.x, lamp.y, lamp.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.lantern;
      context.beginPath();
      context.arc(lamp.x, lamp.y, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#7a4a12';
      context.fillRect(lamp.x - 1, lamp.y - 14, 2, 8);
    }
  }

  function drawExit(state, zone) {
    const exit = zone.exit;
    const open = state.exitOpen;
    context.fillStyle = open ? PALETTE.exitOpen : PALETTE.exitClosed;
    context.fillRect(exit.x, exit.y, exit.w, exit.h);
    context.strokeStyle = open ? '#b6ffd0' : '#8a8078';
    context.lineWidth = 3;
    context.strokeRect(exit.x, exit.y, exit.w, exit.h);
    context.fillStyle = '#0d0a14';
    context.font = `bold 12px ${FONT}`;
    context.textAlign = 'center';
    context.fillText(open ? '✓ ' + exit.label : '✕ ' + exit.label, exit.x + exit.w / 2, exit.y + exit.h / 2 + 4);
  }

  function drawLoot(state) {
    for (const item of state.loot) {
      if (item.taken) continue;
      const bob = Math.sin((state.elapsed * 2 + item.x) / 3) * 2;
      if (item.kind === 'keris') {
        // The heirloom keris: a gold wavy blade, bigger and brighter than the rest.
        context.strokeStyle = PALETTE.lootKeris;
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(item.x - 16, item.y + 12 + bob);
        context.quadraticCurveTo(item.x - 4, item.y - 2 + bob, item.x, item.y - 14 + bob);
        context.quadraticCurveTo(item.x + 6, item.y - 2 + bob, item.x + 16, item.y + 12 + bob);
        context.stroke();
        context.fillStyle = '#8a6a42';
        context.fillRect(item.x - 3, item.y + 12 + bob, 6, 12);
        context.fillStyle = PALETTE.lootKeris;
        context.beginPath();
        context.arc(item.x, item.y - 18 + bob, 4, 0, Math.PI * 2);
        context.fill();
      } else if (item.kind === 'spice') {
        context.fillStyle = PALETTE.lootSpice;
        context.beginPath();
        context.arc(item.x, item.y + bob, 11, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#5e2f12';
        context.beginPath();
        context.arc(item.x, item.y - 4 + bob, 5, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillStyle = PALETTE.lootCoin;
        context.beginPath();
        context.arc(item.x, item.y + bob, 9, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#a67c1a';
        context.beginPath();
        context.arc(item.x, item.y + bob, 4, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawCover(zone) {
    for (const rect of zone.cover) {
      if (rect.kind === 'stall') {
        context.fillStyle = PALETTE.stall;
        context.fillRect(rect.x, rect.y, rect.w, rect.h);
        // Striped awning: the stall's roof, so cover reads at a glance.
        const roof = rect.roof ? PALETTE.stallRoof : PALETTE.stallRoofAlt;
        context.fillStyle = roof;
        context.fillRect(rect.x - 6, rect.y - 12, rect.w + 12, 16);
        context.fillStyle = 'rgba(255, 255, 255, 0.25)';
        for (let x = rect.x - 6; x < rect.x + rect.w + 12; x += 24) {
          context.fillRect(x, rect.y - 12, 12, 16);
        }
        context.fillStyle = '#3a2415';
        context.fillRect(rect.x + 12, rect.y + rect.h - 14, rect.w - 24, 8);
      } else {
        context.fillStyle = PALETTE.crate;
        context.fillRect(rect.x, rect.y, rect.w, rect.h);
        context.strokeStyle = PALETTE.crateEdge;
        context.lineWidth = 3;
        context.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
        context.beginPath();
        context.moveTo(rect.x + 2, rect.y + 2);
        context.lineTo(rect.x + rect.w - 2, rect.y + rect.h - 2);
        context.moveTo(rect.x + rect.w - 2, rect.y + 2);
        context.lineTo(rect.x + 2, rect.y + rect.h - 2);
        context.stroke();
      }
    }
  }

  function drawCones(state) {
    for (const guard of state.guards) {
      const color = state.alarm
        ? PALETTE.coneAlarm
        : guard.seesPlayer
          ? PALETTE.coneSuspect
          : PALETTE.coneCalm;
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.arc(guard.x, guard.y, GUARD.coneRange, guard.dir - GUARD.coneHalfAngle, guard.dir + GUARD.coneHalfAngle);
      context.closePath();
      context.fill();
      context.strokeStyle = color.replace(/[\d.]+\)$/, '0.6)');
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.arc(guard.x, guard.y, GUARD.coneRange, guard.dir - GUARD.coneHalfAngle, guard.dir + GUARD.coneHalfAngle);
      context.closePath();
      context.stroke();
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      // Body: a night watchman in a red sash and wide hat, visible against the floor.
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guardHat;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius + 3, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius - 3, 0, Math.PI * 2);
      context.fill();
      // Facing tick, so the patrol direction reads.
      context.strokeStyle = '#ffd9d4';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.dir) * (GUARD.radius + 7), guard.y + Math.sin(guard.dir) * (GUARD.radius + 7));
      context.stroke();
      if (guard.seesPlayer || state.alarm) {
        text('!', guard.x, guard.y - GUARD.radius - 8, 26, state.alarm ? PALETTE.danger : '#ffd640', 'center');
      } else if (state.suspicion > 40) {
        text('?', guard.x, guard.y - GUARD.radius - 8, 24, '#ffd640', 'center');
      }
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (!player) return;
    // The thief: a hooded figure in a teal cloak, small and quick.
    context.fillStyle = PALETTE.playerCloak;
    context.beginPath();
    context.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, PLAYER_RADIUS - 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#dffaff';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(player.x, player.y);
    context.lineTo(player.x + Math.cos(player.dir) * (PLAYER_RADIUS + 5), player.y + Math.sin(player.dir) * (PLAYER_RADIUS + 5));
    context.stroke();
    if (player.sneaking) {
      context.strokeStyle = 'rgba(87, 217, 119, 0.9)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(player.x, player.y, PLAYER_RADIUS + 4, 0, Math.PI * 2);
      context.stroke();
    }
  }

  // The player's radius, kept beside the draw code that uses it.
  const PLAYER_RADIUS = 11;

  function drawHud(state) {
    const zone = ZONES[state.zone];
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 16, 26, PALETTE.text, 'left');
    const minutes = Math.floor(state.elapsed / 60);
    const seconds = Math.floor(state.elapsed % 60);
    text(timeLabel(`${minutes}:${String(seconds).padStart(2, '0')}`), FIELD.width / 2 - 130, 16, 26, PALETTE.text, 'center');
    text(zone.name, FIELD.width / 2 + 130, 16, 22, PALETTE.muted, 'center');
    text(lootLabel(`Loot ${state.lootTaken}/${state.lootTotal}`), FIELD.width - 24, 16, 26, state.exitOpen ? PALETTE.safe : PALETTE.text, 'right');
    // Lives as hearts, bottom left.
    for (let life = 0; life < LIVES; life += 1) {
      context.fillStyle = life < state.lives ? PALETTE.danger : '#3a2f52';
      const x = 30 + life * 30;
      const y = FIELD.height - 34;
      context.beginPath();
      context.arc(x, y, 8, 0, Math.PI * 2);
      context.fill();
    }
    // The suspicion eye: fills amber, then red, as the guards' doubt grows.
    const meterX = 24;
    const meterY = 56;
    const meterW = 190;
    const meterH = 16;
    context.fillStyle = '#241a33';
    context.fillRect(meterX, meterY, meterW, meterH);
    const fill = state.suspicion / 100;
    context.fillStyle = state.alarm ? PALETTE.danger : fill > 0.6 ? '#ffb347' : '#ffd640';
    context.fillRect(meterX, meterY, meterW * fill, meterH);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(meterX, meterY, meterW, meterH);
    text(state.alarm ? 'ALARM!' : 'Curiga', meterX, meterY + 22, 18, state.alarm ? PALETTE.danger : PALETTE.muted, 'left');
    if (state.alarm) {
      text('Pintu keluar terkunci — hilang dari pandangan!', FIELD.width / 2, 52, 22, PALETTE.danger, 'center');
    } else if (state.exitOpen) {
      text('Semua takings didapat — ke ' + zone.exit.label + '!', FIELD.width / 2, 52, 22, PALETTE.safe, 'center');
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 3;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 72, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 23, PALETTE.lootCoin, 'center');
  }

  const TITLE_LINES = [
    'Keris pusaka keluarga Sari dicuri dan dijual lewat pasar malam.',
    'Selinap lewat tiga zona, ambil kembali takings dan kerisnya,',
    'dan kabur dengan perahu — tanpa terlihat.',
    '',
    'WASD / panah: bergerak · Shift: menyelinap · E: ambil loot',
    'Klik: jalan ke titik itu · P: jeda · Lampu = bahaya, bayangan = aman',
  ];
  const PAUSED_LINES = ['Para penjaga menunggumu.'];
  const ZONE_LINES = ['', ''];

  /** Paint one frame: the floor, then the game, then the HUD or a panel. */
  function draw(state, screen, best) {
    const zone = ZONES[state.zone];
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(zone);
    drawExit(state, zone);
    drawLoot(state);
    drawCover(zone);
    drawCones(state);
    drawGuards(state);
    drawPlayer(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[3] = best > 0 ? bestLabel(best) : '';
      drawPanel('PASAR SENJA', TITLE_LINES, 'Tekan Spasi atau klik untuk mulai');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Jeda', PAUSED_LINES, 'Tekan P untuk lanjut');
    } else if (screen === SCREEN_OVER) {
      const over = [finalLabel(state.score), bestLabel(best), ''];
      drawPanel('Ketangkap!', over, 'Tekan Spasi atau klik untuk coba lagi');
    } else if (screen === SCREEN_WIN) {
      const win = [
        'Keris pusaka kembali ke keluarga Sari.',
        finalLabel(state.score),
        bestLabel(best),
      ];
      drawPanel('KABUR!', win, 'Tekan Spasi atau klik untuk main lagi');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
