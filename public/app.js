
document.addEventListener("DOMContentLoaded", () => {

  // Create language button automatically
  let toggle = document.querySelector("#languageToggle");

  if (!toggle) {
    toggle = document.createElement("button");
    toggle.id = "languageToggle";
    document.body.appendChild(toggle);
  }

  let language = localStorage.getItem("panelLanguage") || "en";

  // Add RTL styling
  const style = document.createElement("style");
  style.textContent = `
    #languageToggle {
      position: fixed;
      top: 15px;
      right: 15px;
      z-index: 99999;
      padding: 10px 18px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      background: #d4a017;
      color: #000;
      font-weight: bold;
    }

    html[dir="rtl"] body {
      direction: rtl;
      text-align: right;
    }

    html[dir="rtl"] input,
    html[dir="rtl"] textarea {
      text-align: right;
    }
  `;

  document.head.appendChild(style);

  function changeLanguage(lang) {
    language = lang;

    document.documentElement.lang = lang;
    document.documentElement.dir =
      lang === "ur" ? "rtl" : "ltr";

    document.querySelectorAll("[data-en][data-ur]")
      .forEach((el) => {
        el.textContent = el.getAttribute(
          lang === "ur" ? "data-ur" : "data-en"
        );
      });

    toggle.textContent =
      lang === "ur" ? "English" : "اردو";

    localStorage.setItem("panelLanguage", lang);
  }

  toggle.addEventListener("click", () => {
    changeLanguage(language === "en" ? "ur" : "en");
  });

  changeLanguage(language);

});
