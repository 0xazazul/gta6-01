// Boot: read the URL, build the game, and either stage a screenshot scene
// (?shot=chase|drive|street|heist, with &seed=N) or run the title screen.
// ?seed=N fixes the city layout and traffic; without it the seed is random.
import { createGame } from './game.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const game = createGame(canvas, document, seed);

if (shot) {
  stageShot(shot, game);
} else {
  game.run();
}
