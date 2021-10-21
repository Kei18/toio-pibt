const { NearestScanner } = require('@toio/scanner');

async function main() {
  const cube = await new NearestScanner().start();
  cube.connect();
  cube.on('id:position-id', data => console.log('[POS ID]', data));
}

main();
