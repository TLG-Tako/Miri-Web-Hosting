let currentUser = null;
let selectedGuild = null;
let selectedBet = 5;

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
      }
    });

    await loadBalance();
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
}

function updateQuestBalance(secondaryBalance) {
  const secondary = typeof secondaryBalance === 'number' ? secondaryBalance : Number(secondaryBalance || 0);
  const secondaryEl = document.getElementById('secondaryBalance');
  if (secondaryEl) {
    secondaryEl.textContent = secondary;
  }
}

function setupEventListeners() {
  // Category selector
  document.getElementById('gameCategory').addEventListener('change', (e) => {
    const category = e.target.value;
    document.getElementById('gamblingContent').style.display = category === 'gambling' ? 'block' : 'none';
    document.getElementById('questsContent').style.display = category === 'quests' ? 'block' : 'none';
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
  } catch (err) {
    console.error('Poker error:', err);
    alert(err?.message || 'Failed to play poker');
  } finally {
    playBtn.disabled = false;
    playBtn.textContent = 'Play Poker!';
  }
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