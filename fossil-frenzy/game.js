// === FOSSIL FRENZY - Game Engine ===

// ---- UPGRADE DEFINITIONS ----
const UPGRADES = [
  {
    id: 'dig_speed',
    name: 'Dig Speed',
    icon: '\u26CF',
    desc: 'Each click does more damage to blocks',
    maxLevel: 10,
    baseCost: 20,
    costScale: 1.8,
    effect: (lvl) => 1 + lvl * 0.5, // multiplier on dig damage
  },
  {
    id: 'dig_power',
    name: 'Dig Power',
    icon: '\u{1F4AA}',
    desc: 'Penetrate deeper layers sooner',
    maxLevel: 10,
    baseCost: 30,
    costScale: 2.0,
    effect: (lvl) => lvl, // bonus depth access
  },
  {
    id: 'rarity_luck',
    name: 'Rarity Luck',
    icon: '\u{1F340}',
    desc: 'Increases chance of finding rarer items',
    maxLevel: 10,
    baseCost: 50,
    costScale: 2.2,
    effect: (lvl) => lvl * 5, // percentage boost to rarity rolls
  },
  {
    id: 'research_speed',
    name: 'Research Speed',
    icon: '\u{1F52C}',
    desc: 'Reduces research time for all tables',
    maxLevel: 10,
    baseCost: 40,
    costScale: 2.0,
    effect: (lvl) => 1 - lvl * 0.07, // time multiplier (0.3 at max)
  },
  {
    id: 'extra_table',
    name: 'Research Table',
    icon: '\u{1F4CB}',
    desc: 'Add another research table',
    maxLevel: 4,
    baseCost: 100,
    costScale: 3.0,
    effect: (lvl) => 1 + lvl, // total tables
  },
  {
    id: 'keen_eye',
    name: 'Keen Eye',
    icon: '\u{1F441}',
    desc: 'Subtle glow on blocks containing items',
    maxLevel: 5,
    baseCost: 80,
    costScale: 2.5,
    effect: (lvl) => lvl * 0.15, // glow opacity
  },
];

// ---- GAME STATE ----
const DIG_COLS = 12;
const DIG_ROWS = 20;
const RESET_INTERVAL = 5 * 60; // 5 minutes in seconds
const ITEMS_PER_RESET = 16;

const state = {
  currency: 0,
  upgrades: {},       // { upgradeId: level }
  collection: {},     // { artifactId: true }
  fragments: {},      // { artifactId: [fragmentIndex, ...] }
  inventory: [],      // [{ artifactId, emoji, rarity, name }] - whole/assembled items ready to clean
  digGrid: [],        // 2D array of cell states
  resetTimer: RESET_INTERVAL,
  cleaning: null,     // { artifactId, emoji, name, rarity, clicksNeeded, clicksDone }
  researchTables: [], // [{ artifactId, emoji, name, rarity, startTime, duration, complete } | null]
  lastSaveTime: Date.now(),
};

function initState() {
  // Initialize upgrades
  UPGRADES.forEach(u => {
    if (state.upgrades[u.id] === undefined) state.upgrades[u.id] = 0;
  });

  // Initialize research tables
  const tableCount = getUpgradeEffect('extra_table');
  while (state.researchTables.length < tableCount) {
    state.researchTables.push(null);
  }
}

// ---- SAVE / LOAD ----
function saveGame() {
  state.lastSaveTime = Date.now();
  const saveData = {
    currency: state.currency,
    upgrades: state.upgrades,
    collection: state.collection,
    fragments: state.fragments,
    inventory: state.inventory,
    resetTimer: state.resetTimer,
    cleaning: state.cleaning,
    researchTables: state.researchTables,
    lastSaveTime: state.lastSaveTime,
  };
  localStorage.setItem('fossilFrenzy_save', JSON.stringify(saveData));
}

function loadGame() {
  const raw = localStorage.getItem('fossilFrenzy_save');
  if (!raw) return false;

  try {
    const data = JSON.parse(raw);
    Object.assign(state, data);

    // Calculate offline research progress
    const now = Date.now();
    const elapsed = (now - (state.lastSaveTime || now)) / 1000;

    state.researchTables.forEach(table => {
      if (table && !table.complete) {
        const timeRemaining = table.duration - ((state.lastSaveTime - table.startTime) / 1000);
        if (timeRemaining <= elapsed) {
          table.complete = true;
        }
      }
    });

    // Advance reset timer for offline time
    state.resetTimer = Math.max(0, state.resetTimer - elapsed);
    if (state.resetTimer <= 0) {
      state.resetTimer = RESET_INTERVAL;
    }

    return true;
  } catch (e) {
    console.error('Failed to load save:', e);
    return false;
  }
}

// ---- UPGRADE HELPERS ----
function getUpgradeLevel(id) {
  return state.upgrades[id] || 0;
}

function getUpgradeEffect(id) {
  const upg = UPGRADES.find(u => u.id === id);
  if (!upg) return 0;
  return upg.effect(getUpgradeLevel(id));
}

function getUpgradeCost(id) {
  const upg = UPGRADES.find(u => u.id === id);
  if (!upg) return Infinity;
  const level = getUpgradeLevel(id);
  if (level >= upg.maxLevel) return Infinity;
  return Math.floor(upg.baseCost * Math.pow(upg.costScale, level));
}

function buyUpgrade(id) {
  const cost = getUpgradeCost(id);
  if (state.currency < cost) return false;
  const upg = UPGRADES.find(u => u.id === id);
  if (getUpgradeLevel(id) >= upg.maxLevel) return false;

  state.currency -= cost;
  state.upgrades[id] = (state.upgrades[id] || 0) + 1;

  // If buying a research table, add a slot
  if (id === 'extra_table') {
    state.researchTables.push(null);
  }

  saveGame();
  ui.renderAll();
  return true;
}

// ---- DIG SITE ----
function generateDigSite() {
  state.digGrid = [];

  let rowIndex = 0;
  for (const layer of LAYERS) {
    for (let r = 0; r < layer.rows; r++) {
      const row = [];
      for (let c = 0; c < DIG_COLS; c++) {
        row.push({
          layerIndex: layer.depth,
          clicksRemaining: layer.clicksToBreak,
          maxClicks: layer.clicksToBreak,
          dug: false,
          hasItem: false,
          artifact: null,
          fragmentIndex: -1,
        });
      }
      state.digGrid.push(row);
      rowIndex++;
    }
  }

  // Place items randomly
  placeItems();
}

function placeItems() {
  const luckBonus = getUpgradeEffect('rarity_luck');

  for (let i = 0; i < ITEMS_PER_RESET; i++) {
    // Pick a random non-item cell
    let attempts = 0;
    while (attempts < 100) {
      const r = Math.floor(Math.random() * DIG_ROWS);
      const c = Math.floor(Math.random() * DIG_COLS);
      const cell = state.digGrid[r][c];

      if (!cell.hasItem) {
        // Pick artifact based on layer
        const artifact = pickArtifactForLayerWithLuck(cell.layerIndex, luckBonus);
        const rarityConf = RARITY_CONFIG[artifact.rarity];

        cell.hasItem = true;
        cell.artifact = artifact;

        // If it's a fragment-based item, pick a random fragment
        if (rarityConf.fragments > 1) {
          cell.fragmentIndex = Math.floor(Math.random() * rarityConf.fragments);
        }
        break;
      }
      attempts++;
    }
  }
}

function pickArtifactForLayerWithLuck(layerIndex, luckBonus) {
  const layer = LAYERS[layerIndex];
  const weights = { ...layer.rarityWeights };

  // Apply luck: shift weight from common/uncommon to higher rarities
  if (luckBonus > 0) {
    const shift = Math.min(luckBonus, weights.common * 0.5);
    weights.common -= shift;
    weights.rare += shift * 0.4;
    weights.epic += shift * 0.35;
    weights.legendary += shift * 0.25;
  }

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const roll = Math.random() * total;
  let cumulative = 0;
  let selectedRarity = RARITY.COMMON;

  for (const [rarity, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (roll < cumulative) {
      selectedRarity = rarity;
      break;
    }
  }

  const candidates = ARTIFACTS.filter(a => a.rarity === selectedRarity);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function canDig(row, col) {
  if (row === 0) return true;
  return state.digGrid[row - 1][col].dug;
}

function digCell(row, col) {
  const cell = state.digGrid[row][col];
  if (cell.dug) return;
  if (!canDig(row, col)) return;

  // Calculate damage
  const digSpeedMult = getUpgradeEffect('dig_speed');
  const damage = Math.max(1, Math.floor(digSpeedMult));

  cell.clicksRemaining -= damage;

  if (cell.clicksRemaining <= 0) {
    cell.dug = true;

    if (cell.hasItem && cell.artifact) {
      handleItemFound(cell);
    }
  }

  ui.renderDigCell(row, col);
  saveGame();
}

function handleItemFound(cell) {
  // Item stays in the dig site — player must click it to select, then move to cleaner
  cell.revealed = true;
}

// Currently selected item in the dig site (row, col)
state.selectedDig = null;

function selectDigItem(row, col) {
  const cell = state.digGrid[row][col];
  if (!cell.revealed || !cell.artifact) return;

  // Toggle selection
  if (state.selectedDig && state.selectedDig.row === row && state.selectedDig.col === col) {
    state.selectedDig = null;
  } else {
    state.selectedDig = { row, col };
    // On mobile: auto-switch to clean tab so player sees the Move button
    if (isMobileLayout()) {
      ui.switchTab('clean');
    }
  }

  ui.renderDigSite();
  ui.renderCleaning();
  ui.renderBadges();
}

const MYSTERY_EMOJI = '\u{1F4E6}'; // box emoji for undiscovered items

function moveSelectedToCleaner() {
  if (!state.selectedDig) return;

  const { row, col } = state.selectedDig;
  const cell = state.digGrid[row][col];
  if (!cell.revealed || !cell.artifact) return;

  const artifact = cell.artifact;
  const rarityConf = RARITY_CONFIG[artifact.rarity];

  // Send to cleaner — identity is unknown until cleaning is done
  if (rarityConf.fragments > 1) {
    sendToCleaner(artifact, cell.fragmentIndex);
  } else {
    sendToCleaner(artifact, -1);
  }

  // Remove item from dig site
  cell.revealed = false;
  cell.hasItem = false;
  cell.artifact = null;
  state.selectedDig = null;

  // On mobile: auto-switch to clean tab
  if (isMobileLayout()) {
    ui.switchTab('clean');
  }

  ui.renderDigSite();
  ui.renderInventory();
  ui.renderFragments();
  ui.renderCleaning();
  ui.renderBadges();
  saveGame();
}

function isMobileLayout() {
  if (!window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse)').matches
      || window.matchMedia('(max-width: 900px)').matches;
}

function sendToCleaner(artifact, fragmentIndex) {
  const rarityConf = RARITY_CONFIG[artifact.rarity];

  if (!state.cleaning) {
    state.cleaning = {
      artifactId: artifact.id,
      emoji: artifact.emoji,
      name: artifact.name,
      rarity: artifact.rarity,
      fragmentIndex: fragmentIndex,
      clicksNeeded: rarityConf.cleanClicks,
      clicksDone: 0,
    };
  } else {
    // Cleaner is busy — put in inventory (still unknown)
    state.inventory.push({
      artifactId: artifact.id,
      emoji: artifact.emoji,
      rarity: artifact.rarity,
      name: artifact.name,
      fragmentIndex: fragmentIndex,
      cleaned: false,
    });
    showToast('Cleaner busy! Unknown artifact stored.');
  }
}

function resetDigSite() {
  state.resetTimer = RESET_INTERVAL;
  generateDigSite();
  ui.renderDigSite();
  showToast('Dig site refreshed! New treasures await.');
}

// ---- CLEANING ----
function startCleaning(inventoryIndex) {
  if (state.cleaning) return; // already cleaning something

  const item = state.inventory[inventoryIndex];
  const artifact = ARTIFACTS.find(a => a.id === item.artifactId);
  const rarityConf = RARITY_CONFIG[item.rarity];

  state.cleaning = {
    artifactId: item.artifactId,
    emoji: item.emoji,
    name: item.name,
    rarity: item.rarity,
    clicksNeeded: rarityConf.cleanClicks,
    clicksDone: 0,
  };

  state.inventory.splice(inventoryIndex, 1);
  ui.renderInventory();
  ui.renderCleaning();
  saveGame();
}

function clickClean() {
  if (!state.cleaning) return;

  state.cleaning.clicksDone++;

  if (state.cleaning.clicksDone >= state.cleaning.clicksNeeded) {
    // Cleaning complete — NOW reveal the item identity
    const cleaned = state.cleaning;
    state.cleaning = null;
    const artifact = ARTIFACTS.find(a => a.id === cleaned.artifactId);
    const rarityConf = RARITY_CONFIG[cleaned.rarity];

    // Handle fragment logic now that identity is revealed
    if (cleaned.fragmentIndex >= 0) {
      const fragIndex = cleaned.fragmentIndex;
      const fragName = artifact.fragmentNames
        ? artifact.fragmentNames[fragIndex]
        : `Fragment ${fragIndex + 1}`;

      if (!state.fragments[artifact.id]) {
        state.fragments[artifact.id] = [];
      }

      if (state.fragments[artifact.id].includes(fragIndex)) {
        state.currency += DUPLICATE_FRAGMENT_REWARD;
        showFoundPopup(artifact, `Duplicate! +${DUPLICATE_FRAGMENT_REWARD} RG`, false);
      } else {
        state.fragments[artifact.id].push(fragIndex);
        const total = rarityConf.fragments;
        const found = state.fragments[artifact.id].length;

        if (found >= total) {
          // Set complete — send assembled item to research
          delete state.fragments[artifact.id];
          showFoundPopup(artifact, 'Complete set!', true);

          let placed = false;
          for (let i = 0; i < state.researchTables.length; i++) {
            if (state.researchTables[i] === null) {
              startResearch(i, cleaned);
              placed = true;
              break;
            }
          }
          if (!placed) {
            state.inventory.push({
              artifactId: cleaned.artifactId,
              emoji: cleaned.emoji,
              rarity: cleaned.rarity,
              name: cleaned.name,
              cleaned: true,
            });
          }
        } else {
          showFoundPopup(artifact, `${fragName} (${found}/${total})`, false);
        }
      }
      ui.renderFragments();
    } else {
      // Whole item — reveal and send to research
      showFoundPopup(artifact, null, false);

      let placed = false;
      for (let i = 0; i < state.researchTables.length; i++) {
        if (state.researchTables[i] === null) {
          startResearch(i, cleaned);
          placed = true;
          break;
        }
      }

      if (!placed) {
        state.inventory.push({
          artifactId: cleaned.artifactId,
          emoji: cleaned.emoji,
          rarity: cleaned.rarity,
          name: cleaned.name,
          cleaned: true,
        });
        showToast('All tables busy! Item stored in inventory.');
      }
    }

    ui.renderInventory();
    ui.renderCurrency();
    ui.renderUpgrades();
  }

  ui.renderCleaning();
  saveGame();
}

// ---- RESEARCH ----
function startResearch(tableIndex, item) {
  const artifact = ARTIFACTS.find(a => a.id === item.artifactId);
  const rarityConf = RARITY_CONFIG[item.rarity];
  const speedMult = getUpgradeEffect('research_speed');
  const duration = Math.max(5, Math.floor(rarityConf.researchTime * speedMult));

  state.researchTables[tableIndex] = {
    artifactId: item.artifactId,
    emoji: item.emoji,
    name: item.name,
    rarity: item.rarity,
    startTime: Date.now(),
    duration: duration,
    complete: false,
  };

  showToast(`Researching: ${item.name}`);
  ui.renderResearch();
  saveGame();
}

function collectResearch(tableIndex) {
  const table = state.researchTables[tableIndex];
  if (!table || !table.complete) return;

  const artifact = ARTIFACTS.find(a => a.id === table.artifactId);
  const rarityConf = RARITY_CONFIG[table.rarity];

  // Award currency
  state.currency += rarityConf.reward;

  // Add to collection
  state.collection[table.artifactId] = true;

  // Show research popup
  ui.showResearchPopup(artifact, rarityConf.reward);

  // Clear table
  state.researchTables[tableIndex] = null;

  ui.renderResearch();
  ui.renderCurrency();
  ui.renderUpgrades();
  saveGame();
}

function placeOnResearchTable(inventoryIndex) {
  const item = state.inventory[inventoryIndex];
  if (!item.cleaned) return;

  for (let i = 0; i < state.researchTables.length; i++) {
    if (state.researchTables[i] === null) {
      state.inventory.splice(inventoryIndex, 1);
      startResearch(i, item);
      ui.renderInventory();
      return true;
    }
  }

  showToast('All research tables are busy!');
  return false;
}

// ---- TIMER / GAME LOOP ----
let gameInterval;

function startGameLoop() {
  gameInterval = setInterval(() => {
    // Update reset timer
    state.resetTimer -= 1;
    if (state.resetTimer <= 0) {
      resetDigSite();
    }
    ui.renderTimer();

    // Update research tables
    const now = Date.now();
    state.researchTables.forEach((table, i) => {
      if (table && !table.complete) {
        const elapsed = (now - table.startTime) / 1000;
        if (elapsed >= table.duration) {
          table.complete = true;
          showToast(`Research complete: ${table.name}!`);
        }
      }
    });
    ui.renderResearch();
    ui.renderUpgrades();

    // Auto-save every 30 seconds
    if (Date.now() - state.lastSaveTime > 30000) {
      saveGame();
    }
  }, 1000);
}

// ---- TOAST NOTIFICATIONS ----
function showToast(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

// ---- FOUND POPUP ----
function showFoundPopup(artifact, fragmentInfo, isAssemblyComplete) {
  const popup = document.getElementById('found-popup');
  const title = document.getElementById('found-popup-title');
  const emoji = document.getElementById('found-popup-emoji');
  const name = document.getElementById('found-popup-name');
  const rarity = document.getElementById('found-popup-rarity');
  const rarityConf = RARITY_CONFIG[artifact.rarity];

  if (fragmentInfo) {
    title.textContent = isAssemblyComplete ? 'Set Complete!' : 'Fragment Found!';
    name.textContent = `${artifact.name} - ${fragmentInfo}`;
  } else {
    title.textContent = 'Item Found!';
    name.textContent = artifact.name;
  }

  emoji.textContent = artifact.emoji;
  rarity.textContent = rarityConf.label;
  rarity.style.color = rarityConf.color;

  popup.classList.remove('hidden');
}

// ---- UI CONTROLLER ----
const ui = {
  renderAll() {
    this.renderCurrency();
    this.renderDigSite();
    this.renderCleaning();
    this.renderResearch();
    this.renderInventory();
    this.renderFragments();
    this.renderTimer();
    this.renderUpgrades();
    this.renderBadges();
  },

  switchTab(tabName) {
    document.body.classList.remove('tab-dig', 'tab-clean', 'tab-research');
    document.body.classList.add('tab-' + tabName);
    document.querySelectorAll('.mobile-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    state.activeTab = tabName;
  },

  renderBadges() {
    // Dig tab: any revealed/collectible cell
    let digBadge = false;
    for (let r = 0; r < DIG_ROWS && !digBadge; r++) {
      for (let c = 0; c < DIG_COLS; c++) {
        if (state.digGrid[r] && state.digGrid[r][c] && state.digGrid[r][c].revealed) {
          digBadge = true;
          break;
        }
      }
    }

    // Clean tab: item selected in dig site (needs move) OR cleaning in progress
    const cleanBadge = state.selectedDig !== null || state.cleaning !== null;

    // Research tab: any table is complete
    const researchBadge = state.researchTables.some(t => t && t.complete);

    const setBadge = (id, visible, gold) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('visible', visible);
      el.classList.toggle('gold', gold);
    };

    setBadge('badge-dig', digBadge, false);
    setBadge('badge-clean', cleanBadge, false);
    setBadge('badge-research', researchBadge, true);
  },

  renderCurrency() {
    document.getElementById('currency-amount').textContent = state.currency.toLocaleString();
  },

  renderTimer() {
    const mins = Math.floor(state.resetTimer / 60);
    const secs = Math.floor(state.resetTimer % 60);
    document.getElementById('timer-display').textContent =
      `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  renderDigSite() {
    const grid = document.getElementById('dig-grid');
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${DIG_COLS}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${DIG_ROWS}, 1fr)`;

    const keenEyeOpacity = getUpgradeEffect('keen_eye');

    for (let r = 0; r < DIG_ROWS; r++) {
      for (let c = 0; c < DIG_COLS; c++) {
        const cell = state.digGrid[r][c];
        const layer = LAYERS[cell.layerIndex];
        const el = document.createElement('div');
        el.className = 'dig-cell';
        el.dataset.row = r;
        el.dataset.col = c;

        if (cell.dug) {
          el.classList.add('dug');
          if (cell.revealed && cell.artifact) {
            const isSelected = state.selectedDig && state.selectedDig.row === r && state.selectedDig.col === c;
            el.classList.add('has-item', 'collectible');
            if (isSelected) el.classList.add('selected');
            el.innerHTML = `<span class="item-reveal">${MYSTERY_EMOJI}</span>`;
            el.addEventListener('click', () => selectDigItem(r, c));
          }
        } else {
          const diggable = canDig(r, c);
          el.style.backgroundColor = layer.color;

          if (!diggable) {
            el.classList.add('locked');
            el.style.filter = 'brightness(0.6)';
          } else {
            // Show cracks for partially dug blocks
            if (cell.clicksRemaining < cell.maxClicks) {
              const pct = 1 - cell.clicksRemaining / cell.maxClicks;
              el.style.opacity = 1 - pct * 0.3;
              if (pct >= 0.5) {
                el.innerHTML = '<span class="crack">\u{2726}</span>';
              }
            }

            // Keen eye glow
            if (cell.hasItem && keenEyeOpacity > 0) {
              el.style.boxShadow = `inset 0 0 8px rgba(240,192,64,${keenEyeOpacity})`;
            }

            el.addEventListener('click', () => digCell(r, c));
          }
        }

        grid.appendChild(el);
      }
    }
  },

  renderDigCell(row, col) {
    const cells = document.querySelectorAll('.dig-cell');
    const index = row * DIG_COLS + col;
    const el = cells[index];
    if (!el) return;

    const cell = state.digGrid[row][col];
    const layer = LAYERS[cell.layerIndex];

    if (cell.dug) {
      el.className = 'dig-cell dug';
      el.removeAttribute('style');
      if (cell.revealed && cell.artifact) {
        const isSelected = state.selectedDig && state.selectedDig.row === row && state.selectedDig.col === col;
        el.classList.add('has-item', 'collectible');
        if (isSelected) el.classList.add('selected');
        el.innerHTML = `<span class="item-reveal">${MYSTERY_EMOJI}</span>`;
        el.onclick = () => selectDigItem(row, col);
      } else {
        el.innerHTML = '';
      }

      // Unlock the cell below
      if (row + 1 < DIG_ROWS) {
        const belowIndex = (row + 1) * DIG_COLS + col;
        const belowEl = cells[belowIndex];
        const belowCell = state.digGrid[row + 1][col];
        if (belowEl && !belowCell.dug) {
          belowEl.classList.remove('locked');
          belowEl.style.filter = '';
          belowEl.style.backgroundColor = LAYERS[belowCell.layerIndex].color;
          // Re-attach click handler
          belowEl.onclick = () => digCell(row + 1, col);
        }
      }
    } else {
      // Shake animation
      el.classList.add('shaking');
      setTimeout(() => el.classList.remove('shaking'), 150);

      // Update crack visuals
      const pct = 1 - cell.clicksRemaining / cell.maxClicks;
      el.style.opacity = 1 - pct * 0.3;
      if (pct >= 0.5) {
        el.innerHTML = '<span class="crack">\u{2726}</span>';
      }
    }
  },

  renderCleaning() {
    const slot = document.getElementById('cleaning-slot');
    const display = document.getElementById('cleaning-item-display');
    const dirt = document.getElementById('dirt-overlay');
    const hint = document.getElementById('cleaning-hint');
    const barFill = document.getElementById('cleaning-bar-fill');
    const clicksLabel = document.getElementById('cleaning-clicks-left');

    // Always hide move button first, re-show only if needed
    const existingBtn = document.getElementById('move-to-cleaner-btn');
    if (existingBtn) existingBtn.style.display = 'none';

    if (state.cleaning) {
      slot.classList.remove('empty');
      slot.classList.add('active');
      display.style.display = 'block';
      display.style.opacity = '1';
      hint.style.display = 'none';

      const progress = state.cleaning.clicksDone / state.cleaning.clicksNeeded;

      // Show mystery emoji under dirt, reveal real emoji as cleaning progresses
      if (progress < 0.75) {
        display.textContent = MYSTERY_EMOJI;
      } else {
        display.textContent = state.cleaning.emoji;
      }

      dirt.style.opacity = 1 - progress;
      barFill.style.width = `${progress * 100}%`;
      clicksLabel.textContent = `${state.cleaning.clicksNeeded - state.cleaning.clicksDone} clicks left`;

      slot.onclick = clickClean;
    } else if (state.selectedDig) {
      // An item is selected in the dig site — show "move to cleaner" prompt
      const { row, col } = state.selectedDig;
      const cell = state.digGrid[row][col];
      slot.classList.remove('empty', 'active');
      slot.classList.add('ready');
      display.textContent = MYSTERY_EMOJI;
      display.style.display = 'block';
      display.style.opacity = '0.5';
      dirt.style.opacity = 0;
      hint.style.display = 'none';
      barFill.style.width = '0%';
      clicksLabel.textContent = '';

      // Show move button
      let btn = document.getElementById('move-to-cleaner-btn');
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'move-to-cleaner-btn';
        document.getElementById('cleaning-area').appendChild(btn);
      }
      btn.textContent = `Move to Cleaner`;
      btn.style.display = 'block';
      btn.onclick = () => moveSelectedToCleaner();

      slot.onclick = null;
    } else {
      slot.classList.add('empty');
      slot.classList.remove('active', 'ready');
      display.textContent = '';
      display.style.display = 'none';
      display.style.opacity = '1';
      dirt.style.opacity = 0;
      hint.style.display = 'block';
      barFill.style.width = '0%';
      clicksLabel.textContent = '';
      slot.onclick = null;

      // Hide move button if it exists
      const btn = document.getElementById('move-to-cleaner-btn');
      if (btn) btn.style.display = 'none';
    }
  },

  renderResearch() {
    const container = document.getElementById('research-tables');
    container.innerHTML = '';

    const totalSlots = getUpgradeEffect('extra_table');
    const maxUpgrade = UPGRADES.find(u => u.id === 'extra_table').maxLevel;

    for (let i = 0; i < Math.max(totalSlots, state.researchTables.length); i++) {
      const table = state.researchTables[i];
      const el = document.createElement('div');
      el.className = 'research-table';

      if (i >= totalSlots && !table) {
        // Locked slot
        el.classList.add('locked');
        el.innerHTML = `
          <span class="rt-emoji">\u{1F512}</span>
          <div class="rt-info">
            <div class="rt-name">Locked</div>
            <div class="rt-status">Purchase in upgrades</div>
          </div>
        `;
      } else if (!table) {
        // Empty slot
        el.classList.add('empty');
        el.innerHTML = `
          <span class="rt-emoji">-</span>
          <div class="rt-info">
            <div class="rt-name">Empty Table</div>
            <div class="rt-status">Clean an item to research it</div>
          </div>
        `;
      } else if (table.complete) {
        // Complete
        el.classList.add('complete');
        el.innerHTML = `
          <span class="rt-emoji">${table.emoji}</span>
          <div class="rt-info">
            <div class="rt-name">${table.name}</div>
            <div class="rt-status" style="color: var(--gold);">Done! Click to collect</div>
            <div class="rt-bar"><div class="rt-bar-fill" style="width:100%"></div></div>
          </div>
        `;
        el.onclick = () => collectResearch(i);
      } else {
        // Researching
        el.classList.add('researching');
        const elapsed = (Date.now() - table.startTime) / 1000;
        const progress = Math.min(1, elapsed / table.duration);
        const remaining = Math.max(0, table.duration - elapsed);
        const mins = Math.floor(remaining / 60);
        const secs = Math.floor(remaining % 60);

        el.innerHTML = `
          <span class="rt-emoji">${table.emoji}</span>
          <div class="rt-info">
            <div class="rt-name">${table.name}</div>
            <div class="rt-status">${mins}:${secs.toString().padStart(2, '0')} remaining</div>
            <div class="rt-bar"><div class="rt-bar-fill" style="width:${progress * 100}%"></div></div>
          </div>
        `;
      }

      container.appendChild(el);
    }

    // Show one locked slot as a teaser if not at max
    if (totalSlots <= maxUpgrade && !state.researchTables.some((_, i) => i >= totalSlots)) {
      const teaser = document.createElement('div');
      teaser.className = 'research-table locked';
      teaser.innerHTML = `
        <span class="rt-emoji">\u{1F512}</span>
        <div class="rt-info">
          <div class="rt-name">Locked</div>
          <div class="rt-status">Purchase in upgrades</div>
        </div>
      `;
      container.appendChild(teaser);
    }
  },

  renderInventory() {
    const container = document.getElementById('inventory-slots');
    container.innerHTML = '';

    state.inventory.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = `inv-item rarity-${item.cleaned ? item.rarity : 'unknown'}`;
      el.textContent = item.cleaned ? item.emoji : MYSTERY_EMOJI;
      el.title = item.cleaned ? `${item.name} (cleaned)` : 'Unknown artifact';

      if (item.cleaned) {
        el.style.border = '2px solid var(--gold)';
        el.onclick = () => placeOnResearchTable(index);
      } else {
        el.onclick = () => startCleaning(index);
      }

      container.appendChild(el);
    });

    if (state.inventory.length === 0) {
      container.innerHTML = '<span style="font-size:7px;color:#555;">Empty - dig to find items!</span>';
    }
  },

  renderFragments() {
    const container = document.getElementById('fragment-slots');
    container.innerHTML = '';

    const fragmentEntries = Object.entries(state.fragments);
    if (fragmentEntries.length === 0) {
      container.innerHTML = '<span style="font-size:7px;color:#555;">No fragments yet</span>';
      return;
    }

    fragmentEntries.forEach(([artifactId, indices]) => {
      const artifact = ARTIFACTS.find(a => a.id === artifactId);
      if (!artifact) return;
      const rarityConf = RARITY_CONFIG[artifact.rarity];
      const total = rarityConf.fragments;

      const el = document.createElement('div');
      el.className = `inv-item rarity-${artifact.rarity}`;
      el.textContent = artifact.emoji;
      el.title = `${artifact.name} (${indices.length}/${total} fragments)`;
      el.innerHTML = `${artifact.emoji}<span class="inv-count">${indices.length}/${total}</span>`;

      container.appendChild(el);
    });
  },

  toggleCollection() {
    const modal = document.getElementById('collection-modal');
    modal.classList.toggle('hidden');
    if (!modal.classList.contains('hidden')) {
      this.renderCollection();
    }
  },

  renderCollection() {
    const grid = document.getElementById('collection-grid');
    grid.innerHTML = '';

    const foundCount = Object.keys(state.collection).length;
    const totalCount = ARTIFACTS.length;
    document.getElementById('collection-progress').textContent =
      `${foundCount} / ${totalCount} discovered`;

    // Group by rarity
    const rarityOrder = [RARITY.COMMON, RARITY.UNCOMMON, RARITY.RARE, RARITY.EPIC, RARITY.LEGENDARY];

    rarityOrder.forEach(rarity => {
      const artifacts = ARTIFACTS.filter(a => a.rarity === rarity);
      const rarityConf = RARITY_CONFIG[rarity];

      artifacts.forEach(artifact => {
        const found = !!state.collection[artifact.id];
        const el = document.createElement('div');
        el.className = `collection-item ${found ? 'found' : 'undiscovered'}`;
        el.style.borderColor = found ? rarityConf.color : '';

        if (found) {
          el.innerHTML = `
            <div class="ci-emoji">${artifact.emoji}</div>
            <div class="ci-name">${artifact.name}</div>
            <div class="ci-rarity" style="color:${rarityConf.color}">${rarityConf.label}</div>
            <div class="ci-flavor">${artifact.flavorText}</div>
          `;
        } else {
          el.innerHTML = `
            <div class="ci-emoji" style="filter:brightness(0);">?</div>
            <div class="ci-name">???</div>
            <div class="ci-rarity" style="color:${rarityConf.color}">${rarityConf.label}</div>
          `;
        }

        grid.appendChild(el);
      });
    });
  },

  renderUpgrades() {
    const bar = document.getElementById('upgrades-bar');
    bar.innerHTML = '';

    UPGRADES.forEach(upg => {
      const level = getUpgradeLevel(upg.id);
      const cost = getUpgradeCost(upg.id);
      const maxed = level >= upg.maxLevel;
      const canAfford = state.currency >= cost;

      // Build level pips
      let pips = '';
      for (let i = 0; i < upg.maxLevel; i++) {
        pips += `<div class="uc-pip ${i < level ? 'filled' : ''}"></div>`;
      }

      const el = document.createElement('div');
      el.className = 'upgrade-chip';

      const btnClass = maxed ? 'maxed-btn' : '';
      const btnDisabled = maxed || !canAfford ? 'disabled' : '';
      const btnText = maxed ? 'MAX' : `${cost} RG`;

      el.innerHTML = `
        <span class="uc-icon">${upg.icon}</span>
        <div class="uc-info">
          <div class="uc-name">${upg.name}</div>
          <div class="uc-level-pips">${pips}</div>
        </div>
        <button class="${btnClass}" ${btnDisabled}>${btnText}</button>
      `;

      if (!maxed) {
        el.querySelector('button').onclick = () => {
          buyUpgrade(upg.id);
        };
      }

      bar.appendChild(el);
    });
  },

  showResearchPopup(artifact, reward) {
    const popup = document.getElementById('research-popup');
    document.getElementById('popup-emoji').textContent = artifact.emoji;
    document.getElementById('popup-name').textContent = artifact.name;

    const rarityConf = RARITY_CONFIG[artifact.rarity];
    const rarityEl = document.getElementById('popup-rarity');
    rarityEl.textContent = rarityConf.label;
    rarityEl.style.color = rarityConf.color;

    document.getElementById('popup-report').textContent = artifact.researchReport;
    document.getElementById('popup-reward').textContent = `+${reward} Research Grants`;

    popup.classList.remove('hidden');
  },

  closeResearchPopup() {
    document.getElementById('research-popup').classList.add('hidden');
  },

  closeFoundPopup() {
    document.getElementById('found-popup').classList.add('hidden');
  },

  openHowTo() {
    document.getElementById('howto-modal').classList.remove('hidden');
  },

  closeHowTo() {
    document.getElementById('howto-modal').classList.add('hidden');
    localStorage.setItem('fossilFrenzy_seenHowTo', '1');
  },
};

// ---- RESPONSIVE SCALING ----
function scaleGameContainer() {
  const container = document.getElementById('game-container');
  if (!container) return;

  const baseW = 1280;
  const baseH = 800;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const scale = Math.min(vw / baseW, vh / baseH);
  const scaledW = baseW * scale;
  const scaledH = baseH * scale;
  const offsetX = (vw - scaledW) / 2;
  const offsetY = (vh - scaledH) / 2;

  container.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

window.addEventListener('resize', scaleGameContainer);

// ---- INIT ----
function init() {
  const loaded = loadGame();
  initState();

  if (!loaded || state.digGrid.length === 0) {
    generateDigSite();
  }

  // Default mobile tab to dig
  document.body.classList.add('tab-' + (state.activeTab || 'dig'));

  ui.renderAll();
  startGameLoop();
  scaleGameContainer();

  // Show How to Play on first visit
  if (!localStorage.getItem('fossilFrenzy_seenHowTo')) {
    ui.openHowTo();
  }

  // Check for completed research on load
  state.researchTables.forEach((table, i) => {
    if (table && table.complete) {
      showToast(`Research complete: ${table.name}! Click to collect.`);
    }
  });
}

init();
