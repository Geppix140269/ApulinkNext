const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const databaseConfig = require('../config/database');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { protect, restrictTo, createUserRateLimit } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Rate limiting for service requests
const serviceRequestRateLimit = createUserRateLimit(15 * 60 * 1000, 5); // 5 requests per 15 minutes

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400));
  }
  next();
};

// Create service request (protected with rate limiting)
router.post('/', [
  protect,
  serviceRequestRateLimit,
  body('provider_id').isUUID().withMessage('Invalid provider ID'),
  body('service_category').notEmpty().isString(),
  body('description').notEmpty().trim().isLength({ min: 10, max: 1000 }),
  body('preferred_date').optional().isISO8601().toDate(),
  body('budget_min').optional().isNumeric(),
  body('budget_max').optional().isNumeric(),
  body('urgency').optional().isIn(['low', 'medium', 'high']),
  body('location').notEmpty().isString(),
  body('contact_phone').optional().isMobilePhone(),
  handleValidationErrors
], catchAsync(async (req, res) => {
  const requestData = {
    ...req.body,
    user_id: req.user.id,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  const supabase = databaseConfig.getClient();

  // Verify provider exists
  const { data: provider, error: providerError } = await supabase
    .from('service_providers')
    .select('id, business_name, user_id')
    .eq('id', requestData.provider_id)
    .single();

  if (providerError || !provider) {
    throw new AppError('Service provider not found', 404);
  }

  // Create service request
  const { data: serviceRequest, error } = await supabase
    .from('service_requests')
    .insert([requestData])
    .select(`
      *,
      service_providers (
        id,
        business_name,
        location,
        phone,
        email
      )
    `)
    .single();

  if (error) {
    logger.error('Error creating service request', { error, userId: req.user.id });
    throw new AppError('Failed to create service request', 500);
  }

  logger.info('Service request created', {
    requestId: serviceRequest.id,
    userId: req.user.id,
    providerId: requestData.provider_id,
    category: requestData.service_category
  });

  res.status(201).json({
    status: 'success',
    data: {
      serviceRequest
    }
  });
}));

// Get user's service requests (protected)
router.get('/my-requests', [
  protect,
  query('status').optional().isIn(['pending', 'accepted', 'in_progress', 'completed', 'cancelled']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  handleValidationErrors
], catchAsync(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const supabase = databaseConfig.getClient();
  let query = supabase
    .from('service_requests')
    .select(`
      *,
      service_providers (
        id,
        business_name,
        location,
        phone,
        email,
        verified
      )
    `)
    .eq('user_id', req.user.id);

  if (status) {
    query = query.eq('status', status);
  }

  // Apply pagination
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1)
              .order('created_at', { ascending: false });

  const { data: requests, error } = await query;

  if (error) {
    logger.error('Error fetching user service requests', { error, userId: req.user.id });
    throw new AppError('Failed to fetch service requests', 500);
  }

  res.status(200).json({
    status: 'success',
    data: {
      requests,
      pagination: {
        currentPage: page,
        itemsPerPage: limit
      }
    }
  });
}));

// Get provider's service requests (protected)
router.get('/provider-requests', [
  protect,
  query('status').optional().isIn(['pending', 'accepted', 'in_progress', 'completed', 'cancelled']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  handleValidationErrors
], catchAsync(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const supabase = databaseConfig.getClient();

  // Get user's provider IDs
  const { data: providers, error: providerError } = await supabase
    .from('service_providers')
    .select('id')
    .eq('user_id', req.user.id);

  if (providerError) {
    throw new AppError('Failed to fetch provider information', 500);
  }

  if (!providers || providers.length === 0) {
    return res.status(200).json({
      status: 'success',
      data: {
        requests: [],
        pagination: {
          currentPage: page,
          itemsPerPage: limit
        }
      }
    });
  }

  const providerIds = providers.map(p => p.id);

  let query = supabase
    .from('service_requests')
    .select(`
      *,
      profiles (
        id,
        full_name,
        email,
        phone
      )
    `)
    .in('provider_id', providerIds);

  if (status) {
    query = query.eq('status', status);
  }

  // Apply pagination
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1)
              .order('created_at', { ascending: false });

  const { data: requests, error } = await query;

  if (error) {
    logger.error('Error fetching provider service requests', { error, userId: req.user.id });
    throw new AppError('Failed to fetch service requests', 500);
  }

  res.status(200).json({
    status: 'success',
    data: {
      requests,
      pagination: {
        currentPage: page,
        itemsPerPage: limit
      }
    }
  });
}));

// Update service request status (protected)
router.patch('/:id/status', [
  protect,
  param('id').isUUID(),
  body('status').isIn(['accepted', 'in_progress', 'completed', 'cancelled']),
  body('notes').optional().isString().trim(),
  handleValidationErrors
], catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const supabase = databaseConfig.getClient();

  // Get the service request with provider info
  const { data: serviceRequest, error: fetchError } = await supabase
    .from('service_requests')
    .select(`
      *,
      service_providers (
        user_id
      )
    `)
    .eq('id', id)
    .single();

  if (fetchError || !serviceRequest) {
    throw new AppError('Service request not found', 404);
  }

  // Check permissions
  const isRequestOwner = serviceRequest.user_id === req.user.id;
  const isProviderOwner = serviceRequest.service_providers?.user_id === req.user.id;
  const isAdmin = req.user.role === 'admin';

  if (!isRequestOwner && !isProviderOwner && !isAdmin) {
    throw new AppError('You do not have permission to update this request', 403);
  }

  // Business logic for status transitions
  const validTransitions = {
    'pending': ['accepted', 'cancelled'],
    'accepted': ['in_progress', 'cancelled'],
    'in_progress': ['completed', 'cancelled'],
    'completed': [],
    'cancelled': []
  };

  if (!validTransitions[serviceRequest.status]?.includes(status)) {
    throw new AppError(`Cannot change status from ${serviceRequest.status} to ${status}`, 400);
  }

  // Update the request
  const updateData = {
    status,
    updated_at: new Date().toISOString()
  };

  if (notes) {
    updateData.notes = notes;
  }

  if (status === 'accepted') {
    updateData.accepted_at = new Date().toISOString();
  } else if (status === 'completed') {
    updateData.completed_at = new Date().toISOString();
  }

  const { data: updatedRequest, error } = await supabase
    .from('service_requests')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Error updating service request status', { error, requestId: id, userId: req.user.id });
    throw new AppError('Failed to update service request', 500);
  }

  logger.info('Service request status updated', {
    requestId: id,
    oldStatus: serviceRequest.status,
    newStatus: status,
    userId: req.user.id
  });

  res.status(200).json({
    status: 'success',
    data: {
      serviceRequest: updatedRequest
    }
  });
}));

// Get single service request (protected)
router.get('/:id', [
  protect,
  param('id').isUUID(),
  handleValidationErrors
], catchAsync(async (req, res) => {
  const { id } = req.params;

  const supabase = databaseConfig.getClient();
  const { data: serviceRequest, error } = await supabase
    .from('service_requests')
    .select(`
      *,
      service_providers (
        id,
        business_name,
        location,
        phone,
        email,
        verified,
        user_id
      ),
      profiles (
        id,
        full_name,
        email,
        phone
      )
    `)
    .eq('id', id)
    .single();

  if (error || !serviceRequest) {
    throw new AppError('Service request not found', 404);
  }

  // Check permissions
  const isRequestOwner = serviceRequest.user_id === req.user.id;
  const isProviderOwner = serviceRequest.service_providers?.user_id === req.user.id;
  const isAdmin = req.user.role === 'admin';

  if (!isRequestOwner && !isProviderOwner && !isAdmin) {
    throw new AppError('You do not have permission to view this request', 403);
  }

  res.status(200).json({
    status: 'success',
    data: {
      serviceRequest
    }
  });
}));

module.exports = router;