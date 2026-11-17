// Rendering only: the three.js renderer, the third-person camera rig and
// the screen effects. The camera chases behind the player on foot and
// behind the car while driving, orbits with mouse drag, and shakes on
// crashes and gunfire. Smoke puffs mark hard driving; a muzzle flash
// lights the scene for a frame when the player shoots.
import * as THREE from 'three';

function makeSmokeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(200,200,200,0.7)');
  grad.addColorStop(1, 'rgba(200,200,200,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function createRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  const smokeTexture = makeSmokeTexture();
  const puffs = [];
  const flash = new THREE.PointLight(0xffe9a8, 0, 18);
  scene.add(flash);
  let camYaw = 0;
  let camPitch = 0.36;
  let shake = 0;
  let distance = 10;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function spawnSmoke(x, y, z) {
    const mat = new THREE.SpriteMaterial({ map: smokeTexture, transparent: true, opacity: 0.55, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.set(1.6, 1.6, 1);
    scene.add(sprite);
    puffs.push({ sprite, life: 0.7 });
  }

  function stepEffects(dt) {
    for (let i = puffs.length - 1; i >= 0; i -= 1) {
      const puff = puffs[i];
      puff.life -= dt;
      puff.sprite.material.opacity = Math.max(0, puff.life / 0.7) * 0.55;
      puff.sprite.scale.multiplyScalar(1 + dt * 1.6);
      puff.sprite.position.y += dt * 0.8;
      if (puff.life <= 0) {
        scene.remove(puff.sprite);
        puffs.splice(i, 1);
      }
    }
    if (shake > 0) shake = Math.max(0, shake - dt * 3);
  }

  /**
   * Chase the focus point from behind: on foot the camera sits behind the
   * player's heading, in a car behind the car's heading, at a distance
   * that grows with speed. Drag deltas orbit the yaw and pitch.
   */
  function updateCamera(focus, heading, speed, dt, drag) {
    if (drag.dragging) {
      camYaw -= drag.dx * 0.005;
      camPitch = Math.max(0.08, Math.min(1.1, camPitch + drag.dy * 0.003));
    } else {
      // Ease the camera back behind the direction of travel.
      let dh = heading - camYaw;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      camYaw += dh * Math.min(1, dt * 2.2);
    }
    const targetDistance = 9 + Math.min(3.5, Math.abs(speed) * 0.08);
    distance += (targetDistance - distance) * Math.min(1, dt * 3);
    const cx = focus.x - Math.sin(camYaw) * Math.cos(camPitch) * distance;
    const cz = focus.z - Math.cos(camYaw) * Math.cos(camPitch) * distance;
    const cy = focus.y + 2.2 + Math.sin(camPitch) * distance;
    camera.position.set(cx, cy, cz);
    const look = new THREE.Vector3(focus.x, focus.y + 1.6, focus.z);
    if (shake > 0) {
      look.x += (Math.random() - 0.5) * shake;
      look.y += (Math.random() - 0.5) * shake;
    }
    camera.lookAt(look);
    return camYaw;
  }

  return {
    renderer,
    scene,
    camera,
    get cameraYaw() {
      return camYaw;
    },
    setCameraYaw(yaw) {
      camYaw = yaw;
    },
    addShake(amount) {
      shake = Math.min(1.2, shake + amount);
    },
    updateCamera,
    muzzleFlash(pos) {
      flash.position.copy(pos);
      flash.intensity = 60;
      window.setTimeout(() => {
        flash.intensity = 0;
      }, 60);
    },
    spawnSmoke,
    stepEffects,
    draw() {
      renderer.render(scene, camera);
    },
  };
}
