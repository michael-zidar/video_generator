import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

let db = null;

export async function initDatabase() {
  const SQL = await initSqlJs();

  // Try to load existing database
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      preferences TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      branding TEXT DEFAULT '{}',
      is_archived INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER UNIQUE NOT NULL,
      title TEXT NOT NULL,
      aspect_ratio TEXT DEFAULT '16:9',
      resolution TEXT DEFAULT '1080p',
      theme TEXT DEFAULT '{}',
      intro_scene_enabled INTEGER DEFAULT 0,
      outro_scene_enabled INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS slides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deck_id INTEGER NOT NULL,
      position INTEGER DEFAULT 0,
      title TEXT,
      body TEXT DEFAULT '{}',
      speaker_notes TEXT DEFAULT '',
      slide_asset_id INTEGER,
      duration_ms INTEGER DEFAULT 5000,
      transition TEXT DEFAULT '{"type": "fade"}',
      background_color TEXT DEFAULT '#ffffff',
      image_url TEXT,
      image_position TEXT DEFAULT 'none',
      image_prompt TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    )
  `);

  // Migration: Add image columns if they don't exist
  try {
    db.run(`ALTER TABLE slides ADD COLUMN image_url TEXT`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.run(`ALTER TABLE slides ADD COLUMN image_position TEXT DEFAULT 'none'`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.run(`ALTER TABLE slides ADD COLUMN image_prompt TEXT`);
  } catch (e) {
    // Column already exists
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_id INTEGER,
      kind TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER,
      storage_path TEXT NOT NULL,
      hash TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS voice_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      provider TEXT DEFAULT 'openai',
      voice_id TEXT DEFAULT 'alloy',
      defaults TEXT DEFAULT '{}',
      pronunciation_lexicon TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS voiceovers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slide_id INTEGER NOT NULL,
      provider TEXT,
      voice_profile_id INTEGER,
      script_text TEXT,
      ssml_like TEXT DEFAULT '{}',
      audio_asset_id INTEGER,
      duration_ms INTEGER,
      loudness_lufs REAL,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (slide_id) REFERENCES slides(id) ON DELETE CASCADE,
      FOREIGN KEY (voice_profile_id) REFERENCES voice_profiles(id),
      FOREIGN KEY (audio_asset_id) REFERENCES assets(id)
    )
  `);

  // Migration: Add is_active column to voiceovers if it doesn't exist
  try {
    db.run(`ALTER TABLE voiceovers ADD COLUMN is_active INTEGER DEFAULT 1`);
  } catch (e) {
    // Column already exists
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS recorded_voiceovers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slide_id INTEGER NOT NULL,
      version_number INTEGER NOT NULL,
      audio_asset_id TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      transcription TEXT,
      transcription_status TEXT DEFAULT 'pending',
      transcription_error TEXT,
      is_active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (slide_id) REFERENCES slides(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for recorded_voiceovers
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_recorded_voiceovers_slide_id
      ON recorded_voiceovers(slide_id)`);
  } catch (e) {
    // Index might already exist
  }
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_recorded_voiceovers_active
      ON recorded_voiceovers(slide_id, is_active)`);
  } catch (e) {
    // Index might already exist
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS renders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deck_id INTEGER NOT NULL,
      kind TEXT DEFAULT 'preview',
      settings TEXT DEFAULT '{}',
      output_asset_id INTEGER,
      status TEXT DEFAULT 'queued',
      progress TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
      FOREIGN KEY (output_asset_id) REFERENCES assets(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      status TEXT DEFAULT 'queued',
      progress TEXT DEFAULT '{}',
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS share_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      share_token TEXT UNIQUE NOT NULL,
      permissions TEXT DEFAULT 'read_only',
      expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      view_count INTEGER DEFAULT 0
    )
  `);

  // User preferences table keyed by Clerk user ID
  db.run(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY NOT NULL,
      preferences TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Timeline items table for intro/outro/interstitial videos
  db.run(`
    CREATE TABLE IF NOT EXISTS timeline_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deck_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      asset_id INTEGER NOT NULL,
      position INTEGER DEFAULT 0,
      start_time_ms INTEGER DEFAULT 0,
      end_time_ms INTEGER,
      duration_ms INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
      FOREIGN KEY (asset_id) REFERENCES assets(id)
    )
  `);

  // Migration: Add video_asset_id to slides for video slides
  try {
    db.run(`ALTER TABLE slides ADD COLUMN video_asset_id INTEGER`);
  } catch (e) {
    // Column already exists
  }

  // Brand assets table for logos, watermarks, icons that can be reused across lessons
  db.run(`
    CREATE TABLE IF NOT EXISTS brand_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      course_id INTEGER,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      asset_id INTEGER NOT NULL,
      default_position TEXT DEFAULT 'bottom-right',
      default_size INTEGER DEFAULT 10,
      default_opacity REAL DEFAULT 1.0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
    )
  `);

  // Slide templates table for reusable slide designs
  db.run(`
    CREATE TABLE IF NOT EXISTS slide_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      course_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      elements TEXT NOT NULL,
      background_color TEXT DEFAULT '#ffffff',
      thumbnail_asset_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
      FOREIGN KEY (thumbnail_asset_id) REFERENCES assets(id) ON DELETE SET NULL
    )
  `);

  // Migration: Add overlays column to decks for logo/page number settings
  try {
    db.run(`ALTER TABLE decks ADD COLUMN overlays TEXT DEFAULT '{}'`);
  } catch (e) {
    // Column already exists
  }

  // Create demo user if not exists
  const demoUser = db.exec("SELECT id FROM users WHERE email = 'demo@example.com'");
  if (demoUser.length === 0 || demoUser[0].values.length === 0) {
    db.run(`
      INSERT INTO users (email, password, name)
      VALUES ('demo@example.com', 'demo123', 'Demo User')
    `);
  }

  saveDatabase();
  console.log('Database initialized');
  return db;
}

export function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

export function getDb() {
  return db;
}

// Helper functions for common operations
export function run(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
}

export function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

export function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function insert(sql, params = []) {
  db.run(sql, params);
  const lastId = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
  saveDatabase();
  return lastId;
}
