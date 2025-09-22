const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import Supabase configuration
const { supabase } = require('./src/config/supabase');

// Import middleware
const { authenticateToken, requireServiceProvider, rateLimit } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Global middleware
app.use(cors());
app.use(express.json());
app.use(rateLimit(15 * 60 * 1000, 100)); // 100 requests per 15 minutes

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

// Get service providers
app.get('/api/service-providers', async (req, res) => {
  try {
    const { category, province, city, search } = req.query;

    let query = supabase
      .from('service_providers')
      .select('*')
      .order('rating', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }
    if (province) {
      query = query.eq('province', province);
    }
    if (city) {
      query = query.eq('city', city);
    }
    if (search) {
      query = query.or(
        `business_name.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get categories
app.get('/api/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Provider dashboard stats
app.get('/api/provider/:id/dashboard', async (req, res) => {
  try {
    const { id } = req.params;

    // Get provider info
    const { data: provider, error: providerError } = await supabase
      .from('service_providers')
      .select('*')
      .eq('id', id)
      .single();

    if (providerError) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found'
      });
    }

    // Get service requests for this provider (mock for now)
    const stats = {
      totalRequests: provider.review_count || 0,
      activeRequests: Math.floor((provider.review_count || 0) * 0.3),
      completedProjects: Math.floor((provider.review_count || 0) * 0.7),
      averageRating: provider.rating || 0.0
    };

    res.json({
      success: true,
      provider,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// PROTECTED ENDPOINTS (require authentication)
// ============================================

// Create service request
app.post('/api/service-requests', authenticateToken, async (req, res) => {
  try {
    const {
      service_provider_id,
      service_type,
      description,
      budget_range,
      location_city,
      urgency,
      preferred_date
    } = req.body;

    // Validate required fields
    if (!service_provider_id || !service_type || !description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: service_provider_id, service_type, description'
      });
    }

    // Create service request
    const { data, error } = await supabase
      .from('service_requests')
      .insert([{
        client_id: req.user.id,
        service_provider_id,
        service_type,
        description,
        budget_range,
        location_city,
        urgency: urgency || 'medium',
        preferred_date,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user's service requests
app.get('/api/my-requests', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('service_requests')
      .select(`
        *,
        service_providers:service_provider_id (
          business_name,
          phone,
          email
        )
      `)
      .eq('client_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Provider endpoints (require service provider verification)
app.get('/api/provider/requests', authenticateToken, requireServiceProvider, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('service_requests')
      .select('*')
      .eq('service_provider_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update service request status (provider only)
app.patch('/api/service-requests/:id/status', authenticateToken, requireServiceProvider, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, response_message } = req.body;

    if (!['accepted', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: accepted, rejected, or completed'
      });
    }

    const { data, error } = await supabase
      .from('service_requests')
      .update({
        status,
        response_message,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('service_provider_id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Service request not found or not authorized'
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
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