import "dotenv/config"; // must be first import
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import policyRoutes from './routes/policies';
import userRoutes from './routes/users';
import uploadRoutes from './routes/upload';
import uploadsRoutes from './routes/uploads';
import dashboardRoutes from './routes/dashboard';
import settingsRoutes from './routes/settings';
import reviewRoutes from './routes/review';
import extractRoutes from './routes/extract';
import pool, { testDatabaseConnection } from './config/database';
import { setupShutdownHandlers, shutdown } from './utils/shutdown';
import "dotenv/config"; // loads .env into process.env


// Load environment variables
dotenv.config();

const app = express();
// Use 3001 by default for local backend
const PORT = Number(process.env.PORT) || 3001;

// CORS FIRST - before any other middleware
app.use(cors({
  origin: ['http://localhost:5174', 'http://localhost:5173', 'http://localhost:5175'],
  credentials: false, // you're authing with Bearer, not cookies
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.options('*', cors());

// Then other middleware
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, _res, next) => { 
  console.log('[REQ]', req.method, req.originalUrl); 
  next(); 
});

// --- Health checks ---
// New minimal health endpoint for ALB/ECS
app.get('/healthz', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(200).json({ status: 'ok' });
});

// Keep your original detailed health for manual checks
app.get('/health', async (req, res) => {
  try {
    // Test database connectivity
    const dbTest = await pool.query('SELECT 1 as test');
    const dbStatus = dbTest.rows[0]?.test === 1 ? 'connected' : 'disconnected';
    
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'Nicsan CRM Backend',
      version: '1.0.0',
      database: dbStatus,
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      service: 'Nicsan CRM Backend',
      version: '1.0.0',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', uploadsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api', reviewRoutes);
app.use('/api/extract', extractRoutes);

console.log('🧭 Routes mounted: /api/auth/*, /api/policies/*, /api/users/*, /api/upload/*, /api/uploads/*, /api/dashboard/*, /api/settings/*, /api/uploads/*/confirm-save, /api/extract/*');

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Main startup function
async function main() {
  try {
    console.log('🚀 Starting backend...');
    
    // Set up shutdown handlers first
    setupShutdownHandlers();
    
    // Test database connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }
    
    // Start the server
    const server = app.listen(PORT, '127.0.0.1', () => {
      console.log('✅ Server listening on port', PORT);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check (ALB): http://localhost:${PORT}/healthz`);
      console.log(`🔗 Health check (verbose): http://localhost:${PORT}/health`);
    });
    
    // Store server reference for graceful shutdown
    (global as any).__server = server;
    
    console.log('🎉 Backend startup completed successfully');
    
  } catch (error) {
    console.error('💥 Backend startup failed:', error);
    await shutdown('boot-failed', error);
  }
}

// Start the application
main().catch(err => {
  console.error('💥 Unhandled error in main():', err);
  shutdown('main-unhandled', err);
});

export default app;
