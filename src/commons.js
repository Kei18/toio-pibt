const { NearScanner } = require('@toio/scanner');
const { performance } = require('perf_hooks');

const POS_BUF = 15;
const INIT_TIME_MS = 1500;
const END_TIME_MS = 1500;
const GOAL_CHECK_MS = 1000;
const INTERVAL_MS = 50;
const MOVE_SPEED = 80;
const MODE = { "CONTRACTED": 0, "EXTENDED": 1 };

const stay_at = (pos, _pos) => {
  // judge by Manhattan distance
  return Math.abs(pos.x - _pos.x) < POS_BUF && Math.abs(pos.y - _pos.y) < POS_BUF;
};

const move = (cube, next_loc_id, AGENTS, OCCUPIED, V) => {
  const id = cube.id;

  // update occupancy
  OCCUPIED[next_loc_id] = id;

  // update mode
  AGENTS[id].mode = MODE.EXTENDED;

  // update other state
  AGENTS[id].v_next = next_loc_id;

  // move
  cube.moveTo([ V[next_loc_id].pos ], {maxSpeed: MOVE_SPEED, moveType: 2});
};

async function main (
  AGENTS,
  OCCUPIED,
  V,
  NUM_AGENTS,
  getInitialSate,
  activation,
  checkTerminalCondition
) {
  // setup OCCUPANCY
  Object.keys(V).forEach(id => { OCCUPIED[id] = null; });

  console.log("start connecting: ", NUM_AGENTS);

  // initialization
  const cubes = await new NearScanner(NUM_AGENTS).start();
  for (let i = 0; i < NUM_AGENTS; ++i) {
    console.log(cubes[i].id, i, "initialize");

    // connect to the cube
    let cube = await cubes[i].connect();

    // tracking position
    cube.on('id:position-id', data => {
      AGENTS[cube.id].pos = { "x": data["x"], "y": data["y"] };
    });

    // insert initial state
    AGENTS[cube.id] = getInitialSate(cube.id);

    let init_loc_id = AGENTS[cube.id].v;

    // update occupancy
    OCCUPIED[init_loc_id] = cube.id;

    // move to initial position
    cube.moveTo([ V[init_loc_id].pos ], {maxSpeed: MOVE_SPEED, moveType: 2});
  }
  console.log("---");

  // execution
  setTimeout(() => {
    // for time metrics
    const time_start = performance.now();
    let time_for_costs = {};
    Object.keys(AGENTS).forEach(id => { time_for_costs[id] = time_start; });

    // setup
    for (let i = 0; i < NUM_AGENTS; ++i) {
      let cube = cubes[i];
      console.log(cube.id, "start execution");
      cube.playPresetSound(4);

      // main loop
      setInterval(() => {
        // activation
        cube.turnOnLight({ durationMs: INTERVAL_MS, red: 0, green: 0, blue: 255 });
        activation(cube);
        // update cost
        if (AGENTS[cube.id].mode == MODE.EXTENDED) {
          time_for_costs[cube.id] = null;
        } else if (time_for_costs[cube.id] === null) {  // when EXTENDED -> CONTRACTED
          time_for_costs[cube.id] = performance.now();
        }
      }, INTERVAL_MS);
    }

    // check termination
    setInterval(() => {
      if (!checkTerminalCondition()) return;

      // print summary
      let makespan = 0;
      let sum_of_costs = 0;
      Object.keys(AGENTS).forEach(id => {
        const c = time_for_costs[id] - time_start;
        sum_of_costs += c;
        if (c > makespan) makespan = c;
      });
      console.log("finish execution");
      console.log("makespan (sec): ", makespan);
      console.log("sum_of_costs (sec): ", sum_of_costs);

      // lighting
      for (let i = 0; i < NUM_AGENTS; ++i) {
        cubes[i].turnOffLight();
        cubes[i].turnOnLight({ durationMs: END_TIME_MS, red: 0, green: 255, blue: 0 });
      }

      setTimeout(() => {process.exit(0);}, GOAL_CHECK_MS/2);
    }, GOAL_CHECK_MS);

  }, INIT_TIME_MS);
};

module.exports = {
  MODE: MODE,

  stay_at: stay_at,
  move: move,
  main: main,
};

// TODO: add metrics
