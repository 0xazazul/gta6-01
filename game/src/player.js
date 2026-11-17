// The player on foot: a third-person figure who walks, sprints and turns
// with the camera, and steps in and out of cars. On foot the camera orbits
// with the mouse; in a car the same camera chases behind the vehicle. The
// player mesh is a simple original character — jacket, jeans, cap — built
// from boxes, like everything else in Solmar Bay.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { resolveBuildingCollisions } from './city.js';

export function makePlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e5d8a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.34), jacket);
  body.position.y = 1.08;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.66;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.4), new THREE.MeshLambertMaterial({ color: 0xd23c2e }));
  cap.position.y = 1.88;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), jeans);
  legL.position.set(-0.16, 0.35, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), jeans);
  legR.position.set(0.16, 0.35, 0);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), jacket);
  armL.position.set(-0.4, 1.05, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), jacket);
  armR.position.set(0.4, 1.05, 0);
  group.add(armR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  group.userData.armR = armR;
  return group;
}

export function createPlayer(scene, x, z) {
  const mesh = makePlayerMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh,
    x,
    z,
    heading: 0,
    health: PLAYER.maxHealth,
    armor: 0,
    walkPhase: 0,
    moving: false,
    vy: 0,
    y: 0,
  };
}

/** Move on foot: camera-relative WASD, sprint with Shift, collide with buildings. */
export function stepPlayerOnFoot(player, input, cameraYaw, dt, colliders, bounds) {
  const forward = input.throttle();
  const strafe = input.steer();
  const sprint = input.sprint();
  // The input is a direction plus a magnitude (0..1): the keyboard gives
  // full magnitude, the screenshot autopilot gives a fraction of it.
  const magnitude = Math.min(1, Math.hypot(forward, strafe));
  const speed = (sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed) * magnitude;
  let mx = 0;
  let mz = 0;
  if (forward !== 0 || strafe !== 0) {
    // Forward is where the camera looks; strafe is sideways to it.
    const fx = Math.sin(cameraYaw);
    const fz = Math.cos(cameraYaw);
    const rx = Math.cos(cameraYaw);
    const rz = -Math.sin(cameraYaw);
    mx = fx * forward + rx * strafe;
    mz = fz * forward + rz * strafe;
    const len = Math.hypot(mx, mz) || 1;
    mx /= len;
    mz /= len;
    player.heading = Math.atan2(mx, mz);
  }
  player.moving = mx !== 0 || mz !== 0;
  const nx = player.x + mx * speed * dt;
  const nz = player.z + mz * speed * dt;
  const pos = { x: nx, z: nz };
  resolveBuildingCollisions(pos, PLAYER.radius, colliders);
  player.x = Math.max(bounds.min, Math.min(bounds.max, pos.x));
  player.z = Math.max(bounds.min, Math.min(bounds.maxZ, pos.z));
  player.mesh.position.set(player.x, player.y, player.z);
  // Face the direction of travel, turning smoothly.
  let dh = player.heading - player.mesh.rotation.y;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  player.mesh.rotation.y += dh * Math.min(1, PLAYER.turnSpeed * dt);
  player.walkPhase += dt * (player.moving ? speed * 1.6 : 0);
  const swing = player.moving ? Math.sin(player.walkPhase) * 0.55 : 0;
  player.mesh.userData.legL.rotation.x = swing;
  player.mesh.userData.legR.rotation.x = -swing;
  return player.moving;
}

export function damagePlayer(player, amount) {
  let rest = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, rest);
    player.armor -= absorbed;
    rest -= absorbed;
  }
  player.health = Math.max(0, player.health - rest);
  return player.health <= 0;
}
