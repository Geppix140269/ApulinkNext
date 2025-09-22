const { supabase } = require('../config/supabase');

// Middleware to verify Supabase JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Add user info to request object
    req.user = user;
    next();

  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

// Middleware to check if user is a verified service provider
const requireServiceProvider = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user is a verified service provider
    const { data: provider, error } = await supabase
      .from('service_providers')
      .select('id, verified, business_name')
      .eq('id', req.user.id)
      .single();

    if (error || !provider) {
      return res.status(403).json({
        success: false,
        error: 'Service provider profile not found'
      });
    }

    if (!provider.verified) {
      return res.status(403).json({
        success: false,
        error: 'Service provider account not verified'
      });
    }

    req.provider = provider;
    next();

  } catch (error) {
    console.error('Service provider check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authorization check failed'
    });
  }
};

// Rate limiting middleware (simple in-memory implementation)
const rateLimit = (windowMs = 15 * 60 * 1000, maxRequests = 100) => {
  const requests = new Map();

  return (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    // Clean old entries
    for (const [ip, data] of requests.entries()) {
      if (now - data.firstRequest > windowMs) {
        requests.delete(ip);
      }
    }

    const clientData = requests.get(clientIp);

    if (!clientData) {
      requests.set(clientIp, {
        firstRequest: now,
        count: 1
      });
      return next();
    }

    if (now - clientData.firstRequest > windowMs) {
      requests.set(clientIp, {
        firstRequest: now,
        count: 1
      });
      return next();
    }

    clientData.count++;

    if (clientData.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later'
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireServiceProvider,
  rateLimit
};