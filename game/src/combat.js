// Combat: shooting, enemies, health and ammo. The player fires a pistol
// with the mouse; a ray from the camera finds what the shot hits. Enemies
// are armed figures who stand their ground and shoot back when the player
// gets close. Kills feed the mission system; shooting a pedestrian or a
// cop feeds the wanted system instead.
import * as THREE from 'three';
import { makePedestrianMesh } from './pedestrians.js';

export function createCombat(scene) {
  return {
    scene,
    enemies: [],
    ammo: 24,
    reserve: 120,
    reloadTimer: 0,
    fireTimer: 0,
    tracers: [],
    muzzleTimer: 0,
  };
}

export function spawnEnemies(combat, positions, rng) {
  for (const pos of positions) {
    const mesh = makePedestrianMesh(rng);
    mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0x3a1a1a });
    mesh.children[1].material = new THREE.MeshLambertMaterial({ color: 0x222222 });
    mesh.position.set(pos.x, 0, pos.z);
    combat.scene.add(mesh);
    combat.enemies.push({
      mesh,
      x: pos.x,
      z: pos.z,
      health: 60,
      shootTimer: rng.range(0.5, 1.5),
      alive: true,
    });
  }
}

export function clearEnemies(combat) {
  for (const enemy of combat.enemies) combat.scene.remove(enemy.mesh);
  combat.enemies = [];
}

/** Fire one shot from the camera. Returns what it hit: 'enemy', 'ped', 'cop', 'car', 'wall' or null. */
export function playerShoot(combat, camera, playerPos, peds, police, cars, onHit) {
  if (combat.ammo <= 0 || combat.fireTimer > 0 || combat.reloadTimer > 0) return null;
  combat.ammo -= 1;
  combat.fireTimer = 0.28;
  combat.muzzleTimer = 0.06;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  raycaster.far = 120;
  const targets = [];
  for (const enemy of combat.enemies) if (enemy.alive) targets.push({ mesh: enemy.mesh, kind: 'enemy', ref: enemy });
  for (const ped of peds) if (ped.alive) targets.push({ mesh: ped.mesh, kind: 'ped', ref: ped });
  for (const cop of police.footCops) targets.push({ mesh: cop.mesh, kind: 'cop', ref: cop });
  for (const car of cars) targets.push({ mesh: car.mesh, kind: 'car', ref: car });
  const hits = raycaster.intersectObjects(targets.map((t) => t.mesh), true);
  let hitKind = null;
  if (hits.length > 0) {
    let obj = hits[0].object;
    while (obj.parent && obj.parent !== combat.scene) obj = obj.parent;
    const target = targets.find((t) => t.mesh === obj);
    if (target) {
      hitKind = target.kind;
      if (target.kind === 'enemy') {
        target.ref.health -= 34;
        if (target.ref.health <= 0) {
          target.ref.alive = false;
          combat.scene.remove(target.ref.mesh);
          if (onHit) onHit('enemy');
        }
      } else if (target.kind === 'ped') {
        target.ref.alive = false;
        combat.scene.remove(target.ref.mesh);
        if (onHit) onHit('ped');
      } else if (target.kind === 'cop') {
        if (onHit) onHit('cop');
      }
    }
  }
  addTracer(combat, camera);
  return hitKind;
}

function addTracer(combat, camera) {
  const from = new THREE.Vector3();
  camera.getWorldPosition(from);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const to = from.clone().add(dir.multiplyScalar(60));
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
  combat.scene.add(line);
  combat.tracers.push({ line, life: 0.08 });
}

export function stepCombat(combat, dt, playerPos, onEnemyShot) {
  combat.fireTimer = Math.max(0, combat.fireTimer - dt);
  combat.muzzleTimer = Math.max(0, combat.muzzleTimer - dt);
  if (combat.reloadTimer > 0) {
    combat.reloadTimer -= dt;
    if (combat.reloadTimer <= 0 && combat.reserve > 0) {
      const take = Math.min(24, combat.reserve);
      combat.ammo = take;
      combat.reserve -= take;
    }
  }
  for (let i = combat.tracers.length - 1; i >= 0; i -= 1) {
    const tracer = combat.tracers[i];
    tracer.life -= dt;
    if (tracer.life <= 0) {
      combat.scene.remove(tracer.line);
      combat.tracers.splice(i, 1);
    }
  }
  for (const enemy of combat.enemies) {
    if (!enemy.alive) continue;
    const dist = Math.hypot(playerPos.x - enemy.x, playerPos.z - enemy.z);
    enemy.mesh.lookAt(playerPos.x, 0, playerPos.z);
    if (dist < 42) {
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0) {
        enemy.shootTimer = 1.1 + Math.random() * 0.9;
        if (onEnemyShot) onEnemyShot(dist < 18 ? 9 : 5);
        addTracer(combat, { getWorldPosition: (v) => v.set(enemy.x, 1.4, enemy.z), getWorldDirection: (v) => v.set(playerPos.x - enemy.x, 0, playerPos.z - enemy.z).normalize() });
      }
    }
  }
}

export function reload(combat) {
  if (combat.reloadTimer > 0 || combat.ammo === 24 || combat.reserve <= 0) return false;
  combat.reloadTimer = 1.1;
  return true;
}
