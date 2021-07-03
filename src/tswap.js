const fs = require('fs');
const yaml = require('js-yaml');
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
  console.log("> yarn run tswap {node-info}.yaml {problem-info}.yaml");
  process.exit(0);
}
const filename_graph = process.argv[2];
const filename_problem = process.argv[3];

// store all nodes
const V = yaml.load(fs.readFileSync(filename_graph, 'utf8'));

// store states of all agents
// key: cube.id, value: id, v, g, mode, pos, v_next
let AGENTS = {};

// used for collision avoidance
// key: node.id, value: agent.id or null
let OCCUPIED = {};

// DIST_TABLE[from][to] -> distance between from and to
let DIST_TABLE = {};

let INIT_STATES = {};

const setInitialAssignment = () => {
  const filename_output = 'build/assignment.yaml';
  const command = "./build/ta " + filename_graph + " " + filename_problem + " " + filename_output;
  execSync(command);
  INIT_STATES = yaml.load(fs.readFileSync(filename_output), 'utf8');
};

const getInitialSate = (id) => {
  return {
    "id": id,
    "v": INIT_STATES[id].v,
    "g": INIT_STATES[id].g,
    "v_next": null,
    "mode": MODE.CONTRACTED,
    "pos": {},
  };
};

const setupDistTable = () => {
  // Floyd Warshall Algorithm
  const MAX_LEN = 10000000;

  // initialize
  for (let [i, v] of Object.entries(V)) {
    DIST_TABLE[i] = {};
    for (let [j, _] of Object.entries(V)) {
      if (i == j) {
        DIST_TABLE[i][j] = 0;
      } else if (v.neigh.includes(j)) {
        DIST_TABLE[i][j] = Math.sqrt(
          Math.pow(v.pos.x - V[j].pos.x, 2) + Math.pow(v.pos.y - V[j].pos.y, 2)
        );
      } else {
        DIST_TABLE[i][j] = MAX_LEN;
      }
    }
  }

  // update
  for (let [k, _] of Object.entries(V)) {
    for (let [i, _] of Object.entries(V)) {
      for (let [j, _] of Object.entries(V)) {
        DIST_TABLE[i][j] = Math.min(DIST_TABLE[i][j], DIST_TABLE[i][k] + DIST_TABLE[k][j]);
      }
    }
  }
};

const getNextLocation = (v_id, g_id, agent_id) => {
  // return argmin(dist(u, g))
  let v_next_id = v_id;
  let min_d = DIST_TABLE[v_id][g_id];
  let cands = [];
  V[v_id].neigh.forEach((u_id) => {
    let d = DIST_TABLE[u_id][g_id];
    if (d < min_d) {
      min_d = d;
      v_next_id = u_id;
      cands = [ v_next_id ];
    } else if (d == min_d) {
      cands.push(u_id);
    }
  });
  return cands[parseInt(agent_id, 16) % cands.length];
};

const updateState = (cube) => {
  const id = cube.id;

  // staying
  if (AGENTS[id].mode == MODE.CONTRACTED) return;

  // still moving
  if (!stay_at(AGENTS[id].pos, V[AGENTS[id].v_next].pos)) return;

  // update mode
  AGENTS[id].mode = MODE.CONTRACTED;

  // update occupancy
  OCCUPIED[AGENTS[id].v] = null;

  // update location
  AGENTS[id].v = AGENTS[id].v_next;
  AGENTS[id].v_next = null;
};

const swapGoals = (agent1, agent2) => {
  const tmp = AGENTS[agent1].g;
  AGENTS[agent1].g = AGENTS[agent2].g;
  AGENTS[agent2].g = tmp;
};

const checkAndResolveDeadlock = (original_id) => {
  let A = [ original_id ];
  let agent = AGENTS[original_id];

  while (true) {
    if (agent.mode == MODE.EXTENDED) return;  // still someone is moving -> wait
    if (agent.v == agent.g) return;  // agents reaching goals -> not deadlock

    let u_id = getNextLocation(agent.v, agent.g, agent.id);
    let id = OCCUPIED[u_id];

    if (id == null) return;  // next_loc is free -> not deadlock

    // detecting deadlock
    if (id == original_id) {
      // rotate goals
      const g = AGENTS[A[A.length - 1]].g;
      for (let i = A.length - 1; i > 0; --i) {
        AGENTS[A[i]].g = AGENTS[A[i-1]].g;
      }
      AGENTS[A[0]].g = g;
      return;
    }

    if (A.includes(id)) return;  // there are deadlocks without original_id

    agent = AGENTS[id];
    A.push(agent.id);
  }

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
  if (me.v == me.g) return;

  // get next location
  const next_loc_id = getNextLocation(me.v, me.g, me.id);

  // check occupancy
  const other_id = OCCUPIED[next_loc_id];

  // case: unoccupied
  if (other_id == null) {
    move(cube, next_loc_id, AGENTS, OCCUPIED, V);
    return;
  }

  const other = AGENTS[other_id];

  // case: occupied, still moving
  if (other.mode == MODE.EXTENDED) return;  // wait

  // case: occupied, staying at goal
  if (other.v == other.g) {
    swapGoals(id, other.id);
    return;
  }

  // case: others -> check deadlocks
  checkAndResolveDeadlock(id);
};

const checkTerminalCondition = () => {
  for (let [id, agent] of Object.entries(AGENTS)) {
    if (agent.mode == MODE.EXTENDED) return false;  // still moving
    if (agent.v != agent.g) return false;  // not at goal
  }
  return true;
};

setupDistTable();
setInitialAssignment();
const NUM_AGENTS = Object.entries(INIT_STATES).length;
main(AGENTS, OCCUPIED, V, NUM_AGENTS, getInitialSate, activation, checkTerminalCondition);
