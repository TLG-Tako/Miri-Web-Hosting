const statusDiv = document.getElementById("status");

bootStats();

async function bootStats(){
  await hydrateShell();
  const allowed = await requirePageAccess("stats");

  if(!allowed) return;

  checkStatus();
  updateStats();
  updateThoughts();

  setInterval(checkStatus, 30000);
  setInterval(updateStats, 5000);
  setInterval(updateThoughts, 5000);
}

async function checkStatus(){
  try{
    const data = await apiFetch("/status");

    statusDiv.className = `status ${data.online ? "online" : "offline"}`;
    statusDiv.textContent = data.online ? "Miri is Online" : "Miri is Offline";
  }catch{
    statusDiv.className = "status offline";
    statusDiv.textContent = "Unable to check status";
  }
}

async function updateStats(){
  try{
    const data = await apiFetch("/stats");

    document.getElementById("mood").textContent =
      toTitleCase(data.mood || data.state?.mood || "unknown");

    const emotions = normalizeEmotions(data.emotions || data.state?.emotions || data.emotion || data.feelings);
    document.getElementById("emotions").textContent = emotions || "None";

    document.getElementById("energy").textContent = formatEnergy(data.energy || data.state?.energy);
    document.getElementById("diary").textContent = data.diary?.summary || data.diarySummary || "None";
    document.getElementById("vision").textContent = data.vision?.[0] || data.focus || "None";
  }catch(err){
    console.error("Stats failed:", err);
  }
}

async function updateThoughts(){
  try{
    const data = await apiFetch("/thoughts");
    const entries = Object.entries(data.thoughts || {});
    const formatted = entries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([key, value]) => `${key} (${Number(value).toFixed(2)})`)
      .join(", ");

    document.getElementById("thoughts").textContent = formatted || "None";
  }catch(err){
    console.error("Thoughts failed:", err);
  }
}

function normalizeEmotions(rawEmotions){
  if(!rawEmotions) return "None";
  if(Array.isArray(rawEmotions)) return rawEmotions.join(", ");
  if(typeof rawEmotions === "string") return rawEmotions;

  if(typeof rawEmotions === "object"){
    return Object.entries(rawEmotions)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 4)
      .map(([emotion, weight]) => `${emotion} (${Number(weight).toFixed(2)})`)
      .join(", ");
  }

  return String(rawEmotions);
}

function formatEnergy(rawEnergy){
  if(rawEnergy === null || rawEnergy === undefined || rawEnergy === "") return "Unknown";
  if(typeof rawEnergy === "number") return `${Math.round(rawEnergy)}%`;
  return String(rawEnergy);
}

function toTitleCase(value){
  return String(value)
    .split(" ")
    .map(part => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(" ");
}
