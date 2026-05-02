const API_BASE = "https://miri-production.up.railway.app";
const DISCORD_OAUTH_URL = "https://discord.com/oauth2/authorize?client_id=1482556887500066867&response_type=code&redirect_uri=https%3A%2F%2Fmiri-web-hosting.pages.dev%2Fcallback&scope=identify+guilds";

function applyStoredTheme(){
  const theme = localStorage.getItem("miri_theme") || "light";
  document.documentElement.dataset.theme = theme;
}

function getAuthToken(){
  return localStorage.getItem("miri_token");
}

function getCurrentUserFromToken(){
  const token = getAuthToken();

  if(!token) return null;

  try{
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  }catch{
    return null;
  }
}

async function apiFetch(path, options = {}){
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const token = getAuthToken();

  if(token){
    headers.Authorization = token;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });

  const data = await res.json().catch(() => ({}));

  if(!res.ok){
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

async function getCurrentUser(){
  const tokenUser = getCurrentUserFromToken();

  try{
    const data = await apiFetch("/auth/me");
    return data.user || tokenUser;
  }catch{
    return tokenUser;
  }
}

function login(){
  localStorage.setItem("miri_post_auth_path", window.location.pathname || "/");
  window.location.href = DISCORD_OAUTH_URL;
}

async function logout(){
  try{
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
  }catch{
    // no-op
  }

  localStorage.removeItem("miri_token");
  window.location.reload();
}

async function hydrateShell(options = {}){
  applyStoredTheme();

  const user = await getCurrentUser();
  const loginBtn = document.querySelector("[data-login-btn]");
  const logoutBtn = document.querySelector("[data-logout-btn]");
  const identity = document.querySelector("[data-identity]");
  const creatorLinks = document.querySelectorAll("[data-creator-only]");

  if(loginBtn) loginBtn.addEventListener("click", login);
  if(logoutBtn) logoutBtn.addEventListener("click", logout);

  if(user){
    const displayName = user.global_name || user.globalName || user.username;

    if(identity){
      identity.textContent = `Logged in as ${displayName}`;
      identity.style.display = "block";
    }

    if(loginBtn) loginBtn.style.display = "none";
    if(logoutBtn) logoutBtn.style.display = "inline-flex";
  }

  const isCreator = Boolean(user?.isCreator);
  creatorLinks.forEach(link => {
    link.style.display = isCreator ? "inline-flex" : "none";
  });

  if(options.requireCreator && !isCreator){
    showLockedPage("Creator access only.");
    return { user, isCreator, allowed: false };
  }

  return { user, isCreator, allowed: true };
}

async function requirePageAccess(page){
  try{
    const access = await apiFetch(`/web-config/access/${page}`);

    if(!access.allowed){
      showLockedPage("This page is currently locked by the creator.");
      return false;
    }

    return true;
  }catch{
    return true;
  }
}

function showLockedPage(message){
  const main = document.querySelector("main") || document.body;
  main.innerHTML = `
    <section class="card locked-card">
      <h1>Page Locked</h1>
      <p>${message}</p>
      <div class="button-row">
        <button type="button" data-login-btn>Login with Discord</button>
        <a class="button-link" href="/">Return Home</a>
      </div>
    </section>
  `;

  const loginBtn = document.querySelector("[data-login-btn]");
  if(loginBtn) loginBtn.addEventListener("click", login);
}

applyStoredTheme();
