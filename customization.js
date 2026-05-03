const API_BASE = "https://miri-production.up.railway.app";
const DISCORD_OAUTH_URL = "https://discord.com/oauth2/authorize?client_id=1482556887500066867&response_type=code&redirect_uri=https%3A%2F%2Fmiri-web-hosting.pages.dev%2Fcallback&scope=identify+guilds";
const BOT_INVITE_URL = "https://discord.com/oauth2/authorize?client_id=1445389657272746127";

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const inviteBtn = document.getElementById("inviteBtn");
const identityPanel = document.getElementById("identityPanel");
const userName = document.getElementById("userName");
const userAvatar = document.getElementById("userAvatar");
const guildSelect = document.getElementById("guildSelect");
const saveBtn = document.getElementById("saveBtn");
const saveResult = document.getElementById("saveResult");

const CHANNEL_FIELDS = [
  "modChannel",
  "adminChannel",
  "disciplineChannel",
  "ticketCategory",
  "welcomeChannel",
  "goodbyeChannel",
  "rulesChannel",
  "rpNotifyChannel",
  "countingChannel"
];

const ROLE_FIELDS = [
  "staffRole",
  "adminRole",
  "moderatorRole",
  "unverifiedRole",
  "verifiedRole",
  "welcomeRole",
  "mutedRole",
  "rewardRole",
  "musicRole"
];

const CHANNEL_ARRAY_FIELDS = ["autoPurgeChannels", "currencyChannels"];

let currentUser = null;
let currentGuildId = "";
let manageableGuildIds = new Set();

const urlToken = new URLSearchParams(window.location.search).get("token");
if(urlToken){
  localStorage.setItem("miri_token", urlToken);
  window.history.replaceState({}, document.title, window.location.pathname);
}

async function hydrateAuthStateFromServer(){
  try{
    const headers = {};

    if(token){
      headers.Authorization = token;
    }

    const data = await apiFetch("/auth/me", {
      headers
    });

    if(data?.user){
      currentUser = data.user;
      return;
    }
  }catch{
    localStorage.removeItem("miri_token");
  }

  currentUser = null;
}

const token = localStorage.getItem("miri_token");

loginBtn.onclick = () => {
  localStorage.setItem("miri_post_auth_path", window.location.pathname || "/");
  window.location.href = DISCORD_OAUTH_URL;
};

if(inviteBtn){
  inviteBtn.onclick = () => {
    window.location.href = BOT_INVITE_URL;
  };
}

logoutBtn.onclick = async () => {
  try{
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
  }catch{
    // no-op
  }

  localStorage.removeItem("miri_token");
  location.reload();
};

guildSelect.addEventListener("change", async () => {
  currentGuildId = guildSelect.value;
  saveBtn.disabled = !isManageableGuild(currentGuildId);

  if(!currentGuildId){
    clearFields();
    return;
  }

  if(!isManageableGuild(currentGuildId)){
    clearFields();
    saveResult.textContent = "That server is not available for this authenticated Discord account.";
    saveResult.style.color = "#c54b67";
    currentGuildId = "";
    guildSelect.value = "";
    return;
  }

  await loadSettings(currentGuildId);
});

saveBtn.onclick = async () => {
  if(!isManageableGuild(currentGuildId)){
    saveResult.textContent = "Select a server from your authenticated manageable server list before saving.";
    saveResult.style.color = "#c54b67";
    return;
  }

  saveResult.textContent = "Saving...";
  saveResult.style.color = "#677086";

  try{
    const settings = collectSettings();

    const res = await apiFetch(`/dashboard/server-vars/${currentGuildId}`, {
      method: "PUT",
      body: JSON.stringify({ settings })
    });

    await apiFetch(`/dashboard/greetings/${currentGuildId}`, {
      method: "PUT",
      body: JSON.stringify(collectGreetings())
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
  await hydrateAuthStateFromServer();

  const allowed = await requirePageAccess();

  if(!allowed) return;

  if(!currentUser){
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

async function requirePageAccess(){
  try{
    const access = await apiFetch("/web-config/access/customization");

    if(access.allowed){
      return true;
    }

    document.querySelector(".container").innerHTML = `
      <div class="card">
        <h1>Page Locked</h1>
        <p class="helper">This page is currently locked by the creator.</p>
        <button id="lockedLoginBtn" type="button">Login with Discord</button>
      </div>
    `;

    const lockedLoginBtn = document.getElementById("lockedLoginBtn");
    lockedLoginBtn.onclick = loginBtn.onclick;
    return false;
  }catch{
    return true;
  }
}

function showIdentity(user){
  identityPanel.style.display = "flex";
  loginBtn.style.display = "none";
  logoutBtn.style.display = "inline-flex";
  document.querySelectorAll(".creator-nav").forEach(nav => {
    nav.style.display = user.isCreator ? "block" : "none";
  });

  userName.textContent = `Logged in as ${user.username}`;

  if(user.avatar){
    userAvatar.src = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
  }else{
    userAvatar.src = `https://cdn.discordapp.com/embed/avatars/${Number(user.discriminator || 0) % 5}.png`;
  }
}

function fillGuildSelect(guilds){
  guildSelect.innerHTML = "<option value=\"\">Select a server...</option>";
  manageableGuildIds = new Set();

  for(const guild of guilds){
    if(!guild?.id) continue;
    manageableGuildIds.add(String(guild.id));
    const option = document.createElement("option");
    option.value = guild.id;
    option.textContent = guild.name;
    guildSelect.appendChild(option);
  }
}

async function loadSettings(guildId){
  if(!isManageableGuild(guildId)){
    throw new Error("That server is not available for this authenticated Discord account.");
  }

  saveResult.textContent = "Loading settings...";
  saveResult.style.color = "#677086";

  try{
    const resources = await apiFetch(`/dashboard/guild-resources/${guildId}`);
    applyGuildResources(resources);

    const data = await apiFetch(`/dashboard/server-vars/${guildId}`);
    setFields(data.settings || {});
    const greetings = await apiFetch(`/dashboard/greetings/${guildId}`);
    setGreetings(greetings);
    saveResult.textContent = `Loaded settings for ${data.guild?.name || "selected server"}.`;
  }catch(err){
    clearFields();
    saveResult.textContent = err.message || "Failed to load settings.";
    saveResult.style.color = "#c54b67";
  }
}

function isManageableGuild(guildId){
  return Boolean(guildId && manageableGuildIds.has(String(guildId)));
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

  document.querySelectorAll("[data-channel-field]").forEach(select => {
    const key = select.dataset.channelField;
    select.value = settings[key] ?? "";
  });

  document.querySelectorAll("[data-role-field]").forEach(select => {
    const key = select.dataset.roleField;
    select.value = settings[key] ?? "";
  });

  document.querySelectorAll("[data-channel-array-field]").forEach(select => {
    const key = select.dataset.channelArrayField;
    const selectedValues = Array.isArray(settings[key]) ? settings[key] : [];
    Array.from(select.options).forEach(option => {
      option.selected = selectedValues.includes(option.value);
    });
  });
}

function setGreetings(greetings){
  setGreetingFields("welcome", greetings?.welcome || {});
  setGreetingFields("goodbye", greetings?.goodbye || {});
}

function setGreetingFields(type, values){
  document.querySelectorAll(`[data-${type}-field]`).forEach(input => {
    const key = input.dataset[`${type}Field`];
    input.value = values[key] || (key === "color" ? "#000000" : "");
  });
}

function clearFields(){
  document.querySelectorAll("input[data-field], input[data-array-field], input[data-number-field]")
    .forEach(input => {
      input.value = "";
    });

  document.querySelectorAll("[data-channel-field], [data-role-field]").forEach(select => {
    select.value = "";
  });

  document.querySelectorAll("[data-channel-array-field]").forEach(select => {
    Array.from(select.options).forEach(option => {
      option.selected = false;
    });
  });

  setGreetings({
    welcome: {},
    goodbye: {}
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

  document.querySelectorAll("[data-channel-field]").forEach(select => {
    const key = select.dataset.channelField;
    settings[key] = select.value || null;
  });

  document.querySelectorAll("[data-role-field]").forEach(select => {
    const key = select.dataset.roleField;
    settings[key] = select.value || null;
  });

  document.querySelectorAll("[data-channel-array-field]").forEach(select => {
    const key = select.dataset.channelArrayField;
    settings[key] = Array.from(select.selectedOptions)
      .map(option => option.value)
      .filter(Boolean);
  });

  return settings;
}

function collectGreetings(){
  return {
    welcome: collectGreetingFields("welcome"),
    goodbye: collectGreetingFields("goodbye")
  };
}

function collectGreetingFields(type){
  const values = {};

  document.querySelectorAll(`[data-${type}-field]`).forEach(input => {
    const key = input.dataset[`${type}Field`];
    values[key] = input.value.trim();
  });

  if(!values.color) values.color = "#000000";

  return values;
}

function applyGuildResources(resources){
  const channels = Array.isArray(resources?.channels) ? resources.channels : [];
  const roles = Array.isArray(resources?.roles) ? resources.roles : [];

  document.querySelectorAll("[data-channel-field]").forEach(select => {
    const fieldName = select.dataset.channelField;
    const filteredChannels = filterChannelsForField(fieldName, channels);
    populateChannelSingleSelect(select, filteredChannels, channel => {
      return getChannelLabel(channel);
    });
  });

  document.querySelectorAll("[data-role-field]").forEach(select => {
    populateSingleSelect(select, roles, role => getRoleLabel(role));
  });

  document.querySelectorAll("[data-channel-array-field]").forEach(select => {
    populateChannelMultiSelect(select, channels, channel => getChannelLabel(channel));
  });
}

function getChannelLabel(channel){
  const prefix = Number(channel.type) === 4 ? "" : "#";
  const typeLabel = channel.typeLabel ? ` (${channel.typeLabel})` : "";
  return `${prefix}${channel.name}${typeLabel}`;
}

function getRoleLabel(role){
  return `@${role.name}`;
}

function getCategoryGroupedChannels(channels){
  const categoryMap = new Map();
  const rootChannels = [];

  const categories = channels
    .filter(channel => Number(channel.type) === 4)
    .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));

  for(const category of categories){
    categoryMap.set(category.id, {
      category,
      children: []
    });
  }

  for(const channel of channels){
    if(Number(channel.type) === 4) continue;

    const parentId = channel.parentId || null;
    const group = parentId ? categoryMap.get(parentId) : null;

    if(group){
      group.children.push(channel);
    }else{
      rootChannels.push(channel);
    }
  }

  for(const group of categoryMap.values()){
    group.children.sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
  }

  rootChannels.sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));

  return {
    categories: Array.from(categoryMap.values()),
    rootChannels
  };
}

function populateChannelSingleSelect(select, channels, labelBuilder){
  select.innerHTML = "";

  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "Not set";
  select.appendChild(noneOption);

  const grouped = getCategoryGroupedChannels(channels);

  for(const rootChannel of grouped.rootChannels){
    const option = document.createElement("option");
    option.value = rootChannel.id;
    option.textContent = labelBuilder(rootChannel);
    select.appendChild(option);
  }

  for(const group of grouped.categories){
    const categoryHeader = document.createElement("option");
    categoryHeader.value = "";
    categoryHeader.disabled = true;
    categoryHeader.textContent = `-- ${group.category.name} --`;
    select.appendChild(categoryHeader);

    for(const child of group.children){
      const option = document.createElement("option");
      option.value = child.id;
      option.textContent = `   ${labelBuilder(child)}`;
      select.appendChild(option);
    }
  }
}

function populateChannelMultiSelect(select, channels, labelBuilder){
  select.innerHTML = "";

  const grouped = getCategoryGroupedChannels(channels);

  for(const rootChannel of grouped.rootChannels){
    const option = document.createElement("option");
    option.value = rootChannel.id;
    option.textContent = labelBuilder(rootChannel);
    select.appendChild(option);
  }

  for(const group of grouped.categories){
    const categoryHeader = document.createElement("option");
    categoryHeader.value = "";
    categoryHeader.disabled = true;
    categoryHeader.textContent = `-- ${group.category.name} --`;
    select.appendChild(categoryHeader);

    for(const child of group.children){
      const option = document.createElement("option");
      option.value = child.id;
      option.textContent = `   ${labelBuilder(child)}`;
      select.appendChild(option);
    }
  }
}

function populateSingleSelect(select, items, labelBuilder){
  select.innerHTML = "";

  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "Not set";
  select.appendChild(noneOption);

  for(const item of items){
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = labelBuilder(item);
    select.appendChild(option);
  }
}

function populateMultiSelect(select, items, labelBuilder){
  select.innerHTML = "";

  for(const item of items){
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = labelBuilder(item);
    select.appendChild(option);
  }
}

function filterChannelsForField(fieldName, channels){
  if(fieldName === "ticketCategory"){
    return channels.filter(channel => Number(channel.type) === 4);
  }

  if(CHANNEL_FIELDS.includes(fieldName)){
    return channels.filter(channel => Number(channel.type) !== 4);
  }

  return channels;
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
    headers,
    credentials: "include"
  });

  const data = await res.json().catch(() => ({}));

  if(!res.ok){
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

boot();
