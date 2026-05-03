const lightThemeBtn = document.getElementById("lightThemeBtn");
const darkThemeBtn = document.getElementById("darkThemeBtn");

bootSettings();

async function bootSettings(){
  await hydrateShell();
  await requirePageAccess("settings");
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
