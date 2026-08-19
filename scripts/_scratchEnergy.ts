/** Scratch, session 46: read-only energy + fishing-cap read. */
import { GigaverseClient } from "../src/api/client.js";
async function main() {
  const c = new GigaverseClient();
  const me = await c.getMe();
  const e = await c.getEnergy(me.address);
  console.log(JSON.stringify(e, null, 2));
}
main().catch((err) => { console.error(err); process.exit(1); });
