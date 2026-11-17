// Pedestrians: the city's foot traffic. Each walker is a small figure —
// body, head, legs that swing — strolling along a sidewalk, turning at
// corners, and running away from gunfire or a wanted player. They make the
// streets feel alive and give the wanted system something to react to.
import * as THREE from 'three';
import { CITY_SIZE } from './config.js';
import { roadCenters } from './city.js';

const SHIRT_COLOURS = [0xe86a5a, 0x5a8fe8, 0x6ac25a, 0xe8c95a, 0x9a5ae8, 0xe85a9a, 0x5ad2c2, 0xd8d8d8];
const SKIN_COLOURS = [0xe8b98a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0];

export function makePedestrianMesh(rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRT_COLOURS) });
  const skin = new THREE.MeshLambertMaterial({ color: rng.pick(SKIN_COLOURS) });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin);
  head.position.y = 1.6;
  head.castShadow = true;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), pants);
  legL.position.set(-0.14, 0.33, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), pants);
  legR.position.set(0.14, 0.33, 0);
  group.add(legR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  return group;
}

export function createPedestrians(scene, rng, count) {
  const centers = roadCenters();
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const mesh = makePedestrianMesh(rng);
    scene.add(mesh);
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const road = centers[rng.int(0, centers.length - 1)];
    const offset = (rng.chance(0.5) ? 1 : -1) * (7 + 4);
    const pos = rng.range(-CITY_SIZE / 2, CITY_SIZE / 2);
    peds.push({
      mesh,
      axis,
      road,
      offset,
      pos,
      dir: rng.chance(0.5) ? 1 : -1,
      speed: rng.range(1.1, 2.2),
      fleeing: 0,
      walkPhase: rng.range(0, Math.PI * 2),
      alive: true,
    });
  }
  return peds;
}

export function stepPedestrians(peds, dt, danger) {
  for (const ped of peds) {
    if (!ped.alive) continue;
    if (danger) ped.fleeing = Math.max(ped.fleeing, 2.5);
    if (ped.fleeing > 0) ped.fleeing -= dt;
    const speed = ped.fleeing > 0 ? ped.speed * 3.2 : ped.speed;
    ped.pos += ped.dir * speed * dt;
    if (ped.pos > CITY_SIZE / 2 + 5 || ped.pos < -CITY_SIZE / 2 - 5) {
      ped.dir *= -1;
      ped.pos = Math.max(-CITY_SIZE / 2 - 4, Math.min(CITY_SIZE / 2 + 4, ped.pos));
    }
    if (ped.axis === 'x') {
      ped.mesh.position.set(ped.pos, 0, ped.road + ped.offset);
      ped.mesh.rotation.y = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      ped.mesh.position.set(ped.road + ped.offset, 0, ped.pos);
      ped.mesh.rotation.y = ped.dir > 0 ? 0 : Math.PI;
    }
    ped.walkPhase += dt * speed * 4;
    const swing = Math.sin(ped.walkPhase) * 0.45;
    ped.mesh.userData.legL.rotation.x = swing;
    ped.mesh.userData.legR.rotation.x = -swing;
  }
}
