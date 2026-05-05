const API_BASE = "https://miri-production.up.railway.app";

let currentUser = null;
let selectedGuild = null;
let selectedBet = 5;

// Initialize the page
async function init() {
  const shell = await hydrateShell();
  currentUser = shell.user;

  if (!currentUser) {
    showLoginRequired();
    return;
  }

  // Get user's guilds
  const guilds = currentUser.guilds || [];
  if (guilds.length === 0) {
    showNoGuilds();
    return;
  }

  // For now, use the first guild. In future, could add guild selector
  selectedGuild = guilds[0].id;

  // Load initial balance
  await loadBalance();

  // Setup event listeners
  setupEventListeners();
}

async function getCurrentUser() {
  try {
    const token = localStorage.getItem("miri_token");
    if (!token) return null;

    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        'Authorization': token
      }
    });

    if (response.ok) {
      const data = await response.json();
      return data.user;
    }
  } catch (err) {
    console.error("Failed to get current user:", err);
  }
  return null;
}

async function loadBalance() {
  try {
    const token = localStorage.getItem("miri_token");
    const response = await fetch(`${API_BASE}/gambling/balance/${selectedGuild}`, {
      headers: {
        'Authorization': token
      }
    });

    if (response.ok) {
      const data = await response.json();
      updateBalanceDisplay(data.balance);
      updateSpinButton();
    }
  } catch (err) {
    console.error("Failed to load balance:", err);
  }
}

function updateBalanceDisplay(balance) {
  document.getElementById('balance').textContent = balance;
  document.getElementById('bjBalance').textContent = balance;
  document.getElementById('pokerBalance').textContent = balance;
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
    const token = localStorage.getItem("miri_token");
    const response = await fetch(`${API_BASE}/gambling/slots/${selectedGuild}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({ bet: selectedBet })
    });

    const data = await response.json();

    if (response.ok) {
      // Animate the slots
      await animateSlots(data.grid);

      // Show result
      const resultDiv = document.getElementById('slotsResult');
      resultDiv.textContent = data.result;
      resultDiv.className = 'game-result ' + (data.net > 0 ? 'win' : data.net < 0 ? 'loss' : 'tie');
      resultDiv.style.display = 'block';

      // Update balance
      updateBalanceDisplay(data.newBalance);
      updateSpinButton();
    } else {
      alert(data.error || 'Failed to play slots');
    }
  } catch (err) {
    console.error('Slots error:', err);
    alert('Failed to play slots');
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
    const token = localStorage.getItem("miri_token");
    const response = await fetch(`${API_BASE}/gambling/blackjack/${selectedGuild}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({ bet: selectedBet })
    });

    const data = await response.json();

    if (response.ok) {
      displayBlackjackState(data);
      updateBalanceDisplay(data.newBalance);

      blackjackInProgress = !data.gameOver;
      hitBtn.disabled = !blackjackInProgress;
      standBtn.disabled = !blackjackInProgress;
      dealBtn.disabled = blackjackInProgress;
      dealBtn.textContent = blackjackInProgress ? 'Game in progress' : 'Deal!';
      document.getElementById('bjActions').style.display = blackjackInProgress ? 'flex' : 'none';
    } else {
      alert(data.error || 'Failed to start blackjack');
    }
  } catch (err) {
    console.error('Blackjack error:', err);
    alert('Failed to start blackjack');
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
    const token = localStorage.getItem("miri_token");
    const response = await fetch(`${API_BASE}/gambling/blackjack/${selectedGuild}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({ action })
    });

    const data = await response.json();

    if (response.ok) {
      displayBlackjackState(data);
      updateBalanceDisplay(data.newBalance);

      blackjackInProgress = !data.gameOver;
      hitBtn.disabled = !blackjackInProgress;
      standBtn.disabled = !blackjackInProgress;
      dealBtn.disabled = blackjackInProgress;
      dealBtn.textContent = blackjackInProgress ? 'Game in progress' : 'Deal!';
      document.getElementById('bjActions').style.display = blackjackInProgress ? 'flex' : 'none';
    } else {
      alert(data.error || 'Failed to update blackjack');
      blackjackInProgress = false;
      dealBtn.disabled = false;
      dealBtn.textContent = 'Deal!';
      document.getElementById('bjActions').style.display = 'none';
    }
  } catch (err) {
    console.error('Blackjack action error:', err);
    alert('Failed to update blackjack');
    blackjackInProgress = false;
    dealBtn.disabled = false;
    dealBtn.textContent = 'Deal!';
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
    const token = localStorage.getItem("miri_token");
    const response = await fetch(`${API_BASE}/gambling/poker/${selectedGuild}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({ bet: selectedBet })
    });

    const data = await response.json();

    if (response.ok) {
      // Display cards
      displayPokerCards(data);

      // Show result
      const resultDiv = document.getElementById('pokerResult');
      resultDiv.textContent = data.result;
      resultDiv.className = 'game-result ' + (data.payout > data.bet ? 'win' : data.payout === data.bet ? 'tie' : 'loss');
      resultDiv.style.display = 'block';

      // Update balance
      updateBalanceDisplay(data.newBalance);
    } else {
      alert(data.error || 'Failed to play poker');
    }
  } catch (err) {
    console.error('Poker error:', err);
    alert('Failed to play poker');
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);