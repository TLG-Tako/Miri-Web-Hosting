const lightThemeBtn = document.getElementById("lightThemeBtn");
const darkThemeBtn = document.getElementById("darkThemeBtn");
const pricingTableWrapper = document.getElementById("pricingTableWrapper");
const pricingLoginPrompt = document.getElementById("pricingLoginPrompt");
const pricingLoginBtn = document.getElementById("pricingLoginBtn");
const manageSubscriptionLink = document.getElementById("manageSubscriptionLink");

bootSettings();

async function bootSettings(){
  const shell = await hydrateShell();
  await requirePageAccess("settings");
  renderPricingSection(shell.user);
}

function renderPricingSection(user){
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

  const table = document.createElement("stripe-pricing-table");
  table.setAttribute("pricing-table-id", "prctbl_1TT1JYEByNmzs7fuZquUbPx1");
  table.setAttribute("publishable-key", "pk_live_51TSzc9EByNmzs7fut3ScHu6pS8StB4JGvSQQedFM6fJqVfiIXKm4RAgmcrnE1SUej8Kq4OVhLLoZnZKrdLjRHylV00aDFOTSSP");
  table.setAttribute("client-reference-id", String(user.id));

  if(user.email){
    table.setAttribute("customer-email", user.email);
  }

  pricingTableWrapper.appendChild(table);
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
