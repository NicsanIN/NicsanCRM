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


// Load environment variables
dotenv.config();

const app = express();
// Use 3001 by default for local backend
const PORT = Number(process.env.PORT) || 3001;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin:
      process.env.CORS_ORIGIN ||
      // Allow prod UI + local dev by default
      ['https://crm.nicsanin.com', 'http://localhost:5173'],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// --- Health checks ---
// New minimal health endpoint for ALB/ECS
app.get('/healthz', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(200).json({ status: 'ok' });
});

// Keep your original detailed health for manual checks
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Nicsan CRM Backend',
    version: '1.0.0',
  });
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

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start server (bind to 127.0.0.1 for local development)
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Nicsan CRM Backend running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check (ALB): http://localhost:${PORT}/healthz`);
  console.log(`🔗 Health check (verbose): http://localhost:${PORT}/health`);
});

export default app;
