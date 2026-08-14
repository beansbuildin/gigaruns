/**
 * scripts/checkAuth.ts — Task 2 gate.
 *
 * 1. Real JWT: GET /user/me, then /game/account/{address}. Prints username
 *    and noob ID.
 * 2. Corrupted JWT: same call, must halt cleanly with TokenExpiredError, not
 *    crash or retry-loop.
 *
 * Read-only. Never touches a dungeon or fishing endpoint.
 */

import { GigaverseClient } from "../src/api/client.js";
import { loadJwt } from "../src/api/auth.js";
import { TokenExpiredError } from "../src/api/errors.js";

async function main() {
  console.log("▸ real JWT");
  const jwt = loadJwt();
  const client = new GigaverseClient({ jwt });
  console.log(`  jwt ${client.maskedJwt()}`);

  const me = await client.getMe();
  console.log(`  /user/me -> address ${me.address}  canEnterGame ${me.canEnterGame}`);

  const account = await client.getAccount(me.address);
  console.log(`  /game/account -> username "${account.username ?? "(none)"}"` + `  noobId ${account.noob?.docId ?? "(none)"}`);

  console.log("\n▸ corrupted JWT — expecting a clean halt, not a crash loop");
  // Flip characters in the middle of the token so it fails signature
  // verification without changing its length or shape.
  const corrupted = jwt.slice(0, -10) + "XXXXXXXXXX";
  const badClient = new GigaverseClient({ jwt: corrupted });
  try {
    await badClient.getMe();
    console.log("  ✗ FAIL — corrupted JWT was accepted. This should never happen.");
    process.exitCode = 1;
    return;
  } catch (e) {
    if (e instanceof TokenExpiredError) {
      console.log(`  ✓ halted cleanly: ${e.message} (status ${e.status})`);
    } else {
      console.log(`  ✗ FAIL — wrong error type: ${(e as Error).name}: ${(e as Error).message}`);
      process.exitCode = 1;
      return;
    }
  }

  console.log("\n✓ Task 2 gate passed.");
}

main().catch((e) => {
  console.error("\n✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
