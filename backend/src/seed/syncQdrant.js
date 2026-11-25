import { pathToFileURL } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { syncAllJobsToQdrant } from '../services/jobService.js';

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  (async () => {
    const connected = await connectDatabase();
    if (!connected) {
      console.error('[Sync] Cannot sync jobs without a valid MONGO_URI.');
      process.exit(1);
    }

    const result = await syncAllJobsToQdrant();
    if (!result.available) {
      console.error(`[Sync] Qdrant/AI service unavailable: ${result.reason}`);
      await disconnectDatabase();
      process.exit(1);
    }

    console.log(
      `[Sync] Indexed ${result.indexedCount} of ${result.totalJobs} MongoDB jobs into Qdrant.`
    );
    await disconnectDatabase();
  })();
}
