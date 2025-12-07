import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = 'data/grokchat.db';

// Ensure the data directory exists
const dbDir = dirname(DB_PATH);
if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    tags TEXT,
    attachments TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT NOT NULL,
    accent TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS category_items (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    emphasis INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
  CREATE INDEX IF NOT EXISTS idx_category_items_category ON category_items(category_id);
`);

// Migration: Add pinned column if it doesn't exist
try {
    db.prepare('SELECT pinned FROM categories LIMIT 1').get();
} catch {
    db.exec('ALTER TABLE categories ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0');
    console.log('[DB] Added pinned column to categories table');
}

// Migration: Add description column if it doesn't exist
try {
    db.prepare('SELECT description FROM categories LIMIT 1').get();
} catch {
    db.exec('ALTER TABLE categories ADD COLUMN description TEXT');
    console.log('[DB] Added description column to categories table');
}

// Migration: Add attachments column to messages if it doesn't exist
try {
    db.prepare('SELECT attachments FROM messages LIMIT 1').get();
} catch {
    db.exec('ALTER TABLE messages ADD COLUMN attachments TEXT');
    console.log('[DB] Added attachments column to messages table');
}

// Session operations
export function getOrCreateSession(userId: string): string {
    const existing = db.prepare('SELECT id FROM sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1').get(userId) as { id: string } | undefined;
    if (existing) {
        return existing.id;
    }

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = Date.now();
    db.prepare('INSERT INTO sessions (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)').run(sessionId, userId, now, now);
    return sessionId;
}

export function touchSession(sessionId: string) {
    db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(Date.now(), sessionId);
}

// Message operations
export interface DBMessage {
    id: string;
    session_id: string;
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp: string;
    tags: string | null;
    attachments: string | null;
}

export function insertMessage(msg: Omit<DBMessage, 'id'>): string {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    db.prepare('INSERT INTO messages (id, session_id, role, content, timestamp, tags, attachments) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        id,
        msg.session_id,
        msg.role,
        msg.content,
        msg.timestamp,
        msg.tags,
        msg.attachments
    );
    touchSession(msg.session_id);
    return id;
}

export function getMessagesBySession(sessionId: string, limit = 100): DBMessage[] {
    return db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?').all(sessionId, limit) as DBMessage[];
}

export function getRecentMessages(sessionId: string, count = 20): DBMessage[] {
    return db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?').all(sessionId, count) as DBMessage[];
}

// Category operations
export interface DBCategory {
    id: string;
    title: string;
    description: string | null;
    icon: string;
    accent: string;
    sort_order: number;
    pinned: number;
}

export interface DBCategoryItem {
    id: string;
    category_id: string;
    title: string;
    description: string | null;
    emphasis: number;
    updated_at: string | null;
    sort_order: number;
}

export function upsertCategory(cat: DBCategory) {
    db.prepare(`
        INSERT INTO categories (id, title, description, icon, accent, sort_order, pinned)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            icon = excluded.icon,
            accent = excluded.accent,
            sort_order = excluded.sort_order,
            pinned = excluded.pinned
    `).run(cat.id, cat.title, cat.description ?? null, cat.icon, cat.accent, cat.sort_order, cat.pinned ?? 0);
}

export function updateCategoryDescription(categoryId: string, description: string) {
    db.prepare('UPDATE categories SET description = ? WHERE id = ?').run(description, categoryId);
}

export function updateCategoryIcon(categoryId: string, icon: string) {
    db.prepare('UPDATE categories SET icon = ? WHERE id = ?').run(icon, categoryId);
}

export function updateCategoryAccent(categoryId: string, accent: string) {
    db.prepare('UPDATE categories SET accent = ? WHERE id = ?').run(accent, categoryId);
}

export function toggleCategoryPinned(categoryId: string): boolean {
    const current = db.prepare('SELECT pinned FROM categories WHERE id = ?').get(categoryId) as { pinned: number } | undefined;
    const newPinned = current?.pinned ? 0 : 1;
    db.prepare('UPDATE categories SET pinned = ? WHERE id = ?').run(newPinned, categoryId);
    return newPinned === 1;
}

export function upsertCategoryItem(item: DBCategoryItem) {
    db.prepare(`
        INSERT INTO category_items (id, category_id, title, description, emphasis, updated_at, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            category_id = excluded.category_id,
            title = excluded.title,
            description = excluded.description,
            emphasis = excluded.emphasis,
            updated_at = excluded.updated_at,
            sort_order = excluded.sort_order
    `).run(item.id, item.category_id, item.title, item.description, item.emphasis, item.updated_at, item.sort_order);
}

export function getAllCategories(): DBCategory[] {
    return db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all() as DBCategory[];
}

export function getCategoryItems(categoryId: string): DBCategoryItem[] {
    return db.prepare('SELECT * FROM category_items WHERE category_id = ? ORDER BY sort_order, id').all(categoryId) as DBCategoryItem[];
}

export function deleteCategoryItem(itemId: string) {
    db.prepare('DELETE FROM category_items WHERE id = ?').run(itemId);
}

export function deleteCategory(categoryId: string) {
    db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
}

export function deleteMessage(messageId: string) {
    db.prepare('DELETE FROM messages WHERE id = ?').run(messageId);
}

export function deleteMessages(messageIds: string[]) {
    const placeholders = messageIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM messages WHERE id IN (${placeholders})`).run(...messageIds);
}

export function updateMessageTags(messageId: string, tags: string | null) {
    db.prepare('UPDATE messages SET tags = ? WHERE id = ?').run(tags, messageId);
}

export default db;
