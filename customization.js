const API_BASE = "https://miri-production.up.railway.app";

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const identityPanel = document.getElementById("identityPanel");
const userName = document.getElementById("userName");
const userAvatar = document.getElementById("userAvatar");
const guildSelect = document.getElementById("guildSelect");
const saveBtn = document.getElementById("saveBtn");
const saveResult = document.getElementById("saveResult");

let currentUser = null;
let currentGuildId = "";

const urlToken = new URLSearchParams(window.location.search).get("token");
if(urlToken){
  localStorage.setItem("miri_token", urlToken);
  window.history.replaceState({}, document.title, window.location.pathname);
}

const token = localStorage.getItem("miri_token");
if(token){
  currentUser = parseJwt(token);
}

loginBtn.onclick = () => {
  const returnTo = encodeURIComponent(window.location.pathname);
  window.location.href = `${API_BASE}/login?returnTo=${returnTo}`;
};

logoutBtn.onclick = () => {
  localStorage.removeItem("miri_token");
  location.reload();
};

guildSelect.addEventListener("change", async () => {
  currentGuildId = guildSelect.value;
  saveBtn.disabled = !currentGuildId;

  if(!currentGuildId){
    clearFields();
    return;
  }

  await loadSettings(currentGuildId);
});

saveBtn.onclick = async () => {
  if(!currentGuildId) return;

  saveResult.textContent = "Saving...";
  saveResult.style.color = "#677086";

  try{
    const settings = collectSettings();

    const res = await apiFetch(`/dashboard/server-vars/${currentGuildId}`, {
      method: "PUT",
      body: JSON.stringify({ settings })
    });

    setFields(res.settings || {});
    saveResult.textContent = "Saved successfully.";
    saveResult.style.color = "#1f9a66";
  }catch(err){
    saveResult.textContent = err.message || "Failed to save settings.";
    saveResult.style.color = "#c54b67";
  }
};

async function boot(){
  if(!token || !currentUser){
    saveResult.textContent = "Login with Discord to customize server settings.";
    return;
  }

  showIdentity(currentUser);

  try{
    const data = await apiFetch("/dashboard/guilds");
    fillGuildSelect(data.guilds || []);

    if(!data.guilds || !data.guilds.length){
      saveResult.textContent = "No manageable servers found where Miri is present.";
      return;
    }

    guildSelect.value = data.guilds[0].id;
    guildSelect.dispatchEvent(new Event("change"));
  }catch(err){
    saveResult.textContent = err.message || "Failed to load your servers.";
    saveResult.style.color = "#c54b67";
  }
}

function showIdentity(user){
  identityPanel.style.display = "flex";
  loginBtn.style.display = "none";

  userName.textContent = `Logged in as ${user.username}`;

  if(user.avatar){
    userAvatar.src = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
  }else{
    userAvatar.src = `https://cdn.discordapp.com/embed/avatars/${Number(user.discriminator || 0) % 5}.png`;
  }
}

function fillGuildSelect(guilds){
  guildSelect.innerHTML = "<option value=\"\">Select a server...</option>";

  for(const guild of guilds){
    const option = document.createElement("option");
    option.value = guild.id;
    option.textContent = guild.name;
    guildSelect.appendChild(option);
  }
}

async function loadSettings(guildId){
  saveResult.textContent = "Loading settings...";
  saveResult.style.color = "#677086";

  try{
    const data = await apiFetch(`/dashboard/server-vars/${guildId}`);
    setFields(data.settings || {});
    saveResult.textContent = `Loaded settings for ${data.guild?.name || "selected server"}.`;
  }catch(err){
    clearFields();
    saveResult.textContent = err.message || "Failed to load settings.";
    saveResult.style.color = "#c54b67";
  }
}

function setFields(settings){
  document.querySelectorAll("[data-field]").forEach(input => {
    const key = input.dataset.field;
    input.value = settings[key] ?? "";
  });

  document.querySelectorAll("[data-array-field]").forEach(input => {
    const key = input.dataset.arrayField;
    const value = settings[key];
    input.value = Array.isArray(value) ? value.join(", ") : "";
  });

  document.querySelectorAll("[data-number-field]").forEach(input => {
    const key = input.dataset.numberField;
    const value = settings[key];
    input.value = value === null || value === undefined ? "" : Number(value);
  });
}

function clearFields(){
  document.querySelectorAll("input[data-field], input[data-array-field], input[data-number-field]")
    .forEach(input => {
      input.value = "";
    });
}

function collectSettings(){
  const settings = {};

  document.querySelectorAll("[data-field]").forEach(input => {
    const key = input.dataset.field;
    settings[key] = input.value.trim() || null;
  });

  document.querySelectorAll("[data-array-field]").forEach(input => {
    const key = input.dataset.arrayField;
    settings[key] = input.value
      .split(",")
      .map(v => v.trim())
      .filter(Boolean);
  });

  document.querySelectorAll("[data-number-field]").forEach(input => {
    const key = input.dataset.numberField;
    settings[key] = input.value === "" ? null : Number(input.value);
  });

  return settings;
}

async function apiFetch(path, options = {}){
  const authToken = localStorage.getItem("miri_token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if(authToken){
    headers.Authorization = authToken;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));

  if(!res.ok){
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

function parseJwt(jwtToken){
  try{
    const base64Url = jwtToken.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  }catch{
    return null;
  }
}

boot();
