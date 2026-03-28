// ============================================================
// db.js — localStorage multi-database abstraction
// ============================================================

const DB_PREFIX    = 'kandra_domy_db_';
const DB_LIST_KEY  = 'kandra_domy_databases';
const ACTIVE_DB_KEY = 'kandra_domy_active';

const DB = {
  // ── active db ──────────────────────────────────────────────
  getActiveName() {
    return localStorage.getItem(ACTIVE_DB_KEY) || 'default';
  },
  _key(name) { return DB_PREFIX + name; },
  _activeKey() { return this._key(this.getActiveName()); },

  // ── raw read/write ─────────────────────────────────────────
  _read(name) {
    try { return JSON.parse(localStorage.getItem(this._key(name))) || this._empty(); }
    catch { return this._empty(); }
  },
  _write(name, data) {
    localStorage.setItem(this._key(name), JSON.stringify(data));
  },
  _empty() { return { players: [], sessions: [], games: [] }; },

  getAll()       { return this._read(this.getActiveName()); },
  save(data)     { this._write(this.getActiveName(), data); },

  // ── players ────────────────────────────────────────────────
  getPlayers()   { return this.getAll().players; },
  addPlayer(p)   { const d = this.getAll(); d.players.push(p); this.save(d); },
  updatePlayer(id, u) {
    const d = this.getAll();
    d.players = d.players.map(p => p.id === id ? { ...p, ...u } : p);
    this.save(d);
  },
  deletePlayer(id) {
    const d = this.getAll(); d.players = d.players.filter(p => p.id !== id); this.save(d);
  },

  // ── sessions ───────────────────────────────────────────────
  getSessions()  { return this.getAll().sessions; },
  addSession(s)  { const d = this.getAll(); d.sessions.push(s); this.save(d); },
  updateSession(id, u) {
    const d = this.getAll();
    d.sessions = d.sessions.map(s => s.id === id ? { ...s, ...u } : s);
    this.save(d);
  },
  deleteSession(id) {
    const d = this.getAll();
    d.sessions = d.sessions.filter(s => s.id !== id);
    d.games    = d.games.filter(g => g.sessionId !== id);
    this.save(d);
  },

  // ── games ──────────────────────────────────────────────────
  getGames()     { return this.getAll().games; },
  addGame(g)     { const d = this.getAll(); d.games.push(g); this.save(d); },
  updateGame(id, u) {
    const d = this.getAll();
    d.games = d.games.map(g => g.id === id ? { ...g, ...u } : g);
    this.save(d);
  },

  // ── multi-database ─────────────────────────────────────────
  getDbList() {
    try { return JSON.parse(localStorage.getItem(DB_LIST_KEY)) || ['default']; }
    catch { return ['default']; }
  },
  _saveDbList(list) { localStorage.setItem(DB_LIST_KEY, JSON.stringify(list)); },

  switchDb(name) {
    localStorage.setItem(ACTIVE_DB_KEY, name);
  },

  createDb(name) {
    const list = this.getDbList();
    if (list.includes(name)) return false;
    list.push(name);
    this._saveDbList(list);
    this._write(name, this._empty());
    return true;
  },

  deleteDb(name) {
    if (name === 'default') return false;
    const list = this.getDbList().filter(n => n !== name);
    this._saveDbList(list);
    localStorage.removeItem(this._key(name));
    if (this.getActiveName() === name) this.switchDb('default');
    return true;
  },

  // archive = copy current → new name, then reset current
  archiveDb(archiveName) {
    const current = this.getAll();
    const list = this.getDbList();
    if (!list.includes(archiveName)) {
      list.push(archiveName);
      this._saveDbList(list);
    }
    this._write(archiveName, current);
    this.save(this._empty());
    return true;
  },

  exportJson(name) {
    return JSON.stringify(this._read(name), null, 2);
  },

  importJson(name, jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      const list = this.getDbList();
      if (!list.includes(name)) { list.push(name); this._saveDbList(list); }
      this._write(name, data);
      return true;
    } catch { return false; }
  },

  // size in KB
  sizeKb(name) {
    const raw = localStorage.getItem(this._key(name)) || '';
    return (raw.length / 1024).toFixed(1);
  }
};
