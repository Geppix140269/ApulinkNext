const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const databaseConfig = require('../config/database');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { optionalAuth, protect, restrictTo } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400));
  }
  next();
};

// Get all service providers (public)
router.get('/', [
  query('category').optional().isString().trim(),
  query('location').optional().isString().trim(),
  query('verified').optional().isBoolean(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().isString().trim(),
  handleValidationErrors
], optionalAuth, catchAsync(async (req, res) => {
  const {
    category,
    location,
    verified,
    page = 1,
    limit = 20,
    search
  } = req.query;

  const supabase = databaseConfig.getClient();
  let query = supabase
    .from('service_providers')
    .select(`
      id,
      business_name,
      business_description,
      category,
      subcategory,
      location,
      phone,
      email,
      website,
      verified,
      rating_average,
      rating_count,
      created_at,
      service_categories (
        id,
        name,
        icon
      )
    `);

  // Apply filters
  if (category) {
    query = query.eq('category', category);
  }

  if (location) {
    query = query.ilike('location', `%${location}%`);
  }

  if (verified !== undefined) {
    query = query.eq('verified', verified);
  }

  if (search) {
    query = query.or(`business_name.ilike.%${search}%,business_description.ilike.%${search}%`);
  }

  // Apply pagination
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  // Add ordering
  query = query.order('verified', { ascending: false })
                .order('rating_average', { ascending: false })
                .order('created_at', { ascending: false });

  const { data: providers, error, count } = await query;

  if (error) {
    logger.error('Error fetching service providers', { error, query: req.query });
    throw new AppError('Failed to fetch service providers', 500);
  }

  // Get total count for pagination
  const { count: totalCount } = await supabase
    .from('service_providers')
    .select('*', { count: 'exact', head: true });

  res.status(200).json({
    status: 'success',
    data: {
      providers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil((totalCount || 0) / limit),
        totalItems: totalCount || 0,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil((totalCount || 0) / limit),
        hasPrevPage: page > 1
      }
    }
  });
}));

// Get single service provider (public)
router.get('/:id', [
  param('id').isUUID().withMessage('Invalid provider ID'),
  handleValidationErrors
], optionalAuth, catchAsync(async (req, res) => {
  const { id } = req.params;

  const supabase = databaseConfig.getClient();
  const { data: provider, error } = await supabase
    .from('service_providers')
    .select(`
      *,
      service_categories (
        id,
        name,
        icon,
        description
      )
    `)
    .eq('id', id)
    .single();

  if (error || !provider) {
    throw new AppError('Service provider not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      provider
    }
  });
}));

// Create service provider (protected)
router.post('/', [
  protect,
  body('business_name').notEmpty().trim().isLength({ min: 2, max: 100 }),
  body('business_description').notEmpty().trim().isLength({ min: 10, max: 1000 }),
  body('category').notEmpty().isString(),
  body('subcategory').optional().isString(),
  body('location').notEmpty().isString(),
  body('phone').optional().isMobilePhone(),
  body('email').isEmail().normalizeEmail(),
  body('website').optional().isURL(),
  handleValidationErrors
], catchAsync(async (req, res) => {
  const providerData = {
    ...req.body,
    user_id: req.user.id,
    verified: false,
    created_at: new Date().toISOString()
  };

  const supabase = databaseConfig.getClient();
  const { data: provider, error } = await supabase
    .from('service_providers')
    .insert([providerData])
    .select()
    .single();

  if (error) {
    logger.error('Error creating service provider', { error, userId: req.user.id });
    throw new AppError('Failed to create service provider', 500);
  }

  logger.info('Service provider created', {
    providerId: provider.id,
    userId: req.user.id,
    businessName: provider.business_name
  });

  res.status(201).json({
    status: 'success',
    data: {
      provider
    }
  });
}));

// Update service provider (protected - own providers only)
router.patch('/:id', [
  protect,
  param('id').isUUID(),
  body('business_name').optional().trim().isLength({ min: 2, max: 100 }),
  body('business_description').optional().trim().isLength({ min: 10, max: 1000 }),
  body('category').optional().isString(),
  body('subcategory').optional().isString(),
  body('location').optional().isString(),
  body('phone').optional().isMobilePhone(),
  body('email').optional().isEmail().normalizeEmail(),
  body('website').optional().isURL(),
  handleValidationErrors
], catchAsync(async (req, res) => {
  const { id } = req.params;

  const supabase = databaseConfig.getClient();

  // Check if provider belongs to user
  const { data: existingProvider, error: fetchError } = await supabase
    .from('service_providers')
    .select('user_id')
    .eq('id', id)
    .single();

  if (fetchError || !existingProvider) {
    throw new AppError('Service provider not found', 404);
  }

  if (existingProvider.user_id !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('You can only update your own service providers', 403);
  }

  const updateData = {
    ...req.body,
    updated_at: new Date().toISOString()
  };

  const { data: provider, error } = await supabase
    .from('service_providers')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Error updating service provider', { error, providerId: id, userId: req.user.id });
    throw new AppError('Failed to update service provider', 500);
  }

  logger.info('Service provider updated', {
    providerId: id,
    userId: req.user.id,
    changes: Object.keys(req.body)
  });

  res.status(200).json({
    status: 'success',
    data: {
      provider
    }
  });
}));

// Delete service provider (protected - own providers only)
router.delete('/:id', [
  protect,
  param('id').isUUID(),
  handleValidationErrors
], catchAsync(async (req, res) => {
  const { id } = req.params;

  const supabase = databaseConfig.getClient();

  // Check if provider belongs to user
  const { data: existingProvider, error: fetchError } = await supabase
    .from('service_providers')
    .select('user_id')
    .eq('id', id)
    .single();

  if (fetchError || !existingProvider) {
    throw new AppError('Service provider not found', 404);
  }

  if (existingProvider.user_id !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('You can only delete your own service providers', 403);
  }

  const { error } = await supabase
    .from('service_providers')
    .delete()
    .eq('id', id);

  if (error) {
    logger.error('Error deleting service provider', { error, providerId: id, userId: req.user.id });
    throw new AppError('Failed to delete service provider', 500);
  }

  logger.info('Service provider deleted', {
    providerId: id,
    userId: req.user.id
  });

  res.status(204).send();
}));

// Admin: Verify service provider
router.patch('/:id/verify', [
  protect,
  restrictTo('admin'),
  param('id').isUUID(),
  body('verified').isBoolean(),
  handleValidationErrors
], catchAsync(async (req, res) => {
  const { id } = req.params;
  const { verified } = req.body;

  const supabase = databaseConfig.getClient();
  const { data: provider, error } = await supabase
    .from('service_providers')
    .update({
      verified,
      verified_at: verified ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to update verification status', 500);
  }

  logger.info('Service provider verification updated', {
    providerId: id,
    verified,
    adminId: req.user.id
  });

  res.status(200).json({
    status: 'success',
    data: {
      provider
    }
  });
}));

module.exports = router;