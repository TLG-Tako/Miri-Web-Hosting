const aboutTitle = document.getElementById("aboutTitle");
const aboutSubtitle = document.getElementById("aboutSubtitle");
const aboutBody = document.getElementById("aboutBody");
const photoGrid = document.getElementById("photoGrid");
const capabilitiesTitle = document.getElementById("capabilitiesTitle");
const capabilitiesList = document.getElementById("capabilitiesList");
const benefitsTitle = document.getElementById("benefitsTitle");
const benefitsList = document.getElementById("benefitsList");
const imageModal = document.getElementById("imageModal");
const modalImage = document.getElementById("modalImage");
const closeImageModal = document.getElementById("closeImageModal");

hydrateShell();
loadAboutPage();
closeImageModal.addEventListener("click", closeImageViewer);
imageModal.addEventListener("click", event => {
  if(event.target === imageModal) closeImageViewer();
});
document.addEventListener("keydown", event => {
  if(event.key === "Escape") closeImageViewer();
});

async function loadAboutPage(){
  try{
    const data = await apiFetch("/web-config/public");
    renderAbout(data.about || {});
  }catch{
    renderAbout({
      title: "About Miri",
      subtitle: "A Discord companion with memory, curiosity, and a little steel behind the smile.",
      body: "Miri is a Discord AI assistant built to be present, socially aware, and genuinely useful inside a server.",
      capabilities: [],
      benefits: []
    });
  }
}

function renderAbout(about){
  aboutTitle.textContent = about.title || "About Miri";
  aboutSubtitle.textContent = about.subtitle || "";
  aboutBody.textContent = about.body || "";
  renderList(capabilitiesTitle, capabilitiesList, about.capabilitiesTitle || "What can Miri do?", about.capabilities);
  renderList(benefitsTitle, benefitsList, about.benefitsTitle || "Why choose Miri?", about.benefits);

  const images = Array.isArray(about.images) ? about.images : [];
  photoGrid.innerHTML = "";

  if(!images.length){
    photoGrid.innerHTML = "<div class=\"empty-photos\">Photos added by the creator will appear here.</div>";
    return;
  }

  for(const image of images){
    const img = document.createElement("img");
    img.src = image.dataUrl;
    img.alt = image.alt || image.name || "About Miri photo";
    img.addEventListener("click", () => openImageViewer(image));
    photoGrid.appendChild(img);
  }
}

function renderList(titleEl, listEl, title, items){
  const visibleItems = Array.isArray(items) ? items.filter(Boolean) : [];

  titleEl.textContent = title;
  listEl.innerHTML = "";

  if(!visibleItems.length){
    const item = document.createElement("li");
    item.textContent = "This section can be customised by the creator.";
    listEl.appendChild(item);
    return;
  }

  for(const value of visibleItems){
    const item = document.createElement("li");
    item.textContent = value;
    listEl.appendChild(item);
  }
}

function openImageViewer(image){
  modalImage.src = image.dataUrl;
  modalImage.alt = image.alt || image.name || "Enlarged About Miri photo";
  imageModal.classList.add("is-open");
  imageModal.setAttribute("aria-hidden", "false");
}

function closeImageViewer(){
  imageModal.classList.remove("is-open");
  imageModal.setAttribute("aria-hidden", "true");
  modalImage.src = "";
}
