const lightThemeBtn = document.getElementById("lightThemeBtn");
const darkThemeBtn = document.getElementById("darkThemeBtn");
const billingPrice = document.getElementById("billingPrice");
const billingNote = document.getElementById("billingNote");
const purchasePremiumLink = document.getElementById("purchasePremiumLink");

bootSettings();

async function bootSettings(){
  await hydrateShell();
  await requirePageAccess("settings");
  await loadBilling();
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

async function loadBilling(){
  try{
    const config = await apiFetch("/web-config/public");
    renderBilling(config.billing || {});
  }catch(err){
    billingPrice.textContent = "Unavailable";
    billingNote.textContent = err.message || "Failed to load billing details.";
    purchasePremiumLink.style.display = "none";
  }
}

function renderBilling(billing){
  const purchaseUrl = String(billing.purchaseUrl || "").trim();

  if(!purchaseUrl){
    billingPrice.textContent = "Premium";
    billingNote.textContent = "A purchase link has not been added yet.";
    purchasePremiumLink.style.display = "none";
    return;
  }

  const price = readPriceFromPurchaseLink(purchaseUrl);

  billingPrice.textContent = price || "Current checkout price";
  billingNote.textContent = price
    ? "Price read from the creator purchase link."
    : "Open checkout to view the current subscription price.";
  purchasePremiumLink.href = purchaseUrl;
  purchasePremiumLink.style.display = "inline-flex";
}

function readPriceFromPurchaseLink(purchaseUrl){
  try{
    const url = new URL(purchaseUrl);
    const params = url.searchParams;
    const priceKeys = ["price", "amount", "subscription_price", "plan_price"];

    for(const key of priceKeys){
      const value = params.get(key);
      if(value) return formatPriceValue(value, params.get("currency"));
    }

    const decodedUrl = decodeURIComponent(purchaseUrl);
    const symbolMatch = decodedUrl.match(/(?:[$£€]\s?\d+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?\s?(?:usd|gbp|eur))/i);
    return symbolMatch ? symbolMatch[0].replace(/\s+/g, " ") : "";
  }catch{
    return "";
  }
}

function formatPriceValue(value, currency){
  const cleaned = String(value || "").trim();
  const numeric = Number(cleaned);

  if(!Number.isFinite(numeric)){
    return /[$£€]|\d+(?:[.,]\d{1,2})?\s?(?:usd|gbp|eur)/i.test(cleaned) ? cleaned : "";
  }

  const normalizedCurrency = String(currency || "GBP").trim().toUpperCase();

  try{
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: normalizedCurrency
    }).format(numeric);
  }catch{
    return cleaned;
  }
}
