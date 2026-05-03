const lightThemeBtn = document.getElementById("lightThemeBtn");
const darkThemeBtn = document.getElementById("darkThemeBtn");
const pricingTableWrapper = document.getElementById("pricingTableWrapper");
const pricingLoginPrompt = document.getElementById("pricingLoginPrompt");
const pricingLoginBtn = document.getElementById("pricingLoginBtn");
const manageSubscriptionLink = document.getElementById("manageSubscriptionLink");
const premiumServersSection = document.getElementById("premiumServersSection");
const premiumServersList = document.getElementById("premiumServersList");

bootSettings();

async function bootSettings(){
  const shell = await hydrateShell();
  await requirePageAccess("settings");
  await renderPricingSection(shell.user);
  await renderPremiumServers(shell.user);
}

async function renderPricingSection(user){
  if(!pricingTableWrapper || !pricingLoginPrompt || !manageSubscriptionLink) return;

  const hasUser = Boolean(user && user.id);
  pricingLoginPrompt.style.display = hasUser ? "none" : "block";
  manageSubscriptionLink.style.display = hasUser ? "inline-flex" : "none";
  pricingTableWrapper.innerHTML = "";

  if(!hasUser){
    if(pricingLoginBtn){
      pricingLoginBtn.addEventListener("click", login);
    }
    return;
  }

  // Check subscription status
  try {
    const response = await apiFetch("/auth/subscription-status");
    const { hasActiveSubscription } = response;

    if(hasActiveSubscription){
      // Hide pricing table, show manage link
      pricingTableWrapper.style.display = "none";
      manageSubscriptionLink.style.display = "inline-flex";
      return;
    }
  } catch (err) {
    console.error("Failed to check subscription status:", err);
    // Fall back to showing pricing table
  }

  // Show pricing table for non-subscribers
  const table = document.createElement("stripe-pricing-table");
  table.setAttribute("pricing-table-id", "prctbl_1TT1JYEByNmzs7fuZquUbPx1");
  table.setAttribute("publishable-key", "pk_live_51TSzc9EByNmzs7fuR6ngVo8Ykogi5ZiDsXNHJXf8zM0zAkNBjoLaSuTwyzjrS5l7soSzrAeL7YccuuCrtSRxEDEB00GmC3VU7A");
  table.setAttribute("client-reference-id", String(user.id));

  if(user.email){
    table.setAttribute("customer-email", user.email);
  }

  pricingTableWrapper.appendChild(table);
  pricingTableWrapper.style.display = "block";
}

async function renderPremiumServers(user){
  if(!premiumServersSection || !premiumServersList) return;

  const hasUser = Boolean(user && user.id);
  if(!hasUser){
    premiumServersSection.style.display = "none";
    return;
  }

  // Check subscription status
  let hasActiveSubscription = false;
  try {
    const response = await apiFetch("/auth/subscription-status");
    hasActiveSubscription = response.hasActiveSubscription;
  } catch (err) {
    console.error("Failed to check subscription status:", err);
  }

  if(!hasActiveSubscription){
    premiumServersSection.style.display = "none";
    return;
  }

  // Show section and fetch guilds
  premiumServersSection.style.display = "block";
  premiumServersList.innerHTML = "<p>Loading servers...</p>";

  try {
    const response = await apiFetch("/dashboard/guilds");
    const { guilds } = response;

    if(!guilds || guilds.length === 0){
      premiumServersList.innerHTML = "<p>No servers available for premium management.</p>";
      return;
    }

    const listHtml = guilds.map(guild => `
      <div class="setting-row">
        <div>
          <div class="setting-title">${guild.name}</div>
          <div class="muted">Premium: ${guild.premiumEnabled ? 'Enabled' : 'Disabled'}</div>
          ${guild.hasOutstandingPayments ? '<div class="muted" style="color: #ff6b6b;">Outstanding payments</div>' : ''}
        </div>
        <button type="button" class="button-link" onclick="togglePremium('${guild.id}', ${guild.premiumEnabled})">
          ${guild.premiumEnabled ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    `).join('');

    premiumServersList.innerHTML = listHtml;
  } catch (err) {
    console.error("Failed to load guilds:", err);
    premiumServersList.innerHTML = "<p>Failed to load servers.</p>";
  }
}

async function togglePremium(guildId, currentlyEnabled){
  const action = currentlyEnabled ? 'deactivate' : 'activate';

  try {
    const response = await apiFetch(`/dashboard/server-vars/${guildId}/premium`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });

    if(response.success){
      // Reload the list
      const shell = await hydrateShell();
      await renderPremiumServers(shell.user);
    } else {
      alert(`Failed to ${action} premium: ${response.error}`);
    }
  } catch (err) {
    console.error(`Failed to ${action} premium:`, err);
    alert(`Failed to ${action} premium.`);
  }
}

function setTheme(theme){
  const normalizedTheme = theme === "dark" ? "dark" : "light";

  localStorage.setItem("miri_theme", normalizedTheme);
  document.documentElement.dataset.theme = normalizedTheme;

  lightThemeBtn.setAttribute("aria-pressed", String(normalizedTheme === "light"));
  darkThemeBtn.setAttribute("aria-pressed", String(normalizedTheme === "dark"));
}

lightThemeBtn.addEventListener("click", () => setTheme("light"));
darkThemeBtn.addEventListener("click", () => setTheme("dark"));

setTheme(localStorage.getItem("miri_theme") || "light");
