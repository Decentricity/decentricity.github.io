(function () {
  document.documentElement.classList.add("has-js");

  const nav = document.getElementById("siteNav");
  const toggle = document.querySelector(".nav-toggle");
  const videos = Array.from(document.querySelectorAll(".motion-media"));
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    nav.addEventListener("click", function (event) {
      if (!event.target.closest("a")) return;
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  }

  if (reduceMotion) {
    videos.forEach(function (video) {
      video.removeAttribute("autoplay");
      video.pause();
      try {
        video.currentTime = 0;
      } catch (_) {}
    });
    return;
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        const video = entry.target;
        if (entry.isIntersecting) {
          const play = video.play();
          if (play && typeof play.catch === "function") play.catch(function () {});
        } else {
          video.pause();
        }
      });
    }, { rootMargin: "180px 0px", threshold: 0.15 });

    videos.forEach(function (video) {
      observer.observe(video);
    });
  }
})();
