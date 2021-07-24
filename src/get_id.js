/*
 * Get the toio id list
 */

const { NearScanner } = require('@toio/scanner');

const colors = [
  {
    "name": "green",
    "rgb": { red: 0, green: 255, blue: 0 }
  },
  {
    "name": "blue",
    "rgb": { red: 0, green: 0, blue: 255 }
  },
  {
    "name": "red",
    "rgb": { red: 255, green: 0, blue: 0 }
  },
  {
    "name": "black",
    "rgb": { red: 0, green: 0, blue: 0 }
  },
  {
    "name": "white",
    "rgb": { red: 255, green: 255, blue: 255 }
  },
  {
    "name": "magenta",
    "rgb": { red: 255, green: 0, blue: 255 }
  },
  {
    "name": "cyan",
    "rgb": { red: 0, green: 255, blue: 255 }
  },
  {
    "name": "yellow",
    "rgb": { red: 255, green: 255, blue: 0 }
  },
  {
    "name": "orange",
    "rgb": { red: 255, green: 165, blue: 0 }
  },
  {
    "name": "purple",
    "rgb": { red: 167, green: 87, blue: 168 }
  }
];

if (process.argv.length != 3) {
  console.log("the number of toio is required!");
  console.log("> yarn run get_id {integer}");
  process.exit(0);
}

const NUM_AGNETS = process.argv[2];

async function main() {
  // connection
  const cubes = await new NearScanner(NUM_AGNETS).start();

  for (let i = 0; i < NUM_AGNETS; ++i) {
    let color = colors[i % colors.length];
    console.log(cubes[i].id, i, color["name"]);
    let cube = await cubes[i].connect();
    setInterval(() => {
      cube.turnOnLight(Object.assign({durationMs: 990}, color["rgb"]));
    }, 1000);
  }
};

main();
