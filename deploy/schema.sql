-- Ultra Download Hub: Production PostgreSQL Schema & Migrations

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- 2. Torrents Table
CREATE TABLE IF NOT EXISTS torrents (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    info_hash VARCHAR(64) UNIQUE NOT NULL,
    total_size BIGINT NOT NULL,
    downloaded_size BIGINT DEFAULT 0,
    uploaded_size BIGINT DEFAULT 0,
    progress NUMERIC(5, 2) DEFAULT 0.00,
    download_speed BIGINT DEFAULT 0,
    upload_speed BIGINT DEFAULT 0,
    eta INTEGER DEFAULT 0,
    status VARCHAR(32) NOT NULL,
    piece_count INTEGER NOT NULL,
    piece_length INTEGER NOT NULL,
    pieces_downloaded INTEGER DEFAULT 0,
    connected_peers INTEGER DEFAULT 0,
    seeders INTEGER DEFAULT 0,
    leechers INTEGER DEFAULT 0,
    save_path TEXT NOT NULL,
    is_sequential BOOLEAN DEFAULT TRUE,
    source VARCHAR(32) DEFAULT 'file',
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_torrents_status ON torrents(status);
CREATE INDEX IF NOT EXISTS idx_torrents_info_hash ON torrents(info_hash);

-- 3. Torrent Files Table
CREATE TABLE IF NOT EXISTS torrent_files (
    id VARCHAR(64) PRIMARY KEY,
    torrent_id VARCHAR(64) REFERENCES torrents(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    path TEXT NOT NULL,
    size BIGINT NOT NULL,
    progress NUMERIC(5, 2) DEFAULT 0.00,
    selected BOOLEAN DEFAULT TRUE,
    priority VARCHAR(16) DEFAULT 'normal'
);

CREATE INDEX IF NOT EXISTS idx_torrent_files_torrent_id ON torrent_files(torrent_id);

-- 4. Download Tokens Table (For Android Chrome Delivery)
CREATE TABLE IF NOT EXISTS download_tokens (
    token VARCHAR(128) PRIMARY KEY,
    file_id VARCHAR(64) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_restriction VARCHAR(64),
    single_use BOOLEAN DEFAULT FALSE,
    used_count INTEGER DEFAULT 0,
    max_uses INTEGER DEFAULT 20,
    revoked BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_download_tokens_expires ON download_tokens(expires_at);

-- 5. Download History Table
CREATE TABLE IF NOT EXISTS download_history (
    id VARCHAR(64) PRIMARY KEY,
    torrent_id VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    total_size BIGINT NOT NULL,
    download_duration_seconds INTEGER NOT NULL,
    average_speed BIGINT NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    info_hash VARCHAR(64) NOT NULL
);

-- 6. User Settings Table
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    profile VARCHAR(32) DEFAULT 'balanced',
    max_active_downloads INTEGER DEFAULT 5,
    max_global_connections INTEGER DEFAULT 200,
    max_connections_per_torrent INTEGER DEFAULT 50,
    download_speed_limit BIGINT DEFAULT 0,
    upload_speed_limit BIGINT DEFAULT 1048576,
    disk_cache_size_mb INTEGER DEFAULT 16,
    seeding_ratio_limit NUMERIC(4, 2) DEFAULT 1.5,
    enable_dht BOOLEAN DEFAULT TRUE,
    enable_pex BOOLEAN DEFAULT TRUE,
    enable_lsd BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Security Audit Logs Table
CREATE TABLE IF NOT EXISTS security_events (
    id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    action VARCHAR(64) NOT NULL,
    details TEXT NOT NULL,
    ip VARCHAR(64) NOT NULL,
    severity VARCHAR(16) DEFAULT 'info'
);

CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp DESC);
