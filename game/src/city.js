// Solmar Bay itself: the city the player drives and walks through. Builds the
// three.js scene — ground, road grid, sidewalks, buildings with procedural
// window textures, the beach and ocean to the south, palms, streetlights and
// props — and hands back the layout data the other systems drive on
// (road centres, named places, spawn points). All textures are drawn on
// canvases at runtime; no image file is loaded.
import * as THREE from 'three';
import { CITY_SIZE, COLOURS, WORLD } from './config.js';

const PITCH = WORLD.BLOCK + WORLD.ROAD;
const HALF = CITY_SIZE / 2;

export function roadCenters() {
  const centers = [];
  for (let i = 0; i <= WORLD.BLOCKS; i += 1) {
    centers.push(-HALF + WORLD.ROAD / 2 + i * PITCH);
  }
  return centers;
}

export function isOnRoad(x, z) {
  const centers = roadCenters();
  for (const c of centers) {
    if (Math.abs(x - c) < WORLD.ROAD / 2 + 0.5) return true;
    if (Math.abs(z - c) < WORLD.ROAD / 2 + 0.5) return true;
  }
  return false;
}

/** The named places the story and the HUD point at. */
export function namedPlaces() {
  const edge = HALF - WORLD.ROAD;
  return {
    safehouse: { x: -edge + 8, z: -edge + 8, label: 'Safehouse' },
    marina: { x: edge - 6, z: HALF + 26, label: 'Marina' },
    bank: { x: 0, z: -PITCH / 2, label: 'Bayfront Bank' },
    docks: { x: -edge + 4, z: HALF + 30, label: 'Docks' },
    strip: { x: edge - 8, z: 0, label: 'The Strip' },
    yacht: { x: 40, z: HALF + 34, label: 'Yacht' },
    plaza: { x: 0, z: 0, label: 'Solmar Plaza' },
  };
}

function makeFacadeTexture(baseColor, floors, litRatio, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `#${baseColor.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 6;
  const rows = Math.max(3, floors);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = rng.next() < litRatio;
      ctx.fillStyle = lit ? '#ffe9a8' : '#2c3e50';
      ctx.fillRect(8 + c * 20, 10 + r * (236 / rows), 12, 14);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makePalm() {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: COLOURS.palmTrunk });
  const leafMat = new THREE.MeshLambertMaterial({ color: COLOURS.palmLeaf });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 5, 6), trunkMat);
  trunk.position.y = 2.5;
  trunk.rotation.z = 0.08;
  group.add(trunk);
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.7), leafMat);
    const angle = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(angle) * 1.1, 5.1, Math.sin(angle) * 1.1);
    leaf.rotation.y = -angle;
    leaf.rotation.z = 0.35;
    group.add(leaf);
  }
  return group;
}

export function createCity(scene, rng) {
  const colliders = [];
  const textureCache = new Map();

  function facade(baseColor, floors) {
    const key = `${baseColor}:${floors}`;
    if (!textureCache.has(key)) textureCache.set(key, makeFacadeTexture(baseColor, floors, 0.35, rng));
    return textureCache.get(key);
  }

  // Sky, sun and haze: a warm late-afternoon over the bay.
  scene.background = new THREE.Color(COLOURS.skyTop);
  scene.fog = new THREE.Fog(0xf2c98f, 180, 520);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6f4d, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(COLOURS.sun, 1.6);
  sun.position.set(120, 160, -80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 500;
  scene.add(sun);

  // Ground slab for the whole city.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_SIZE + 160, CITY_SIZE + 160),
    new THREE.MeshLambertMaterial({ color: COLOURS.sidewalk }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 40);
  ground.receiveShadow = true;
  scene.add(ground);

  // Roads: dark strips along every grid line, with dashed centre lines.
  const centers = roadCenters();
  const roadMat = new THREE.MeshLambertMaterial({ color: COLOURS.road });
  const lineMat = new THREE.MeshLambertMaterial({ color: COLOURS.roadLine });
  for (const c of centers) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.ROAD, CITY_SIZE), roadMat);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(c, 0.02, 0);
    ns.receiveShadow = true;
    scene.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SIZE, WORLD.ROAD), roadMat);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.02, c);
    ew.receiveShadow = true;
    scene.add(ew);
    for (let d = -HALF + 8; d < HALF; d += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(c, 0.04, d);
      scene.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), lineMat);
      dash2.rotation.x = -Math.PI / 2;
      dash2.position.set(d, 0.04, c);
      scene.add(dash2);
    }
  }

  // Buildings: one to four per block, varied heights and colours, each with
  // a rooftop box so the skyline reads from the street and from above.
  const buildingMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (let bx = 0; bx < WORLD.BLOCKS; bx += 1) {
    for (let bz = 0; bz < WORLD.BLOCKS; bz += 1) {
      const blockX = -HALF + WORLD.ROAD + bx * PITCH;
      const blockZ = -HALF + WORLD.ROAD + bz * PITCH;
      const count = rng.int(1, 3);
      for (let b = 0; b < count; b += 1) {
        const w = rng.range(12, 20);
        const d = rng.range(12, 20);
        const h = rng.range(8, WORLD.BUILDING_MAX);
        const x = blockX + rng.range(6 + w / 2, WORLD.BLOCK - 6 - w / 2);
        const z = blockZ + rng.range(6 + d / 2, WORLD.BLOCK - 6 - d / 2);
        const color = rng.pick(COLOURS.buildingPalette);
        const floors = Math.max(3, Math.round(h / 4));
        const mat = new THREE.MeshLambertMaterial({ map: facade(color, floors) });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 1.6, d * 0.3), buildingMat);
        roof.position.set(x, h + 0.8, z);
        roof.castShadow = true;
        scene.add(roof);
        colliders.push({ x, z, hw: w / 2, hd: d / 2 });
      }
      // A palm or two on each block's corner.
      if (rng.chance(0.7)) {
        const palm = makePalm();
        palm.position.set(blockX + 4, 0, blockZ + 4);
        scene.add(palm);
      }
    }
  }

  // Beach and ocean south of the city, with a boardwalk strip.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_SIZE + 160, 46),
    new THREE.MeshLambertMaterial({ color: COLOURS.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.01, HALF + 23);
  sand.receiveShadow = true;
  scene.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_SIZE + 400, 300),
    new THREE.MeshLambertMaterial({ color: COLOURS.ocean }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, HALF + 46 + 150);
  scene.add(ocean);
  const boardwalk = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_SIZE, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6b45 }),
  );
  boardwalk.rotation.x = -Math.PI / 2;
  boardwalk.position.set(0, 0.03, HALF + 2);
  scene.add(boardwalk);

  // A white yacht anchored off the marina, the final mission's prize.
  const yacht = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(10, 2.2, 3.4),
    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
  );
  hull.position.y = 0.8;
  yacht.add(hull);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(5, 1.8, 2.6),
    new THREE.MeshLambertMaterial({ color: 0xd8e8f0 }),
  );
  cabin.position.set(-0.5, 2.6, 0);
  yacht.add(cabin);
  yacht.position.set(40, -0.2, HALF + 60);
  scene.add(yacht);

  // Streetlights along the roads.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  for (const c of centers) {
    for (let d = -HALF + 20; d < HALF; d += 60) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), poleMat);
      pole.position.set(c + WORLD.ROAD / 2 + 1, 3, d);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffe9a8 }));
      lamp.position.set(c + WORLD.ROAD / 2 + 1, 6.1, d);
      scene.add(lamp);
    }
  }

  return { colliders, centers, places: namedPlaces() };
}

/** Push a circle (the player, a car) out of every building it overlaps. */
export function resolveBuildingCollisions(pos, radius, colliders) {
  for (const c of colliders) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const px = c.hw + radius - Math.abs(dx);
    const pz = c.hd + radius - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) pos.x = c.x + Math.sign(dx || 1) * (c.hw + radius);
      else pos.z = c.z + Math.sign(dz || 1) * (c.hd + radius);
    }
  }
}
