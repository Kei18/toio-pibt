const { NearScanner } = require('@toio/scanner');

if (process.argv.length != 3) {
  console.log("the number of toio is required!");
  console.log("> yarn run get_id {integer}");
}

const NUM_AGNETS = process.argv[2];

async function main() {
  // connection
  const cubes = await new NearScanner(NUM_AGNETS).start();

  for (let i = 0; i < NUM_AGNETS; ++i) {
    console.log(cubes[i].id);
  }

  process.exit(0);
};

main();
