-- SQL Server Database Schema for Production Operation Management Solution

-- Users table
CREATE TABLE users (
    user_id NVARCHAR(50) PRIMARY KEY,
    username NVARCHAR(100) NOT NULL,
    email NVARCHAR(255) NOT NULL UNIQUE,
    role NVARCHAR(50) NOT NULL,
    factory_id NVARCHAR(50),
    status NVARCHAR(20) DEFAULT 'active',
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Factories table
CREATE TABLE factories (
    factory_id NVARCHAR(50) PRIMARY KEY,
    factory_name NVARCHAR(255) NOT NULL,
    factory_code NVARCHAR(50),
    location NVARCHAR(500),
    contact_person NVARCHAR(255),
    contact_email NVARCHAR(255),
    contact_phone NVARCHAR(50),
    production_capacity INT,
    specialities NVARCHAR(MAX),
    status NVARCHAR(20) DEFAULT 'active',
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Products table
CREATE TABLE products (
    product_id NVARCHAR(50) PRIMARY KEY,
    product_name NVARCHAR(255) NOT NULL,
    product_code NVARCHAR(50),
    category NVARCHAR(100),
    unit NVARCHAR(20),
    standard_lead_time INT,
    minimum_order_quantity INT,
    required_materials NVARCHAR(MAX),
    description NVARCHAR(MAX),
    status NVARCHAR(20) DEFAULT 'active',
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Production Adjustment Requests table
CREATE TABLE production_adjustment_requests (
    request_id NVARCHAR(50) PRIMARY KEY,
    requester_id NVARCHAR(50) NOT NULL,
    factory_id NVARCHAR(50) NOT NULL,
    product_id NVARCHAR(50) NOT NULL,
    requested_quantity INT NOT NULL,
    current_quantity INT,
    adjustment_type NVARCHAR(20) NOT NULL, -- 'increase', 'decrease'
    priority NVARCHAR(20) NOT NULL, -- 'high', 'medium', 'low'
    response_deadline DATETIME2 NOT NULL,
    delivery_deadline DATETIME2 NOT NULL,
    reason NVARCHAR(MAX),
    required_materials_inventory NVARCHAR(MAX),
    status NVARCHAR(50) DEFAULT 'submitted',
    status_memo NVARCHAR(MAX),
    revision_count INT DEFAULT 0,
    revision_reason NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    FOREIGN KEY (requester_id) REFERENCES users(user_id),
    FOREIGN KEY (factory_id) REFERENCES factories(factory_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Factory Responses table
CREATE TABLE factory_responses (
    response_id NVARCHAR(50) PRIMARY KEY,
    request_id NVARCHAR(50) NOT NULL,
    responder_id NVARCHAR(50) NOT NULL,
    acceptance_status NVARCHAR(50) NOT NULL, -- 'accepted', 'rejected', 'conditional'
    available_quantity INT,
    available_date DATETIME2,
    additional_cost DECIMAL(10,2),
    comments NVARCHAR(MAX),
    conditions NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    FOREIGN KEY (request_id) REFERENCES production_adjustment_requests(request_id),
    FOREIGN KEY (responder_id) REFERENCES users(user_id)
);

-- Status History table
CREATE TABLE status_history (
    history_id NVARCHAR(50) PRIMARY KEY,
    request_id NVARCHAR(50) NOT NULL,
    previous_status NVARCHAR(50),
    new_status NVARCHAR(50) NOT NULL,
    changed_by NVARCHAR(50) NOT NULL,
    change_reason NVARCHAR(MAX),
    changed_at DATETIME2 DEFAULT GETUTCDATE(),
    
    FOREIGN KEY (request_id) REFERENCES production_adjustment_requests(request_id),
    FOREIGN KEY (changed_by) REFERENCES users(user_id)
);

-- Create indexes for better performance
CREATE INDEX IX_production_requests_status ON production_adjustment_requests(status);
CREATE INDEX IX_production_requests_factory ON production_adjustment_requests(factory_id);
CREATE INDEX IX_production_requests_deadline ON production_adjustment_requests(response_deadline);
CREATE INDEX IX_status_history_request ON status_history(request_id);
CREATE INDEX IX_factory_responses_request ON factory_responses(request_id);