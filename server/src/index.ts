import createApp from './app.ts';
import config from './config.ts';
import database from './db/index.ts';
import { migrateToLatest } from './db/migrate.ts';

async function startServer() {
  try {
    if (config.NODE_ENV === 'development' || config.NODE_ENV === 'production') {
      await migrateToLatest(database);
      console.log('Database migrations completed');
    }
  } catch (error) {
    console.error('Failed to run migrations:', error);
    process.exit(1);
  }

  const app = createApp(database);

  const server = app.listen(config.SERVER_PORT, () => {
    console.log('Listening on port ' + config.SERVER_PORT);
  });

  server.on('error', (error) => {
    console.error(`Failed to start server on port ${config.SERVER_PORT}:`, error.message);
    process.exit(1);
  });
}

startServer();
