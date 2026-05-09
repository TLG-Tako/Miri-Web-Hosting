let currentUser = null;
let selectedGuild = null;
let selectedBet = 5;
let selectedQuestType = 'daily';
let questState = null;
let currencyState = {
  primaryName: 'coins',
  primaryEmoji: '',
  secondaryName: 'tokens',
  secondaryEmoji: ''
};

// Initialize the page
async function init() {
  const shell = await hydrateShell();
  const allowed = await requirePageAccess('games');
  if (!allowed) return;

  currentUser = shell.user;

  if (!currentUser) {
    showLoginRequired();
    return;
  }

  const guildSelect = document.getElementById('guildSelect');
  guildSelect.innerHTML = '<option value="">Select a server...</option>';

  try {
    const data = await apiFetch('/gambling/guilds');
    const guilds = Array.isArray(data.guilds) ? data.guilds : [];

    if (guilds.length === 0) {
      showNoGuilds();
      return;
    }

    guildSelect.innerHTML = '<option value="">Select a server...</option>' +
      guilds.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

    selectedGuild = guilds[0].id;
    guildSelect.value = selectedGuild;

    guildSelect.addEventListener('change', async (e) => {
      selectedGuild = e.target.value;
      if (selectedGuild) {
        await loadBalance();
        await loadQuests();
      }
    });

    await loadBalance();
    await loadQuests();
  } catch (err) {
    console.error("Failed to load guilds:", err);
    showGuildLoadError(err?.message);
  }

  // Setup event listeners
  setupEventListeners();
}

async function loadBalance() {
  if (!selectedGuild) return;

  try {
    const data = await apiFetch(`/gambling/balance/${selectedGuild}`);
    if (data.currency) {
      currencyState = {
        ...currencyState,
        primaryName: data.currency.primaryName || currencyState.primaryName,
        primaryEmoji: data.currency.primaryEmoji || '',
        secondaryName: data.currency.secondaryName || currencyState.secondaryName,
        secondaryEmoji: data.currency.secondaryEmoji || ''
      };
      updateCurrencyLabels();
    }
    updateGamblingBalance(data.primary_balance);
    updateQuestBalance(data.secondary_balance);
    updateSpinButton();
  } catch (err) {
    console.error("Failed to load balance:", err);
  }
}

function updateGamblingBalance(balance) {
  const primary = typeof balance === 'number' ? balance : Number(balance || 0);
  document.getElementById('balance').textContent = primary;
  document.getElementById('bjBalance').textContent = primary;
  document.getElementById('pokerBalance').textContent = primary;
  const questPrimary = document.getElementById('questPrimaryBalance');
  if (questPrimary) questPrimary.textContent = primary;
}

function updateQuestBalance(secondaryBalance) {
  const secondary = typeof secondaryBalance === 'number' ? secondaryBalance : Number(secondaryBalance || 0);
  const secondaryEl = document.getElementById('secondaryBalance');
  if (secondaryEl) {
    secondaryEl.textContent = secondary;
  }
}

function updateCurrencyLabels() {
  const primaryLabel = document.getElementById('questPrimaryName');
  const secondaryLabel = document.getElementById('questSecondaryName');
  if (primaryLabel) primaryLabel.textContent = `${currencyState.primaryEmoji} ${currencyState.primaryName}`.trim();
  if (secondaryLabel) secondaryLabel.textContent = `${currencyState.secondaryEmoji} ${currencyState.secondaryName}`.trim();
}

function setupEventListeners() {
  // Category selector
  document.getElementById('gameCategory').addEventListener('change', async (e) => {
    const category = e.target.value;
    document.getElementById('gamblingContent').style.display = category === 'gambling' ? 'block' : 'none';
    document.getElementById('questsContent').style.display = category === 'quests' ? 'block' : 'none';
    if (category === 'quests') {
      await loadQuests();
    }
  });

  // Gambling game selector
  document.getElementById('gamblingGame').addEventListener('change', (e) => {
    const game = e.target.value;
    document.getElementById('slotsGame').style.display = game === 'slots' ? 'block' : 'none';
    document.getElementById('blackjackGame').style.display = game === 'blackjack' ? 'block' : 'none';
    document.getElementById('pokerGame').style.display = game === 'poker' ? 'block' : 'none';
  });

  // Bet buttons
  document.querySelectorAll('.bet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bet-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedBet = parseInt(btn.dataset.bet);
      updateSpinButton();
    });
  });

  // Slots spin button
  document.getElementById('spinBtn').addEventListener('click', playSlots);

  // Blackjack controls
  document.getElementById('dealBtn').addEventListener('click', startBlackjack);
  document.getElementById('hitBtn').addEventListener('click', () => handleBlackjackAction('hit'));
  document.getElementById('standBtn').addEventListener('click', () => handleBlackjackAction('stand'));

  // Poker play button
  document.getElementById('playPokerBtn').addEventListener('click', playPoker);

  document.querySelectorAll('[data-quest-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedQuestType = btn.dataset.questType;
      document.querySelectorAll('[data-quest-type]').forEach(tab => tab.classList.remove('active'));
      btn.classList.add('active');
      renderQuests();
    });
  });

  document.getElementById('convertBtn').addEventListener('click', convertCurrency);
}

function updateSpinButton() {
  const balance = parseInt(document.getElementById('balance').textContent);
  const spinBtn = document.getElementById('spinBtn');
  spinBtn.disabled = balance < selectedBet;
}

async function playSlots() {
  const spinBtn = document.getElementById('spinBtn');
  spinBtn.disabled = true;
  spinBtn.textContent = 'Spinning...';

  try {
    const data = await apiFetch(`/gambling/slots/${selectedGuild}`, {
      method: 'POST',
      body: JSON.stringify({ bet: selectedBet })
    });

    // Animate the slots
    await animateSlots(data.grid);

    // Show result
    const resultDiv = document.getElementById('slotsResult');
    resultDiv.textContent = data.result;
    resultDiv.className = 'game-result ' + (data.net > 0 ? 'win' : data.net < 0 ? 'loss' : 'tie');
    resultDiv.style.display = 'block';

    // Update primary gambling balance
    updateGamblingBalance(data.newBalance);
    updateSpinButton();
    await loadQuests();
  } catch (err) {
    console.error('Slots error:', err);
    alert(err?.message || 'Failed to play slots');
  } finally {
    spinBtn.disabled = false;
    spinBtn.textContent = 'Spin!';
  }
}

async function animateSlots(finalGrid) {
  const cells = document.querySelectorAll('#slotsGrid .slot-cell');
  const spins = 10;

  for (let spin = 0; spin < spins; spin++) {
    for (let i = 0; i < cells.length; i++) {
      cells[i].textContent = getRandomEmoji();
    }
    await new Promise(resolve => setTimeout(resolve, 100 + spin * 20));
  }

  // Set final grid
  for (let i = 0; i < cells.length; i++) {
    cells[i].textContent = finalGrid[i];
  }
}

function getRandomEmoji() {
  const emojis = ['🎰', '🍒', '🍋', '⭐', '💎', '🃏', '😊', '😡'];
  return emojis[Math.floor(Math.random() * emojis.length)];
}

let blackjackInProgress = false;

async function startBlackjack() {
  const dealBtn = document.getElementById('dealBtn');
  const hitBtn = document.getElementById('hitBtn');
  const standBtn = document.getElementById('standBtn');
  const resultDiv = document.getElementById('blackjackResult');

  dealBtn.disabled = true;
  dealBtn.textContent = 'Dealing...';
  hitBtn.disabled = true;
  standBtn.disabled = true;
  resultDiv.style.display = 'none';

  try {
    const data = await apiFetch(`/gambling/blackjack/${selectedGuild}/start`, {
      method: 'POST',
      body: JSON.stringify({ bet: selectedBet })
    });

    displayBlackjackState(data);
    updateGamblingBalance(data.newBalance);
    await loadQuests();

    blackjackInProgress = !data.gameOver;
    hitBtn.disabled = !blackjackInProgress;
    standBtn.disabled = !blackjackInProgress;
    dealBtn.disabled = blackjackInProgress;
    dealBtn.textContent = blackjackInProgress ? 'Game in progress' : 'Deal!';
    document.getElementById('bjActions').style.display = blackjackInProgress ? 'flex' : 'none';
  } catch (err) {
    console.error('Blackjack error:', err);
    alert(err?.message || 'Failed to start blackjack');
  } finally {
    if (!blackjackInProgress) {
      dealBtn.disabled = false;
      dealBtn.textContent = 'Deal!';
    }
  }
}

async function handleBlackjackAction(action) {
  const hitBtn = document.getElementById('hitBtn');
  const standBtn = document.getElementById('standBtn');
  const dealBtn = document.getElementById('dealBtn');
  const resultDiv = document.getElementById('blackjackResult');

  hitBtn.disabled = true;
  standBtn.disabled = true;

  try {
    const data = await apiFetch(`/gambling/blackjack/${selectedGuild}/action`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });

    displayBlackjackState(data);
    updateGamblingBalance(data.newBalance);

    blackjackInProgress = !data.gameOver;
    hitBtn.disabled = !blackjackInProgress;
    standBtn.disabled = !blackjackInProgress;
    dealBtn.disabled = blackjackInProgress;
    dealBtn.textContent = blackjackInProgress ? 'Game in progress' : 'Deal!';
    document.getElementById('bjActions').style.display = blackjackInProgress ? 'flex' : 'none';
  } catch (err) {
    console.error('Blackjack action error:', err);
    alert(err?.message || 'Failed to update blackjack');
    blackjackInProgress = false;
    dealBtn.disabled = false;
    dealBtn.textContent = 'Deal!';
    document.getElementById('bjActions').style.display = 'none';
  }
}

function displayBlackjackState(data) {
  const playerCardsDiv = document.getElementById('playerCards');
  const dealerCardsDiv = document.getElementById('dealerCards');
  const playerTotalDiv = document.getElementById('playerTotal');
  const dealerTotalDiv = document.getElementById('dealerTotal');
  const resultDiv = document.getElementById('blackjackResult');

  playerCardsDiv.innerHTML = data.playerCards.map(card => `<div class="card">${card}</div>`).join('');
  dealerCardsDiv.innerHTML = data.dealerCards.map(card => `<div class="card">${card}</div>`).join('');

  playerTotalDiv.textContent = data.playerTotal;
  dealerTotalDiv.textContent = data.dealerHidden ? '?' : data.dealerTotal;

  resultDiv.textContent = data.result;
  const outcomeClass = data.gameOver
    ? (data.payout > selectedBet ? 'win' : data.payout === selectedBet ? 'tie' : 'loss')
    : '';
  resultDiv.className = 'game-result' + (outcomeClass ? ` ${outcomeClass}` : '');
  resultDiv.style.display = 'block';
}

async function playPoker() {
  const playBtn = document.getElementById('playPokerBtn');
  playBtn.disabled = true;
  playBtn.textContent = 'Playing...';

  try {
    const data = await apiFetch(`/gambling/poker/${selectedGuild}`, {
      method: 'POST',
      body: JSON.stringify({ bet: selectedBet })
    });

    // Display cards
    displayPokerCards(data);

    // Show result
    const resultDiv = document.getElementById('pokerResult');
    resultDiv.textContent = data.result;
    resultDiv.className = 'game-result ' + (data.payout > data.bet ? 'win' : data.payout === data.bet ? 'tie' : 'loss');
    resultDiv.style.display = 'block';

    // Update primary gambling balance
    updateGamblingBalance(data.newBalance);
    await loadQuests();
  } catch (err) {
    console.error('Poker error:', err);
    alert(err?.message || 'Failed to play poker');
  } finally {
    playBtn.disabled = false;
    playBtn.textContent = 'Play Poker!';
  }
}

async function loadQuests() {
  if (!selectedGuild) return;

  try {
    const data = await apiFetch(`/gambling/quests/${selectedGuild}`);
    questState = data;
    if (data.currency) {
      currencyState = {
        ...currencyState,
        secondaryName: data.currency.secondaryName || currencyState.secondaryName,
        secondaryEmoji: data.currency.secondaryEmoji || ''
      };
      updateCurrencyLabels();
    }
    updateQuestBalance(data.secondary_balance);
    renderQuests();
  } catch (err) {
    console.error('Failed to load quests:', err);
    const list = document.getElementById('questList');
    if (list) list.innerHTML = '<p>Failed to load quests.</p>';
  }
}

function renderQuests() {
  const list = document.getElementById('questList');
  const summary = document.getElementById('questSummary');
  if (!list || !summary) return;

  const bucket = questState?.quests?.[selectedQuestType];
  if (!bucket) {
    list.innerHTML = '<p>Select a server to view quests.</p>';
    summary.textContent = '';
    return;
  }

  const completed = bucket.items.filter(q => q.complete).length;
  const claimed = bucket.items.filter(q => q.claimed).length;
  const refreshText = selectedQuestType === 'challenging' && bucket.expiresAt
    ? ` Refreshes ${formatTimeLeft(bucket.expiresAt)}.`
    : '';

  summary.textContent = `${bucket.label}: ${completed}/5 complete, ${claimed}/5 claimed. Reward: ${bucket.reward} ${currencyState.secondaryName} each.${refreshText}`;
  list.innerHTML = bucket.items.map(item => {
    const percent = Math.min(100, Math.round((item.progress / item.target) * 100));
    const disabled = !item.complete || item.claimed ? 'disabled' : '';
    const buttonText = item.claimed ? 'Claimed' : item.complete ? 'Claim' : 'Locked';

    return `
      <div class="quest-item">
        <div>
          <div class="quest-title">${escapeHtml(item.title)}</div>
          <div class="quest-progress"><span style="width:${percent}%"></span></div>
          <div class="quest-meta">${item.progress}/${item.target}</div>
        </div>
        <button class="claim-btn" type="button" data-claim-index="${item.index}" ${disabled}>${buttonText}</button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-claim-index]').forEach(btn => {
    btn.addEventListener('click', () => claimQuest(Number(btn.dataset.claimIndex)));
  });
}

async function claimQuest(index) {
  try {
    const data = await apiFetch(`/gambling/quests/${selectedGuild}/claim`, {
      method: 'POST',
      body: JSON.stringify({ type: selectedQuestType, index })
    });

    updateQuestBalance(data.secondary_balance);
    await loadQuests();
  } catch (err) {
    console.error('Claim quest error:', err);
    alert(err?.message || 'Failed to claim quest reward');
  }
}

async function convertCurrency() {
  const result = document.getElementById('convertResult');
  const button = document.getElementById('convertBtn');
  const direction = document.getElementById('convertDirection').value;
  const amount = Number(document.getElementById('convertAmount').value || 1);

  button.disabled = true;
  result.textContent = 'Converting...';

  try {
    const data = await apiFetch(`/gambling/convert/${selectedGuild}`, {
      method: 'POST',
      body: JSON.stringify({ direction, amount })
    });

    updateGamblingBalance(data.primary_balance);
    updateQuestBalance(data.secondary_balance);
    updateSpinButton();
    result.textContent = `Converted ${data.spent} into ${data.gained}.`;
    await loadQuests();
  } catch (err) {
    console.error('Convert error:', err);
    result.textContent = err?.message || 'Conversion failed';
  } finally {
    button.disabled = false;
  }
}

function formatTimeLeft(expiresAt) {
  const remaining = Math.max(0, Number(expiresAt || 0) - Date.now());
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  return `in ${hours}h ${minutes}m`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function displayPokerCards(data) {
  const communityDiv = document.getElementById('communityCards');
  const playerDiv = document.getElementById('playerPokerCards');
  const dealerDiv = document.getElementById('dealerPokerCards');

  communityDiv.innerHTML = data.communityCards.map(card => `<div class="card">${card}</div>`).join('');
  playerDiv.innerHTML = data.playerCards.map(card => `<div class="card">${card}</div>`).join('');
  dealerDiv.innerHTML = data.dealerCards.map(card => `<div class="card">${card}</div>`).join('');

  document.getElementById('playerHand').textContent = data.playerHand;
  document.getElementById('dealerHand').textContent = data.dealerHand;
}

function showLoginRequired() {
  document.querySelector('.games-card').innerHTML = `
    <h1>Games</h1>
    <p>You must be logged in to play games.</p>
    <button onclick="login()">Login with Discord</button>
  `;
}

function showNoGuilds() {
  document.querySelector('.games-card').innerHTML = `
    <h1>Games</h1>
    <p>You must be a member of a server with Miri to play games.</p>
  `;
}

function showGuildLoadError(message) {
  const normalized = String(message || '');
  if (normalized.includes('Not logged in') || normalized.includes('401')) {
    showLoginRequired();
    return;
  }

  showNoGuilds();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
