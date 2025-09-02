// Centralized shutdown handling with detailed logging
let isShuttingDown = false;

export async function shutdown(reason: string, err?: unknown) {
  if (isShuttingDown) {
    console.log('🔄 Shutdown already in progress, ignoring duplicate call');
    return;
  }
  
  isShuttingDown = true;
  console.error('🟥 SHUTDOWN TRIGGERED — reason:', reason);
  if (err) {
    console.error('🟥 Error details:', err);
    if (err instanceof Error) {
      console.error('🟥 Error stack:', err.stack);
    }
  }
  
  try {
    // Import pool here to avoid circular dependencies
    const pool = (await import('../config/database')).default;
    console.log('🔄 Shutting down database connections...');
    await pool.end();
    console.log('✅ Database connections closed');
  } catch (shutdownErr) {
    console.error('❌ Error during shutdown:', shutdownErr);
  } finally {
    console.log('🔄 Process exiting...');
    process.exit(err ? 1 : 0);
  }
}

// Set up signal handlers
export function setupShutdownHandlers() {
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (err) => shutdown('uncaughtException', err));
  process.on('unhandledRejection', (err) => shutdown('unhandledRejection', err as any));
  
  console.log('🛡️ Shutdown handlers registered');
}
