// Missions and the story of Solmar Bay. Five missions, each a chain of
// steps with a target place and a line of dialogue: Marco Solis, a driver
// for hire, works his way up from a stolen sedan to the yacht of the man
// who runs the bay. Completing a mission pays cash, advances the story and
// saves the game. Free roam continues after the last one.
import { MISSION_REWARDS } from './config.js';

export const MISSIONS = [
  {
    id: 1,
    title: 'First Fare',
    giver: 'Lena',
    intro: 'Lena: "Marco, I need wheels. Steal any car on the street and bring it to the Docks."',
    steps: [
      { text: 'Steal a car (press E near one)', place: null, needCar: true },
      { text: 'Drive to the Docks', place: 'docks', needCar: true },
    ],
    reward: MISSION_REWARDS[0],
  },
  {
    id: 2,
    title: 'The Pickup',
    giver: 'Lena',
    intro: 'Lena: "Pick me up at the Marina. The cops are watching the Strip — expect heat."',
    steps: [
      { text: 'Drive to the Marina', place: 'marina', needCar: false },
      { text: 'Escape the police — lose the wanted level', place: null, needWanted: 0, heat: 2 },
    ],
    reward: MISSION_REWARDS[1],
  },
  {
    id: 3,
    title: 'Bayfront Heist',
    giver: 'Reyes',
    intro: 'Reyes: "The Bayfront Bank keeps its cash in the back room. Take it. The guards will not just watch."',
    steps: [
      { text: 'Go to the Bayfront Bank', place: 'bank', needCar: false },
      { text: 'Take out the 3 bank guards', place: 'bank', needKills: 3, heat: 3 },
      { text: 'Grab the cash and reach the Safehouse', place: 'safehouse', needCar: false },
    ],
    reward: MISSION_REWARDS[2],
  },
  {
    id: 4,
    title: 'Heat on the Strip',
    giver: 'Lena',
    intro: 'Lena: "Reyes set us up. Four stars, Marco. Lose them and meet me at the Safehouse."',
    steps: [
      { text: 'Survive the 4-star manhunt', place: null, needWanted: 0, heat: 4 },
      { text: 'Reach the Safehouse', place: 'safehouse', needCar: false },
    ],
    reward: MISSION_REWARDS[3],
  },
  {
    id: 5,
    title: 'King of Solmar',
    giver: 'Reyes',
    intro: 'Reyes: "You want the bay? Come take it. My crew is on the yacht. Bring a gun."',
    steps: [
      { text: 'Go to the Yacht at the Marina', place: 'yacht', needCar: false },
      { text: 'Take out Reyes and his 4 guards', place: 'yacht', needKills: 5, heat: 3 },
      { text: 'Claim the Yacht — Solmar Bay is yours', place: 'yacht', needCar: false },
    ],
    reward: MISSION_REWARDS[4],
  },
];

export function createMissions() {
  return {
    index: 0,
    step: 0,
    kills: 0,
    active: false,
    done: false,
    banner: '',
    bannerTimer: 0,
  };
}

export function currentMission(missions) {
  if (missions.index >= MISSIONS.length) return null;
  return MISSIONS[missions.index];
}

export function currentStep(missions) {
  const mission = currentMission(missions);
  if (!mission) return null;
  return mission.steps[missions.step] || null;
}

export function startMission(missions) {
  const mission = currentMission(missions);
  if (!mission) return null;
  missions.active = true;
  missions.step = 0;
  missions.kills = 0;
  missions.banner = `${mission.title} — ${mission.intro}`;
  missions.bannerTimer = 6;
  return mission;
}

export function missionTarget(missions, places) {
  const step = currentStep(missions);
  if (!step || !step.place) return null;
  return places[step.place] || null;
}

/**
 * Advance the mission chain. Returns an event string when a step or a
 * mission completes: 'step', 'mission', 'story' — or null.
 */
export function advanceMission(missions, context) {
  const mission = currentMission(missions);
  if (!mission || !missions.active) return null;
  const step = currentStep(missions);
  if (!step) return null;
  if (step.needCar && !context.inCar) return null;
  if (step.needWanted !== undefined && context.stars !== step.needWanted) return null;
  if (step.needKills && missions.kills < step.needKills) return null;
  if (step.place) {
    const target = context.places[step.place];
    if (!target) return null;
    const dist = Math.hypot(context.x - target.x, context.z - target.z);
    if (dist > 9) return null;
  }
  missions.step += 1;
  missions.kills = 0;
  if (missions.step >= mission.steps.length) {
    missions.index += 1;
    missions.active = false;
    missions.step = 0;
    if (missions.index >= MISSIONS.length) {
      missions.done = true;
      return 'story';
    }
    return 'mission';
  }
  return 'step';
}
