import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
mkdirSync('data', { recursive: true });
const connection = new DatabaseSync(process.env.DB_FILE || 'data/projects.db');
connection.exec(`CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),
  status TEXT NOT NULL CHECK(status IN ('Planned', 'In Progress', 'Completed'))
)`);
export const db = {
  async list() { return connection.prepare('SELECT id, name, status FROM projects ORDER BY id DESC').all(); },
  async create({ name, status }) {
    const result = connection.prepare('INSERT INTO projects (name, status) VALUES (?, ?)').run(name, status);
    return connection.prepare('SELECT id, name, status FROM projects WHERE id = ?').get(Number(result.lastInsertRowid));
  },
  async update(id, { name, status }) {
    const result = connection.prepare('UPDATE projects SET name = ?, status = ? WHERE id = ?').run(name, status, id);
    if (!result.changes) return null;
    return connection.prepare('SELECT id, name, status FROM projects WHERE id = ?').get(id);
  },
  async remove(id) { return connection.prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0; }
};
