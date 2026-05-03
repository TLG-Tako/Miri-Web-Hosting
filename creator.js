const PAGE_LABELS = {
  chat: "Chat",
  stats: "Stats",
  customization: "Customization",
  settings: "Settings",
  creator: "Creator Panel"
};

const aboutTitleInput = document.getElementById("aboutTitleInput");
const aboutSubtitleInput = document.getElementById("aboutSubtitleInput");
const aboutBodyInput = document.getElementById("aboutBodyInput");
const capabilitiesTitleInput = document.getElementById("capabilitiesTitleInput");
const capabilitiesInput = document.getElementById("capabilitiesInput");
const benefitsTitleInput = document.getElementById("benefitsTitleInput");
const benefitsInput = document.getElementById("benefitsInput");
const photoUploadInput = document.getElementById("photoUploadInput");
const purchaseUrlInput = document.getElementById("purchaseUrlInput");
const photoList = document.getElementById("photoList");
const creatorGuildList = document.getElementById("creatorGuildList");
const lockList = document.getElementById("lockList");
const saveCreatorBtn = document.getElementById("saveCreatorBtn");
const saveResult = document.getElementById("saveResult");

let aboutImages = [];

bootCreator();

async function bootCreator(){
  const shell = await hydrateShell({ requireCreator: true });

  if(!shell.allowed) return;

  const allowed = await requirePageAccess("creator");
  if(!allowed) return;

  photoUploadInput.addEventListener("change", handlePhotoUpload);
  saveCreatorBtn.addEventListener("click", saveCreatorConfig);

  await loadCreatorConfig();
  await loadCreatorGuilds();
}

async function loadCreatorConfig(){
  saveResult.textContent = "Loading creator settings...";

  try{
    const config = await apiFetch("/web-config/creator");
    setAboutFields(config.about || {});
    setBillingFields(config.billing || {});
    renderLocks(config.pageLocks || {});
    saveResult.textContent = "";
  }catch(err){
    saveResult.textContent = err.message || "Failed to load creator settings.";
  }
}

function setBillingFields(billing){
  purchaseUrlInput.value = billing.purchaseUrl || "";
}

function setAboutFields(about){
  aboutTitleInput.value = about.title || "";
  aboutSubtitleInput.value = about.subtitle || "";
  aboutBodyInput.value = about.body || "";
  capabilitiesTitleInput.value = about.capabilitiesTitle || "What can Miri do?";
  capabilitiesInput.value = Array.isArray(about.capabilities) ? about.capabilities.join("\n") : "";
  benefitsTitleInput.value = about.benefitsTitle || "Why choose Miri?";
  benefitsInput.value = Array.isArray(about.benefits) ? about.benefits.join("\n") : "";
  aboutImages = Array.isArray(about.images) ? about.images : [];
  renderPhotos();
}

function renderPhotos(){
  photoList.innerHTML = "";

  if(!aboutImages.length){
    photoList.innerHTML = "<p class=\"muted\">No photos uploaded yet.</p>";
    return;
  }

  aboutImages.forEach(image => {
    const item = document.createElement("div");
    item.className = "photo-item";

    const img = document.createElement("img");
    img.src = image.dataUrl;
    img.alt = image.alt || image.name || "Uploaded photo";

    const detail = document.createElement("div");
    detail.textContent = image.name || "Uploaded photo";

    const removeBtn = document.createElement("button");
    removeBtn.className = "danger-btn";
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      aboutImages = aboutImages.filter(existing => existing.id !== image.id);
      renderPhotos();
    });

    item.appendChild(img);
    item.appendChild(detail);
    item.appendChild(removeBtn);
    photoList.appendChild(item);
  });
}

async function handlePhotoUpload(event){
  const files = Array.from(event.target.files || []);

  for(const file of files){
    if(!file.type.startsWith("image/")) continue;

    const dataUrl = await resizeImageFile(file);

    aboutImages.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      dataUrl,
      alt: file.name.replace(/\.[^.]+$/, "")
    });
  }

  aboutImages = aboutImages.slice(0, 8);
  photoUploadInput.value = "";
  renderPhotos();
}

function readFileAsDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function resizeImageFile(file){
  const dataUrl = await readFileAsDataUrl(file);

  return new Promise(resolve => {
    const image = new Image();

    image.onload = () => {
      const maxSize = 1400;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");

      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };

    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function renderLocks(pageLocks){
  lockList.innerHTML = "";

  for(const [key, label] of Object.entries(PAGE_LABELS)){
    const row = document.createElement("label");
    row.className = "lock-row";
    row.htmlFor = `lock-${key}`;

    const text = document.createElement("span");
    text.textContent = label;

    const checkbox = document.createElement("input");
    checkbox.id = `lock-${key}`;
    checkbox.type = "checkbox";
    checkbox.checked = key === "creator" ? true : Boolean(pageLocks[key]);
    checkbox.disabled = key === "creator";
    checkbox.dataset.lockKey = key;

    row.appendChild(text);
    row.appendChild(checkbox);
    lockList.appendChild(row);
  }
}

function collectPageLocks(){
  const locks = {};

  document.querySelectorAll("[data-lock-key]").forEach(input => {
    locks[input.dataset.lockKey] = input.checked;
  });

  locks.creator = true;
  return locks;
}

async function saveCreatorConfig(){
  saveResult.textContent = "Saving...";
  saveResult.style.color = "var(--muted)";

  const payload = {
    about: {
      title: aboutTitleInput.value,
      subtitle: aboutSubtitleInput.value,
      body: aboutBodyInput.value,
      capabilitiesTitle: capabilitiesTitleInput.value,
      capabilities: getLines(capabilitiesInput.value),
      benefitsTitle: benefitsTitleInput.value,
      benefits: getLines(benefitsInput.value),
      images: aboutImages
    },
    billing: {
      purchaseUrl: purchaseUrlInput.value.trim()
    },
    pageLocks: collectPageLocks()
  };

  try{
    const saved = await apiFetch("/web-config/creator", {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    setAboutFields(saved.about || payload.about);
    setBillingFields(saved.billing || payload.billing);
    renderLocks(saved.pageLocks || payload.pageLocks);
    saveResult.textContent = "Saved successfully.";
    saveResult.style.color = "var(--success)";
  }catch(err){
    saveResult.textContent = err.message || "Failed to save changes.";
    saveResult.style.color = "var(--danger)";
  }
}

function getLines(value){
  return String(value || "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);
}

async function loadCreatorGuilds(){
  if(!creatorGuildList) return;
  creatorGuildList.innerHTML = "<p class='muted'>Loading servers...</p>";

  try{
    const data = await apiFetch("/dashboard/guilds");
    renderCreatorGuilds(data.guilds || []);
  }catch(err){
    creatorGuildList.innerHTML = `<p class='muted'>${err.message || "Failed to load guilds."}</p>`;
  }
}

function renderCreatorGuilds(guilds){
  if(!creatorGuildList) return;
  creatorGuildList.innerHTML = "";

  if(!Array.isArray(guilds) || !guilds.length){
    creatorGuildList.innerHTML = "<p class='muted'>No servers found where Miri is present and you have manage permissions.</p>";
    return;
  }

  guilds.forEach(guild => {
    const item = document.createElement("div");
    item.className = "guild-item";

    const header = document.createElement("div");
    header.className = "guild-header";

    const title = document.createElement("div");
    title.className = "guild-name";
    title.textContent = guild.name;

    const status = document.createElement("span");
    status.className = `status-pill ${guild.premiumEnabled ? "active" : "inactive"}`;
    status.textContent = guild.premiumEnabled ? "Premium active" : "No premium";

    header.appendChild(title);
    header.appendChild(status);

    if (guild.hasOutstandingPayments) {
      const paymentStatus = document.createElement("span");
      paymentStatus.className = "status-pill danger";
      paymentStatus.textContent = "Outstanding payment";
      header.appendChild(paymentStatus);
    }

    const meta = document.createElement("div");
    meta.className = "guild-meta";
    meta.innerHTML = `
      <span>Guild ID: ${guild.id}</span>
      <span>Premium owner: ${guild.premiumOwnerUserId || "none"}</span>
    `;

    const usage = document.createElement("div");
    usage.className = "guild-usage";
    usage.textContent = `Daily tokens: ${guild.dailyTokenUsage}, Total: ${guild.totalTokenUsage}, Est. cost: $${guild.estimatedCost}`;

    const actionRow = document.createElement("div");
    actionRow.className = "guild-actions";

    const settingsLink = document.createElement("a");
    settingsLink.className = "button-link";
    settingsLink.href = "/settings.html";
    settingsLink.target = "_blank";
    settingsLink.rel = "noopener";
    settingsLink.textContent = "Open Settings";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "danger-btn";
    removeBtn.textContent = "Remove Bot";
    removeBtn.addEventListener("click", () => leaveGuild(guild.id));

    actionRow.appendChild(settingsLink);
    actionRow.appendChild(removeBtn);

    if(guild.premiumEnabled){
      const deactivateBtn = document.createElement("button");
      deactivateBtn.type = "button";
      deactivateBtn.className = "danger-btn";
      deactivateBtn.textContent = "Deactivate Premium";
      deactivateBtn.addEventListener("click", () => deactivatePremium(guild.id));
      actionRow.appendChild(deactivateBtn);
    }

    item.appendChild(header);
    item.appendChild(meta);
    item.appendChild(usage);
    item.appendChild(actionRow);
    creatorGuildList.appendChild(item);
  });
}

async function leaveGuild(guildId){
  if(!confirm("Remove Miri from this server? This cannot be undone from the creator panel.")) return;

  try{
    await apiFetch(`/dashboard/guilds/${guildId}`, { method: "DELETE" });
    await loadCreatorGuilds();
  }catch(err){
    alert(err.message || "Failed to remove Miri from the server.");
  }
}

async function deactivatePremium(guildId){
  if(!confirm("Deactivate premium for this server?")) return;

  try{
    await apiFetch(`/dashboard/server-vars/${guildId}/premium`, {
      method: "POST",
      body: JSON.stringify({ action: "deactivate" })
    });
    await loadCreatorGuilds();
  }catch(err){
    alert(err.message || "Failed to deactivate premium.");
  }
}
