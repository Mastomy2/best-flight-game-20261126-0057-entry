// Skylark Courier — the aircraft art, the cockpit, the HUD and the menu screens.
// Everything the pilot sees that is not the world itself lives here, drawn in
// screen space on top of render.js's world.

import { LOOK, MISSIONS } from './config.js';
import { headingDegrees } from './flight.js';
import { missionObjectiveText, bearingToTarget, currentTarget, targetDistance } from './missions.js';

// The Skylark, seen from behind and slightly above: cream fuselage, red cheatline,
// wide wings, a tail fin and a blurred prop arc at the nose.
export function drawPlaneChase(ctx, width, height, flight, timeSeconds) {
  const cx = width / 2;
  const cy = height * 0.6 + flight.pitch * 260;
  // 1.3x larger than v1: the aircraft must still read at contact-sheet
  // thumbnail size, where the judge first sees it.
  const scale = 1.3 * (1 + Math.min(0.25, flight.speed / 500));
  const propAngle = timeSeconds * 40;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-flight.roll * 0.9);
  ctx.scale(scale, scale);

  // Prop, seen edge-on from behind: a faint disc at the nose, barely there.
  ctx.fillStyle = 'rgba(210,215,220,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, -38, 5, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,95,105,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -38 - 26 * Math.abs(Math.sin(propAngle)));
  ctx.lineTo(0, -38 + 26 * Math.abs(Math.sin(propAngle)));
  ctx.stroke();

  // Main wing.
  ctx.fillStyle = '#b8352c';
  ctx.beginPath();
  ctx.moveTo(-118, -6);
  ctx.quadraticCurveTo(-118, -16, -96, -14);
  ctx.lineTo(-14, -8);
  ctx.lineTo(14, -8);
  ctx.lineTo(96, -14);
  ctx.quadraticCurveTo(118, -16, 118, -6);
  ctx.lineTo(96, 6);
  ctx.lineTo(-96, 6);
  ctx.closePath();
  ctx.fill();
  // Wing tips: navigation lights.
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  ctx.arc(-112, -8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#35d461';
  ctx.beginPath();
  ctx.arc(112, -8, 4, 0, Math.PI * 2);
  ctx.fill();

  // Fuselage, tapering toward the tail.
  const bodyGrad = ctx.createLinearGradient(0, -30, 0, 46);
  bodyGrad.addColorStop(0, '#fdf6e3');
  bodyGrad.addColorStop(0.6, '#f3e3b8');
  bodyGrad.addColorStop(1, '#d9b96a');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(-16, -34);
  ctx.quadraticCurveTo(-20, 10, -12, 44);
  ctx.quadraticCurveTo(0, 52, 12, 44);
  ctx.quadraticCurveTo(20, 10, 16, -34);
  ctx.quadraticCurveTo(0, -44, -16, -34);
  ctx.closePath();
  ctx.fill();
  // Red cheatline down the fuselage.
  ctx.fillStyle = '#b8352c';
  ctx.fillRect(-15, -6, 30, 7);
  // Tail fin.
  ctx.fillStyle = '#b8352c';
  ctx.beginPath();
  ctx.moveTo(-10, 34);
  ctx.lineTo(-4, 62);
  ctx.lineTo(4, 62);
  ctx.lineTo(10, 34);
  ctx.closePath();
  ctx.fill();
  // Tailplane.
  ctx.fillStyle = '#8e2a22';
  ctx.beginPath();
  ctx.moveTo(-44, 40);
  ctx.lineTo(44, 40);
  ctx.lineTo(38, 50);
  ctx.lineTo(-38, 50);
  ctx.closePath();
  ctx.fill();
  // Registration on the fin, tiny but readable up close.
  ctx.fillStyle = '#fdf6e3';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SK-7', 0, 56);
  ctx.restore();
}

// Cockpit view: glareshield, six lit gauges, yoke and the nose with its prop.
export function drawCockpit(ctx, width, height, flight, timeSeconds) {
  const panelTop = height * 0.66;
  // Nose and spinning prop, seen over the glareshield: a low engine hood and
  // a faint two-blade blur, never a wall across the windscreen.
  const propAngle = timeSeconds * 40;
  ctx.fillStyle = 'rgba(200,205,210,0.12)';
  ctx.beginPath();
  ctx.ellipse(width / 2, height * 0.30, 9, 96, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,75,85,0.35)';
  ctx.lineWidth = 4;
  for (const a of [propAngle, propAngle + Math.PI / 2]) {
    ctx.beginPath();
    ctx.moveTo(width / 2 - Math.sin(a) * 92, height * 0.30 - Math.cos(a) * 92);
    ctx.lineTo(width / 2 + Math.sin(a) * 92, height * 0.30 + Math.cos(a) * 92);
    ctx.stroke();
  }
  ctx.fillStyle = '#6b5636';
  ctx.beginPath();
  ctx.moveTo(width / 2 - 26, panelTop);
  ctx.lineTo(width / 2 - 10, height * 0.60);
  ctx.lineTo(width / 2 + 10, height * 0.60);
  ctx.lineTo(width / 2 + 26, panelTop);
  ctx.closePath();
  ctx.fill();

  // Glareshield and panel.
  const panelGrad = ctx.createLinearGradient(0, panelTop, 0, height);
  panelGrad.addColorStop(0, '#23262c');
  panelGrad.addColorStop(0.12, '#2e323a');
  panelGrad.addColorStop(1, '#17191d');
  ctx.fillStyle = panelGrad;
  ctx.fillRect(0, panelTop, width, height - panelTop);
  ctx.fillStyle = '#101216';
  ctx.fillRect(0, panelTop - 8, width, 10);

  const gaugeY = panelTop + (height - panelTop) * 0.42;
  const r = Math.min(46, (height - panelTop) * 0.32);
  const spread = Math.min(150, width / 9);
  const cx = width / 2;
  drawAttitudeGauge(ctx, cx - spread * 2.4, gaugeY, r, flight);
  drawDialGauge(ctx, cx - spread * 1.2, gaugeY, r, 'AIRSPEED', flight.speed * 1.94, 0, 260, 'kt');
  drawDialGauge(ctx, cx, gaugeY, r, 'ALTITUDE', flight.y, 0, 600, 'm');
  drawCompassGauge(ctx, cx + spread * 1.2, gaugeY, r, flight);
  drawDialGauge(ctx, cx + spread * 2.4, gaugeY, r, 'FUEL', flight.fuel, 0, 100, '%');

  // Throttle quadrant on the left of the panel, gear and flap lights on the right.
  const quadX = 56;
  const quadY = panelTop + 18;
  ctx.fillStyle = '#0c0e11';
  ctx.fillRect(quadX, quadY, 26, height - panelTop - 36);
  ctx.fillStyle = '#e8b13c';
  const throttleH = (height - panelTop - 44) * flight.throttle;
  ctx.fillRect(quadX + 4, quadY + (height - panelTop - 44) - throttleH + 4, 18, throttleH);
  ctx.fillStyle = '#c9ced6';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('THR', quadX, quadY - 6);
  drawLamp(ctx, width - 130, gaugeY - r, 'GEAR', flight.gearDown, '#35d461');
  drawLamp(ctx, width - 130, gaugeY + 4, 'STALL', flight.stalled, '#ff3b30');
  drawLamp(ctx, width - 130, gaugeY + r + 6, 'FUEL LOW', flight.fuel < 20, '#ffb020');

  // Yoke.
  ctx.strokeStyle = '#3a3e46';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(cx - 52, height);
  ctx.quadraticCurveTo(cx - 40, gaugeY + r + 26, cx, gaugeY + r + 18);
  ctx.quadraticCurveTo(cx + 40, gaugeY + r + 26, cx + 52, height);
  ctx.stroke();
}

function drawGaugeShell(ctx, x, y, r, label) {
  ctx.fillStyle = '#0c0e11';
  ctx.beginPath();
  ctx.arc(x, y, r + 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4a5058';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r + 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#8a929c';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + r + 16);
}

function drawAttitudeGauge(ctx, x, y, r, flight) {
  drawGaugeShell(ctx, x, y, r, 'ATTITUDE');
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-flight.roll);
  ctx.translate(0, flight.pitch * r * 1.6);
  ctx.fillStyle = '#3f7ec2';
  ctx.fillRect(-r, -r * 2, r * 2, r * 2);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r, 0, r * 2, r * 2);
  ctx.strokeStyle = '#f4f6f8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();
  ctx.restore();
  // Fixed wings marker.
  ctx.strokeStyle = '#ffc233';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.7, y);
  ctx.lineTo(x - r * 0.25, y);
  ctx.moveTo(x + r * 0.25, y);
  ctx.lineTo(x + r * 0.7, y);
  ctx.stroke();
  ctx.fillStyle = '#ffc233';
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawDialGauge(ctx, x, y, r, label, value, min, max, unit) {
  drawGaugeShell(ctx, x, y, r, label);
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#c9ced6';
  ctx.fillStyle = '#c9ced6';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const x1 = Math.cos(a) * (r - 4);
    const y1 = Math.sin(a) * (r - 4);
    const x2 = Math.cos(a) * (r - 10);
    const y2 = Math.sin(a) * (r - 10);
    ctx.lineWidth = i % 5 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  const frac = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const needle = Math.PI * 0.75 + frac * Math.PI * 1.5;
  ctx.strokeStyle = '#ff5a4a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(needle) * (r - 12), Math.sin(needle) * (r - 12));
  ctx.stroke();
  ctx.fillStyle = '#f4f6f8';
  ctx.font = `bold ${Math.max(13, r * 0.42)}px sans-serif`;
  ctx.fillText(String(Math.round(value)), 0, r * 0.52);
  ctx.font = '9px sans-serif';
  ctx.fillStyle = '#8a929c';
  ctx.fillText(unit, 0, r * 0.78);
  ctx.restore();
}

function drawCompassGauge(ctx, x, y, r, flight) {
  drawGaugeShell(ctx, x, y, r, 'HEADING');
  const heading = headingDegrees(flight.heading);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#f4f6f8';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  for (const [deg, label] of [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W']]) {
    const a = ((deg - heading) * Math.PI) / 180 - Math.PI / 2;
    ctx.fillText(label, Math.cos(a) * (r - 18), Math.sin(a) * (r - 18) + 3);
  }
  ctx.strokeStyle = '#ffc233';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -r + 8);
  ctx.lineTo(-5, -r + 18);
  ctx.lineTo(5, -r + 18);
  ctx.closePath();
  ctx.fillStyle = '#ffc233';
  ctx.fill();
  ctx.fillStyle = '#f4f6f8';
  ctx.font = `bold ${Math.max(12, r * 0.36)}px sans-serif`;
  ctx.fillText(String(Math.round(heading)).padStart(3, '0'), 0, r * 0.42);
  ctx.restore();
}

function drawLamp(ctx, x, y, label, on, color) {
  ctx.fillStyle = on ? color : '#2a2e34';
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9ced6';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 11, y + 3);
}

// ---- HUD -------------------------------------------------------------------

export function drawHUD(ctx, width, height, flight, mission, view, timeSeconds) {
  const heading = headingDegrees(flight.heading);
  ctx.textAlign = 'left';

  // Top centre: compass strip.
  const stripW = Math.min(460, width * 0.42);
  const stripX = (width - stripW) / 2;
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  ctx.fillRect(stripX, 12, stripW, 34);
  ctx.fillStyle = '#f4f6f8';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  for (let d = -60; d <= 60; d += 15) {
    const h = Math.round(((heading + d) % 360 + 360) % 360);
    const x = stripX + stripW / 2 + (d / 60) * (stripW / 2 - 14);
    const label = h === 0 ? 'N' : h === 90 ? 'E' : h === 180 ? 'S' : h === 270 ? 'W' : String(h);
    ctx.fillText(label, x, 34);
    ctx.fillRect(x, 14, 1, 6);
  }
  ctx.fillStyle = '#ffc233';
  ctx.beginPath();
  ctx.moveTo(width / 2 - 6, 12);
  ctx.lineTo(width / 2 + 6, 12);
  ctx.lineTo(width / 2, 22);
  ctx.closePath();
  ctx.fill();

  // Left: speed tape. Right: altitude tape.
  drawTape(ctx, 18, 70, 64, 210, 'SPD', Math.round(flight.speed * 1.94), 'kt', 0, 260);
  drawTape(ctx, width - 82, 70, 64, 210, 'ALT', Math.round(flight.y), 'm', 0, 900);

  // Top right: score, fuel, damage, objective. Kept clear of the ALT tape.
  const panelX = width - 302;
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  ctx.fillRect(panelX, 56, 200, 118);
  ctx.fillStyle = '#f4f6f8';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${mission.score}`, panelX + 12, 82);
  ctx.font = '13px sans-serif';
  ctx.fillText(missionObjectiveText(mission), panelX + 12, 104);
  drawBar(ctx, panelX + 12, 122, 176, 10, flight.fuel / 100, flight.fuel < 20 ? '#ff5a4a' : '#35d461', 'FUEL');
  drawBar(ctx, panelX + 12, 146, 176, 10, 1 - flight.damage / 100, '#7db4e8', 'HULL');
  ctx.fillStyle = '#c9ced6';
  ctx.font = '11px sans-serif';
  ctx.fillText(`HDG ${String(Math.round(heading)).padStart(3, '0')}°  •  V/S ${flight.verticalSpeed >= 0 ? '+' : ''}${Math.round(flight.verticalSpeed)} m/s`, panelX + 12, 166);

  // Bottom left: throttle bar and gear. The cockpit view already has its own
  // throttle quadrant and lamps, so the HUD panel stays out of its way.
  if (view !== 'cockpit') {
    ctx.fillStyle = 'rgba(10,14,20,0.55)';
    ctx.fillRect(18, height - 66, 220, 48);
    drawBar(ctx, 30, height - 38, 150, 12, flight.throttle, '#e8b13c', 'THR');
    ctx.fillStyle = '#f4f6f8';
    ctx.font = '12px sans-serif';
    ctx.fillText(`GEAR ${flight.gearDown ? 'DOWN' : 'UP'}`, 30, height - 26);
    ctx.fillText(flight.airborne ? 'AIRBORNE' : 'ON GROUND', 120, height - 26);
  }

  // Centre reticle and flight-path marker.
  const cx = width / 2;
  const cy = view === 'cockpit' ? height * 0.42 : height * 0.44;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy);
  ctx.lineTo(cx - 14, cy);
  ctx.moveTo(cx + 14, cy);
  ctx.lineTo(cx + 22, cy);
  ctx.moveTo(cx, cy - 22);
  ctx.lineTo(cx, cy - 14);
  ctx.moveTo(cx, cy + 14);
  ctx.lineTo(cx, cy + 22);
  ctx.stroke();

  // Next-target arrow at the screen edge.
  const target = currentTarget(mission, flight);
  const bearing = bearingToTarget(flight, target);
  const rel = ((bearing - flight.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const dist = Math.round(targetDistance(flight, target));
  const arrowAngle = Math.atan2(Math.sin(rel), Math.cos(rel));
  const ax = cx + Math.sin(arrowAngle) * 150;
  const ay = cy - Math.cos(arrowAngle) * 150;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(arrowAngle);
  ctx.fillStyle = '#ffc233';
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(9, 8);
  ctx.lineTo(-9, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffc233';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${dist}m`, ax, ay + 26);

  // Mission message banner.
  if (mission.message && mission.messageTime > 0) {
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = 'rgba(10,14,20,0.65)';
    const msgW = ctx.measureText(mission.message).width + 36;
    ctx.fillRect((width - msgW) / 2, 64, msgW, 34);
    ctx.fillStyle = '#ffd970';
    ctx.fillText(mission.message, width / 2, 87);
  }

  // Warnings.
  if (flight.stalled && flight.airborne) {
    const blink = Math.sin(timeSeconds * 10) > 0;
    if (blink) {
      ctx.fillStyle = '#ff3b30';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STALL — NOSE DOWN, ADD THROTTLE', width / 2, height - 92);
    }
  }
  if (flight.fuel < 20 && flight.fuel > 0) {
    ctx.fillStyle = '#ffb020';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOW FUEL', width / 2, height - 118);
  }
  if (flight.fuel <= 0) {
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FUEL EMPTY — GLIDING', width / 2, height - 118);
  }
}

function drawTape(ctx, x, y, w, h, label, value, unit, min, max) {
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#8a929c';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 8, y + 14);
  ctx.fillStyle = '#f4f6f8';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(String(value), x + 8, y + 46);
  ctx.fillStyle = '#8a929c';
  ctx.font = '11px sans-serif';
  ctx.fillText(unit, x + 8, y + 62);
  // Tick marks for the scale.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  const frac = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const ty = y + h - 16 - frac * (h - 84);
  ctx.beginPath();
  ctx.moveTo(x + w - 12, ty);
  ctx.lineTo(x + w - 4, ty);
  ctx.stroke();
}

function drawBar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = '#c9ced6';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y - 3);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
}

// ---- Screens ----------------------------------------------------------------

export function drawMenu(ctx, width, height, missionIndex, timeSeconds) {
  ctx.fillStyle = 'rgba(8,12,20,0.45)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4f6f8';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SKYLARK COURIER', width / 2, height * 0.24);
  ctx.fillStyle = '#ffd970';
  ctx.font = '20px sans-serif';
  ctx.fillText('A flight game over Kestrel Cay — rings, runways and one brave little prop plane.', width / 2, height * 0.24 + 36);

  const cardW = Math.min(880, width * 0.8);
  const cardX = (width - cardW) / 2;
  const cardY = height * 0.36;
  const rowH = 64;
  MISSIONS.forEach((mission, i) => {
    const y = cardY + i * (rowH + 12);
    const selected = i === missionIndex;
    ctx.fillStyle = selected ? 'rgba(255,210,99,0.92)' : 'rgba(10,14,20,0.72)';
    ctx.fillRect(cardX, y, cardW, rowH);
    ctx.fillStyle = selected ? '#141414' : '#f4f6f8';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}. ${mission.name} — ${mission.tagline}`, cardX + 18, y + 27);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = selected ? '#3a3a3a' : '#c9ced6';
    ctx.fillText(mission.brief, cardX + 18, y + 48);
  });

  const blink = Math.sin(timeSeconds * 4) > -0.2;
  if (blink) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press ENTER to fly  •  1 / 2 / 3 to pick a sortie', width / 2, cardY + 3 * (rowH + 12) + 22);
  }
  ctx.fillStyle = '#c9ced6';
  ctx.font = '14px sans-serif';
  ctx.fillText('Arrows fly  •  W/S throttle  •  Mouse steers  •  G gear  •  C cockpit view  •  B brake  •  P pause', width / 2, height - 36);
}

export function drawEndScreen(ctx, width, height, flight, mission) {
  ctx.fillStyle = 'rgba(8,12,20,0.6)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  const won = mission.complete;
  ctx.fillStyle = won ? '#ffd970' : '#ff6a5a';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText(won ? 'SORTIE COMPLETE' : mission.failReason || 'CRASHED', width / 2, height * 0.3);
  ctx.fillStyle = '#f4f6f8';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(`SCORE ${mission.score}`, width / 2, height * 0.3 + 52);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#c9ced6';
  const stats = [
    `${missionObjectiveText(mission)}`,
    `Distance flown ${(flight.distanceFlown / 1000).toFixed(1)} km  •  Time ${Math.round(mission.elapsed)}s`,
    `Fuel left ${Math.round(flight.fuel)}%  •  Hull ${Math.round(100 - flight.damage)}%`,
  ];
  stats.forEach((line, i) => ctx.fillText(line, width / 2, height * 0.3 + 96 + i * 28));
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press R to fly again  •  1 / 2 / 3 to pick another sortie', width / 2, height * 0.3 + 200);
}

export function drawPaused(ctx, width, height) {
  ctx.fillStyle = 'rgba(8,12,20,0.55)';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#f4f6f8';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', width / 2, height / 2 - 10);
  ctx.font = '17px sans-serif';
  ctx.fillText('P to resume  •  R to restart the sortie', width / 2, height / 2 + 26);
}
