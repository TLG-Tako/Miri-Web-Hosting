const aboutTitle = document.getElementById("aboutTitle");
const aboutSubtitle = document.getElementById("aboutSubtitle");
const aboutBody = document.getElementById("aboutBody");
const photoGrid = document.getElementById("photoGrid");

hydrateShell();
loadAboutPage();

async function loadAboutPage(){
  try{
    const data = await apiFetch("/web-config/public");
    renderAbout(data.about || {});
  }catch{
    renderAbout({
      title: "About Miri",
      subtitle: "A Discord companion with memory, curiosity, and a little steel behind the smile.",
      body: "Miri is a Discord AI assistant built to be present, socially aware, and genuinely useful inside a server."
    });
  }
}

function renderAbout(about){
  aboutTitle.textContent = about.title || "About Miri";
  aboutSubtitle.textContent = about.subtitle || "";
  aboutBody.textContent = about.body || "";

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
    photoGrid.appendChild(img);
  }
}
