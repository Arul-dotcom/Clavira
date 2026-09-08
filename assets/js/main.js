(function () {
  "use strict";

  /* ------------------------------------------------------------------
     Artboard scale

     The stylesheet sizes everything in rem against a 1440px artboard
     (90rem). Deriving the root font-size from clientWidth rather than vw
     keeps a vertical scrollbar from tipping the artboard into horizontal
     overflow.

     Scaling stops once the artboard reaches MIN_ARTBOARD_PX so type stays
     legible on phones; narrower viewports scroll horizontally instead.
     ------------------------------------------------------------------ */

  var ARTBOARD_REM = 90;
  var MAX_ROOT_PX = 16;
  var MIN_ARTBOARD_PX = 600;
  var root = document.documentElement;
  var scaleQueued = false;
  var mobileMq = window.matchMedia("(max-width: 768px)");

  function applyScale() {
    scaleQueued = false;
    if (mobileMq.matches) {
      root.style.fontSize = "";
      return;
    }
    var width = Math.max(root.clientWidth, MIN_ARTBOARD_PX);
    var px = Math.min(width / ARTBOARD_REM, MAX_ROOT_PX);
    root.style.fontSize = px + "px";
  }

  function queueScale() {
    if (scaleQueued) return;
    scaleQueued = true;
    window.requestAnimationFrame(applyScale);
  }

  applyScale();
  window.addEventListener("resize", queueScale);
  window.addEventListener("orientationchange", queueScale);
  if (mobileMq.addEventListener) mobileMq.addEventListener("change", applyScale);
  else if (mobileMq.addListener) mobileMq.addListener(applyScale);
  root.classList.add("js");
  void root.offsetWidth;

  /* ------------------------------------------------------------------
     Primary nav

     Hash links scroll to the absolutely placed sections, accounting for
     the sticky masthead. The active item follows the section in view.
     ------------------------------------------------------------------ */

  var reduceMotionNav = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var navLinks = document.querySelectorAll(".nav__link");
  var sectionMeta = [
    { id: "home", el: document.getElementById("home") },
    { id: "problem-vision", el: document.getElementById("problem-vision") },
    { id: "design-framework", el: document.getElementById("design-framework") },
    { id: "walkthrough", el: document.getElementById("walkthrough") },
    { id: "ux-impact", el: document.getElementById("ux-impact") }
  ];

  function sectionIdFromHref(href) {
    if (!href) return "";
    if (href === "#" || href === "#home") return "home";
    return href.charAt(0) === "#" ? href.slice(1) : "";
  }

  function setActiveNav(id) {
    for (var i = 0; i < navLinks.length; i++) {
      var on = sectionIdFromHref(navLinks[i].getAttribute("href")) === id;
      navLinks[i].classList.toggle("is-active", on);
      if (on) navLinks[i].setAttribute("aria-current", "page");
      else navLinks[i].removeAttribute("aria-current");
    }
  }

  function scrollToSection(id) {
    var behavior = reduceMotionNav ? "auto" : "smooth";
    if (!id || id === "home") {
      window.scrollTo({ top: 0, behavior: behavior });
      return;
    }
    var target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: behavior, block: "start" });
  }

  function updateActiveFromScroll() {
    var probe = window.scrollY + 96;
    var current = "home";
    for (var i = 1; i < sectionMeta.length; i++) {
      var el = sectionMeta[i].el;
      if (!el) continue;
      var top = el.getBoundingClientRect().top + window.scrollY;
      if (top <= probe) current = sectionMeta[i].id;
    }
    setActiveNav(current);
  }

  function closeMenu() {
    var masthead = document.querySelector(".masthead");
    var menuBtn = document.querySelector(".masthead__menu");
    if (masthead) masthead.classList.remove("is-open");
    if (menuBtn) {
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.setAttribute("aria-label", "Open menu");
    }
  }

  function onNavClick(event) {
    var href = this.getAttribute("href");
    var id = sectionIdFromHref(href);
    if (!id) return;
    event.preventDefault();
    closeMenu();
    setActiveNav(id);
    scrollToSection(id);
    if (history.replaceState) history.replaceState(null, "", "#" + id);
  }

  for (var n = 0; n < navLinks.length; n++) {
    navLinks[n].addEventListener("click", onNavClick);
  }

  var extraLinks = document.querySelectorAll(".footer__link, .masthead__logo");
  for (var e = 0; e < extraLinks.length; e++) {
    extraLinks[e].addEventListener("click", onNavClick);
  }

  window.addEventListener("scroll", updateActiveFromScroll, { passive: true });
  updateActiveFromScroll();

  var menuBtn = document.querySelector(".masthead__menu");
  if (menuBtn) {
    menuBtn.addEventListener("click", function () {
      var masthead = document.querySelector(".masthead");
      var open = masthead.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    mobileMq.addEventListener
      ? mobileMq.addEventListener("change", function (event) {
          if (!event.matches) closeMenu();
        })
      : null;
  }

  /* ------------------------------------------------------------------
     Interactive walkthrough

     Two prototype motions:
     1. Flow A/B/C tabs smart-animate the inner stack (translateY
        0 / -729 / -1458) and the decorative orbs.
     2. Chevrons run the i-1 / i-2 mockup carousel: phone screens,
        size, blur and copy (chip + notes) all change together.

     Video slots: drop looping MP4s into assets/video/
     Flow A: 1a.mp4 (or active.mp4), 1b.mp4, 1c.mp4
     Flow B: red.mp4, green.mp4
     Flow C: c.mp4 (or red.mp4)
     The front phone loops. Background phones stay on their poster.
     ------------------------------------------------------------------ */

  var walkthrough = document.querySelector(".walkthrough");
  if (walkthrough) {
    var flowButtons = walkthrough.querySelectorAll(".wt-switch__btn");
    var panels = walkthrough.querySelectorAll(".wt-panel");
    var wtVideos = walkthrough.querySelectorAll(".wt-phone__video");
    var SETTLE_MS = 180;

    function stopVideo(video) {
      if (!video) return;
      window.clearTimeout(video.wtPlayTimer);
      video.classList.remove("is-ready");
      try {
        video.pause();
        video.currentTime = 0;
      } catch (err) {}
    }

    function playLoop(video) {
      if (!video) return;
      video.loop = true;
      video.muted = true;
      if (video.readyState >= 2) video.classList.add("is-ready");
      var attempt = video.play();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch(function () {});
      }
    }

    function syncVideo(card, role, animateIn) {
      var video = card.querySelector(".wt-phone__video");
      if (role !== "near") {
        stopVideo(video);
        return;
      }
      if (!video) return;
      window.clearTimeout(video.wtPlayTimer);
      video.wtPlayTimer = window.setTimeout(function () {
        if (!card.classList.contains("wt-phone--near")) return;
        playLoop(video);
      }, animateIn ? SETTLE_MS : 0);
    }

    function applyDeck(panel, step, animateIn) {
      var cards = panel.querySelectorAll(".wt-phone[data-card]");
      var count = cards.length;
      if (!count) return;

      var roles = count === 3
        ? ["near", "mid", "far"]
        : count === 2
          ? ["near", "mid"]
          : ["near"];

      for (var i = 0; i < count; i++) {
        var card = cards[i];
        var role = roles[((i - step) % count + count) % count];
        var wasNear = card.classList.contains("wt-phone--near");
        card.classList.remove("wt-phone--near", "wt-phone--mid", "wt-phone--far");
        card.classList.add("wt-phone--" + role);
        card.setAttribute("aria-hidden", role === "near" ? "false" : "true");
        syncVideo(card, role, Boolean(animateIn && role === "near" && !wasNear));
      }
    }

    function setStep(panel, step, animateIn) {
      var total = parseInt(panel.getAttribute("data-steps") || "1", 10);
      if (total < 1) total = 1;
      var prev = parseInt(panel.getAttribute("data-step") || "0", 10);
      step = ((step % total) + total) % total;
      panel.setAttribute("data-step", String(step));
      panel.classList.remove("is-step-0", "is-step-1", "is-step-2");
      panel.classList.add("is-step-" + step);
      var current = panel.querySelector(".wt-pager__current");
      if (current) current.textContent = String(step + 1);
      applyDeck(panel, step, animateIn !== false && step !== prev);
    }

    function setFlow(flow) {
      walkthrough.classList.remove("is-flow-a", "is-flow-b", "is-flow-c");
      walkthrough.classList.add("is-flow-" + flow);

      for (var i = 0; i < flowButtons.length; i++) {
        var on = flowButtons[i].getAttribute("data-flow") === flow;
        flowButtons[i].classList.toggle("is-active", on);
        flowButtons[i].setAttribute("aria-selected", on ? "true" : "false");
        flowButtons[i].tabIndex = on ? 0 : -1;
      }

      for (var v = 0; v < wtVideos.length; v++) {
        stopVideo(wtVideos[v]);
      }

      for (var j = 0; j < panels.length; j++) {
        var match = panels[j].getAttribute("data-flow") === flow;
        panels[j].setAttribute("aria-hidden", match ? "false" : "true");
        if (match) setStep(panels[j], 0, false);
      }
    }

    for (var b = 0; b < flowButtons.length; b++) {
      flowButtons[b].addEventListener("click", function (event) {
        setFlow(event.currentTarget.getAttribute("data-flow"));
      });
    }

    for (var p = 0; p < panels.length; p++) {
      (function (panel) {
        var prev = panel.querySelector(".wt-pager__btn--prev");
        var next = panel.querySelector(".wt-pager__btn--next");
        if (prev) {
          prev.addEventListener("click", function () {
            setStep(panel, parseInt(panel.getAttribute("data-step") || "0", 10) - 1);
          });
        }
        if (next) {
          next.addEventListener("click", function () {
            setStep(panel, parseInt(panel.getAttribute("data-step") || "0", 10) + 1);
          });
        }

        var currentNum = panel.querySelector(".wt-pager__current");
        if (currentNum) {
          currentNum.addEventListener("click", function () {
            setStep(panel, parseInt(panel.getAttribute("data-step") || "0", 10) + 1);
          });
        }

        var jumps = panel.querySelectorAll(".wt-chip__label[data-step]");
        for (var n = 0; n < jumps.length; n++) {
          jumps[n].addEventListener("click", function (event) {
            setStep(panel, parseInt(event.currentTarget.getAttribute("data-step"), 10));
          });
        }

        var phones = panel.querySelector(".wt-phones");
        if (phones && parseInt(panel.getAttribute("data-steps") || "1", 10) > 1) {
          var touchX = 0;
          var touchY = 0;
          phones.addEventListener("touchstart", function (event) {
            var touch = event.changedTouches && event.changedTouches[0];
            if (!touch) return;
            touchX = touch.clientX;
            touchY = touch.clientY;
          }, { passive: true });
          phones.addEventListener("touchend", function (event) {
            if (!window.matchMedia("(max-width: 768px)").matches) return;
            var touch = event.changedTouches && event.changedTouches[0];
            if (!touch) return;
            var dx = touch.clientX - touchX;
            var dy = touch.clientY - touchY;
            if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
            setStep(panel, parseInt(panel.getAttribute("data-step") || "0", 10) + (dx < 0 ? 1 : -1));
          }, { passive: true });
        }
      })(panels[p]);
    }

    var videoFallbacks = {
      "assets/video/c.mp4": "assets/video/red.mp4"
    };

    for (var w = 0; w < wtVideos.length; w++) {
      (function (video) {
        video.loop = true;
        video.muted = true;

        video.addEventListener("error", function () {
          var src = video.getAttribute("src") || "";
          var fallback = videoFallbacks[src];
          if (fallback && !video.wtFallback) {
            video.wtFallback = true;
            video.src = fallback;
            video.load();
            return;
          }
          video.style.display = "none";
        });

        video.addEventListener("loadeddata", function () {
          var host = video.closest(".wt-phone");
          if (host && host.classList.contains("wt-phone--near")) {
            playLoop(video);
          }
        });
      })(wtVideos[w]);
    }

    var startPanel = walkthrough.querySelector('.wt-panel[aria-hidden="false"]') || panels[0];
    if (startPanel) applyDeck(startPanel, parseInt(startPanel.getAttribute("data-step") || "0", 10), false);
  }

  /* ------------------------------------------------------------------
     Scroll reveal

     Same fade-up on every .reveal block. Observer fires once per node so
     scrolling back does not replay. Reduced-motion users see the content
     immediately. Keep this above the showcase early return.
     ------------------------------------------------------------------ */

  var revealNodes = document.querySelectorAll(".reveal");
  if (revealNodes.length) {
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function showReveal(el) {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          el.classList.add("is-in");
        });
      });
    }

    if (reduceMotion || !("IntersectionObserver" in window)) {
      for (var r = 0; r < revealNodes.length; r++) showReveal(revealNodes[r]);
    } else {
      var revealObserver = new IntersectionObserver(
        function (entries) {
          for (var i = 0; i < entries.length; i++) {
            if (!entries[i].isIntersecting) continue;
            showReveal(entries[i].target);
            revealObserver.unobserve(entries[i].target);
          }
        },
        { threshold: 0.01, rootMargin: "0px 0px -6% 0px" }
      );

      for (var r = 0; r < revealNodes.length; r++) {
        revealObserver.observe(revealNodes[r]);
      }
    }
  }

  /* ------------------------------------------------------------------
     Showcase video

     Plays through exactly once and freezes on its final frame. Hover
     starts it on pointer devices; leaving early does not interrupt
     playback. Touch devices start it when the video scrolls into view.
     The file is warmed so the first pointerenter does not wait on decode.
     ------------------------------------------------------------------ */

  var isPhone = window.matchMedia("(max-width: 768px)").matches;
  var video = document.querySelector(".showcase__video");
  if (!video || isPhone) return;

  var showcase = video.closest(".showcase") || video;
  var started = false;
  var queued = false;
  var SPREAD_START = 1.3;
  var SPREAD_RATE = 0.8;
  var SKIP_RATE = 3;

  function playOnce() {
    if (started) return;

    if (video.readyState < 2) {
      queued = true;
      return;
    }

    started = true;
    queued = false;

    var atSpread = false;
    var didSeek = false;

    function enterSpread() {
      if (atSpread) return;
      atSpread = true;
      video.playbackRate = SPREAD_RATE;
    }

    function skipSplash() {
      if (atSpread || video.ended) return true;

      if (!didSeek && video.readyState >= 2) {
        didSeek = true;
        try {
          video.currentTime = SPREAD_START;
        } catch (err) {}
      }

      if (video.currentTime >= SPREAD_START - 0.04) {
        enterSpread();
        video.removeEventListener("timeupdate", skipSplash);
        return true;
      }

      video.playbackRate = SKIP_RATE;
      return false;
    }

    function tick() {
      if (skipSplash()) return;
      if (!video.paused && !video.ended) window.requestAnimationFrame(tick);
    }

    video.playbackRate = SPREAD_RATE;
    video.addEventListener("timeupdate", skipSplash);

    var attempt = video.play();
    if (attempt && typeof attempt.then === "function") {
      attempt.then(function () {
        skipSplash();
        window.requestAnimationFrame(tick);
      }).catch(function () {
        started = false;
        video.playbackRate = 1;
      });
    } else {
      window.requestAnimationFrame(tick);
    }
  }

  video.addEventListener("loadeddata", function () {
    if (queued) playOnce();
  });
  video.addEventListener("canplay", function () {
    if (queued) playOnce();
  });

  video.addEventListener("ended", function () {
    video.pause();
    video.playbackRate = 1;
  });

  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    showcase.addEventListener("pointerenter", playOnce);
  } else if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            playOnce();
            observer.disconnect();
            return;
          }
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(video);
  } else {
    showcase.addEventListener("click", playOnce);
  }
})();
