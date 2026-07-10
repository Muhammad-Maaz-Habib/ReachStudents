import { purgeExpiredTripLocationCheckIns } from "../src/lib/emergency/trip-location-retention";

async function main() {
  const result = await purgeExpiredTripLocationCheckIns();
  console.log(
    `Purged ${result.deleted} trip location check-in(s) older than ${result.cutoff}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
