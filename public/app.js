
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector("#languageToggle");

  let language = localStorage.getItem("panelLanguage") || "en";

  function changeLanguage(lang) {
    language = lang;

    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ur" ? "rtl" : "ltr";

    // Translate all elements having English and Urdu text
    document.querySelectorAll("[data-en][data-ur]").forEach((el) => {
      el.textContent = el.dataset[lang];
    });

    // Update language button
    if (toggle) {
      toggle.textContent = lang === "ur" ? "English" : "اردو";
    }

    localStorage.setItem("panelLanguage", lang);
  }

  if (toggle) {
    toggle.addEventListener("click", () => {
      changeLanguage(language === "en" ? "ur" : "en");
    });
  }

  changeLanguage(language);
});
