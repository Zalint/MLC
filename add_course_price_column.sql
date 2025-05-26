-- Add course_price column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS course_price DECIMAL(12,2) DEFAULT 0; 