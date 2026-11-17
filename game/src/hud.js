// The HUD: the DOM overlay and the minimap. Health and armour bars, cash,
// wanted stars, clock, speed, mission text and a live top-down minimap
// drawn on a small canvas — roads, blocks, the player arrow, police blips,
// traffic dots and the yellow mission marker. Pure DOM and 2D canvas, so
// it reads crisply at any window size.
import { CITY_SIZE } from './config.js';

export function createHud(document) {
  const root = document.getElementById('hud');
  const minimap = document.getElementById('minimap');
  const mapCtx = minimap.getContext('2d');
  const els = {
    healthFill: document.getElementById('health-fill'),
    armorFill: document.getElementById('armor-fill'),
    cash: document.getElementById('cash'),
    stars: document.getElementById('stars'),
    clock: document.getElementById('clock'),
    speed: document.getElementById('speed'),
    objective: document.getElementById('objective'),
    banner: document.getElementById('banner'),
    hint: document.getElementById('hint'),
    screen: document.getElementById('screen'),
    title: document.getElementById('screen-title'),
    lines: document.getElementById('screen-lines'),
    prompt: document.getElementById('screen-prompt'),
  };

  function drawMinimap(state) {
    const size = minimap.width;
    const scale = size / (CITY_SIZE + 160);
    mapCtx.fillStyle = '#10141a';
    mapCtx.fillRect(0, 0, size, size);
    const toMap = (x, z) => [(x + CITY_SIZE / 2 + 80) * scale, (z + CITY_SIZE / 2 + 80) * scale];
    // Ocean to the south.
    mapCtx.fillStyle = '#1e6f9e';
    const [ox, oy] = toMap(-CITY_SIZE / 2 - 80, CITY_SIZE / 2);
    mapCtx.fillRect(0, oy, size, size - oy);
    // Blocks.
    mapCtx.fillStyle = '#5a5f6a';
    for (const c of state.colliders) {
      const [x, y] = toMap(c.x - c.hw, c.z - c.hd);
      mapCtx.fillRect(x, y, c.hw * 2 * scale, c.hd * 2 * scale);
    }
    // Roads.
    mapCtx.strokeStyle = '#2b2b30';
    mapCtx.lineWidth = 3;
    for (const c of state.roadCenters) {
      const [x1] = toMap(c, -CITY_SIZE / 2);
      const [, y1] = toMap(-CITY_SIZE / 2, c);
      mapCtx.beginPath();
      mapCtx.moveTo(x1, 0);
      mapCtx.lineTo(x1, size);
      mapCtx.stroke();
      mapCtx.beginPath();
      mapCtx.moveTo(0, y1);
      mapCtx.lineTo(size, y1);
      mapCtx.stroke();
    }
    // Mission marker.
    if (state.target) {
      const [x, y] = toMap(state.target.x, state.target.z);
      mapCtx.fillStyle = '#ffd23a';
      mapCtx.beginPath();
      mapCtx.arc(x, y, 6, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.strokeStyle = '#ffd23a';
      mapCtx.lineWidth = 2;
      mapCtx.beginPath();
      mapCtx.arc(x, y, 10 + Math.sin(state.time * 4) * 2, 0, Math.PI * 2);
      mapCtx.stroke();
    }
    // Traffic dots.
    mapCtx.fillStyle = '#cfd6dd';
    for (const car of state.traffic) {
      const [x, y] = toMap(car.mesh.position.x, car.mesh.position.z);
      mapCtx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Police blips.
    mapCtx.fillStyle = '#ff3b30';
    for (const cop of state.policeCars) {
      const [x, y] = toMap(cop.x, cop.z);
      mapCtx.beginPath();
      mapCtx.arc(x, y, 3.5, 0, Math.PI * 2);
      mapCtx.fill();
    }
    for (const cop of state.policeFoot) {
      const [x, y] = toMap(cop.x, cop.z);
      mapCtx.beginPath();
      mapCtx.arc(x, y, 2.5, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // Player arrow.
    const [px, py] = toMap(state.playerX, state.playerZ);
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(-state.heading);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 5);
    mapCtx.lineTo(-5, 5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  function update(state) {
    els.healthFill.style.width = `${Math.max(0, Math.min(100, state.health))}%`;
    els.armorFill.style.width = `${Math.max(0, Math.min(100, state.armor))}%`;
    els.cash.textContent = `$${state.cash.toLocaleString('en-US')}`;
    els.stars.innerHTML = '';
    for (let i = 0; i < 5; i += 1) {
      const span = document.createElement('span');
      span.textContent = i < state.stars ? '★' : '☆';
      span.style.color = i < state.stars ? '#ffd23a' : '#8b93a3';
      els.stars.appendChild(span);
    }
    const hours = Math.floor(state.clockMinutes / 60) % 24;
    const minutes = Math.floor(state.clockMinutes % 60);
    els.clock.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    els.speed.textContent = state.inCar ? `${Math.round(Math.abs(state.speed) * 3.6)} km/h` : '';
    els.objective.textContent = state.objective || '';
    els.banner.textContent = state.banner || '';
    els.banner.style.opacity = state.banner ? '1' : '0';
    els.hint.textContent = state.hint || '';
    drawMinimap(state);
  }

  function showScreen(title, lines, prompt) {
    els.title.textContent = title;
    els.lines.innerHTML = '';
    for (const line of lines) {
      const p = document.createElement('p');
      p.textContent = line;
      els.lines.appendChild(p);
    }
    els.prompt.textContent = prompt;
    els.screen.style.display = 'flex';
  }

  function hideScreen() {
    els.screen.style.display = 'none';
  }

  return { update, showScreen, hideScreen, root };
}
