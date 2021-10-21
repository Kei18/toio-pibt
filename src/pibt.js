const fs = require('fs');
const yaml = require('js-yaml');
const { NearScanner } = require('@toio/scanner');

// define duration of one timestep
const INTERVAL_MS = 900;

// waiting time before execution
const SETUP_MS = 1000;

// move speed
const MOVE_SPEED = 50;

// info of all agents
let AGENTS = {};

// read graph
if (process.argv.length < 3) {
  console.log("> yarn run pibt {graph}.yaml {number of agents}");
  process.exit(0);
}
const filename_graph = process.argv[2];
const V = yaml.load(fs.readFileSync(filename_graph, 'utf8'));

let NUM_AGENTS = 1;
if (process.argv.length >= 4) NUM_AGENTS = process.argv[3];

// occupancy data
let occupied_now = {};
let occupied_next = {};

// DIST_TABLE[from][to] -> distance between from and to
let DIST_TABLE = {};

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

// move to another node
const move = (cube, next_loc_id) => {
  const id = cube.id;

  // move
  cube.moveTo([ V[next_loc_id].pos ], {maxSpeed: MOVE_SPEED, moveType: 2});
  console.log("agent-" + id + " moves to node-" + next_loc_id +
              " (" + V[next_loc_id].pos.x + ", " + V[next_loc_id].pos.y + ")");
};

// initialize agents
const setupAgents = (cube, tie_breaker) => {
  AGENTS[cube.id] = {
    "v_now": null,
    "v_next": null,
    "g": null,
    "p": tie_breaker,
    "tie_breaker": tie_breaker,
    "x": null,
    "y": null,
  };
};

// assign new goal
const assignGoalRandomly = (id) => {
  const arr = Object.keys(V);
  AGENTS[id].g = arr[Math.floor(Math.random() * arr.length)];
};

// used in initialization
const getNearestLocation = (id) => {
  const x = AGENTS[id].x;
  const y = AGENTS[id].y;
  let min_d2 = 1000000;
  let min_v_id = null;
  for (let [v_id, v] of Object.entries(V)) {
    d2 = Math.pow(v.pos.x - x, 2) + Math.pow(v.pos.y - y, 2);
    if (d2 < min_d2) {
      min_d2 = d2;
      min_v_id = v_id;
    }
  }
  return min_v_id;
};

// top-level procedure of PIBT
const planOneStep = () => {

  // update info
  occupied_now = {};
  occupied_next = {};
  Object.keys(AGENTS).forEach(id => {
    // update priority
    AGENTS[id].p = (AGENTS[id].v_now != AGENTS[id].g) ? AGENTS[id].p + 1 : AGENTS[id].tie_breaker;

    // update location
    const v = AGENTS[id].v_next;
    AGENTS[id].v_now = v;
    AGENTS[id].v_next = null;
    occupied_now[v] = id;
  });

  // sort agents
  const sorted_id_list = Object.keys(AGENTS).sort((a, b) => { return AGENTS[b].p - AGENTS[a].p; });

  // planning
  sorted_id_list.forEach(id => {
    if (AGENTS[id].v_next == null) funcPIBT(id, null);
  });
};

// function to execute priority inheritance and backtracking
const funcPIBT = (id_i, id_j) => {
  // setup candidates
  let C = V[AGENTS[id_i].v_now].neigh.concat([AGENTS[id_i].v_now]);

  // sort C
  const g_i = AGENTS[id_i].g;
  C.sort((u, v) => {
    const diff = DIST_TABLE[u][g_i] - DIST_TABLE[v][g_i];
    if (diff != 0) return diff;

    // tie-break
    if (occupied_now[u] && occupied_now[u] != id_i) return -1;
    return 1;
  });

  for (const v of C) {
    // avoid vertex conflict
    if (occupied_next[v]) continue;

    // avoid swap conflict
    if (id_j != null && AGENTS[id_j].v_now == v) continue;

    // reservation
    AGENTS[id_i].v_next = v;
    occupied_next[v] = id_i;

    // priority inheritance
    if (occupied_now[v]) {
      const id_k = occupied_now[v];
      if (AGENTS[id_k].v_next == null && !funcPIBT(id_k, id_i)) {
        // re-planning
        continue;
      }
    }

    // backtracking, valid
    return true;
  }

  // stay at current location
  AGENTS[id_i].v_next = AGENTS[id_i].v_now;

  // backtracking, invalid
  return false;
};

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main () {
  setupDistTable();

  // establish connection with robots
  const cubes = await new NearScanner(NUM_AGENTS).start();
  for (let i = 0; i < NUM_AGENTS; ++i) {
    console.log(cubes[i].id, i, "initialize");

    // connect to the cube
    let cube = await cubes[i].connect();

    setupAgents(cube, i / NUM_AGENTS);

    // tracking position
    cube.on('id:position-id', data => {
      AGENTS[cube.id].x = data["x"];
      AGENTS[cube.id].y = data["y"];
    });
  }
  await sleep(SETUP_MS);

  // initialize
  for (let i = 0; i < NUM_AGENTS; ++i) {
    let cube = cubes[i];

    // move to the nearest node
    const init_v = getNearestLocation(cube.id);
    move(cube, init_v);
    AGENTS[cube.id].v_now = init_v;
    AGENTS[cube.id].v_next = init_v;

    // task allocation
    assignGoalRandomly(cube.id);
  }
  await sleep(SETUP_MS);
  console.log("---");

  // start lifelong MAPF
  setInterval(() => {
    // planning
    planOneStep();

    // acting
    for (let i = 0; i < NUM_AGENTS; ++i) {
      let cube = cubes[i];
      let id = cube.id;
      move(cube, AGENTS[id].v_next);

      // update goal
      if (AGENTS[id].v_next == AGENTS[id].g) {
        cube.turnOnLight({ durationMs: 200, red: 0, green: 255, blue: 0 });
        assignGoalRandomly(id);
        let g_id = AGENTS[id].g;
        console.log("agent-" + id + " updates the goal to node-" + g_id +
                    " (" + V[g_id].pos.x + ", " + V[g_id].pos.y + ")");
      }
    }
  }, INTERVAL_MS);
};

main();
