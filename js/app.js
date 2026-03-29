// ============================================================
// app.js — Main application
// ============================================================

// ── state ─────────────────────────────────────────────────
const App = {
  screen:        'sessions',   // sessions | players | config
  subScreen:     null,         // session-detail | new-session | new-game | game
  sessionId:     null,
  gameId:        null,
};

// ── utils ──────────────────────────────────────────────────
function uid()  { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function now()  { return Date.now(); }
function dateStr(ts) {
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function playerInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
const AVATAR_CLASSES = ['av-purple', 'av-cyan', 'av-green', 'av-orange'];
function avatarClass(index) { return AVATAR_CLASSES[index % AVATAR_CLASSES.length]; }
function playerById(id) { return DB.getPlayers().find(p => p.id === id); }

// ── toast ──────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  c.appendChild(el);
  requestAnimationFrame(() => { requestAnimationFrame(() => el.classList.add('show')); });
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ── modal (bottom sheet) ───────────────────────────────────
function openModal(title, bodyHtml, afterRender) {
  const overlay   = document.getElementById('modal-overlay');
  const container = document.getElementById('modal-container');
  overlay.classList.remove('hidden');
  container.classList.remove('hidden');
  container.innerHTML = `
    <div class="modal-handle"></div>
    <div class="modal-header">
      <h3>${title}</h3>
      <button class="modal-close" id="modal-close-btn">✕</button>
    </div>
    <div class="modal-body">${bodyHtml}</div>
  `;
  document.getElementById('modal-close-btn').onclick = closeModal;
  overlay.onclick = closeModal;
  if (afterRender) afterRender();
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-container').classList.add('hidden');
}

// ── confirm dialog ─────────────────────────────────────────
function confirmDialog(msg, onYes) {
  openModal('Confirmer', `
    <p style="margin-bottom:20px;color:var(--muted)">${msg}</p>
    <div style="display:flex;gap:10px">
      <button class="btn btn-secondary btn-full" id="conf-no">Annuler</button>
      <button class="btn btn-danger btn-full" id="conf-yes">Confirmer</button>
    </div>
  `, () => {
    document.getElementById('conf-no').onclick  = closeModal;
    document.getElementById('conf-yes').onclick = () => { closeModal(); onYes(); };
  });
}

// ── render ─────────────────────────────────────────────────
function render() {
  const container = document.getElementById('screen-container');
  // bottom nav highlight
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.screen === App.screen);
  });

  if (App.subScreen === 'session-detail') { container.innerHTML = renderSessionDetail(); bindSessionDetail(); return; }
  if (App.subScreen === 'new-session')    { container.innerHTML = renderNewSession();    bindNewSession();    return; }
  if (App.subScreen === 'new-game')       { container.innerHTML = renderNewGame();       bindNewGame();       return; }
  if (App.subScreen === 'game')           { container.innerHTML = renderGame();          bindGame();          return; }

  switch (App.screen) {
    case 'sessions': container.innerHTML = renderSessions(); bindSessions(); break;
    case 'players':  container.innerHTML = renderPlayers();  bindPlayers();  break;
    case 'config':   container.innerHTML = renderConfig();   bindConfig();   break;
  }
}

function goBack() {
  App.subScreen = null;
  App.gameId    = null;
  if (App.sessionId) {
    App.subScreen = 'session-detail';
    App.gameId    = null;
  }
  render();
}

// ============================================================
// SESSIONS LIST
// ============================================================
function renderSessions() {
  const sessions = DB.getSessions().slice().reverse();
  const games    = DB.getGames();
  return `
    <div class="screen-header">
      <h2>Sessions</h2>
      <button class="btn btn-sm btn-primary" id="btn-new-session">+ Nouvelle</button>
    </div>
    <div class="screen">
      ${sessions.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">🎲</div>
          <p>Aucune session.<br>Créez-en une pour commencer !</p>
        </div>` : sessions.map(s => {
          const sg = games.filter(g => g.sessionId === s.id);
          const active = sg.filter(g => g.status === 'active').length;
          const done   = sg.filter(g => g.status === 'finished').length;
          return `
          <div class="list-item" data-session="${s.id}">
            <div class="avatar av-purple">${playerInitials(s.name)}</div>
            <div class="list-item-main">
              <div class="list-item-title">${s.name}</div>
              <div class="list-item-sub">${dateStr(s.createdAt)} · ${sg.length} partie(s)</div>
            </div>
            <div class="list-item-end">
              ${active > 0 ? `<span class="badge badge-orange">En cours</span>` : ''}
              ${active === 0 && done > 0 ? `<span class="badge badge-green">${done} terminée(s)</span>` : ''}
              <span style="color:var(--muted)">›</span>
            </div>
          </div>`;
        }).join('')}
    </div>
  `;
}
function bindSessions() {
  document.getElementById('btn-new-session')?.addEventListener('click', () => {
    App.subScreen = 'new-session';
    App.sessionId = null;
    render();
  });
  document.querySelectorAll('[data-session]').forEach(el => {
    el.addEventListener('click', () => {
      App.sessionId = el.dataset.session;
      App.subScreen = 'session-detail';
      render();
    });
  });
}

// ============================================================
// NEW SESSION
// ============================================================
let _newSessionSelected = [];

function renderNewSession() {
  const players = DB.getPlayers();
  return `
    <div class="screen-header">
      <button class="btn-back" id="btn-back">‹</button>
      <h2>Nouvelle session</h2>
    </div>
    <div class="screen">
      <div class="form-group">
        <label class="form-label">Nom de la session</label>
        <input class="form-input" id="session-name" type="text" placeholder="Ex: Vendredi soir" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">Joueurs participants</label>
        <div class="chip-row" id="session-player-chips">
          ${players.map((p, i) => `
            <div class="chip" data-pid="${p.id}">
              <div class="avatar ${avatarClass(i)}" style="width:22px;height:22px;font-size:0.65rem">${playerInitials(p.name)}</div>
              ${p.name}
            </div>`).join('')}
          <div class="chip" id="chip-add-player">+ Joueur</div>
        </div>
      </div>
      <div id="selected-players-preview" style="margin-bottom:16px"></div>
      <button class="btn btn-primary btn-full" id="btn-create-session">Créer la session</button>
    </div>
  `;
}
function bindNewSession() {
  _newSessionSelected = [];
  document.getElementById('btn-back').onclick = () => { App.subScreen = null; render(); };
  document.querySelectorAll('#session-player-chips .chip[data-pid]').forEach(chip => {
    chip.addEventListener('click', () => {
      const pid = chip.dataset.pid;
      if (_newSessionSelected.includes(pid)) {
        _newSessionSelected = _newSessionSelected.filter(x => x !== pid);
        chip.classList.remove('selected');
      } else {
        _newSessionSelected.push(pid);
        chip.classList.add('selected');
      }
      updateNewSessionPreview();
    });
  });
  document.getElementById('chip-add-player').onclick = showAddPlayerModal;
  document.getElementById('btn-create-session').onclick = createSession;
}
function updateNewSessionPreview() {
  const el = document.getElementById('selected-players-preview');
  if (!el) return;
  if (_newSessionSelected.length === 0) { el.innerHTML = ''; return; }
  const players = DB.getPlayers();
  el.innerHTML = `<div class="section-title">${_newSessionSelected.length} joueur(s) sélectionné(s)</div>
    <div class="chip-row">${_newSessionSelected.map((pid, i) => {
      const p = players.find(x => x.id === pid);
      return p ? `<div class="chip selected"><span class="chip-order">${i+1}</span>${p.name}</div>` : '';
    }).join('')}</div>`;
}
function createSession() {
  const name = document.getElementById('session-name').value.trim();
  if (!name) { toast('Donnez un nom à la session', 'error'); return; }
  if (_newSessionSelected.length === 0) { toast('Sélectionnez au moins un joueur', 'error'); return; }
  const session = {
    id: uid(), name,
    playerIds: [..._newSessionSelected],
    createdAt: now(),
    status: 'active'
  };
  DB.addSession(session);
  App.sessionId = session.id;
  App.subScreen = 'session-detail';
  toast('Session créée !', 'success');
  render();
}

// ============================================================
// SESSION DETAIL
// ============================================================
function renderSessionDetail() {
  const session = DB.getSessions().find(s => s.id === App.sessionId);
  if (!session) { App.subScreen = null; return renderSessions(); }
  const games   = DB.getGames().filter(g => g.sessionId === App.sessionId).reverse();
  const players = DB.getPlayers();

  return `
    <div class="screen-header">
      <button class="btn-back" id="btn-back">‹</button>
      <h2>${session.name}</h2>
      <button class="btn btn-sm btn-primary" id="btn-new-game">+ Partie</button>
    </div>
    <div class="screen">
      <div class="section-title">Joueurs de la session</div>
      <div class="chip-row" style="margin-bottom:20px">
        ${session.playerIds.map((pid, i) => {
          const p = players.find(x => x.id === pid);
          return p ? `<div class="chip"><div class="avatar ${avatarClass(i)}" style="width:22px;height:22px;font-size:0.65rem">${playerInitials(p.name)}</div>${p.name}</div>` : '';
        }).join('')}
      </div>
      <div class="section-title">Parties</div>
      ${games.length === 0 ? `<div class="empty-state"><div class="empty-state-icon">🀱</div><p>Aucune partie.<br>Lancez la première !</p></div>`
        : games.map(g => {
          const pts   = g.playerIds.map(pid => {
            const p = players.find(x => x.id === pid);
            return `${p ? p.name : '?'} (${g.cumulativeScores?.[pid] ?? 0})`;
          }).join(' · ');
          const winner = g.winnerId ? players.find(x => x.id === g.winnerId) : null;
          return `
          <div class="list-item" data-game="${g.id}">
            <div class="list-item-main">
              <div class="list-item-title">Partie ${g.mode} pts · ${dateStr(g.createdAt)}</div>
              <div class="list-item-sub">${pts}</div>
              ${winner ? `<div style="font-size:.78rem;color:var(--green);margin-top:3px">🏆 ${winner.name} · ${WIN_REASON_LABELS[g.winReason] || ''}</div>` : ''}
            </div>
            <div class="list-item-end">
              ${g.status === 'active' ? `<span class="badge badge-orange">En cours</span>` : `<span class="badge badge-green">Terminée</span>`}
              <span style="color:var(--muted)">›</span>
            </div>
          </div>`;
        }).join('')}
      <div style="height:24px"></div>
      <button class="btn btn-secondary btn-full" id="btn-delete-session" style="color:var(--red);border-color:var(--red)">Supprimer la session</button>
    </div>
  `;
}
function bindSessionDetail() {
  document.getElementById('btn-back').onclick = () => { App.subScreen = null; App.sessionId = null; render(); };
  document.getElementById('btn-new-game').onclick = () => { _newGameSelected = []; App.subScreen = 'new-game'; render(); };
  document.querySelectorAll('[data-game]').forEach(el => {
    el.addEventListener('click', () => {
      App.gameId    = el.dataset.game;
      App.subScreen = 'game';
      render();
    });
  });
  document.getElementById('btn-delete-session')?.addEventListener('click', () => {
    confirmDialog('Supprimer cette session et toutes ses parties ?', () => {
      DB.deleteSession(App.sessionId);
      App.subScreen = null;
      App.sessionId = null;
      render();
      toast('Session supprimée');
    });
  });
}

// ============================================================
// NEW GAME SETUP
// ============================================================
let _newGameSelected = [];
let _newGameMode     = 60;

function renderNewGame() {
  const session = DB.getSessions().find(s => s.id === App.sessionId);
  const players = DB.getPlayers().filter(p => session.playerIds.includes(p.id));

  return `
    <div class="screen-header">
      <button class="btn-back" id="btn-back">‹</button>
      <h2>Nouvelle partie</h2>
    </div>
    <div class="screen">
      <div class="form-group">
        <div class="section-title">Mode de jeu</div>
        <div class="mode-selector">
          <div class="mode-option ${_newGameMode === 60 ? 'selected' : ''}" data-mode="60">
            <div class="mode-pts">60</div>
            <div class="mode-lbl">points</div>
          </div>
          <div class="mode-option ${_newGameMode === 120 ? 'selected' : ''}" data-mode="120">
            <div class="mode-pts">120</div>
            <div class="mode-lbl">points</div>
          </div>
        </div>
      </div>

      <div class="form-group">
        <div class="section-title">Choisir les joueurs (3 max, l'ordre compte)</div>
        <div class="chip-row" id="game-player-chips">
          ${players.map((p, i) => {
            const selIdx = _newGameSelected.indexOf(p.id);
            const isSel  = selIdx !== -1;
            return `
            <div class="chip ${isSel ? 'selected' : ''}" data-pid="${p.id}">
              ${isSel ? `<span class="chip-order">${selIdx+1}</span>` : ''}
              <div class="avatar ${avatarClass(i)}" style="width:22px;height:22px;font-size:.65rem">${playerInitials(p.name)}</div>
              ${p.name}
            </div>`;
          }).join('')}
        </div>
      </div>

      <div id="game-selection-preview" style="margin-bottom:20px"></div>

      <div class="card" style="font-size:.82rem;color:var(--muted);line-height:1.6">
        ${_newGameMode === 60 ? `
          <b style="color:var(--text)">Mode 60 pts</b><br>
          • Min. 10 pts/manche (sinon = 0)<br>
          • Double 6 → victoire immédiate<br>
          • Cumulé ≥ 60 → victoire
        ` : `
          <b style="color:var(--text)">Mode 120 pts</b><br>
          • Min. 20 pts/manche (sinon = 0, sauf date du jour)<br>
          • Score manche = date du jour → victoire<br>
          • Score manche ≥ 60 (hors 0:1) → victoire<br>
          • 0:1 joué en dernier → +60 pts<br>
          • Double 6 → victoire immédiate<br>
          • Seul à ≥ 60 cumulé → victoire<br>
          • Cumulé ≥ 120 → victoire
        `}
      </div>

      <button class="btn btn-primary btn-full" id="btn-start-game">Lancer la partie</button>
    </div>
  `;
}
function bindNewGame() {
  document.getElementById('btn-back').onclick = () => {
    _newGameSelected = [];
    App.subScreen = 'session-detail';
    render();
  };
  // show preview if pre-populated (e.g. "new game again")
  if (_newGameSelected.length > 0) updateGameSelectionPreview();

  document.querySelectorAll('[data-mode]').forEach(el => {
    el.addEventListener('click', () => {
      _newGameMode = parseInt(el.dataset.mode);
      // re-render just the mode section without losing selection
      document.querySelectorAll('[data-mode]').forEach(m => m.classList.toggle('selected', parseInt(m.dataset.mode) === _newGameMode));
      // update rules card
      const card = document.querySelector('.card');
      if (card) card.innerHTML = _newGameMode === 60 ? `
        <b style="color:var(--text)">Mode 60 pts</b><br>
        • Min. 10 pts/manche (sinon = 0)<br>
        • Double 6 → victoire immédiate<br>
        • Cumulé ≥ 60 → victoire
      ` : `
        <b style="color:var(--text)">Mode 120 pts</b><br>
        • Min. 20 pts/manche (sinon = 0, sauf date du jour)<br>
        • Score manche = date du jour → victoire<br>
        • Score manche ≥ 60 (hors 0:1) → victoire<br>
        • 0:1 joué en dernier → +60 pts<br>
        • Double 6 → victoire immédiate<br>
        • Seul à ≥ 60 cumulé → victoire<br>
        • Cumulé ≥ 120 → victoire
      `;
    });
  });

  document.querySelectorAll('#game-player-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const pid = chip.dataset.pid;
      if (_newGameSelected.includes(pid)) {
        _newGameSelected = _newGameSelected.filter(x => x !== pid);
        chip.classList.remove('selected');
        chip.querySelector('.chip-order')?.remove();
      } else {
        if (_newGameSelected.length >= 3) { toast('Maximum 3 joueurs', 'warning'); return; }
        _newGameSelected.push(pid);
        chip.classList.add('selected');
        const order = document.createElement('span');
        order.className = 'chip-order';
        order.textContent = _newGameSelected.length;
        chip.insertBefore(order, chip.firstChild);
      }
      updateGameSelectionPreview();
    });
  });

  document.getElementById('btn-start-game').onclick = startGame;
}
function updateGameSelectionPreview() {
  const el = document.getElementById('game-selection-preview');
  if (!el || _newGameSelected.length === 0) { if (el) el.innerHTML = ''; return; }
  const players = DB.getPlayers();
  el.innerHTML = `<div class="section-title">Ordre de jeu</div>
    <div class="chip-row">${_newGameSelected.map((pid, i) => {
      const p = players.find(x => x.id === pid);
      return p ? `<div class="chip selected"><span class="chip-order">${i+1}</span>${p.name}</div>` : '';
    }).join('')}</div>`;
}
function startGame() {
  if (_newGameSelected.length < 2) { toast('Sélectionnez 2 ou 3 joueurs', 'error'); return; }
  const scores = {};
  _newGameSelected.forEach(pid => { scores[pid] = 0; });
  const game = {
    id: uid(),
    sessionId: App.sessionId,
    playerIds:  [..._newGameSelected],
    mode:       _newGameMode,
    status:     'active',
    currentTurnIndex: 0,
    rounds:     [],
    cumulativeScores: { ...scores },
    winnerId:   null,
    winReason:  null,
    createdAt:  now(),
    finishedAt: null,
  };
  DB.addGame(game);
  App.gameId    = game.id;
  App.subScreen = 'game';
  render();
}

// ============================================================
// ACTIVE GAME
// ============================================================

// per-game transient state
let _roundInputs   = {};  // { pid: { score: '', action: null } }
let _showHistory   = false;

function getGame() { return DB.getGames().find(g => g.id === App.gameId); }
function getGamePlayers(game) {
  return game.playerIds.map((pid, i) => ({ ...playerById(pid), idx: i })).filter(p => p.id);
}

function renderGame() {
  const game = getGame();
  if (!game) { App.subScreen = 'session-detail'; return renderSessionDetail(); }

  const players  = getGamePlayers(game);
  const finished = game.status === 'finished';
  const winner   = finished && game.winnerId ? playerById(game.winnerId) : null;
  const today    = new Date().getDate();

  return `
    <div class="screen-header">
      <button class="btn-back" id="btn-back">‹</button>
      <h2>Mode ${game.mode} pts · Tour ${game.rounds.length + (finished ? 0 : 1)}</h2>
      <button class="header-action" id="btn-toggle-history">${_showHistory ? 'Scores' : 'Historique'}</button>
    </div>
    <div class="screen">

      ${finished ? `
        <div class="win-banner">
          <h2>🏆 ${winner ? winner.name : 'Fin de partie'}</h2>
          <p>${WIN_REASON_LABELS[game.winReason] || 'Victoire !'}</p>
        </div>` : ''}

      <!-- Cumulative scores summary -->
      <div class="card" style="padding:12px 14px;margin-bottom:12px">
        <table class="score-table">
          <thead><tr>
            <th style="text-align:left">Joueur</th>
            <th>Total</th>
            <th>Cible</th>
            ${game.rounds.slice(-1)[0] ? '<th>Dernière</th>' : ''}
          </tr></thead>
          <tbody>
            ${players.map((p, i) => {
              const cum  = game.cumulativeScores[p.id] ?? 0;
              const last = game.rounds.length > 0 ? (game.rounds[game.rounds.length-1].effectiveScores[p.id] ?? 0) : null;
              const isWinner    = game.winnerId === p.id;
              const isCurrent   = !finished && i === game.currentTurnIndex;
              const pct = Math.min(100, Math.round((cum / game.mode) * 100));
              return `<tr class="${isWinner ? 'winner-row' : isCurrent ? 'current-turn' : ''}">
                <td class="player-name">
                  ${isCurrent ? '<span class="turn-dot" style="display:inline-block;margin-right:4px"></span>' : ''}
                  ${isWinner ? '🏆 ' : ''}${p.name}
                </td>
                <td class="score-total" style="color:${cum >= game.mode ? 'var(--green)' : cum >= game.mode*0.5 ? 'var(--orange)' : 'var(--text)'}">${cum}</td>
                <td style="font-size:.78rem;color:var(--muted)">${game.mode} (${pct}%)</td>
                ${last !== null ? `<td class="${last === 0 ? 'score-zero' : ''}">${last}</td>` : ''}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      ${_showHistory ? renderRoundHistory(game, players) : ''}

      ${!finished ? renderRoundInput(game, players, today) : `
        <button class="btn btn-secondary btn-full" id="btn-new-game-again">Nouvelle partie</button>
      `}
    </div>
  `;
}

function renderRoundHistory(game, players) {
  if (game.rounds.length === 0) return `<div class="section-title">Aucune manche jouée</div>`;
  return `
    <div class="section-title">Historique des manches</div>
    <div class="card rounds-history">
      <div class="round-row" style="font-weight:600">
        <div class="round-num">#</div>
        ${players.map(p => `<div style="flex:1;text-align:center;font-size:.78rem">${p.name}</div>`).join('')}
      </div>
      ${game.rounds.map((r, i) => `
        <div class="round-row">
          <div class="round-num">${i+1}</div>
          ${players.map(p => {
            const eff = r.effectiveScores[p.id] ?? 0;
            const act = r.specialActions[p.id];
            const tag = act === 'double6' ? ' 🎲' : act === 'domino01' ? ' 🃏' : '';
            return `<div style="flex:1;text-align:center;${eff === 0 ? 'color:var(--muted)' : ''}">${eff}${tag}</div>`;
          }).join('')}
        </div>`).join('')}
    </div>
  `;
}

function renderRoundInput(game, players, today) {
  const current = players[game.currentTurnIndex];
  return `
    <div class="active-turn-indicator">
      <div class="turn-dot"></div>
      <span>Tour de <b>${current ? current.name : '?'}</b></span>
      <span style="margin-left:auto;color:var(--muted);font-size:.78rem">Date: ${today}</span>
    </div>

    <div class="section-title">Saisir les scores de cette manche</div>
    <div class="round-input-card" id="round-input-card">
      ${players.map((p, i) => {
        const inp = _roundInputs[p.id] || { score: '', action: null };
        return `
        <div class="round-player-row">
          <div class="avatar ${avatarClass(i)}" style="width:34px;height:34px;font-size:.78rem">${playerInitials(p.name)}</div>
          <div class="round-player-name">${p.name}</div>
          <div class="action-btns">
            <button class="action-btn ${inp.action === 'double6' ? 'active-double6' : ''}" data-action="double6" data-pid="${p.id}">D6</button>
            ${game.mode === 120 ? `<button class="action-btn ${inp.action === 'domino01' ? 'active-domino01' : ''}" data-action="domino01" data-pid="${p.id}">0:1</button>` : ''}
          </div>
          <input class="score-input" type="number" inputmode="numeric" min="0" max="999"
            data-pid="${p.id}" value="${inp.score}" placeholder="0">
        </div>`;
      }).join('')}
    </div>

    <button class="btn btn-success btn-full" id="btn-submit-round" style="margin-top:4px">Valider la manche ✓</button>
  `;
}

function bindGame() {
  const game = getGame();
  if (!game) return;

  document.getElementById('btn-back').onclick = () => { App.subScreen = 'session-detail'; render(); };

  document.getElementById('btn-toggle-history')?.addEventListener('click', () => {
    _showHistory = !_showHistory; render();
  });

  document.getElementById('btn-new-game-again')?.addEventListener('click', () => {
    App.subScreen = 'new-game';
    _newGameSelected = [...game.playerIds];
    _newGameMode     = game.mode;
    render();
  });

  // Score inputs — save state on change
  document.querySelectorAll('.score-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const pid = inp.dataset.pid;
      if (!_roundInputs[pid]) _roundInputs[pid] = { score: '', action: null };
      _roundInputs[pid].score = inp.value;
    });
  });

  // Action buttons (D6, 0:1) — toggle
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid    = btn.dataset.pid;
      const action = btn.dataset.action;
      if (!_roundInputs[pid]) _roundInputs[pid] = { score: '', action: null };
      // toggle: clicking same action clears it
      _roundInputs[pid].action = _roundInputs[pid].action === action ? null : action;
      // visually update only this row without full re-render
      const row = btn.closest('.round-player-row');
      row.querySelectorAll('.action-btn').forEach(b => {
        b.className = 'action-btn';
        if (b.dataset.action === _roundInputs[pid].action) {
          b.classList.add(b.dataset.action === 'double6' ? 'active-double6' : 'active-domino01');
        }
      });
    });
  });

  document.getElementById('btn-submit-round')?.addEventListener('click', submitRound);
}

function submitRound() {
  const game    = getGame();
  if (!game || game.status === 'finished') return;
  const players = getGamePlayers(game);

  // collect inputs
  const rawScores     = {};
  const specialActions = {};
  let parseError = false;

  players.forEach(p => {
    const inp = _roundInputs[p.id] || {};
    const raw = parseInt(document.querySelector(`.score-input[data-pid="${p.id}"]`)?.value || inp.score || '0', 10);
    if (isNaN(raw) || raw < 0) { parseError = true; return; }
    rawScores[p.id]      = raw;
    specialActions[p.id] = inp.action || null;
  });

  if (parseError) { toast('Scores invalides', 'error'); return; }

  // process each player through rules
  const effectiveScores = {};
  let instantWinner = null;
  let instantReason  = null;

  for (const p of players) {
    const raw    = rawScores[p.id];
    const action = specialActions[p.id];
    const result = processRoundEntry(game.mode, raw, action, game.cumulativeScores[p.id] || 0);
    effectiveScores[p.id] = result.effectiveScore;

    if (result.instantWin && !instantWinner) {
      instantWinner = p.id;
      instantReason  = result.instantWin;
    }
  }

  // build new cumulative scores
  const newCumulative = { ...game.cumulativeScores };
  players.forEach(p => {
    newCumulative[p.id] = (newCumulative[p.id] || 0) + effectiveScores[p.id];
  });

  const round = {
    roundNumber: game.rounds.length + 1,
    rawScores,
    effectiveScores,
    specialActions,
  };

  // check instant win first
  let winnerId  = instantWinner;
  let winReason = instantReason;

  // then post-round conditions
  if (!winnerId) {
    const postWin = checkPostRoundWin(game.mode, newCumulative);
    if (postWin) { winnerId = postWin.winnerId; winReason = postWin.reason; }
  }

  // advance turn (winner of round starts next, else cycle)
  let nextTurn = game.currentTurnIndex;
  if (winnerId) {
    // already finishing
  } else {
    // who went out (action double6 or domino01) starts next round
    const outPlayer = players.find(p => specialActions[p.id] === 'double6' || specialActions[p.id] === 'domino01');
    if (outPlayer) {
      nextTurn = players.findIndex(p => p.id === outPlayer.id);
    } else {
      nextTurn = (game.currentTurnIndex + 1) % players.length;
    }
  }

  const updatedGame = {
    rounds:           [...game.rounds, round],
    cumulativeScores: newCumulative,
    currentTurnIndex: nextTurn,
    status:           winnerId ? 'finished' : 'active',
    winnerId:         winnerId || null,
    winReason:        winReason || null,
    finishedAt:       winnerId ? now() : null,
  };
  DB.updateGame(game.id, updatedGame);

  // reset round inputs
  _roundInputs = {};
  _showHistory = false;

  if (winnerId) {
    const w = playerById(winnerId);
    toast(`🏆 ${w ? w.name : '?'} gagne ! ${WIN_REASON_LABELS[winReason] || ''}`, 'success');
    // vibrate
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  } else {
    if (navigator.vibrate) navigator.vibrate(50);
  }

  render();
}

// ============================================================
// PLAYERS
// ============================================================
function renderPlayers() {
  const players = DB.getPlayers();
  const games   = DB.getGames();
  return `
    <div class="screen-header">
      <h2>Joueurs</h2>
    </div>
    <div class="screen">
      ${players.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">👤</div>
          <p>Aucun joueur encore.<br>Appuyez sur + pour en ajouter.</p>
        </div>` :
        players.map((p, i) => {
          const wins   = games.filter(g => g.winnerId === p.id).length;
          const played = games.filter(g => g.playerIds.includes(p.id)).length;
          return `
          <div class="list-item" data-pid="${p.id}">
            <div class="avatar ${avatarClass(i)}">${playerInitials(p.name)}</div>
            <div class="list-item-main">
              <div class="list-item-title">${p.name}</div>
              <div class="list-item-sub">${played} partie(s) · ${wins} victoire(s)</div>
            </div>
            <div class="list-item-end">
              <button class="btn btn-sm btn-secondary delete-player" data-pid="${p.id}" style="color:var(--red)">✕</button>
            </div>
          </div>`;
        }).join('')}
      <div style="height:72px"></div>
    </div>
    <button class="fab" id="fab-add-player">+</button>
  `;
}
function bindPlayers() {
  document.getElementById('fab-add-player')?.addEventListener('click', showAddPlayerModal);
  document.querySelectorAll('.delete-player').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const pid = btn.dataset.pid;
      const p   = playerById(pid);
      confirmDialog(`Supprimer ${p?.name} ?`, () => {
        DB.deletePlayer(pid);
        render();
        toast('Joueur supprimé');
      });
    });
  });
}

function showAddPlayerModal(onAdded) {
  openModal('Nouveau joueur', `
    <div class="form-group">
      <label class="form-label">Nom du joueur</label>
      <input class="form-input" id="new-player-name" type="text" placeholder="Nom" autocomplete="off" autofocus>
    </div>
    <button class="btn btn-primary btn-full" id="btn-save-player">Ajouter</button>
  `, () => {
    const inp = document.getElementById('new-player-name');
    inp.focus();
    const save = () => {
      const name = inp.value.trim();
      if (!name) { toast('Entrez un nom', 'error'); return; }
      const player = { id: uid(), name, createdAt: now() };
      DB.addPlayer(player);
      closeModal();
      toast(`${name} ajouté !`, 'success');
      if (typeof onAdded === 'function') onAdded(player);
      else render();
    };
    document.getElementById('btn-save-player').onclick = save;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  });
}

// ============================================================
// CONFIG
// ============================================================
function renderConfig() {
  const dbList  = DB.getDbList();
  const active  = DB.getActiveName();
  const today   = new Date().getDate();
  const r60     = RULES.mode60;
  const r120    = RULES.mode120;

  return `
    <div class="screen-header">
      <h2>Configuration</h2>
    </div>
    <div class="screen">

      <!-- ─── DATABASES ───────────────────────────────────── -->
      <div class="section-title">Bases de données</div>
      <div id="db-list">
        ${dbList.map(name => {
          const isActive = name === active;
          const size     = DB.sizeKb(name);
          const data     = DB._read(name);
          const stats    = `${data.players.length} joueurs · ${data.sessions.length} sessions · ${data.games.length} parties`;
          return `
          <div class="db-card ${isActive ? 'active-db' : ''}">
            <div class="db-info">
              <div class="db-name">${name} ${isActive ? '<span class="badge badge-purple">Active</span>' : ''}</div>
              <div class="db-meta">${stats} · ${size} KB</div>
            </div>
            <div class="db-actions">
              ${!isActive ? `<button class="btn btn-sm btn-primary db-switch" data-name="${name}">Utiliser</button>` : ''}
              <button class="btn btn-sm btn-secondary db-export" data-name="${name}" title="Exporter JSON">⬇</button>
              ${name !== 'default' ? `<button class="btn btn-sm btn-secondary db-delete" data-name="${name}" style="color:var(--red)" title="Supprimer">✕</button>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>

      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-secondary" id="btn-create-db" style="flex:1">+ Nouvelle base</button>
        <button class="btn btn-secondary" id="btn-archive-db" style="flex:1">📦 Archiver active</button>
        <button class="btn btn-secondary" id="btn-import-db" style="flex:1">⬆ Importer JSON</button>
      </div>
      <input type="file" id="file-import" accept=".json" class="hidden">

      <div class="divider"></div>

      <!-- ─── RULES 60 ─────────────────────────────────────── -->
      <div class="section-title">Règles — Mode 60 pts</div>
      <div class="card">
        <div class="rule-row">
          <div class="rule-label">
            <div class="rule-name">Cible</div>
            <div class="rule-desc">Score cumulé pour gagner</div>
          </div>
          <input class="score-input" type="number" id="rule-60-target" value="${r60.target}" style="width:70px">
        </div>
        <div class="rule-row">
          <div class="rule-label">
            <div class="rule-name">Minimum par manche</div>
            <div class="rule-desc">Score &lt; seuil → compte 0</div>
          </div>
          <input class="score-input" type="number" id="rule-60-min" value="${r60.minScorePerRound}" style="width:70px">
        </div>
        <div class="rule-row">
          <div class="rule-label">
            <div class="rule-name">Double 6</div>
            <div class="rule-desc">Terminer avec double-6 → victoire</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="rule-60-double6" ${r60.winConditions.double6 ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- ─── RULES 120 ────────────────────────────────────── -->
      <div class="section-title">Règles — Mode 120 pts</div>
      <div class="card">
        <div class="rule-row">
          <div class="rule-label"><div class="rule-name">Cible</div></div>
          <input class="score-input" type="number" id="rule-120-target" value="${r120.target}" style="width:70px">
        </div>
        <div class="rule-row">
          <div class="rule-label">
            <div class="rule-name">Minimum par manche</div>
            <div class="rule-desc">Score &lt; seuil → 0 (sauf date du jour)</div>
          </div>
          <input class="score-input" type="number" id="rule-120-min" value="${r120.minScorePerRound}" style="width:70px">
        </div>
        <div class="rule-row">
          <div class="rule-label">
            <div class="rule-name">Bonus pièce 0:1</div>
            <div class="rule-desc">Pts ajoutés si dernier domino = 0:1</div>
          </div>
          <input class="score-input" type="number" id="rule-120-d01" value="${r120.domino01Bonus}" style="width:70px">
        </div>
        <div class="rule-row">
          <div class="rule-label"><div class="rule-name">Double 6 → victoire</div></div>
          <label class="toggle">
            <input type="checkbox" id="rule-120-double6" ${r120.winConditions.double6 ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="rule-row">
          <div class="rule-label">
            <div class="rule-name">Score manche = date du jour</div>
            <div class="rule-desc">Aujourd'hui : <b>${today}</b> → victoire si score = ${today}</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="rule-120-date" ${r120.winConditions.roundMatchesDate ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="rule-row">
          <div class="rule-label">
            <div class="rule-name">Score manche ≥ 60</div>
            <div class="rule-desc">Score naturel ≥ 60 (hors 0:1) → victoire</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="rule-120-score60" ${r120.winConditions.roundScore60 ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="rule-row">
          <div class="rule-label">
            <div class="rule-name">Seul à ≥ 60 cumulé</div>
            <div class="rule-desc">Si un seul joueur a ≥ 60 pts cumulé → victoire</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="rule-120-single60" ${r120.winConditions.singlePlayerAt60 ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <button class="btn btn-primary btn-full" id="btn-save-rules" style="margin-top:4px">Enregistrer les règles</button>

      <div class="divider"></div>
      <div style="font-size:.75rem;color:var(--muted);text-align:center;padding-bottom:8px">
        Kandra Domy · Base active : <b>${active}</b><br>
        <span id="app-version">Version : chargement...</span>
      </div>
    </div>
  `;
}

function bindConfig() {
  // ── version depuis le cache SW ──
  if ('caches' in window) {
    caches.keys().then(keys => {
      const swCache = keys.find(k => k.startsWith('kandra-domy-v'));
      const el = document.getElementById('app-version');
      if (!el) return;
      if (swCache) {
        const ts = parseInt(swCache.replace('kandra-domy-v', ''));
        if (ts) {
          const d = new Date(ts * 1000);
          el.textContent = `Version : ${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}`;
        } else {
          el.textContent = `Version : ${swCache}`;
        }
      } else {
        el.textContent = 'Version : dev (pas de cache)';
      }
    });
  } else {
    const el = document.getElementById('app-version');
    if (el) el.textContent = 'Version : dev';
  }

  // ── database actions ──
  document.querySelectorAll('.db-switch').forEach(btn => {
    btn.addEventListener('click', () => {
      DB.switchDb(btn.dataset.name);
      _roundInputs = {};
      render();
      toast(`Base "${btn.dataset.name}" activée`, 'success');
    });
  });

  document.querySelectorAll('.db-export').forEach(btn => {
    btn.addEventListener('click', () => {
      const json = DB.exportJson(btn.dataset.name);
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `kandra-domy-${btn.dataset.name}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Export téléchargé');
    });
  });

  document.querySelectorAll('.db-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmDialog(`Supprimer la base "${btn.dataset.name}" définitivement ?`, () => {
        DB.deleteDb(btn.dataset.name);
        render();
        toast('Base supprimée');
      });
    });
  });

  document.getElementById('btn-create-db')?.addEventListener('click', () => {
    openModal('Nouvelle base de données', `
      <div class="form-group">
        <label class="form-label">Nom</label>
        <input class="form-input" id="new-db-name" type="text" placeholder="Ex: Tournoi 2026" autocomplete="off">
      </div>
      <label class="toggle" style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <input type="checkbox" id="new-db-switch">
        <span class="toggle-slider"></span>
        <span style="font-size:.88rem">Activer tout de suite</span>
      </label>
      <button class="btn btn-primary btn-full" id="btn-save-new-db">Créer</button>
    `, () => {
      document.getElementById('new-db-name').focus();
      document.getElementById('btn-save-new-db').onclick = () => {
        const name = document.getElementById('new-db-name').value.trim();
        if (!name) { toast('Nom requis', 'error'); return; }
        if (!DB.createDb(name)) { toast('Ce nom existe déjà', 'error'); return; }
        if (document.getElementById('new-db-switch').checked) DB.switchDb(name);
        closeModal();
        render();
        toast(`Base "${name}" créée`, 'success');
      };
    });
  });

  document.getElementById('btn-archive-db')?.addEventListener('click', () => {
    const active = DB.getActiveName();
    openModal('Archiver la base active', `
      <p style="color:var(--muted);font-size:.88rem;margin-bottom:12px">
        La base "<b>${active}</b>" sera copiée sous un nouveau nom, puis remise à zéro.
      </p>
      <div class="form-group">
        <label class="form-label">Nom de l'archive</label>
        <input class="form-input" id="archive-name" type="text" value="${active}-${new Date().toISOString().slice(0,10)}" autocomplete="off">
      </div>
      <button class="btn btn-primary btn-full" id="btn-do-archive">Archiver et remettre à zéro</button>
    `, () => {
      document.getElementById('btn-do-archive').onclick = () => {
        const archiveName = document.getElementById('archive-name').value.trim();
        if (!archiveName) { toast('Nom requis', 'error'); return; }
        DB.archiveDb(archiveName);
        closeModal();
        render();
        toast(`Archivé sous "${archiveName}"`, 'success');
      };
    });
  });

  document.getElementById('btn-import-db')?.addEventListener('click', () => {
    document.getElementById('file-import').click();
  });
  document.getElementById('file-import')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const defaultName = file.name.replace('.json','').replace(/[^a-z0-9_-]/gi, '-');
    openModal('Importer JSON', `
      <p style="color:var(--muted);font-size:.88rem;margin-bottom:12px">Fichier : ${file.name}</p>
      <div class="form-group">
        <label class="form-label">Nom de la base importée</label>
        <input class="form-input" id="import-db-name" type="text" value="${defaultName}" autocomplete="off">
      </div>
      <button class="btn btn-primary btn-full" id="btn-do-import">Importer</button>
    `, () => {
      document.getElementById('btn-do-import').onclick = () => {
        const name = document.getElementById('import-db-name').value.trim();
        if (!name) { toast('Nom requis', 'error'); return; }
        const reader = new FileReader();
        reader.onload = ev => {
          if (DB.importJson(name, ev.target.result)) {
            closeModal();
            render();
            toast(`Importé sous "${name}"`, 'success');
          } else {
            toast('Fichier JSON invalide', 'error');
          }
        };
        reader.readAsText(file);
      };
    });
    e.target.value = '';
  });

  // ── rules save ──
  document.getElementById('btn-save-rules')?.addEventListener('click', () => {
    RULES.mode60.target              = parseInt(document.getElementById('rule-60-target').value)  || 60;
    RULES.mode60.minScorePerRound    = parseInt(document.getElementById('rule-60-min').value)     || 10;
    RULES.mode60.winConditions.double6 = document.getElementById('rule-60-double6').checked;

    RULES.mode120.target             = parseInt(document.getElementById('rule-120-target').value) || 120;
    RULES.mode120.minScorePerRound   = parseInt(document.getElementById('rule-120-min').value)    || 20;
    RULES.mode120.domino01Bonus      = parseInt(document.getElementById('rule-120-d01').value)    || 60;
    RULES.mode120.winConditions.double6          = document.getElementById('rule-120-double6').checked;
    RULES.mode120.winConditions.roundMatchesDate = document.getElementById('rule-120-date').checked;
    RULES.mode120.winConditions.roundScore60     = document.getElementById('rule-120-score60').checked;
    RULES.mode120.winConditions.singlePlayerAt60 = document.getElementById('rule-120-single60').checked;

    // persist rules in localStorage
    localStorage.setItem('kandra_rules', JSON.stringify(RULES));
    toast('Règles enregistrées ✓', 'success');
  });
}

// ============================================================
// INIT
// ============================================================
function init() {
  // restore saved rules if any
  try {
    const saved = JSON.parse(localStorage.getItem('kandra_rules'));
    if (saved) {
      Object.assign(RULES.mode60,  saved.mode60  || {});
      Object.assign(RULES.mode120, saved.mode120 || {});
      Object.assign(RULES.mode60.winConditions,  (saved.mode60  || {}).winConditions  || {});
      Object.assign(RULES.mode120.winConditions, (saved.mode120 || {}).winConditions || {});
    }
  } catch {}

  // ensure default db exists
  const list = DB.getDbList();
  if (!list.includes('default')) {
    DB._saveDbList(['default', ...list]);
    DB._write('default', DB._empty());
  }

  // bottom nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      App.screen    = btn.dataset.screen;
      App.subScreen = null;
      App.sessionId = null;
      App.gameId    = null;
      _roundInputs  = {};
      _showHistory  = false;
      render();
    });
  });

  render();
}

document.addEventListener('DOMContentLoaded', init);
