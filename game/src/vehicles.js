// Cars: how they look, how traffic drives them, and how the player drives
// one. A car is a small group of boxes — body, cabin, wheels, lights — so
// every vehicle is built from the same parts in its own colour. Traffic
// follows the road grid on waypoints; the player's car is arcade physics
// (accelerate, steer, brake, drift) with building collision.
import * as THREE from 'three';
import { CAR, CITY_SIZE } from './config.js';
import { resolveBuildingCollisions, roadCenters } from './city.js';

const CAR_COLOURS = [0xd23c2e, 0x2e6fd2, 0xe8c33a, 0x3aa655, 0xe8e8e8, 0x222222, 0xd2701e, 0x7a4fd2, 0x4fc3c3];
const CAR_NAMES = ['Comet', 'Stallion', 'Rumbler', 'Sunrise', 'Vagabond', 'Cortez', 'Breeze', 'Mamba', 'Dune'];

export function carName(index) {
  return CAR_NAMES[index % CAR_NAMES.length];
}

export function makeCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0x1a1a1a : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, 2.2),
    new THREE.MeshLambertMaterial({ color: isPolice ? 0xf2f2f2 : 0x1c2733 }),
  );
  cabin.position.set(0, 1.15, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  if (isPolice) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.25, 4.42), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    stripe.position.y = 0.62;
    group.add(stripe);
  }
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.38, z);
    group.add(wheel);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.1), lightMat);
  head.position.set(0, 0.6, 2.21);
  group.add(head);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.18, 0.1),
    new THREE.MeshLambertMaterial({ color: 0xd21f1f }),
  );
  tail.position.set(0, 0.6, -2.21);
  group.add(tail);
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), new THREE.MeshLambertMaterial({ color: 0x2244ff }));
    bar.position.set(0, 1.55, -0.2);
    group.add(bar);
    group.userData.lightBar = bar;
  }
  group.userData.wheels = [];
  return group;
}

/** A traffic car: a mesh plus a route along the roads. */
export function createTraffic(scene, rng, count) {
  const centers = roadCenters();
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const color = CAR_COLOURS[i % CAR_COLOURS.length];
    const mesh = makeCarMesh(color, false);
    scene.add(mesh);
    const car = {
      mesh,
      name: carName(i),
      color,
      // Drive along one axis on a road centre, turning at intersections.
      axis: rng.chance(0.5) ? 'x' : 'z',
      lane: centers[rng.int(0, centers.length - 1)],
      pos: rng.range(-CITY_SIZE / 2, CITY_SIZE / 2),
      dir: rng.chance(0.5) ? 1 : -1,
      speed: rng.range(7, 12),
      stolen: false,
      driver: true,
    };
    cars.push(car);
  }
  return cars;
}

export function placeTrafficCar(car) {
  if (car.axis === 'x') {
    car.mesh.position.set(car.pos, 0, car.lane);
    car.mesh.rotation.y = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.mesh.position.set(car.lane, 0, car.pos);
    car.mesh.rotation.y = car.dir > 0 ? 0 : Math.PI;
  }
}

export function stepTraffic(cars, dt, colliders) {
  for (const car of cars) {
    if (car.stolen || !car.driver) continue;
    car.pos += car.dir * car.speed * dt;
    if (car.pos > CITY_SIZE / 2 + 10 || car.pos < -CITY_SIZE / 2 - 10) {
      car.dir *= -1;
      car.pos = Math.max(-CITY_SIZE / 2 - 5, Math.min(CITY_SIZE / 2 + 5, car.pos));
    }
    placeTrafficCar(car);
    const p = car.mesh.position;
    resolveBuildingCollisions(p, 1.4, colliders);
  }
}

/** The player's driven car: arcade physics on a flat plane. */
export function createDrivenCar(mesh) {
  return {
    mesh,
    speed: 0,
    heading: 0,
    x: mesh.position.x,
    z: mesh.position.z,
    smoke: 0,
  };
}

export function stepDrivenCar(car, throttle, steer, dt, colliders, onCrash) {
  const maxFwd = CAR.maxSpeed;
  if (throttle > 0) car.speed += CAR.accel * dt;
  else if (throttle < 0) {
    car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.reverseAccel) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * CAR.grip * dt;
    if (Math.abs(car.speed) < 0.2) car.speed = 0;
  }
  car.speed = Math.max(-CAR.maxReverse, Math.min(maxFwd, car.speed));
  const steerAmount = steer * CAR.steer * dt * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 8 + 0.2);
  car.heading += steerAmount * Math.sign(car.speed || 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const before = { x: car.x, z: car.z };
  car.x = nx;
  car.z = nz;
  const pos = { x: car.x, z: car.z };
  resolveBuildingCollisions(pos, 1.6, colliders);
  const hitWall = pos.x !== car.x || pos.z !== car.z;
  car.x = pos.x;
  car.z = pos.z;
  // Keep the car inside the drivable area (city + beach).
  car.x = Math.max(-CITY_SIZE / 2 - 60, Math.min(CITY_SIZE / 2 + 60, car.x));
  car.z = Math.max(-CITY_SIZE / 2 - 10, Math.min(CITY_SIZE / 2 + 70, car.z));
  if (hitWall && Math.abs(car.speed) > 8) {
    if (onCrash) onCrash(Math.abs(car.speed));
    car.speed *= 0.4;
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  car.smoke = Math.max(0, car.smoke - dt);
  if (Math.abs(steer) > 0.7 && Math.abs(car.speed) > 18) car.smoke = 0.4;
  return { moved: Math.hypot(car.x - before.x, car.z - before.z) };
}
