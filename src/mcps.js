const fs = require('fs');
const yaml = require('js-yaml');
const { NearScanner } = require('@toio/scanner');
const { execSync } = require('child_process');

const INTERVAL_MS = 100;
const MOVE_SPEED = 80;
const POS_BUF = 10;
const INIT_TIME_MS = 1500;
const GOAL_CHECK_MS = 1000;
const END_TIME_MS = 1500;

const MODE = { "CONTRACTED": 0, "EXTENDED": 1 };

// read graph
if (process.argv.length != 4) {
  console.log("planning file is required!");
  console.log("> yarn run mcps {node-info}.yaml {plan-info}.yaml");
  process.exit(0);
}

const filename_graph = process.argv[2];
const filename_plan = process.argv[3];

// store all nodes
const V = yaml.load(fs.readFileSync(filename_graph, 'utf8'));

// store states of all agents
// key: cube.id, value: id, v, g, mode, pos, v_next
let AGENTS = {};

// used for collision avoidance
// key: node.id, value: agent.id or null
let OCCUPIED = {};

// used for preserving temporal dependencies
// key: node.id, value: int
let VISITED_COUNTS = {};

const PLANS = yaml.load(fs.readFileSync(filename_plan, 'utf8'));

const getInitialSate = (id) => {
  return {
    "id": id,
    "v": PLANS[id].plan[0],
    "v_next": null,
    "clock": 0,
    "mode": MODE.CONTRACTED,
    "pos": {}
  };
};

const setupOccupiedTable = () => {
  Object.keys(V).forEach(id => { OCCUPIED[id] = null; });
};

const setupVisitedCntTable = () => {
  Object.keys(V).forEach(id => { VISITED_COUNTS[id] = 0; });
};

const getNextLocation = (id) => {
  return PLANS[id].plan[Math.min(AGENTS[id].clock+1, PLANS[id].plan.length-1)];
};

const stay_at = (pos, v_next_id) => {
  // judge by Manhattan distance
  const _pos = V[v_next_id].pos;
  return Math.abs(pos.x - _pos.x) < POS_BUF && Math.abs(pos.y - _pos.y) < POS_BUF;
};

const updateState = (cube) => {
  const id = cube.id;

  // staying
  if (AGENTS[id].mode == MODE.CONTRACTED) return;

  // still moving
  if (!stay_at(AGENTS[id].pos, AGENTS[id].v_next)) return;

  // update mode
  AGENTS[id].mode = MODE.CONTRACTED;

  // update visited counts
  VISITED_COUNTS[AGENTS[id].v] += 1;

  // increment internal clock
  AGENTS[id].clock += 1;

  // update occupancy
  OCCUPIED[AGENTS[id].v] = null;

  // update location
  AGENTS[id].v = AGENTS[id].v_next;
  AGENTS[id].v_next = null;
};

const getOccupyingAgentId = (next_loc_id) => {
  return OCCUPIED[next_loc_id];
};

const initCube = (cube, init_loc_id) => {
  // update occupancy
  OCCUPIED[init_loc_id] = cube.id;

  // move
  cube.moveTo([ V[init_loc_id].pos ], {maxSpeed: MOVE_SPEED, moveType: 2});
};

const move = (cube, next_loc_id) => {
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

const checkTemporalDependencies = (id, next_loc_id) => {
  return VISITED_COUNTS[next_loc_id] == PLANS[id].order[AGENTS[id].clock + 1];
};

async function execution(cube) {

  const id = cube.id;

  console.log(id, "start execution");
  cube.playPresetSound(4);

  // activation
  setInterval(() => {

    cube.turnOnLight({ durationMs: INTERVAL_MS, red: 0, green: 0, blue: 255 });

    // update state
    updateState(cube);

    // get state
    const me = AGENTS[id];

    // still moving
    if (me.mode == MODE.EXTENDED) return;

    // check goal condition
    if (me.clock == PLANS[id].plan.length - 1) return;

    // get next location
    const next_loc_id = getNextLocation(id);

    // check occupancy
    const other_id = getOccupyingAgentId(next_loc_id);

    // case: occupied
    if (other_id != null) return;

    // case: unoccupied
    // check temporal dependencies
    if (checkTemporalDependencies(id, next_loc_id)) {
      move(cube, next_loc_id);
    }

  }, INTERVAL_MS);
}

async function main() {
  setupOccupiedTable();
  setupVisitedCntTable();

  console.log("start assignment");
  const NUM_AGENTS = Object.keys(PLANS).length;

  console.log("done, start connecting: ", NUM_AGENTS);

  // initialization
  const cubes = await new NearScanner(NUM_AGENTS).start();
  for (let i = 0; i < NUM_AGENTS; ++i) {
    console.log(cubes[i].id, i, "initialize");

    // connect to the cube
    let cube = await cubes[i].connect();

    // get initial state and register
    AGENTS[cube.id] = getInitialSate(cube.id);

    // tracking position
    cube.on('id:position-id', data => {
      AGENTS[cube.id].pos = { "x": data["x"], "y": data["y"] };
    });

    // move to initial position
    initCube(cube, AGENTS[cube.id].v);
  }
  console.log("---");

  // execution
  setTimeout(() => {
    for (let i = 0; i < NUM_AGENTS; ++i) execution(cubes[i]);
  }, INIT_TIME_MS);

  // check termination
  setInterval(() => {
    for (let [id, agent] of Object.entries(AGENTS)) {
      if (agent.mode == MODE.EXTENDED) return;  // still moving
      if (agent.clock != PLANS[id].plan.length - 1) return;  // not at goal
    }

    console.log("finish execution");
    for (let i = 0; i < NUM_AGENTS; ++i) {
      cubes[i].turnOffLight();
      cubes[i].turnOnLight({ durationMs: END_TIME_MS, red: 0, green: 255, blue: 0 });
    }

    setTimeout(() => {process.exit(0);}, GOAL_CHECK_MS/2);
  }, GOAL_CHECK_MS);
};

main();
