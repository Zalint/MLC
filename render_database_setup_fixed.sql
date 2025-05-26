-- =====================================================
-- MATIX LIVREUR - DATABASE SETUP FOR RENDER (FIXED)
-- =====================================================
-- This script creates the complete database structure
-- for the Matix Livreur application on Render
-- Fixed version without immutable function issues
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: users
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'LIVREUR')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- =====================================================
-- TABLE: orders
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    address TEXT,
    description TEXT,
    amount DECIMAL(10,2),
    course_price DECIMAL(10,2) DEFAULT 0,
    order_type VARCHAR(50) NOT NULL,
    commentaire TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(order_type);

-- =====================================================
-- TABLE: expenses
-- =====================================================
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    livreur_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expense_date DATE NOT NULL,
    carburant DECIMAL(10,2) DEFAULT 0,
    reparations DECIMAL(10,2) DEFAULT 0,
    police DECIMAL(10,2) DEFAULT 0,
    autres DECIMAL(10,2) DEFAULT 0,
    km_parcourus DECIMAL(10,2) DEFAULT 0,
    commentaire TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint: one expense record per livreur per date
    UNIQUE(livreur_id, expense_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expenses_livreur_id ON expenses(livreur_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);

-- =====================================================
-- INITIAL DATA - DEFAULT USERS
-- =====================================================
-- Note: These passwords are hashed versions of 'mlc2024'
-- Hash generated with bcrypt, salt rounds = 12

INSERT INTO users (id, username, password_hash, role, is_active) VALUES
    (uuid_generate_v4(), 'ADMIN', '$2b$12$dIuetyR7QnwO9DcGMnonn.b18blGloeUZyBQ5sbElO3bwuQHmj486', 'ADMIN', true),
    (uuid_generate_v4(), 'SALIOU', '$2b$12$DVP7mVMfnw/5s73l03/82.lE/a9Xl5eMjqt5fY8hlt0MMNOwocLOS', 'MANAGER', true),
    (uuid_generate_v4(), 'OUSMANE', '$2b$12$OTOKrBGtubwBp9sFeIL8/.EKhR.76AZYjpFBtC4Lhl3nyDwcSgGT.', 'MANAGER', true)
ON CONFLICT (username) DO NOTHING;

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for expenses table
DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS FOR REPORTING
-- =====================================================

-- View for orders with user information
CREATE OR REPLACE VIEW orders_with_users AS
SELECT 
    o.*,
    u.username as creator_username,
    u.role as creator_role
FROM orders o
LEFT JOIN users u ON o.created_by = u.id;

-- View for expenses with user information
CREATE OR REPLACE VIEW expenses_with_users AS
SELECT 
    e.*,
    u1.username as livreur_username,
    u2.username as creator_username,
    (e.carburant + e.reparations + e.police + e.autres) as total_expense
FROM expenses e
LEFT JOIN users u1 ON e.livreur_id = u1.id
LEFT JOIN users u2 ON e.created_by = u2.id;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify the setup worked correctly

SELECT 'Database setup completed successfully!' as status;

SELECT 'Tables created:' as info, 
       string_agg(table_name, ', ') as tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';

SELECT 'Initial users created:' as info, 
       COUNT(*) as user_count 
FROM users;

SELECT 'Extensions enabled:' as info, 
       string_agg(extname, ', ') as extensions 
FROM pg_extension;

-- =====================================================
-- END OF SETUP SCRIPT
-- ===================================================== 