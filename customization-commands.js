const guildSelect = document.getElementById("guildSelect");
const saveCommandsBtn = document.getElementById("saveCommandsBtn");
const saveResult = document.getElementById("saveResult");
const commandsContainer = document.getElementById("commandsContainer");

let commandCategories = [];
let disabledCommands = new Set();
let currentGuildId = "";

bootCommandCustomization();

async function bootCommandCustomization(){
  await hydrateShell();

  const allowed = await requirePageAccess("customization");
  if(!allowed) return;

  guildSelect.addEventListener("change", handleGuildChange);
  saveCommandsBtn.addEventListener("click", saveCommandSettings);

  try{
    const [guildData, commandData] = await Promise.all([
      apiFetch("/dashboard/guilds"),
      apiFetch("/dashboard/commands")
    ]);

    fillGuildSelect(guildData.guilds || []);
    commandCategories = commandData.categories || [];
    renderCommands();

    if(!guildData.guilds?.length){
      saveResult.textContent = "No manageable servers found where Miri is present.";
      return;
    }

    guildSelect.value = guildData.guilds[0].id;
    await handleGuildChange();
  }catch(err){
    saveResult.textContent = err.message || "Failed to load command settings.";
    saveResult.style.color = "var(--danger)";
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

async function handleGuildChange(){
  currentGuildId = guildSelect.value;
  saveCommandsBtn.disabled = !currentGuildId;

  if(!currentGuildId){
    disabledCommands = new Set();
    renderCommands();
    return;
  }

  saveResult.textContent = "Loading command settings...";
  saveResult.style.color = "var(--muted)";

  try{
    const data = await apiFetch(`/dashboard/server-vars/${currentGuildId}`);
    disabledCommands = new Set(Array.isArray(data.settings?.disabledCommands) ? data.settings.disabledCommands : []);
    renderCommands();
    saveResult.textContent = `Loaded command settings for ${data.guild?.name || "selected server"}.`;
  }catch(err){
    saveResult.textContent = err.message || "Failed to load command settings.";
    saveResult.style.color = "var(--danger)";
  }
}

function renderCommands(){
  commandsContainer.innerHTML = "";

  if(!commandCategories.length){
    commandsContainer.innerHTML = "<section class=\"card\"><p class=\"muted\">No commands found.</p></section>";
    return;
  }

  for(const category of commandCategories){
    const section = document.createElement("section");
    section.className = "card command-category";

    const heading = document.createElement("div");
    heading.className = "category-heading";

    const title = document.createElement("h2");
    title.textContent = category.label || category.key || "Other";

    const count = document.createElement("span");
    count.className = "muted";
    count.textContent = `${category.commands?.length || 0} commands`;

    heading.appendChild(title);
    heading.appendChild(count);
    section.appendChild(heading);

    const list = document.createElement("div");
    list.className = "command-list";

    for(const command of category.commands || []){
      list.appendChild(renderCommandCard(command));
    }

    section.appendChild(list);
    commandsContainer.appendChild(section);
  }
}

function renderCommandCard(command){
  const card = document.createElement("div");
  card.className = "command-card";

  const header = document.createElement("div");
  header.className = "command-card-header";

  const name = document.createElement("div");
  name.className = "command-name";
  name.textContent = `/${command.name}`;

  const toggle = document.createElement("label");
  toggle.className = "toggle";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !disabledCommands.has(command.name);
  input.dataset.commandName = command.name;
  input.addEventListener("change", () => {
    if(input.checked){
      disabledCommands.delete(command.name);
    }else{
      disabledCommands.add(command.name);
    }

    toggleText.textContent = input.checked ? "Enabled" : "Disabled";
  });

  const toggleText = document.createElement("span");
  toggleText.textContent = input.checked ? "Enabled" : "Disabled";

  toggle.appendChild(input);
  toggle.appendChild(toggleText);
  header.appendChild(name);
  header.appendChild(toggle);

  const description = document.createElement("div");
  description.className = "command-description";
  description.textContent = command.description || "No description provided.";

  card.appendChild(header);
  card.appendChild(description);

  return card;
}

async function saveCommandSettings(){
  if(!currentGuildId) return;

  saveResult.textContent = "Saving command settings...";
  saveResult.style.color = "var(--muted)";

  try{
    await apiFetch(`/dashboard/server-vars/${currentGuildId}`, {
      method: "PUT",
      body: JSON.stringify({
        settings: {
          disabledCommands: Array.from(disabledCommands).sort()
        }
      })
    });

    saveResult.textContent = "Command settings saved.";
    saveResult.style.color = "var(--success)";
  }catch(err){
    saveResult.textContent = err.message || "Failed to save command settings.";
    saveResult.style.color = "var(--danger)";
  }
}
