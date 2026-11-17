// Solmar Bay — the game itself: screens, the fixed-step loop, and the
// wiring between the player, cars, traffic, pedestrians, police, missions,
// combat, audio and the HUD. The world is simulated in 1/60 s steps; the
// renderer paints the current state every frame. Nothing here knows about
// screenshots: shots.js stages scenes through the same public state.
import * as THREE from 'three';
import { CITY_SIZE, MISSION_REWARDS, PLAYER, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_PAUSE, ACTION_SHOOT, createInput } from './input.js';
import { createCity } from './city.js';
import { createRender } from './render.js';
import { createPlayer, damagePlayer, stepPlayerOnFoot } from './player.js';
import { createDrivenCar, createTraffic, placeTrafficCar, stepDrivenCar, stepTraffic } from './vehicles.js';
import { createPedestrians, stepPedestrians } from './pedestrians.js';
import { addStars, createPolice, setStars, stepPolice } from './police.js';
import { clearEnemies, createCombat, playerShoot, reload, spawnEnemies, stepCombat } from './combat.js';
import { advanceMission, createMissions, currentMission, currentStep, missionTarget, startMission } from './missions.js';
import { createHud } from './hud.js';
import { loadSave, writeSave } from './save.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_STORY = 'story';

const HALF = CITY_SIZE / 2;
const MAX_FRAME = 0.25;
const PICKUP_VALUE = 150;

const BANK_GUARDS = [
  { x: -8, z: -52 },
  { x: 0, z: -54 },
  { x: 8, z: -52 },
];
const YACHT_GUARDS = [
  { x: 34, z: HALF + 30 },
  { x: 46, z: HALF + 38 },
  { x: 40, z: HALF + 26 },
  { x: 30, z: HALF + 40 },
  { x: 48, z: HALF + 28 },
];

export function createGame(canvas, doc, seed) {
  const rng = createRandom(seed);
  const render = createRender(canvas);
  const city = createCity(render.scene, rng);
  const places = city.places;
  const hud = createHud(doc);
  const audio = createAudio();
  const input = createInput(canvas);
  const player = createPlayer(render.scene, places.plaza.x - 5, places.plaza.z + 8);
  const traffic = createTraffic(render.scene, rng, 14);
  // Four parked cars on the street by the plaza so the first steal is always at hand.
  for (let i = 0; i < 4; i += 1) {
    const car = traffic[i];
    car.driver = false;
    car.axis = 'x';
    car.lane = 3;
    car.pos = -14 + i * 9;
    placeTrafficCar(car);
  }
  for (const car of traffic) placeTrafficCar(car);
  const peds = createPedestrians(render.scene, rng, 24);
  const police = createPolice(render.scene);
  const combat = createCombat(render.scene);
  const missions = createMissions();

  // Cash pickups: gold cases tucked around the city, worth $150 each.
  const pickups = [];
  const pickupMat = new THREE.MeshLambertMaterial({ color: 0xf2c94c });
  const pickupGeo = new THREE.BoxGeometry(0.9, 0.6, 0.9);
  for (let i = 0; i < 8; i += 1) {
    const mesh = new THREE.Mesh(pickupGeo, pickupMat);
    const x = rng.range(-HALF + 20, HALF - 20);
    const z = rng.range(-HALF + 20, HALF - 20);
    mesh.position.set(x, 0.6, z);
    render.scene.add(mesh);
    pickups.push({ mesh, x, z, taken: false, spin: rng.range(0, 6) });
  }

  const state = {
    screen: SCREEN_TITLE,
    cash: 250,
    clockMinutes: 17 * 60 + 30,
    inCar: null,
    danger: false,
    time: 0,
    elapsed: 0,
    heatAppliedFor: -1,
    enemiesSpawnedFor: -1,
    respawnTimer: 0,
    storyShown: false,
  };

  function saveGame() {
    writeSave({
      missionIndex: missions.index,
      cash: state.cash,
      health: player.health,
      armor: player.armor,
      x: player.x,
      z: player.z,
      inCar: false,
    });
  }

  function applySave(data) {
    if (!data) return;
    missions.index = Math.max(0, Math.min(5, data.missionIndex || 0));
    state.cash = data.cash || 250;
    player.health = data.health || PLAYER.maxHealth;
    player.armor = data.armor || 0;
    if (typeof data.x === 'number' && typeof data.z === 'number') {
      player.x = data.x;
      player.z = data.z;
      player.mesh.position.set(player.x, 0, player.z);
    }
  }

  function missionObjectiveText() {
    const mission = currentMission(missions);
    if (!mission) return 'Free roam — Solmar Bay is yours. Find cash cases, steal cars, stay out of trouble.';
    const step = currentStep(missions);
    if (!step) return mission.title;
    return `${mission.title}: ${step.text}`;
  }

  function startStory() {
    missions.index = 0;
    missions.active = false;
    missions.done = false;
    missions.step = 0;
    missions.kills = 0;
    state.heatAppliedFor = -1;
    state.enemiesSpawnedFor = -1;
    state.cash = 250;
    player.health = PLAYER.maxHealth;
    player.armor = 0;
    setStars(police, 0);
    startMission(missions);
  }

  function respawnAtSafehouse(reason) {
    state.cash = Math.max(0, state.cash - 200);
    player.health = reason === 'wasted' ? PLAYER.maxHealth : 50;
    player.x = places.safehouse.x;
    player.z = places.safehouse.z;
    player.mesh.position.set(player.x, 0, player.z);
    setStars(police, 0);
    if (state.inCar) {
      state.inCar = null;
      player.mesh.visible = true;
    }
    state.screen = SCREEN_PLAY;
    hud.hideScreen();
    saveGame();
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of traffic) {
      if (car.stolen) continue;
      const d = Math.hypot(car.mesh.position.x - player.x, car.mesh.position.z - player.z);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car) {
    car.stolen = true;
    car.driver = false;
    state.inCar = createDrivenCar(car.mesh);
    state.inCar.heading = car.mesh.rotation.y;
    state.inCar.x = car.mesh.position.x;
    state.inCar.z = car.mesh.position.z;
    player.mesh.visible = false;
    render.setCameraYaw(state.inCar.heading);
    addStars(police, 1);
    audio.crash();
  }

  function exitCar() {
    const car = state.inCar;
    if (!car) return;
    const side = { x: car.x + Math.cos(car.heading) * 2.4, z: car.z - Math.sin(car.heading) * 2.4 };
    player.x = side.x;
    player.z = side.z;
    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.visible = true;
    state.inCar = null;
    render.setCameraYaw(player.heading);
  }

  function ensureStepEnemies() {
    const step = currentStep(missions);
    if (!step || !step.needKills) return;
    const key = missions.index * 10 + missions.step;
    if (state.enemiesSpawnedFor === key) return;
    state.enemiesSpawnedFor = key;
    clearEnemies(combat);
    const spots = missions.index === 2 ? BANK_GUARDS : YACHT_GUARDS;
    spawnEnemies(combat, spots, rng);
  }

  function ensureStepHeat() {
    const step = currentStep(missions);
    if (!step || !step.heat) return;
    const key = missions.index * 10 + missions.step;
    if (state.heatAppliedFor === key) return;
    state.heatAppliedFor = key;
    setStars(police, step.heat);
  }

  function handleMissionEvent(event) {
    if (event === 'step') {
      audio.cash();
      missions.banner = 'Objective complete';
      missions.bannerTimer = 3;
    } else if (event === 'mission') {
      const reward = rewardFor(missions.index - 1);
      state.cash += reward;
      audio.mission();
      missions.banner = `Mission complete — +$${reward}`;
      missions.bannerTimer = 4;
      saveGame();
      const next = currentMission(missions);
      if (next) startMission(missions);
    } else if (event === 'story') {
      state.cash += MISSION_REWARDS[4];
      audio.mission();
      saveGame();
      state.screen = SCREEN_STORY;
      hud.showScreen('King of Solmar', [
        'Reyes is done. The yacht, the bay, the whole city — yours.',
        `You finished with $${state.cash.toLocaleString('en-US')}. Free roam continues.`,
        'Find the gold cash cases, steal the fastest cars, keep the stars down.',
      ], 'Press Space to keep playing');
    }
  }

  // Reward lookup keeps the mission table the single source of truth.
  function rewardFor(index) {
    return MISSION_REWARDS[index] || 0;
  }

  function step(dt) {
    state.time += dt;
    state.elapsed += dt;
    state.clockMinutes += dt * 2;
    if (missions.bannerTimer > 0) missions.bannerTimer -= dt;
    if (state.screen !== SCREEN_PLAY) return;

    const actions = input.takeActions();
    const drag = input.takeDrag();
    const inCar = state.inCar !== null;
    // Shots stage scenes with a scripted autopilot instead of the keyboard.
    const throttle = state.auto ? state.auto.throttle : input.throttle();
    const steer = state.auto ? state.auto.steer : input.steer();

    if (actions & ACTION_PAUSE) {
      state.screen = SCREEN_PAUSED;
      hud.showScreen('Paused', ['Solmar Bay waits for you.', `Cash $${state.cash.toLocaleString('en-US')} · Mission ${Math.min(missions.index + 1, 5)} of 5`], 'Press P to resume · Space to continue');
      audio.setEngine(0, false);
      return;
    }
    if (actions & ACTION_ENTER_CAR) {
      if (inCar) exitCar();
      else {
        const car = nearestCar(6);
        if (car) enterCar(car);
      }
    }
    if (actions & ACTION_SHOOT && !inCar) {
      const hit = playerShoot(combat, render.camera, player, peds, police, traffic, (kind) => {
        if (kind === 'enemy') missions.kills += 1;
        else if (kind === 'ped') addStars(police, 1);
        else if (kind === 'cop') addStars(police, 2);
      });
      if (hit) {
        state.danger = true;
        audio.shoot();
        render.addShake(0.25);
        render.muzzleFlash(new THREE.Vector3(player.x, 1.5, player.z));
      }
    }
    if (inCar && actions & ACTION_SHOOT) audio.crash();

    const camYaw = render.cameraYaw;
    let speed = 0;
    let focus = { x: player.x, y: player.y, z: player.z };
    let heading = player.heading;
    if (inCar) {
      const car = state.inCar;
      const result = stepDrivenCar(car, throttle, steer, dt, city.colliders, (impact) => {
        damagePlayer(player, Math.round(impact / 6));
        audio.crash();
        render.addShake(0.5);
        if (player.health <= 0) {
          state.screen = SCREEN_WASTED;
          hud.showScreen('Wasted', ['The crash finished you.', 'You lose $200 and wake up at the Safehouse.'], 'Press Space to continue');
          audio.busted();
        }
      });
      speed = car.speed;
      focus = { x: car.x, y: 0, z: car.z };
      heading = car.heading;
      if (car.smoke > 0 && Math.random() < 0.5) {
        render.spawnSmoke(car.x - Math.sin(car.heading) * 1.8, 0.4, car.z - Math.cos(car.heading) * 1.8);
      }
      audio.setEngine(Math.abs(car.speed) / 42, true);
    } else {
      // On foot the autopilot walks forward; the keyboard steers otherwise.
      const footInput = state.auto
        ? { throttle: () => state.auto.throttle, steer: () => state.auto.steer, sprint: () => false }
        : input;
      stepPlayerOnFoot(player, footInput, camYaw, dt, city.colliders, { min: -HALF - 20, max: HALF + 20, maxZ: HALF + 44 });
      focus = { x: player.x, y: player.y, z: player.z };
      heading = player.heading;
      audio.setEngine(0, false);
    }

    stepTraffic(traffic, dt, city.colliders);
    stepPedestrians(peds, dt, state.danger || police.stars > 0);
    state.danger = false;
    stepPolice(police, dt, focus, Math.abs(speed), () => {
      state.screen = SCREEN_BUSTED;
      hud.showScreen('Busted', ['Solmar PD caught you.', 'You lose $200 and wake up at the Safehouse.'], 'Press Space to continue');
      audio.busted();
    }, (ramSpeed) => {
      damagePlayer(player, Math.round(ramSpeed / 5));
      audio.crash();
      render.addShake(0.6);
    });
    stepCombat(combat, dt, focus, (dmg) => {
      if (damagePlayer(player, dmg)) {
        state.screen = SCREEN_WASTED;
        hud.showScreen('Wasted', ['Solmar Bay is not done with you yet.', 'You lose $200 and wake up at the Safehouse.'], 'Press Space to continue');
        audio.busted();
      } else {
        audio.hit();
      }
    });
    audio.siren(police.sirenOn);

    // Cash pickups.
    for (const pickup of pickups) {
      if (pickup.taken) continue;
      pickup.spin += dt;
      pickup.mesh.rotation.y = pickup.spin;
      const d = Math.hypot(pickup.x - focus.x, pickup.z - focus.z);
      if (d < 2.2) {
        pickup.taken = true;
        pickup.mesh.visible = false;
        state.cash += PICKUP_VALUE;
        audio.cash();
        missions.banner = `Cash case +$${PICKUP_VALUE}`;
        missions.bannerTimer = 2;
      }
    }

    // Mission progression.
    if (missions.active) {
      ensureStepEnemies();
      ensureStepHeat();
      const event = advanceMission(missions, {
        inCar,
        stars: police.stars,
        x: focus.x,
        z: focus.z,
        places,
      });
      if (event) handleMissionEvent(event);
    }

    render.updateCamera(focus, heading, speed, dt, drag);
    render.stepEffects(dt);

    const target = missions.active ? missionTarget(missions, places) : null;
    const near = !inCar ? nearestCar(6) : null;
    hud.update({
      health: player.health,
      armor: player.armor,
      cash: state.cash,
      stars: police.stars,
      clockMinutes: state.clockMinutes,
      speed,
      inCar,
      objective: missionObjectiveText(),
      banner: missions.bannerTimer > 0 ? missions.banner : '',
      hint: inCar
        ? 'WASD drive · E exit car · H horn'
        : near
          ? `E — steal the ${near.name} · Click to shoot · R reload`
          : 'WASD move · Shift sprint · E near a car to steal · Click to shoot',
      time: state.time,
      playerX: focus.x,
      playerZ: focus.z,
      heading: render.cameraYaw,
      target,
      traffic,
      policeCars: police.copCars,
      policeFoot: police.footCops,
      colliders: city.colliders,
      roadCenters: city.centers,
    });
  }

  function handleScreenActions() {
    const actions = input.takeActions();
    if (state.screen === SCREEN_TITLE && (actions & ACTION_CONFIRM)) {
      audio.unlock();
      const save = loadSave();
      if (save && (save.missionIndex || 0) > 0) {
        // Continue where the save left off instead of restarting the story.
        applySave(save);
        setStars(police, 0);
        startMission(missions);
      } else {
        startStory();
      }
      state.screen = SCREEN_PLAY;
      hud.hideScreen();
    } else if (state.screen === SCREEN_PAUSED && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      state.screen = SCREEN_PLAY;
      hud.hideScreen();
    } else if ((state.screen === SCREEN_BUSTED || state.screen === SCREEN_WASTED) && (actions & ACTION_CONFIRM)) {
      respawnAtSafehouse(state.screen === SCREEN_WASTED ? 'wasted' : 'busted');
    } else if (state.screen === SCREEN_STORY && (actions & ACTION_CONFIRM)) {
      state.screen = SCREEN_PLAY;
      hud.hideScreen();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    // Menu screens own their input; while playing, step() is the only
    // consumer of actions, so a key press is never swallowed by the menu.
    if (state.screen !== SCREEN_PLAY) handleScreenActions();
    if (state.screen === SCREEN_TITLE) {
      // The title screen shows the living city: traffic and pedestrians move behind the menu.
      stepTraffic(traffic, dt, city.colliders);
      stepPedestrians(peds, dt, false);
      render.updateCamera({ x: places.plaza.x, y: 0, z: places.plaza.z }, state.time * 0.05, 0, dt, { dx: 0, dy: 0, dragging: false });
      render.stepEffects(dt);
      render.draw();
      return;
    }
    let acc = dt;
    while (acc >= STEP) {
      step(STEP);
      acc -= STEP;
    }
    if (state.screen === SCREEN_PLAY || state.screen === SCREEN_PAUSED) render.draw();
  }

  let last = performance.now();

  // R reloads the pistol; handled here so input.js stays about movement.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyR' && state.screen === SCREEN_PLAY) reload(combat);
    if (event.code === 'KeyM') audio.setMuted(!audio.isMuted());
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN_PLAY) {
      state.screen = SCREEN_PAUSED;
      hud.showScreen('Paused', ['Solmar Bay waits for you.'], 'Press P to resume');
    }
  });

  return {
    state,
    missions,
    player,
    traffic,
    peds,
    police,
    combat,
    pickups,
    places,
    city,
    render,
    hud,
    audio,
    input,
    step,
    startStory,
    applySave,
    saveGame,
    setStars: (n) => setStars(police, n),
    addStars: (n) => addStars(police, n),
    startMission,
    /** Staging helpers used by shots.js (and only there). */
    setAuto(auto) {
      state.auto = auto;
    },
    enterNearestCar() {
      const car = nearestCar(6);
      if (car) enterCar(car);
      return car;
    },
    teleportPlayer(x, z, heading) {
      player.x = x;
      player.z = z;
      player.heading = heading;
      player.mesh.position.set(x, 0, z);
      player.mesh.rotation.y = heading;
      render.setCameraYaw(heading);
    },
    setMission(index, stepIndex) {
      missions.index = index;
      missions.step = stepIndex;
      missions.kills = 0;
      missions.active = true;
      missions.banner = '';
      missions.bannerTimer = 0;
      state.heatAppliedFor = -1;
      state.enemiesSpawnedFor = -1;
    },
    showTitle() {
      hud.showScreen('SOLMAR BAY', [
        'An open-world crime story in a sun-soaked bay city.',
        'Steal cars, lose the cops, run five missions for Lena and Reyes.',
        'WASD move / drive · Mouse to look · E steal car · Click shoot · R reload · P pause',
      ], 'Press Space or click to start');
    },
    run() {
      this.showTitle();
      requestAnimationFrame(frame);
    },
  };
}
