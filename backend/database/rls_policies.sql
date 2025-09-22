-- Row Level Security Policies for Apulink
-- Run these SQL commands in Supabase SQL Editor

-- Enable RLS on all tables
ALTER TABLE service_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- =========================================
-- SERVICE PROVIDERS POLICIES
-- =========================================

-- Public can read all verified service providers
CREATE POLICY "Public can read verified service providers"
ON service_providers FOR SELECT
USING (verified = true);

-- Service providers can read and update their own profile
CREATE POLICY "Providers can read own profile"
ON service_providers FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Providers can update own profile"
ON service_providers FOR UPDATE
USING (auth.uid() = id);

-- Only authenticated users can insert new provider profiles
CREATE POLICY "Authenticated users can create provider profile"
ON service_providers FOR INSERT
WITH CHECK (auth.uid() = id);

-- =========================================
-- CATEGORIES POLICIES
-- =========================================

-- Public can read all categories
CREATE POLICY "Public can read categories"
ON categories FOR SELECT
USING (true);

-- =========================================
-- REVIEWS POLICIES
-- =========================================

-- Public can read approved reviews
CREATE POLICY "Public can read approved reviews"
ON reviews FOR SELECT
USING (moderation_status = 'approved');

-- Authenticated users can insert reviews
CREATE POLICY "Authenticated users can create reviews"
ON reviews FOR INSERT
WITH CHECK (auth.uid() = client_id);

-- Users can update their own reviews (only if not moderated yet)
CREATE POLICY "Users can update own pending reviews"
ON reviews FOR UPDATE
USING (auth.uid() = client_id AND moderation_status = 'pending');

-- Service providers can read reviews about them
CREATE POLICY "Providers can read own reviews"
ON reviews FOR SELECT
USING (auth.uid() = service_provider_id);

-- =========================================
-- SERVICE REQUESTS POLICIES
-- =========================================

-- Clients can read their own service requests
CREATE POLICY "Clients can read own requests"
ON service_requests FOR SELECT
USING (auth.uid() = client_id);

-- Service providers can read requests assigned to them
CREATE POLICY "Providers can read assigned requests"
ON service_requests FOR SELECT
USING (auth.uid() = service_provider_id);

-- Clients can create service requests
CREATE POLICY "Clients can create requests"
ON service_requests FOR INSERT
WITH CHECK (auth.uid() = client_id);

-- Clients can update their own pending requests
CREATE POLICY "Clients can update own pending requests"
ON service_requests FOR UPDATE
USING (auth.uid() = client_id AND status = 'pending');

-- Service providers can update status of assigned requests
CREATE POLICY "Providers can update assigned request status"
ON service_requests FOR UPDATE
USING (auth.uid() = service_provider_id);

-- =========================================
-- BOOKINGS POLICIES
-- =========================================

-- Clients can read their own bookings
CREATE POLICY "Clients can read own bookings"
ON bookings FOR SELECT
USING (auth.uid() = client_id);

-- Service providers can read their bookings
CREATE POLICY "Providers can read own bookings"
ON bookings FOR SELECT
USING (auth.uid() = service_provider_id);

-- Authenticated users can create bookings
CREATE POLICY "Authenticated users can create bookings"
ON bookings FOR INSERT
WITH CHECK (auth.uid() = client_id);

-- Both parties can update booking status
CREATE POLICY "Participants can update booking status"
ON bookings FOR UPDATE
USING (auth.uid() = client_id OR auth.uid() = service_provider_id);

-- =========================================
-- ADDITIONAL SECURITY FUNCTIONS
-- =========================================

-- Function to check if user is service provider
CREATE OR REPLACE FUNCTION is_service_provider()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM service_providers
    WHERE id = auth.uid() AND verified = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin (for future admin features)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;