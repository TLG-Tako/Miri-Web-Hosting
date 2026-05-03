const API_BASE = "https://miri-production.up.railway.app";
const DISCORD_OAUTH_URL = "https://discord.com/oauth2/authorize?client_id=1482556887500066867&response_type=code&redirect_uri=https%3A%2F%2Fmiri-web-hosting.pages.dev%2Fcallback&scope=identify+guilds";
const BOT_INVITE_URL = "https://discord.com/oauth2/authorize?client_id=1445389657272746127";

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
  try{
    const data = await apiFetch("/auth/me");
    return data.user || null;
  }catch{
    localStorage.removeItem("miri_token");
    return null;
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

function inviteBot(){
  window.location.href = BOT_INVITE_URL;
}

function ensureInviteButton(identityRow){
  if(!identityRow || identityRow.querySelector("[data-invite-btn]")) return;

  const logoutBtn = identityRow.querySelector("[data-logout-btn]");
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.inviteBtn = "";
  button.textContent = "Invite";

  if(logoutBtn){
    identityRow.insertBefore(button, logoutBtn);
  }else{
    identityRow.appendChild(button);
  }
}

function enhanceNavigation(isCreator = false){
  const nav = document.querySelector(".top-nav");
  const navLinks = nav?.querySelector(".nav-links");
  if(!nav || !navLinks || navLinks.dataset.enhanced === "true") return;

  const links = Array.from(navLinks.querySelectorAll("a"));
  const makeLink = (href, label, extra = "") => {
    const source = links.find(link => link.getAttribute("href") === href);
    const activePath = window.location.pathname === "/" ? "/" : window.location.pathname.replace(/\/$/, "");
    const linkPath = href === "/" ? "/" : href.replace(/\/$/, "");
    const isActive = activePath === linkPath;
    const creatorAttr = extra.includes("data-creator-only") ? " data-creator-only" : "";
    const activeAttr = isActive ? " aria-current=\"page\"" : "";

    if(source?.dataset.creatorOnly !== undefined && !isCreator) return "";
    return `<a href="${href}"${creatorAttr}${activeAttr}>${label}</a>`;
  };

  navLinks.dataset.enhanced = "true";
  navLinks.innerHTML = `
    <details class="nav-group" open>
      <summary><span>Pages</span></summary>
      <div class="nav-group-links">
        ${makeLink("/", "About")}
        ${makeLink("/chat.html", "Chat")}
        ${makeLink("/stats.html", "Stats", "data-creator-only")}
      </div>
    </details>
    <details class="nav-group" open>
      <summary><span>Server</span></summary>
      <div class="nav-group-links">
        ${makeLink("/customization.html", "Customization")}
        ${makeLink("/customization-commands.html", "Command Toggles")}
      </div>
    </details>
    <details class="nav-group" open>
      <summary><span>Account</span></summary>
      <div class="nav-group-links">
        ${makeLink("/settings.html", "Settings")}
      </div>
    </details>
    ${isCreator ? `
    <details class="nav-group">
      <summary><span>Creator</span></summary>
      <div class="nav-group-links">
        ${makeLink("/creator.html", "Creator", "data-creator-only")}
      </div>
    </details>
    ` : ""}
  `;
}

async function hydrateShell(options = {}){
  applyStoredTheme();

  const user = await getCurrentUser();
  const loginBtn = document.querySelector("[data-login-btn]");
  const logoutBtn = document.querySelector("[data-logout-btn]");
  const inviteBtn = document.querySelector("[data-invite-btn]");
  const identity = document.querySelector("[data-identity]");
  const identityRow = document.querySelector(".identity-row");
  const creatorLinks = document.querySelectorAll("[data-creator-only]");

  ensureInviteButton(identityRow);
  const ensuredInviteBtn = document.querySelector("[data-invite-btn]") || inviteBtn;
  if(loginBtn && loginBtn.textContent.trim() === "Login") loginBtn.textContent = "Login with Discord";
  if(loginBtn) loginBtn.addEventListener("click", login);
  if(logoutBtn) logoutBtn.addEventListener("click", logout);
  if(ensuredInviteBtn) ensuredInviteBtn.addEventListener("click", inviteBot);

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
  enhanceNavigation(isCreator);
  document.querySelectorAll("[data-creator-only]").forEach(link => {
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
