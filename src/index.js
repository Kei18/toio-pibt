const { NearScanner } = require('@toio/scanner');

const INTERVAL_MS = 100;
const MOVE_SPEED = 80;
const POS_BUF = 10;
const INIT_TIME_MS = 1500;
const GOAL_CHECK_MS = 1000;
const END_TIME_MS = 1500;

const MODE = { "CONTRACTED": 0, "EXTENDED": 1 };

// read graph
const fs = require('fs');
const yaml = require('js-yaml');


// store all nodes
const V = yaml.load(fs.readFileSync("sample/graph.yaml", 'utf8'));

// store states of all agents
// key: cube.id, value: id, v, g, mode, pos, v_next
let AGENTS = {};

// used for collision avoidance
// key: node.id, value: agent.id or null
let OCCUPIED = {};

// DIST_TABLE[from][to] -> distance between from and to
let DIST_TABLE = {};

const INIT_STATES = yaml.load(fs.readFileSync("sample/init_agents.yaml", 'utf8'));

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

const setupOccupiedTable = () => {
  Object.keys(V).forEach(id => { OCCUPIED[id] = null; });
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

const getNextLocation = (v_id, g_id) => {
  // return argmin(dist(u, g))
  let v_next_id = v_id;
  let min_d = DIST_TABLE[v_id][g_id];
  V[v_id].neigh.forEach((u_id) => {
    let d = DIST_TABLE[u_id][g_id];
    if (d < min_d) {
      min_d = d;
      v_next_id = u_id;
    }
  });
  return v_next_id;
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

    let u_id = getNextLocation(agent.v, agent.g);
    let id = getOccupyingAgentId(u_id);

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

async function exec(cube) {

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
    if (me.v == me.g) return;

    // get next location
    const next_loc_id = getNextLocation(me.v, me.g);

    // check occupancy
    const other_id = getOccupyingAgentId(next_loc_id);

    // case: unoccupied
    if (other_id == null) {
      move(cube, next_loc_id);
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

  }, INTERVAL_MS);
}

async function main() {
  const NUM_AGENTS = Object.keys(INIT_STATES).length;

  setupOccupiedTable();
  setupDistTable();

  // initialization
  const cubes = await new NearScanner(NUM_AGENTS).start();
  for (let i = 0; i < NUM_AGENTS; ++i) {
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
    for (let i = 0; i < NUM_AGENTS; ++i) exec(cubes[i]);
  }, INIT_TIME_MS);

  // check termination
  setInterval(() => {
    for (let [id, agent] of Object.entries(AGENTS)) {
      if (agent.mode == MODE.EXTENDED) return;  // still moving
      if (agent.v != agent.g) return;  // not at goal
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
