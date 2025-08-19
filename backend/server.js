const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'ApuLink Backend is running!',
    timestamp: new Date()
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    message: 'Test endpoint working',
    data: {
      version: '1.0.0',
      environment: 'sandbox'
    }
  });
});

// ADD THIS ROUTE FOR PROJECTS
app.get('/api/projects', (req, res) => {
  res.json({
    success: true,
    message: 'Projects endpoint working',
    projects: [
      {
        id: '1',
        name: 'Villa Renovation',
        budget: 50000,
        status: 'active'
      },
      {
        id: '2',
        name: 'Restaurant Project',
        budget: 120000,
        status: 'planning'
      }
    ]
  });
});

// ADD DASHBOARD ENDPOINT
app.get('/api/dashboard', (req, res) => {
  res.json({
    greeting: 'Ciao Giuseppe!',
    stats: {
      totalProjects: 3,
      activeProjects: 2,
      totalBudget: 250000,
      completionRate: 85
    }
  });
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log('🚀 ApuLink Backend Server Started!');
  console.log(`📍 Running on: http://localhost:${PORT}`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
  console.log(`📦 Projects: http://localhost:${PORT}/api/projects`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/api/dashboard`);
  console.log('========================================');
});