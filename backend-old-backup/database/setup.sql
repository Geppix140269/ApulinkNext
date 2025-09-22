-- Create database
CREATE DATABASE apulink_next;

-- Connect to the database
\c apulink_next;

-- Create user for the application
CREATE USER apulink_user WITH PASSWORD 'ApuLink2025!';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE apulink_next TO apulink_user;