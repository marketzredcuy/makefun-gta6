// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 view is scaled to fit the window and centred, the margin filled
// with the backdrop colour. A warm sun-soaked palette: grass, asphalt roads
// with dashed centrelines, sand and sea at the south edge, the marina water
// at the east, buildings with roofs and windows, trees, cars with shadows,
// and a HUD with money, health, wanted stars, the mission tracker and a
// minimap.

import { WORLD, ROADS, DISTRICTS, FONT, PALETTE, PLAYER, CAR } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const VIEW = { width: 1280, height: 720 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(canvas.clientWidth / VIEW.width, canvas.clientHeight / VIEW.height);
    canvas.width = Math.round(VIEW.width * scale * dpr);
    canvas.height = Math.round(VIEW.height * scale * dpr);
    return { scale: scale * dpr, ox: (canvas.width - VIEW.width * scale * dpr) / 2, oy: (canvas.height - VIEW.height * scale * dpr) / 2 };
  }

  function drawCity(state, view) {
    const { x0, y0, x1, y1 } = view;
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // The park: a darker green block.
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(948, 948, 504, 504);
    // The beach and the sea along the south edge.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(Math.max(x0, 0), 1650, Math.min(x1, WORLD.width), 150);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(Math.max(x0, 0), 1740, Math.min(x1, WORLD.width), 60);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      const wy = 1752 + i * 16;
      for (let x = Math.max(x0, 0); x < Math.min(x1, WORLD.width); x += 60) {
        ctx.moveTo(x, wy + Math.sin((x + state.time * 40) / 90) * 3);
        ctx.lineTo(x + 30, wy + Math.sin((x + 30 + state.time * 40) / 90) * 3);
      }
      ctx.stroke();
    }
    // The marina water along the east edge, with its piers.
    ctx.fillStyle = PALETTE.seaDeep;
    ctx.fillRect(2250, Math.max(y0, 960), 150, Math.min(y1, 1680) - Math.max(y0, 960));
    ctx.fillStyle = '#8a6b45';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillRect(2250, 990 + i * 130, 90, 10);
    }
    // Sidewalks, then roads.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const x of ROADS.vertical) ctx.fillRect(x - ROADS.width / 2 - ROADS.sidewalk, y0, ROADS.width + ROADS.sidewalk * 2, y1 - y0);
    for (const y of ROADS.horizontal) ctx.fillRect(x0, y - ROADS.width / 2 - ROADS.sidewalk, x1 - x0, ROADS.width + ROADS.sidewalk * 2);
    ctx.fillStyle = PALETTE.road;
    for (const x of ROADS.vertical) ctx.fillRect(x - ROADS.width / 2, y0, ROADS.width, y1 - y0);
    for (const y of ROADS.horizontal) ctx.fillRect(x0, y - ROADS.width / 2, x1 - x0, ROADS.width);
    // Dashed centrelines.
    ctx.strokeStyle = PALETTE.roadLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    ctx.beginPath();
    for (const x of ROADS.vertical) {
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
    }
    for (const y of ROADS.horizontal) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Crosswalks at every intersection.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const x of ROADS.vertical) {
      for (const y of ROADS.horizontal) {
        for (let i = -3; i <= 3; i += 1) {
          if (i === 0) continue;
          ctx.fillRect(x + i * 12 - 4, y - ROADS.width / 2 + 6, 8, 14);
          ctx.fillRect(x + i * 12 - 4, y + ROADS.width / 2 - 20, 8, 14);
        }
      }
    }
    // District names, painted on the ground.
    ctx.fillStyle = 'rgba(20, 28, 20, 0.35)';
    ctx.font = '700 26px ' + FONT;
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      if (d.x + d.w / 2 < x0 - 100 || d.x + d.w / 2 > x1 + 100 || d.y + d.h / 2 < y0 - 60 || d.y + d.h / 2 > y1 + 60) continue;
      ctx.fillText(d.name.toUpperCase(), d.x + d.w / 2, d.y + d.h / 2);
    }
    // Buildings: body, roof edge, and a window grid.
    for (const b of state.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = PALETTE.buildingRoof;
      ctx.lineWidth = 4;
      ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      const cols = Math.max(2, Math.floor(b.w / 34));
      const rows = Math.max(2, Math.floor(b.h / 34));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          ctx.fillRect(b.x + 12 + cx * ((b.w - 24) / cols), b.y + 12 + cy * ((b.h - 24) / rows), 12, 9);
        }
      }
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.fillRect(b.x + b.w * 0.2, b.y + 8, b.w * 0.18, b.h - 16);
      }
    }
    // Trees and boats.
    for (const t of state.trees) {
      if (t.x < x0 - 30 || t.x > x1 + 30 || t.y < y0 - 30 || t.y > y1 + 30) continue;
      ctx.fillStyle = PALETTE.treeDark;
      ctx.beginPath();
      ctx.arc(t.x + 3, t.y + 4, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of state.boats) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.fillStyle = '#e8e8e8';
      roundRect(ctx, -26, -9, 52, 18, 8);
      ctx.fill();
      ctx.fillStyle = '#3d7dd9';
      ctx.fillRect(-8, -14, 16, 10);
      ctx.restore();
    }
  }

  function drawSkids(state) {
    ctx.strokeStyle = 'rgba(20,20,20,0.4)';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (const s of state.skids) {
      const dx = Math.cos(s.angle);
      const dy = Math.sin(s.angle);
      const px = -dy * 10;
      const py = dx * 10;
      ctx.globalAlpha = Math.min(1, s.life / 2);
      ctx.beginPath();
      ctx.moveTo(s.x - dx * 16 + px, s.y - dy * 16 + py);
      ctx.lineTo(s.x + dx * 16 + px, s.y + dy * 16 + py);
      ctx.moveTo(s.x - dx * 16 - px, s.y - dy * 16 - py);
      ctx.lineTo(s.x + dx * 16 - px, s.y + dy * 16 - py);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawCarShadow(x, y) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 4, y + 5, 30, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCar(car) {
    drawCarShadow(car.x, car.y);
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = car.color;
    roundRect(ctx, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,28,38,0.85)';
    roundRect(ctx, -8, -CAR.width / 2 + 4, 18, CAR.width - 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(CAR.length / 2 - 6, -CAR.width / 2 + 4, 3, 5);
    ctx.fillRect(CAR.length / 2 - 6, CAR.width / 2 - 9, 3, 5);
    if (car.kind === 'police') {
      const flash = Math.floor(performance.now() / 260) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#2f7bff';
      ctx.fillRect(-4, -CAR.width / 2 + 2, 8, 5);
      ctx.fillStyle = flash ? '#2f7bff' : '#ff3b30';
      ctx.fillRect(-4, CAR.width / 2 - 7, 8, 5);
      ctx.fillStyle = '#e8e8e8';
      ctx.font = '700 10px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 3);
    }
    ctx.restore();
  }

  function drawPedestrian(ped) {
    if (ped.down > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(ped.x + 2, ped.y + 3, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(state) {
    const p = state.player;
    if (!p.onFoot) return;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + 3, PLAYER.radius, PLAYER.radius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerShirt;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER.radius + 3, p.angle - 0.6, p.angle + 0.6);
    ctx.stroke();
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.min(1, pt.life * 2);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  /** The pulsing mission marker: a diamond and a ring over the target. */
  function drawMissionMarker(state) {
    const m = state.mission;
    if (!m) return;
    let target = null;
    if (m.def.type === 'deliver' && !m.pickedUp) target = m.def.pickup;
    else if (m.def.type === 'escape' && m.phase === 'survive') target = null;
    else target = m.def.target;
    if (!target) return;
    const pulse = 1 + Math.sin(state.time * 5) * 0.12;
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(12, 0);
    ctx.lineTo(0, 16);
    ctx.lineTo(-12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // A beacon line from the player toward the target, faint, so the goal is findable.
    ctx.strokeStyle = 'rgba(255,225,77,0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 18]);
    ctx.beginPath();
    ctx.moveTo(state.player.x, state.player.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawMinimap(state) {
    const mw = 230;
    const mh = 168;
    const mx = VIEW.width - mw - 16;
    const my = 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    ctx.fillStyle = '#5d8a48';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(mx, my + 1650 * sy, mw, mh - 1650 * sy);
    ctx.strokeStyle = '#3a3f47';
    ctx.lineWidth = 5;
    for (const x of ROADS.vertical) {
      ctx.beginPath();
      ctx.moveTo(mx + x * sx, my);
      ctx.lineTo(mx + x * sx, my + mh);
      ctx.stroke();
    }
    for (const y of ROADS.horizontal) {
      ctx.beginPath();
      ctx.moveTo(mx, my + y * sy);
      ctx.lineTo(mx + mw, my + y * sy);
      ctx.stroke();
    }
    const m = state.mission;
    if (m) {
      let target = null;
      if (m.def.type === 'deliver' && !m.pickedUp) target = m.def.pickup;
      else if (m.def.type === 'escape' && m.phase === 'survive') target = null;
      else target = m.def.target;
      if (target) {
        ctx.fillStyle = PALETTE.marker;
        ctx.beginPath();
        ctx.arc(mx + target.x * sx, my + target.y * sy, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const c of state.cars) {
      if (c.kind === 'police') ctx.fillStyle = '#ff3b30';
      else if (c.kind === 'player') ctx.fillStyle = '#ffffff';
      else ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.arc(mx + c.x * sx, my + c.y * sy, c.kind === 'police' ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.player.onFoot) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // The view rectangle.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    const vx = state.cam.x - VIEW.width / 2;
    const vy = state.cam.y - VIEW.height / 2;
    ctx.strokeRect(mx + vx * sx, my + vy * sy, VIEW.width * sx, VIEW.height * sy);
    ctx.restore();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '600 13px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR BAY', mx, my + mh + 20);
  }

  function drawHud(state, muted) {
    // Top-left panel: money, health, mission.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 16, 16, 400, 118, 10);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '700 28px ' + FONT;
    ctx.fillText('$' + state.player.money.toLocaleString('en-US'), 32, 50);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '600 15px ' + FONT;
    ctx.fillText('HEALTH', 32, 76);
    ctx.fillStyle = '#2a2f38';
    roundRect(ctx, 100, 64, 150, 14, 7);
    ctx.fill();
    ctx.fillStyle = state.player.health > 35 ? '#7fb069' : '#e5534b';
    roundRect(ctx, 100, 64, 150 * (state.player.health / 100), 14, 7);
    ctx.fill();
    const m = state.mission;
    if (m) {
      ctx.fillStyle = PALETTE.marker;
      ctx.font = '700 16px ' + FONT;
      ctx.fillText(m.def.name.toUpperCase(), 32, 106);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '400 13px ' + FONT;
      let sub = m.def.text;
      if (m.def.type === 'deliver' && m.pickedUp) sub = `Deliver it! ${Math.ceil(m.timer)}s left.`;
      if (m.def.type === 'escape' && m.phase === 'survive') sub = `Survive! ${Math.ceil(m.surviveLeft)}s left.`;
      ctx.fillText(sub.length > 58 ? sub.slice(0, 58) + '…' : sub, 32, 126);
    } else if (state.allDone) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = '700 16px ' + FONT;
      ctx.fillText('ALL MISSIONS COMPLETE', 32, 106);
    }
    // Wanted stars, top centre.
    ctx.textAlign = 'center';
    ctx.font = '700 30px ' + FONT;
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < state.wanted ? PALETTE.gold : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', 590 + i * 34, 52);
    }
    if (state.wanted > 0) {
      ctx.fillStyle = '#e5534b';
      ctx.font = '700 14px ' + FONT;
      ctx.fillText('WANTED', 640, 76);
    }
    drawMinimap(state);
    // Bottom hints and the message line.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '400 14px ' + FONT;
    const hint = state.player.onFoot ? 'WASD walk · E enter car · P pause · M sound' : 'WASD drive · Shift handbrake · E get out · P pause · M sound';
    ctx.fillText(hint, 16, VIEW.height - 16);
    if (muted) {
      ctx.textAlign = 'right';
      ctx.fillText('SOUND OFF (M)', VIEW.width - 16, VIEW.height - 16);
    }
    if (state.messageTimer > 0 && state.message) {
      ctx.textAlign = 'center';
      ctx.font = '600 19px ' + FONT;
      const w = ctx.measureText(state.message).width + 36;
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, (VIEW.width - w) / 2, 96, w, 40, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(state.message, VIEW.width / 2, 122);
    }
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(10, 16, 24, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '900 84px ' + FONT;
    ctx.fillText('SOLMAR BAY', VIEW.width / 2, 210);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '600 24px ' + FONT;
    ctx.fillText('An open-world crime story', VIEW.width / 2, 252);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '400 17px ' + FONT;
    ctx.fillText('Mara Voss has jobs. The city has cars. The police have opinions.', VIEW.width / 2, 292);
    ctx.fillText('Steal, drive, deliver — and stay out of the cells.', VIEW.width / 2, 318);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '600 18px ' + FONT;
    ctx.fillText('WASD move / drive · E enter & exit cars · Shift handbrake', VIEW.width / 2, 380);
    ctx.fillText('P pause · M sound · Complete all 3 missions for Mara Voss', VIEW.width / 2, 408);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '700 26px ' + FONT;
    ctx.fillText('PRESS SPACE OR CLICK TO START', VIEW.width / 2, 480);
    if (best && best.money > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '400 15px ' + FONT;
      ctx.fillText(`Last run: $${best.money} · ${best.missionsDone} of 3 missions done`, VIEW.width / 2, 520);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '400 13px ' + FONT;
    ctx.fillText('A wholly original city. No real place, no borrowed game.', VIEW.width / 2, 680);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(10, 16, 24, 0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = '900 56px ' + FONT;
    ctx.fillText('PAUSED', VIEW.width / 2, 350);
    ctx.font = '400 18px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Press P or Space to keep driving.', VIEW.width / 2, 390);
  }

  function drawOver(state) {
    ctx.fillStyle = 'rgba(20, 8, 8, 0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6b5e';
    ctx.font = '900 72px ' + FONT;
    ctx.fillText('BUSTED', VIEW.width / 2, 320);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '600 22px ' + FONT;
    ctx.fillText(`Solmar Bay PD caught up with you.`, VIEW.width / 2, 366);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '400 18px ' + FONT;
    ctx.fillText(`You earned $${state.player.money} and finished ${state.missionIndex} of 3 missions.`, VIEW.width / 2, 400);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '700 24px ' + FONT;
    ctx.fillText('PRESS SPACE TO TRY AGAIN', VIEW.width / 2, 470);
  }

  function draw(state, screen, best, muted) {
    const { scale, ox, oy } = fit();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#11141b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    const camX = state.cam.x - VIEW.width / 2 + (state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0);
    const camY = state.cam.y - VIEW.height / 2 + (state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0);
    const view = { x0: camX - 40, y0: camY - 40, x1: camX + VIEW.width + 40, y1: camY + VIEW.height + 40 };
    ctx.save();
    ctx.translate(-camX, -camY);
    drawCity(state, view);
    drawSkids(state);
    for (const c of state.cars) {
      if (c.kind === 'parked' || c.kind === 'traffic' || c.kind === 'police' || c.kind === 'player') {
        if (c.x < view.x0 - 80 || c.x > view.x1 + 80 || c.y < view.y0 - 80 || c.y > view.y1 + 80) continue;
        drawCar(c);
      }
    }
    for (const ped of state.peds) {
      if (ped.x < view.x0 - 40 || ped.x > view.x1 + 40 || ped.y < view.y0 - 40 || ped.y > view.y1 + 40) continue;
      drawPedestrian(ped);
    }
    drawPlayer(state);
    drawParticles(state);
    drawMissionMarker(state);
    ctx.restore();
    // Warm daylight over everything.
    ctx.fillStyle = 'rgba(255, 214, 130, 0.06)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, muted);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state);
  }

  return { draw };
}
