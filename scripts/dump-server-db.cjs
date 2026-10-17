const { DatabaseSync } = require("node:sqlite");

const db = new DatabaseSync("/var/lib/shijie-suanfa/community.sqlite", { readOnly: true });
const hidden = new Set(["password_hash", "restore_hash", "token"]);
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((row) => row.name)
  .filter((name) => /^[a-z_]+$/.test(name));

const rows = {};
const counts = {};
for (const name of tables) {
  const columns = db
    .prepare(`PRAGMA table_info(${name})`)
    .all()
    .map((column) => column.name)
    .filter((column) => !hidden.has(column) && /^[a-z_]+$/.test(column));
  counts[name] = db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get().n;
  if (!columns.length) {
    rows[name] = [];
    continue;
  }
  rows[name] = db.prepare(`SELECT ${columns.map((column) => `"${column}"`).join(", ")} FROM ${name}`).all();
}

process.stdout.write(JSON.stringify({ pulledAt: Date.now(), counts, rows }));
