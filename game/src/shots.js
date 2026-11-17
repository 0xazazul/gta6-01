// The screenshot scenes behind ?shot=chase|drive|street|heist. Each one
// plays the real game forward from a staged state with the autopilot —
// stealing a car, driving through traffic, walking the plaza, facing the
// bank guards — so the frame is what real play looks like, and the same
// seed always gives the same frame. Nothing is composited or faked: the
// HUD, minimap, wanted stars and mission text are the live game.
import { STEP } from './config.js';

function runFor(game, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) game.step(STEP);
}

function paintReady(game) {
  let painted = 0;
  function paint() {
    game.render.draw();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

/** Steal the parked car by the plaza and point it down the road. */
function stealAndDrive(game, heading) {
  game.teleportPlayer(-7, 5, heading);
  game.enterNearestCar();
  const car = game.state.inCar;
  if (car) car.heading = heading;
}

/**
 * Stage the named scene and paint it. Unknown names fall back to 'street'.
 * The game object is the live game from game.js, already booted.
 */
export function stageShot(name, game) {
  const places = game.places;
  game.hud.hideScreen();
  game.state.screen = 'play';
  game.audio.setMuted(true);

  if (name === 'chase') {
    // A three-star police chase: Marco in a stolen sedan driving east down
    // the road, cop cars closing in, the mission objective live on the HUD.
    game.setMission(1, 0);
    stealAndDrive(game, Math.PI / 2);
    game.setStars(3);
    // Put two pursuing cop cars in the lanes beside and just ahead of the
    // player so the chase reads in the frame, and one behind.
    const px = -5;
    game.police.copCars.forEach((cop, i) => {
      if (i === 0) { cop.x = px + 18; cop.z = -4; }
      else if (i === 1) { cop.x = px + 30; cop.z = 10; }
      else { cop.x = px - 20; cop.z = 3; }
    });
    game.setAuto({ throttle: 1, steer: 0 });
    runFor(game, 1.5);
    game.setAuto(null);
  } else if (name === 'drive') {
    // Driving west through traffic on the plaza road, first mission live.
    game.setMission(0, 1);
    stealAndDrive(game, -Math.PI / 2);
    game.setAuto({ throttle: 1, steer: 0 });
    runFor(game, 3.5);
    game.setAuto(null);
  } else if (name === 'heist') {
    // On foot on the street facing the Bayfront Bank, its three guards out
    // on the sidewalk ahead, two stars already on the board.
    game.setMission(2, 1);
    game.setStars(2);
    // Face south (+z) toward the guards and the bank behind them.
    game.teleportPlayer(0, -58, 0);
    game.setAuto({ throttle: 0.25, steer: 0 });
    runFor(game, 1);
    game.setAuto(null);
    // The pursuit cars close in fast on foot: pull them to the far ends
    // of the street so the guards, not a ram, fill the frame.
    game.police.copCars.forEach((cop, i) => {
      cop.x = i % 2 === 0 ? -80 : 80;
      cop.z = -60;
    });
    game.police.footCops.forEach((cop, i) => {
      cop.x = i % 2 === 0 ? -30 : 30;
      cop.z = -58;
    });
    game.render.setCameraYaw(0);
  } else {
    // 'street': on foot at the plaza crossroads, looking north down the
    // road — pedestrians, traffic and the skyline in one frame.
    game.setMission(0, 0);
    game.teleportPlayer(0, 10, Math.PI);
    game.setAuto({ throttle: 0.2, steer: 0 });
    runFor(game, 5);
    game.setAuto(null);
    game.render.setCameraYaw(Math.PI);
  }
  paintReady(game);
}
