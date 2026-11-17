// The wanted system: stars, police cars and foot cops. Stars rise when the
// player steals, shoots or runs a hot mission, and fall when the player stays
// out of sight. Police cars spawn at the city edge, chase the player and ram;
// foot cops run the player down and bust them if they get close while the
// player is slow. Losing the cops is a real mechanic: break line of sight
// and keep moving and the stars tick down.
import * as THREE from 'three';
import { CITY_SIZE, WANTED } from './config.js';
import { makeCarMesh } from './vehicles.js';
import { makePedestrianMesh } from './pedestrians.js';

export function createPolice(scene) {
  return {
    scene,
    stars: 0,
    heat: 0,
    decayTimer: 0,
    copCars: [],
    footCops: [],
    sirenOn: false,
  };
}

export function addStars(police, n) {
  police.stars = Math.max(0, Math.min(5, police.stars + n));
  police.decayTimer = WANTED.decaySeconds;
  syncPolice(police);
}

export function setStars(police, n) {
  police.stars = Math.max(0, Math.min(5, n));
  police.decayTimer = WANTED.decaySeconds;
  syncPolice(police);
}

function spawnCopCar(police, x, z) {
  const mesh = makeCarMesh(0x111111, true);
  police.scene.add(mesh);
  const car = { mesh, x, z, heading: 0, speed: 0 };
  police.copCars.push(car);
  return car;
}

function spawnFootCop(police, x, z) {
  const mesh = makePedestrianMesh({ pick: (l) => l[0], next: () => 0.5, range: (a, b) => (a + b) / 2, int: (a) => a, chance: () => false });
  // Recolour the figure as a Solmar PD officer: navy shirt, dark cap.
  mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0x1a2a5a });
  mesh.children[1].material = new THREE.MeshLambertMaterial({ color: 0x1a2a5a });
  police.scene.add(mesh);
  const cop = { mesh, x, z, heading: 0 };
  police.footCops.push(cop);
  return cop;
}

/** Keep the number of active cops matched to the wanted level. */
export function syncPolice(police) {
  const wantCars = WANTED.copCars[police.stars];
  const wantFoot = WANTED.copFoot[police.stars];
  while (police.copCars.length < wantCars) {
    const edge = CITY_SIZE / 2 - 8;
    spawnCopCar(police, (Math.random() - 0.5) * edge * 2, (Math.random() - 0.5) * edge * 2);
  }
  while (police.copCars.length > wantCars) {
    const car = police.copCars.pop();
    police.scene.remove(car.mesh);
  }
  while (police.footCops.length < wantFoot) {
    spawnFootCop(police, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40);
  }
  while (police.footCops.length > wantFoot) {
    const cop = police.footCops.pop();
    police.scene.remove(cop.mesh);
  }
  police.sirenOn = police.stars > 0;
}

export function stepPolice(police, dt, playerPos, playerSpeed, onBusted, onRam) {
  if (police.stars === 0) {
    if (police.sirenOn) police.sirenOn = false;
    return;
  }
  // Stars decay while the player keeps moving and stays out of the cops' way.
  police.decayTimer -= dt;
  if (police.decayTimer <= 0) {
    police.stars = Math.max(0, police.stars - 1);
    police.decayTimer = WANTED.decaySeconds;
    syncPolice(police);
  }
  for (const car of police.copCars) {
    const dx = playerPos.x - car.x;
    const dz = playerPos.z - car.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
    const targetSpeed = dist > 60 ? 34 : 26;
    car.speed += (targetSpeed - car.speed) * dt * 0.8;
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    if (dist < 3.4 && Math.abs(car.speed) > 6) {
      if (onRam) onRam(car.speed);
      car.speed *= 0.3;
    }
  }
  for (const cop of police.footCops) {
    const dx = playerPos.x - cop.x;
    const dz = playerPos.z - cop.z;
    const dist = Math.hypot(dx, dz) || 1;
    cop.heading = Math.atan2(dx, dz);
    const speed = 5.4;
    cop.x += (dx / dist) * speed * dt;
    cop.z += (dz / dist) * speed * dt;
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.heading;
    if (dist < WANTED.bustRadius && playerSpeed < 3) {
      if (onBusted) onBusted();
    }
  }
}
