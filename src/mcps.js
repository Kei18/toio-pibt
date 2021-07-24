/*
 * implementation of MCPs
 */

const fs = require('fs');
const yaml = require('js-yaml');
const { NearScanner } = require('@toio/scanner');
const { execSync } = require('child_process');
const {
  MOVE_SPEED,
  MODE,
  stay_at,
  move,
  main,
} = require('./commons.js');


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

const setupVisitedCntTable = () => {
  Object.keys(V).forEach(id => { VISITED_COUNTS[id] = 0; });
};

const getNextLocation = (id) => {
  return PLANS[id].plan[Math.min(AGENTS[id].clock+1, PLANS[id].plan.length-1)];
};

const updateState = (cube) => {
  const id = cube.id;

  // staying
  if (AGENTS[id].mode == MODE.CONTRACTED) return;

  // still moving
  if (!stay_at(AGENTS[id].pos, V[AGENTS[id].v_next].pos)) return;

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

const checkTemporalDependencies = (id, next_loc_id) => {
  return VISITED_COUNTS[next_loc_id] == PLANS[id].order[AGENTS[id].clock + 1];
};

const activation = (cube) => {
  const id = cube.id;

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
  const other_id = OCCUPIED[next_loc_id];

  // case: occupied
  if (other_id != null) return;

  // case: unoccupied
  // check temporal dependencies
  if (checkTemporalDependencies(id, next_loc_id)) {
    move(cube, next_loc_id, AGENTS, OCCUPIED, V);
  }
};

const checkTerminalCondition = () => {
  for (let [id, agent] of Object.entries(AGENTS)) {
    if (agent.mode == MODE.EXTENDED) return false;  // still moving
    if (agent.clock != PLANS[id].plan.length - 1) return false;  // not at goal
  }
  return true;
};

setupVisitedCntTable();
const NUM_AGENTS = Object.keys(PLANS).length;
main(AGENTS, OCCUPIED, V, NUM_AGENTS, getInitialSate, activation, checkTerminalCondition);
