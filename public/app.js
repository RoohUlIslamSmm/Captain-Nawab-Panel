const toggle = document.querySelector("#languageToggle");
let language = "en";
if (toggle) {
  toggle.addEventListener("click", () => {
    language = language === "en" ? "ur" : "en";
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ur" ? "rtl" : "ltr";
    toggle.textContent = language === "ur" ? "English" : "اردو";
    document.querySelectorAll(".nav a, .button, h1, h2, p, label, th, footer").forEach((el) => {
      if (!el.dataset.originalText) el.dataset.originalText = el.textContent;
    });
    // English-first starter: Urdu content is available in service fields; the
    // language toggle switches direction. Add translated UI strings as needed.
  });
}
