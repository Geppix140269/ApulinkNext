import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import dashboardRoutes from './routes/dashboard';
import { automationService } from './services/AutomationService';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'OK', 
      timestamp: new Date(),
      database: 'Connected',
      automation: 'Running'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      timestamp: new Date(),
      error: error.message
    });
  }
});

// API Routes
app.use('/api/dashboard', dashboardRoutes);

// Listen to automation events
automationService.on('lowHealth', (data) => {
  console.log('⚠️ Low health detected:', data);
  // Here we would send notifications
});

automationService.on('deadlineApproaching', (data) => {
  console.log('📅 Deadline approaching:', data);
  // Send reminder notifications
});

automationService.on('insightsGenerated', (data) => {
  console.log('💡 New insights generated');
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║                                           ║
║   🚀 ApuLink Next Generation Backend      ║
║                                           ║
║   Server:     http://localhost:${PORT}      ║
║   Health:     http://localhost:${PORT}/health║
║   Dashboard:  http://localhost:${PORT}/api/dashboard/:userId║
║                                           ║
║   Status: RUNNING                         ║
║   Database: PostgreSQL + Firebase         ║
║   Automation: ACTIVE                      ║
║                                           ║
╚═══════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  automationService.stopAutomation();
  await prisma.$disconnect();
  process.exit(0);
});

export { prisma };