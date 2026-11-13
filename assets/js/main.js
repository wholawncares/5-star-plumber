/* =========================================================
   Thermal (theme-14): UI behaviour. No animation library required;
   everything here works if GSAP never loads.

   FILE MAP (the page agents edit ONLY inside their own region):
     REGION: CORE      foundation agent: shared UI, lens, forms, boot
     REGION: HOME      home agent: services peek, process lens, estimator, fan
     REGION: SERVICE   service agent: tool lenses, problems, compare
     REGION: LOCATION  location agent: signs checklist, nearby-town light

   RULES (editor safety: the site editor saves the live DOM of its iframe)
   - `live` is true only in a TOP-LEVEL window whose <html> has the `js` class
     (the head gate adds it ONLY when window.self === window.top).
   - When !live (editor iframe / no gate) nothing is built, collapsed, measured or
     written at load: no lens, no inline styles, no attributes. Click-driven
     handlers (menu, dropdowns, accordion, tabs, forms) may still bind, but they
     write only when the user clicks. Hover / pointer driven class toggles never bind.
   - Decorative DUPLICATES of a photo (lens heat layer, services peek images, process
     lens images) are built here from the in-flow <img>; they are never server-rendered.
   - Everything runs at the END of <body> (before the deferred motion.js), so page
     regions can create DOM that motion.js then finds.
   ========================================================= */
(function () {
  "use strict";

  const selfScript = document.currentScript; // the <script src=".../main.js"> tag (read at evaluation time only)
  const framed = window.self !== window.top;
  const live = !framed && document.documentElement.classList.contains("js");
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const layoutChanged = () =>
    window.dispatchEvent(new CustomEvent("layout:change"));
  // booted: main.js has built every JS-made element (motion.js waits for it, see the end of this file). Framed windows have nothing to wait for.
  window.TH = {
    $,
    $$,
    reduceMotion,
    layoutChanged,
    live,
    framed,
    booted: !live,
  };

  /** Build a JS-made DOM node: el("span", "scan__ring", { "aria-hidden": "true" }) */
  const el = (tag, className, attrs) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs)
      Object.keys(attrs).forEach((k) => node.setAttribute(k, attrs[k]));
    return node;
  };
  /** Copy the image source attributes of `from` onto a decorative clone `to`. */
  const cloneImageSource = (from, to) => {
    // `loading` (and decoding, sizes, srcset) must be set BEFORE `src`: an <img> starts fetching the moment it gets a src, so a clone
    // that becomes lazy afterwards has already been downloaded (a dozen full-size photos in the first second of the page).
    // Same URL as the in-flow photo: the browser fetches it once. Mirror its lazy / eager choice.
    to.setAttribute(
      "loading",
      from.getAttribute("loading") === "lazy" ? "lazy" : "eager",
    );
    to.setAttribute("decoding", "async");
    ["srcset", "sizes", "src", "width", "height"].forEach((attr) => {
      const v = from.getAttribute(attr);
      if (v) to.setAttribute(attr, v);
    });
    to.setAttribute("alt", "");
    to.setAttribute("aria-hidden", "true");
  };
  window.TH.el = el;
  window.TH.cloneImageSource = cloneImageSource;

  /* === REGION: CORE (foundation agent) =================== */

  /* ---- Header state ------------------------------------- */
  function initHeader() {
    const header = $("[data-header]");
    if (!header || !live) return;
    const update = () =>
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  /* ---- Desktop dropdowns (services / areas) ------------- */
  function setDropdown(item, open) {
    const button = $(".nav__drop-toggle", item);
    const panel = $(".nav__panel", item);
    if (!button || !panel) return;
    button.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
  }
  function initDropdowns() {
    const items = $$("[data-dropdown]");
    items.forEach((item) => {
      const button = $(".nav__drop-toggle", item);
      if (!button) return;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const open = button.getAttribute("aria-expanded") !== "true";
        items.forEach((other) => {
          if (other !== item) setDropdown(other, false);
        });
        setDropdown(item, open);
      });
      item.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          setDropdown(item, false);
          button.focus();
        }
      });
      item.addEventListener("focusout", (event) => {
        if (!item.contains(event.relatedTarget)) setDropdown(item, false);
      });
    });
    document.addEventListener("click", (event) => {
      items.forEach((item) => {
        if (!item.contains(event.target)) setDropdown(item, false);
      });
    });
  }

  /* ---- Mobile menu (focus trap, Esc, returns focus) ----- */
  function initMenu() {
    const toggle = $(".menu-toggle");
    const menu = $("[data-menu]");
    if (!toggle || !menu) return;
    const label = $(".menu-toggle__label", toggle);
    const dock = $("[data-call-dock]");
    const openLabel = toggle.getAttribute("data-open-label") || "Menu";
    const closeLabel = toggle.getAttribute("data-close-label") || "Close";
    if (live) {
      menu.setAttribute("aria-modal", "true");
      menu.setAttribute("aria-hidden", "true");
      menu.inert = true;
    }

    const focusables = () => [toggle, ...$$("a, button", menu)];
    const setOpen = (open, restore) => {
      toggle.setAttribute("aria-expanded", String(open));
      menu.classList.toggle("is-open", open);
      menu.setAttribute("aria-hidden", String(!open));
      menu.inert = !open;
      document.body.classList.toggle("is-menu-open", open);
      if (label) label.textContent = open ? closeLabel : openLabel;
      if (dock) dock.classList.toggle("is-menu-hidden", open);
      if (open) {
        const first = $("a", menu);
        if (first) first.focus({ preventScroll: true });
      } else if (restore) toggle.focus();
    };

    toggle.addEventListener("click", () =>
      setOpen(toggle.getAttribute("aria-expanded") !== "true"),
    );
    $$("a", menu).forEach((link) =>
      link.addEventListener("click", () => setOpen(false)),
    );
    document.addEventListener("keydown", (event) => {
      if (!menu.classList.contains("is-open")) return;
      if (event.key === "Escape") setOpen(false, true);
      else if (event.key === "Tab") {
        const items = focusables();
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    window.matchMedia("(min-width: 981px)").addEventListener("change", (e) => {
      if (e.matches && menu.classList.contains("is-open")) setOpen(false);
    });
  }

  /* ---- Accordion ---------------------------------------- */
  function initAccordions() {
    $$("[data-accordion]").forEach((acc) => {
      const items = $$(".accordion__item", acc);
      const multi = acc.dataset.accordion === "multi";
      const setItem = (item, open) => {
        item.classList.toggle("is-open", open);
        const btn = $(".accordion__trigger", item);
        if (btn) btn.setAttribute("aria-expanded", String(open));
      };
      items.forEach((item) => {
        const btn = $(".accordion__trigger", item);
        if (!btn) return;
        if (live) setItem(item, item.classList.contains("is-open"));
        btn.addEventListener("click", () => {
          const willOpen = !item.classList.contains("is-open");
          if (!multi)
            items.forEach((other) => {
              if (other !== item) setItem(other, false);
            });
          setItem(item, willOpen);
          layoutChanged();
          window.setTimeout(layoutChanged, 480);
        });
      });
    });
  }

  /* ---- Tabs (arrow keys, Home/End) ---------------------- */
  function initTabs() {
    $$("[data-tabs]").forEach((root) => {
      const tabs = $$('[role="tab"]', root);
      // Without JS every panel is visible; collapse the inactive ones only once tabs will work
      if (live)
        tabs.forEach((t) => {
          const panel = document.getElementById(
            t.getAttribute("aria-controls"),
          );
          if (panel) panel.hidden = t.getAttribute("aria-selected") !== "true";
        });
      const select = (tab, focus) => {
        tabs.forEach((t) => {
          const on = t === tab;
          t.setAttribute("aria-selected", String(on));
          t.tabIndex = on ? 0 : -1;
          const panel = document.getElementById(
            t.getAttribute("aria-controls"),
          );
          if (panel) {
            panel.hidden = !on;
            if (on && !reduceMotion.matches && live) {
              panel.classList.remove("is-entering");
              void panel.offsetWidth;
              panel.classList.add("is-entering");
            }
          }
        });
        if (focus) tab.focus();
        layoutChanged();
      };
      tabs.forEach((tab, i) => {
        tab.addEventListener("click", () => select(tab));
        tab.addEventListener("keydown", (e) => {
          let n = null;
          if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
          if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
          if (e.key === "Home") n = 0;
          if (e.key === "End") n = tabs.length - 1;
          if (n !== null) {
            e.preventDefault();
            select(tabs[n], true);
          }
        });
      });
    });
  }

  /* ---- Lead forms (central lead script contract) --------- */
  function leadConfig() {
    const config = window.__RL_LEADS || {};
    const base = String(config.apiBase || "");
    const siteId = String(config.siteId || "");
    if (!/^https?:\/\//.test(base) || !siteId || siteId.indexOf("{{") !== -1)
      return null;
    return { apiBase: base.replace(/\/+$/, ""), siteId };
  }
  function setFormState(form, state) {
    form.setAttribute("data-status", state);
    const button = $('button[type="submit"]', form);
    const map = {
      success: ".form-success",
      error: ".form-error",
      invalid: ".form-invalid",
    };
    Object.keys(map).forEach((key) => {
      const node = $(map[key], form);
      if (node) node.classList.toggle("visible", state === key);
    });
    if (button) {
      button.disabled = state === "pending" || state === "success";
      if (state === "pending") button.setAttribute("aria-busy", "true");
      else button.removeAttribute("aria-busy");
    }
    if (state === "error") {
      const err = $(".form-error", form);
      if (err) err.focus({ preventScroll: true });
    }
  }
  function validateForm(form) {
    let firstBad = null;
    $$("input, select, textarea", form).forEach((field) => {
      if (field.name === "_hp" || field.type === "hidden") return;
      const bad = !field.checkValidity();
      if (field.required || field.value)
        field.setAttribute("aria-invalid", bad ? "true" : "false");
      if (bad && !firstBad) firstBad = field;
    });
    return firstBad;
  }
  function initLeadForms() {
    $$("form[data-rl-lead]").forEach((form) => {
      $$("input, select, textarea", form).forEach((field) => {
        field.addEventListener("input", () => {
          if (
            field.getAttribute("aria-invalid") === "true" &&
            field.checkValidity()
          )
            field.setAttribute("aria-invalid", "false");
        });
      });
    });
    document.addEventListener("submit", (event) => {
      const form =
        event.target &&
        event.target.matches &&
        event.target.matches("form[data-rl-lead]")
          ? event.target
          : null;
      if (!form) return;
      event.preventDefault();
      const status = form.getAttribute("data-status");
      if (status === "pending" || status === "success") return;
      const bad = validateForm(form);
      if (bad) {
        setFormState(form, "invalid");
        bad.focus();
        return;
      }
      const honeypot = $('[name="_hp"]', form);
      if (honeypot && honeypot.value) {
        setFormState(form, "success");
        return;
      }
      const config = leadConfig();
      if (!config) {
        setFormState(form, "error");
        return;
      }
      const payload = {};
      new FormData(form).forEach((value, key) => {
        if (key !== "_hp" && key !== "cf-turnstile-response")
          payload[key] = String(value);
        if (key === "cf-turnstile-response" && value)
          payload.turnstileToken = String(value);
      });
      payload.pageUrl = window.location.href;
      setFormState(form, "pending");
      fetch(
        config.apiBase + "/api/leads/" + encodeURIComponent(config.siteId),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        },
      )
        .then((response) => {
          if (!response.ok) throw new Error("Lead request failed");
          setFormState(form, "success");
          form.reset();
        })
        .catch(() => setFormState(form, "error"));
    });
    document.addEventListener("rl:lead-success", (e) => {
      if (e.detail && e.detail.form) setFormState(e.detail.form, "success");
    });
    document.addEventListener("rl:lead-error", (e) => {
      if (e.detail && e.detail.form) setFormState(e.detail.form, "error");
    });
  }

  /* ---- Offer code copy (labels from data attributes) ----- */
  function initCopy() {
    if (!live) return;
    $$("[data-copy-code]").forEach((btn) => {
      const label = $("[data-copy-label]", btn) || btn;
      const original = label.textContent;
      btn.addEventListener("click", async () => {
        const code = btn.dataset.copyCode;
        try {
          await navigator.clipboard.writeText(code);
          label.textContent = btn.dataset.copiedLabel || "Copied";
        } catch (_e) {
          label.textContent = (btn.dataset.codeLabel || "Code:") + " " + code;
        }
        window.setTimeout(() => {
          label.textContent = original;
        }, 2200);
      });
    });
  }

  /* ---- Native-scroll slider with buttons ---------------- */
  function initSliders() {
    $$("[data-slider]").forEach((root) => {
      const track = $("[data-slider-track]", root);
      const prev = $("[data-slider-prev]", root);
      const next = $("[data-slider-next]", root);
      if (!track) return;
      const slides = Array.from(track.children);
      const step = () =>
        slides[1]
          ? slides[1].offsetLeft - slides[0].offsetLeft
          : track.clientWidth;
      const update = () => {
        if (!live) return; // framed (editor): never write `disabled` (resize/scroll would be saved into the page)
        const max = track.scrollWidth - track.clientWidth - 2;
        if (prev) prev.disabled = Math.abs(track.scrollLeft) <= 2;
        if (next) next.disabled = Math.abs(track.scrollLeft) >= max;
      };
      const go = (dir) =>
        track.scrollBy({
          left: dir * step(),
          behavior: reduceMotion.matches ? "auto" : "smooth",
        });
      if (prev) prev.addEventListener("click", () => go(-1));
      if (next) next.addEventListener("click", () => go(1));
      track.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      if (live) update();
    });
  }

  /* ---- Linked lists <-> visuals (data-link-group) ------- */
  function initLinkedHighlights() {
    if (!live) return;
    $$("[data-link-group]").forEach((root) => {
      const targets = $$("[data-link-target]", root);
      $$("[data-link-source]", root).forEach((src) => {
        const on = () =>
          targets.forEach((t) =>
            t.classList.toggle(
              "is-active",
              t.dataset.linkTarget === src.dataset.linkSource,
            ),
          );
        const off = () =>
          targets.forEach((t) => t.classList.remove("is-active"));
        src.addEventListener("pointerenter", on);
        src.addEventListener("focus", on);
        src.addEventListener("pointerleave", off);
        src.addEventListener("blur", off);
      });
    });
  }

  /* ---- In-page anchors: smooth, then re-aim ------------- */
  /* Lazy images above the target change the page height while a smooth scroll runs, so the
     browser's own anchor jump can undershoot. After the scroll settles we correct once or twice. */
  function initAnchors() {
    if (!live) return;
    const headerH = () => {
      const bar = $(".site-header__bar");
      return bar ? bar.getBoundingClientRect().bottom + 12 : 0;
    };
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest('a[href*="#"]');
      if (
        !a ||
        e.defaultPrevented ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        a.target
      )
        return;
      const url = new URL(a.href, location.href);
      if (
        url.pathname !== location.pathname ||
        url.search !== location.search ||
        !url.hash ||
        url.hash === "#"
      )
        return;
      const id = decodeURIComponent(url.hash.slice(1));
      const target = id === "top" ? document.body : document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      const aim = () =>
        id === "top"
          ? 0
          : Math.max(
              0,
              target.getBoundingClientRect().top +
                window.scrollY -
                (id === "contact" || id === "faq" ? headerH() - 8 : 0),
            );
      window.scrollTo({
        top: aim(),
        behavior: reduceMotion.matches ? "auto" : "smooth",
      });
      history.replaceState(null, "", url.hash);
      let tries = 0;
      let last = -1;
      const settle = () => {
        const y = window.scrollY;
        if (Math.abs(y - last) > 1) {
          last = y;
          window.setTimeout(settle, 140);
          return;
        }
        if (Math.abs(aim() - y) > 3 && tries++ < 3) {
          window.scrollTo({ top: aim(), behavior: "auto" });
          last = -1;
          window.setTimeout(settle, 160);
          return;
        }
        if (target !== document.body) {
          if (!target.hasAttribute("tabindex"))
            target.setAttribute("tabindex", "-1");
          target.focus({ preventScroll: true });
        }
      };
      window.setTimeout(settle, 200);
    });
  }

  /* ---- Mobile call dock visibility ---------------------- */
  function initCallDock() {
    if (!live) return;
    const dock = $("[data-call-dock]");
    if (!dock) return;
    const watch = $$("[data-hero], #contact");
    const visible = new Set();
    const sync = () =>
      dock.classList.toggle(
        "is-hidden",
        visible.size > 0 || dock.classList.contains("is-menu-hidden"),
      );
    // the menu sheet hides the dock (menu code toggles .is-menu-hidden); hero / contact in view hide it too
    new MutationObserver(sync).observe(dock, {
      attributes: true,
      attributeFilter: ["class"],
    });
    if (watch.length && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) =>
            e.isIntersecting ? visible.add(e.target) : visible.delete(e.target),
          );
          sync();
        },
        { threshold: 0.2 },
      );
      watch.forEach((node) => io.observe(node));
    } else sync();
  }

  /* ---- Current page in the nav -------------------------- */
  function markCurrent() {
    if (!live) return;
    const clean = (p) =>
      p
        .replace(/\/index(\.html)?$/, "/")
        .replace(/\.html$/, "")
        .replace(/\/+$/, "") || "/";
    const here = clean(window.location.pathname);
    $$(".nav__link, .menu__link").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#") return;
      let path;
      try {
        path = clean(new URL(href, window.location.href).pathname);
      } catch (_e) {
        return;
      }
      if (path === here) link.setAttribute("aria-current", "page");
    });
  }

  /* ---- Scan lens: the signature photo interaction -------- */
  /* Illustrative thermal ramp (same 7 stops as the prototype's tools/make-thermal.cjs):
     the heat layer is a CLONE of the photo run through an SVG filter, so any photo works.
       grey (luminance) -> blur mixed with the original -> contrast stretch -> 7-stop colour table.
     The stretch is ADAPTIVE: when the photo is same-origin (always, in an exported site) its 2nd / 98th
     luminance percentiles are read from a tiny canvas and a per-figure filter is made, like the
     prototype's offline normalise(2, 98). Otherwise (cross-origin, file://) the static default is used. */
  const THERMAL_STOPS = [
    [0.0, [20, 9, 63]],
    [0.2, [74, 31, 184]],
    [0.4, [176, 47, 192]],
    [0.58, [255, 79, 122]],
    [0.76, [255, 154, 60]],
    [0.9, [255, 212, 90]],
    [1.0, [255, 243, 196]],
  ];
  // blurRatio: blur sigma as a fraction of the displayed width (prototype: 9px on a 1600px image)
  const FILTER = {
    blurRatio: 0.0056,
    mixBlur: 0.72,
    slope: 1.3,
    intercept: -0.12,
    gamma: 1.1,
    samples: 51,
  };
  function thermalRamp(t) {
    for (let i = 1; i < THERMAL_STOPS.length; i++) {
      if (t <= THERMAL_STOPS[i][0]) {
        const a = THERMAL_STOPS[i - 1];
        const b = THERMAL_STOPS[i];
        const k = (t - a[0]) / (b[0] - a[0]);
        return a[1].map((v, j) => v + (b[1][j] - v) * k);
      }
    }
    return THERMAL_STOPS[THERMAL_STOPS.length - 1][1];
  }
  let thermalTable = null;
  function thermalFilterMarkup(id, slope, intercept, blur, exponent) {
    if (!thermalTable) {
      thermalTable = [[], [], []];
      for (let i = 0; i < FILTER.samples; i++) {
        const c = thermalRamp(
          Math.pow(i / (FILTER.samples - 1), 1 / FILTER.gamma),
        );
        for (let ch = 0; ch < 3; ch++)
          thermalTable[ch].push((c[ch] / 255).toFixed(4));
      }
    }
    const fn = (name, attrs) => "<" + name + " " + attrs + "/>";
    const lin = ["R", "G", "B"]
      .map((c) =>
        fn(
          "feFunc" + c,
          'type="linear" slope="' +
            slope.toFixed(3) +
            '" intercept="' +
            intercept.toFixed(3) +
            '"',
        ),
      )
      .join("");
    const tab = ["R", "G", "B"]
      .map((c, i) =>
        fn(
          "feFunc" + c,
          'type="table" tableValues="' + thermalTable[i].join(" ") + '"',
        ),
      )
      .join("");
    const gam = ["R", "G", "B"]
      .map((c) =>
        fn(
          "feFunc" + c,
          'type="gamma" amplitude="1" exponent="' +
            (exponent || 1).toFixed(3) +
            '" offset="0"',
        ),
      )
      .join("");
    return (
      '<filter id="' +
      id +
      '" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0" result="grey"/>' +
      '<feGaussianBlur in="grey" stdDeviation="' +
      blur.toFixed(2) +
      '" result="soft"/>' +
      '<feComposite in="soft" in2="grey" operator="arithmetic" k1="0" k2="' +
      FILTER.mixBlur +
      '" k3="' +
      (1 - FILTER.mixBlur).toFixed(2) +
      '" k4="0" result="mix"/>' +
      '<feComponentTransfer in="mix" result="contrast">' +
      lin +
      '<feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>' +
      '<feComponentTransfer in="contrast" result="balanced">' +
      gam +
      "</feComponentTransfer>" +
      '<feComponentTransfer in="balanced">' +
      tab +
      "</feComponentTransfer></filter>"
    );
  }
  function ensureThermalFilter() {
    if (document.getElementById("th-thermal-defs")) return;
    document.body.insertAdjacentHTML(
      "beforeend",
      '<svg id="th-thermal-defs" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden"><defs>' +
        thermalFilterMarkup("th-thermal", FILTER.slope, FILTER.intercept, 3) +
        "</defs></svg>",
    );
  }
  /** Run `fn` once, the first time `node` is within ~300px of the viewport (immediately without IntersectionObserver). */
  const visibleOnce = (function () {
    const jobs = new Map();
    let io = null;
    return function (node, fn) {
      if (!("IntersectionObserver" in window)) {
        fn();
        return;
      }
      if (!io) {
        io = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              io.unobserve(entry.target);
              const list = jobs.get(entry.target) || [];
              jobs.delete(entry.target);
              list.forEach((job) => {
                try {
                  job();
                } catch (err) {
                  console.error("[thermal:visibleOnce]", err);
                }
              });
            });
          },
          { rootMargin: "300px 0px" },
        );
      }
      if (!jobs.has(node)) jobs.set(node, []);
      jobs.get(node).push(fn);
      io.observe(node);
    };
  })();
  window.TH.visibleOnce = visibleOnce;

  /** Read the 2nd / 98th / 50th luminance percentiles (0..1) from RGBA pixel data of a tiny bitmap. */
  function lumaPercentiles(data, total) {
    const hist = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4)
      hist[
        Math.round(
          0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2],
        )
      ] += 1;
    let acc = 0;
    let lo = 0;
    let hi = 255;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= total * 0.02) {
        lo = v;
        break;
      }
    }
    acc = 0;
    for (let v = 255; v >= 0; v--) {
      acc += hist[v];
      if (acc >= total * 0.02) {
        hi = v;
        break;
      }
    }
    acc = 0;
    let med = 128;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= total * 0.5) {
        med = v;
        break;
      }
    }
    return [lo / 255, hi / 255, med / 255];
  }
  /**
   * 2nd / 98th luminance percentiles (0..1) of a loaded image as a Promise (null when it cannot be read).
   * createImageBitmap decodes and shrinks the photo OFF the main thread; a plain drawImage of the full photo
   * costs a synchronous decode (hundreds of ms on a phone), so it is only the fallback.
   */
  function lumaRange(image) {
    const W = 48;
    const H = 32;
    const read = (source) => {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(source, 0, 0, W, H);
      return lumaPercentiles(ctx.getImageData(0, 0, W, H).data, W * H);
    };
    try {
      if (typeof window.createImageBitmap === "function") {
        return window
          .createImageBitmap(image, {
            resizeWidth: W,
            resizeHeight: H,
            resizeQuality: "medium",
          })
          .then((bitmap) => {
            try {
              return read(bitmap);
            } finally {
              if (bitmap.close) bitmap.close();
            }
          })
          .catch(() => null);
      }
      return Promise.resolve(read(image));
    } catch (_e) {
      return Promise.resolve(null);
    }
  }
  let filterSeq = 0;
  /**
   * Give one heat image its own filter, stretched to that photo's luminance range and blurred in proportion to its size.
   * Deferred: it starts only once the figure is near the viewport and after the first paint, so it never competes with the LCP photo.
   * (Until then the heat layer uses the static default filter; the lens is radius 0 at that point, so nothing shows.)
   */
  function adaptHeatFilter(root, heatImg) {
    const defs = $("#th-thermal-defs defs");
    if (!defs) return;
    const id = "th-thermal-" + ++filterSeq;
    const apply = () => {
      lumaRange(heatImg).then((range) => {
        if (!range) return;
        const span = Math.max(0.2, range[1] - range[0]);
        const slope = Math.min(2.4, 1 / span);
        const intercept = -range[0] * slope;
        // balance: pull the stretched median toward the middle of the ramp so bright / dark photos still span the colours
        const median = Math.min(
          0.97,
          Math.max(0.03, (range[2] - range[0]) / span),
        );
        const exponent = Math.min(
          1.7,
          Math.max(0.8, Math.log(0.52) / Math.log(median)),
        );
        // The blur follows the figure's width. A ResizeObserver reports the width after layout (no forced layout here); its first
        // callback also creates the filter, so the filter is only ever built with a real width.
        let blurNode = null;
        const blurFor = (width) => Math.max(0.6, width * FILTER.blurRatio);
        const place = (width) => {
          if (!blurNode) {
            defs.insertAdjacentHTML(
              "beforeend",
              thermalFilterMarkup(
                id,
                slope,
                intercept,
                blurFor(width),
                exponent,
              ),
            );
            heatImg.style.filter = "url(#" + id + ")";
            blurNode = defs.querySelector("#" + id + " feGaussianBlur");
          } else if (blurNode)
            blurNode.setAttribute("stdDeviation", blurFor(width).toFixed(2));
        };
        if ("ResizeObserver" in window)
          new ResizeObserver((entries) =>
            place(entries[0].contentRect.width),
          ).observe(root);
        else place(root.getBoundingClientRect().width);
      });
    };
    const whenLoaded = () => {
      if (heatImg.complete && heatImg.naturalWidth) apply();
      else heatImg.addEventListener("load", apply, { once: true });
    };
    visibleOnce(root, () =>
      window.requestAnimationFrame(() => window.setTimeout(whenLoaded, 0)),
    );
  }

  /** Build heat layer, hot patch, ring, readout and toggle for one [data-scan] figure. */
  function buildLens(root) {
    if ($(".scan__heat", root)) return true;
    const base = $("img.scan__base", root) || $("img", root);
    if (!base) return false;
    const heat = el("div", "scan__heat", { "aria-hidden": "true" });
    const heatImg = el("img", "scan__heat-img");
    cloneImageSource(base, heatImg);
    heat.appendChild(heatImg);
    heat.appendChild(el("span", "scan__hot"));
    adaptHeatFilter(root, heatImg);
    const ring = el("span", "scan__ring", { "aria-hidden": "true" });
    base.after(heat);
    heat.after(ring);
    const readoutText = root.getAttribute("data-readout");
    if (readoutText) {
      const readout = el("span", "scan__readout");
      readout.textContent = readoutText;
      ring.after(readout);
    }
    const onLabel = root.getAttribute("data-toggle-on");
    if (onLabel) {
      const toggle = el("button", "scan__toggle", {
        type: "button",
        "aria-pressed": "false",
        "data-scan-toggle": "",
      });
      toggle.appendChild(
        el("span", "scan__toggle-dot", { "aria-hidden": "true" }),
      );
      const text = el("span", "", { "data-scan-toggle-label": "" });
      text.textContent = onLabel;
      toggle.appendChild(text);
      root.appendChild(toggle);
    }
    return true;
  }

  function initScan() {
    if (!live) return;
    const roots = $$("[data-scan]");
    if (!roots.length) return;
    ensureThermalFilter();
    // Phase 1 (writes only, cheap): build every heat layer / ring / toggle so motion.js and the editor-safe markup rules see the final DOM.
    // Phase 2 (reads + pointer logic): wire each lens only when its figure is near the viewport, one figure per task, so a page with many
    // lenses does not measure them all (forced layouts) during start-up.
    roots
      .filter(buildLens)
      .forEach((root) => visibleOnce(root, () => setupLens(root)));
    function setupLens(root) {
      const toggle = $("[data-scan-toggle]", root);
      const pins = $$(".pin", root);
      const state = {
        x: 0,
        y: 0,
        tx: 0,
        ty: 0,
        r: 0,
        tr: 0,
        w: 0,
        h: 0,
        raf: 0,
        inside: false,
        idleTimer: 0,
      };
      const home = () => {
        const cs = getComputedStyle(root);
        const hx = parseFloat(cs.getPropertyValue("--home-x")) || 62;
        const hy = parseFloat(cs.getPropertyValue("--home-y")) || 52;
        return { x: (hx / 100) * state.w, y: (hy / 100) * state.h };
      };
      const hoverMode = root.dataset.scanMode === "hover";
      const radius = () =>
        hoverMode
          ? Math.max(70, Math.min(state.w * 0.24, 150))
          : Math.max(78, Math.min(state.w * 0.15, 190));

      const measure = () => {
        const b = root.getBoundingClientRect();
        state.w = b.width;
        state.h = b.height;
        state.tr = hoverMode
          ? state.inside
            ? radius()
            : 0
          : root.classList.contains("is-full")
            ? 0
            : radius();
        if (!state.inside && !hoverMode) {
          const h = home();
          state.tx = h.x;
          state.ty = h.y;
        }
      };
      const paint = () => {
        root.style.setProperty("--lx", state.x.toFixed(1) + "px");
        root.style.setProperty("--ly", state.y.toFixed(1) + "px");
        root.style.setProperty("--lr", Math.max(0, state.r).toFixed(1) + "px");
        root.classList.toggle(
          "has-lens",
          state.r > 2,
        ); /* ring + cross-hair exist only while the lens has a radius */
        pins.forEach((pin) => {
          const px =
            (parseFloat(pin.style.getPropertyValue("--px")) / 100) * state.w;
          const py =
            (parseFloat(pin.style.getPropertyValue("--py")) / 100) * state.h;
          const d = Math.hypot(px - state.x, py - state.y);
          pin.classList.toggle(
            "is-lit",
            root.classList.contains("is-full") || d < state.r * 1.25,
          );
        });
      };
      const loop = () => {
        const k = reduceMotion.matches ? 1 : 0.14;
        state.x += (state.tx - state.x) * k;
        state.y += (state.ty - state.y) * k;
        state.r += (state.tr - state.r) * (reduceMotion.matches ? 1 : 0.12);
        paint();
        const settled =
          Math.abs(state.tx - state.x) < 0.4 &&
          Math.abs(state.ty - state.y) < 0.4 &&
          Math.abs(state.tr - state.r) < 0.4;
        state.raf = settled ? 0 : requestAnimationFrame(loop);
      };
      const kick = () => {
        if (!state.raf) state.raf = requestAnimationFrame(loop);
      };
      const target = (e) => {
        const b = root.getBoundingClientRect();
        state.tx = Math.max(0, Math.min(b.width, e.clientX - b.left));
        state.ty = Math.max(0, Math.min(b.height, e.clientY - b.top));
        if (hoverMode && !state.inside) {
          state.x = state.tx;
          state.y = state.ty;
        }
        state.inside = true;
        if (hoverMode) state.tr = radius();
        window.clearTimeout(state.idleTimer);
        kick();
      };
      const park = () => {
        state.inside = false;
        window.clearTimeout(state.idleTimer);
        if (hoverMode) {
          state.tr = 0;
          kick();
          return;
        }
        state.idleTimer = window.setTimeout(() => {
          const h = home();
          state.tx = h.x;
          state.ty = h.y;
          kick();
        }, 1400);
      };

      root.addEventListener("pointermove", target);
      root.addEventListener("pointerdown", target);
      root.addEventListener("pointerleave", park);
      root.addEventListener("pointercancel", park);

      if (toggle) {
        const onLabel = root.getAttribute("data-toggle-on") || "";
        const offLabel = root.getAttribute("data-toggle-off") || onLabel;
        toggle.addEventListener("click", () => {
          const full = !root.classList.contains("is-full");
          root.classList.toggle("is-full", full);
          toggle.setAttribute("aria-pressed", String(full));
          const label = $("[data-scan-toggle-label]", toggle);
          if (label) label.textContent = full ? offLabel : onLabel;
          state.tr = full ? 0 : radius();
          paint();
          kick();
        });
      }

      measure();
      if (hoverMode) {
        state.x = state.w / 2;
        state.y = state.h / 2;
        state.r = 0;
        state.tr = 0;
        paint();
        if ("ResizeObserver" in window)
          new ResizeObserver(measure).observe(root);
        return;
      }
      // Intro: the lens sweeps in from the left edge, then settles on the hotspot
      const h0 = home();
      state.x = state.w * 0.06;
      state.y = h0.y;
      state.tx = h0.x;
      state.ty = h0.y;
      state.r = reduceMotion.matches ? radius() : 0;
      state.tr = radius();
      paint();
      if (reduceMotion.matches) {
        state.x = h0.x;
        state.r = state.tr;
        paint();
      } else window.setTimeout(kick, 650);

      if ("ResizeObserver" in window)
        new ResizeObserver(() => {
          measure();
          kick();
        }).observe(root);
      else
        window.addEventListener("resize", () => {
          measure();
          kick();
        });
    }
  }

  /* === END REGION: CORE ================================== */

  /* === REGION: HOME (home agent) ========================= */
  /* Page-specific UI of the home page. Contracts (server markup -> JS):
     Services index  [data-svc] > ul[data-svc-index] > li.svc-index__item[data-peek-key] holding
        one thumbnail <img> (inside .svc-index__thumb). The pointer-following preview is BUILT HERE
        from those thumbnails: .svc-peek[data-svc-peek] > .svc-peek__frame > img.svc-peek__img[data-peek=key].
        The server markup has NO .svc-peek and no duplicate photos.
     Process         section[data-process] > .process__runway > .process__sticky > .process__lens[data-process-lens]
        > .process__lens-media (EMPTY in the server markup) + ol.process__steps > li.process__step[data-step]
        each with an in-flow photo .process__step-media img. The lens images (img.process__lens-img,
        data-step-img=i, first one .is-active) are cloned here from those step photos.
     Estimator       [data-estimator] with role=radio options (data-level 1..3, data-note), [data-est-note],
        [data-meter]. Optional data attributes for translated text: data-meter-label="Typical effect on scope: {level}"
        and data-levels="smaller|moderate|larger".
     Fan             [data-fan] > [data-fan-item] with .fan__trigger (expanding photo panels).
     Locations       [data-link-group] with ul .loc__link rows (text in .loc__name) + [data-loc-map] (rings + .loc__pin--home).
        The town pills (.loc__pin with --a / --r) are BUILT HERE from the first 7 rows; none are server-rendered. */

  function buildServicePeek() {
    if (!live) return;
    const section = $("[data-svc]");
    const list = $("[data-svc-index]", section || document);
    if (!section || !list || $("[data-svc-peek]", section)) return;
    const rows = $$(".svc-index__item", list);
    const frame = el("div", "svc-peek__frame");
    rows.forEach((row, i) => {
      const thumb = $(".svc-index__thumb img", row) || $("img", row);
      if (!thumb) return;
      let key = row.getAttribute("data-peek-key");
      if (!key) {
        key = "svc-" + i;
        row.setAttribute("data-peek-key", key);
      }
      const image = el("img", "svc-peek__img", { "data-peek": key });
      cloneImageSource(thumb, image);
      image.setAttribute("loading", "lazy");
      image.setAttribute("sizes", "320px");
      // Thumbnails are small: prefer the larger source when the thumb offers a srcset
      image.removeAttribute("width");
      image.removeAttribute("height");
      frame.appendChild(image);
    });
    if (!frame.children.length) return;
    const peek = el("div", "svc-peek", {
      "aria-hidden": "true",
      "data-svc-peek": "",
    });
    peek.appendChild(frame);
    list.after(peek);
  }

  function buildProcessLens() {
    if (!live) return;
    const section = $("[data-process]");
    const media = section && $(".process__lens-media", section);
    if (!section || !media || $(".process__lens-img", media)) return;
    $$(".process__step", section).forEach((step, i) => {
      const photo = $(".process__step-media img", step);
      if (!photo) return;
      const image = el(
        "img",
        "process__lens-img" + (i === 0 ? " is-active" : ""),
        { "data-step-img": String(i) },
      );
      cloneImageSource(photo, image);
      image.setAttribute("loading", "lazy");
      image.setAttribute("sizes", "(min-width: 900px) 40vw, 80vw");
      media.appendChild(image);
    });
  }

  function initEstimator() {
    if (!live) return;
    $$("[data-estimator]").forEach((root) => {
      const names = (root.dataset.levels || "smaller|moderate|larger").split(
        "|",
      );
      const template =
        root.dataset.meterLabel || "Typical effect on scope: {level}";
      const opts = $$('[role="radio"]', root);
      const note = $("[data-est-note]", root);
      const meter = $("[data-meter]", root);
      const set = (opt, focus) => {
        opts.forEach((o) => {
          const on = o === opt;
          o.setAttribute("aria-checked", String(on));
          o.tabIndex = on ? 0 : -1;
        });
        if (note) note.textContent = opt.dataset.note || "";
        if (meter) {
          meter.dataset.level = opt.dataset.level;
          meter.setAttribute(
            "aria-label",
            template.replace(
              "{level}",
              names[Number(opt.dataset.level) - 1] || "",
            ),
          );
        }
        if (focus) opt.focus();
      };
      opts.forEach((o, i) => {
        o.addEventListener("click", () => set(o));
        o.addEventListener("keydown", (e) => {
          let n = null;
          if (e.key === "ArrowDown" || e.key === "ArrowRight")
            n = (i + 1) % opts.length;
          if (e.key === "ArrowUp" || e.key === "ArrowLeft")
            n = (i - 1 + opts.length) % opts.length;
          if (n !== null) {
            e.preventDefault();
            set(opts[n], true);
          }
        });
      });
      if (opts.length)
        set(
          opts.find((o) => o.getAttribute("aria-checked") === "true") ||
            opts[0],
        );
    });
  }

  /* Expanding photo panels (desktop) / stacked cards (mobile) */
  function initFan() {
    if (!live) return;
    const desktop = window.matchMedia("(min-width: 900px)");
    $$("[data-fan]").forEach((root) => {
      const items = $$("[data-fan-item]", root);
      const trigger = (it) => $(".fan__trigger", it);
      const activate = (item) =>
        items.forEach((it) => {
          const on = it === item;
          it.classList.toggle("is-active", on);
          trigger(it).setAttribute("aria-expanded", String(on));
        });
      const sync = () => {
        if (desktop.matches)
          activate(
            items.find((i) => i.classList.contains("is-active")) || items[0],
          );
        else
          items.forEach((it) => {
            it.classList.add("is-active");
            trigger(it).setAttribute("aria-expanded", "true");
          });
      };
      items.forEach((it, i) => {
        trigger(it).addEventListener("click", () => {
          if (desktop.matches) activate(it);
        });
        it.addEventListener("pointerenter", (e) => {
          if (desktop.matches && e.pointerType === "mouse") activate(it);
        });
        trigger(it).addEventListener("keydown", (e) => {
          if (!desktop.matches) return;
          let n = null;
          if (e.key === "ArrowRight") n = Math.min(items.length - 1, i + 1);
          if (e.key === "ArrowLeft") n = Math.max(0, i - 1);
          if (n !== null && n !== i) {
            e.preventDefault();
            activate(items[n]);
            trigger(items[n]).focus();
          }
        });
      });
      desktop.addEventListener("change", sync);
      if (items.length) sync();
    });
  }

  /* Locations: the town pills on the ripple map are COPIES of the list names, so they are built here (live only), never
     server-rendered: deleting a city in the editor removes its list row and leaves no stray name behind. Each pill lights up
     with its row (hover / focus), like the prototype's data-link-group behaviour (which cannot bind to DOM built after it ran). */
  const PIN_SLOTS = [
    [-50, 23],
    [12, 29],
    [128, 27],
    [-112, 39],
    [160, 40],
    [48, 41],
    [-18, 44],
  ]; // [angle deg, radius % of the map]
  function buildLocationPins() {
    if (!live) return;
    $$("[data-loc-map]").forEach((map) => {
      if ($(".loc__pin:not(.loc__pin--home)", map)) return;
      const group = map.closest("[data-link-group]") || document;
      const links = $$(".loc__link", group).slice(0, PIN_SLOTS.length);
      const home = $(".loc__pin--home", map);
      links.forEach((link, i) => {
        const name = $(".loc__name", link);
        const label = (name ? name.textContent : link.textContent || "").trim();
        if (!label) return;
        const pill = el("span", "loc__pin");
        pill.textContent = label;
        pill.style.setProperty("--a", PIN_SLOTS[i][0] + "deg");
        pill.style.setProperty("--r", PIN_SLOTS[i][1] + "%");
        map.appendChild(pill);
        const on = () => {
          pill.classList.add("is-active");
          if (home) home.classList.remove("is-active");
        };
        const off = () => pill.classList.remove("is-active");
        link.addEventListener("pointerenter", on);
        link.addEventListener("focus", on);
        link.addEventListener("pointerleave", off);
        link.addEventListener("blur", off);
      });
    });
  }
  // main.js runs at the end of <body>: the list exists, and motion.js (deferred) finds the pills already built.
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", () => {
      try {
        buildLocationPins();
      } catch (err) {
        console.error("[thermal:buildLocationPins]", err);
      }
    });
  else {
    try {
      buildLocationPins();
    } catch (err) {
      console.error("[thermal:buildLocationPins]", err);
    }
  }

  /* === END REGION: HOME ================================== */

  /* === REGION: SERVICE (service agent) =================== */
  /* Page-specific UI of the service page (prototype motion-service.js "Part 1" + compare), adapted to the real markup.
     Editor safety: everything below returns early unless `live`, and the server markup holds ONE <img> per photo, so
     the pieces that duplicate a photo or float over it are built HERE:
       - tools:    .s-tool__lens.scan (hover lens, built by CORE) gets its .s-tool__btn button (aria-label from data-lens-label);
       - problems: [data-s-prob] rows (.s-prob__row, divs in the server markup) are upgraded to role=button on desktop and the
                   sticky .s-prob__panel is built from CLONES of the in-flow thumbnails (.s-prob__thumb img);
       - compare:  [data-compare] holds only the photo layer; the illustrative thermal layer (a clone through the heat filter),
                   the two tags, the range input and the handle are built here (labels from data-label-heat / -photo / -range). */

  /* Tools: every circle is a hover lens. Keyboard and touch get the same view:
     focus opens a lens in the middle, Enter / Space / tap toggles the full-circle view. */
  function initToolLenses() {
    if (!live) return;
    $$(".s-tool__lens.scan").forEach((lens) => {
      let btn = $(".s-tool__btn", lens);
      if (!btn) {
        btn = el("button", "s-tool__btn", {
          type: "button",
          "aria-pressed": "false",
          "aria-label": lens.getAttribute("data-lens-label") || "",
        });
        lens.appendChild(btn);
      }
      let raf = 0;
      let r = 0;
      let target = 0;
      const radius = () => Math.max(60, Math.min(lens.clientWidth * 0.34, 120));
      const paint = () => {
        lens.style.setProperty("--lx", lens.clientWidth / 2 + "px");
        lens.style.setProperty("--ly", lens.clientHeight / 2 + "px");
        lens.style.setProperty("--lr", Math.max(0, r).toFixed(1) + "px");
        lens.classList.toggle(
          "has-lens",
          r > 2,
        ); /* ring + cross-hair exist only while the lens has a radius (no dot at zero radius) */
      };
      const step = () => {
        r += (target - r) * (reduceMotion.matches ? 1 : 0.18);
        paint();
        raf = Math.abs(target - r) < 0.5 ? 0 : requestAnimationFrame(step);
        if (!raf) {
          r = target;
          paint();
        }
      };
      const kick = () => {
        if (!raf) raf = requestAnimationFrame(step);
      };
      btn.addEventListener("focus", () => {
        if (!btn.matches(":focus-visible")) return;
        target = radius();
        kick();
      });
      btn.addEventListener("blur", () => {
        target = 0;
        kick();
      });
      btn.addEventListener("click", () => {
        const on = !lens.classList.contains("is-full");
        lens.classList.toggle("is-full", on);
        btn.setAttribute("aria-pressed", String(on));
      });
    });
  }

  /* Problems: the active row (hover, focus or click) decides which photo is shown in the sticky panel (desktop). */
  function initProblems() {
    if (!live) return;
    const root = $("[data-s-prob]");
    if (!root) return;
    const grid = $("[data-s-prob-grid]", root);
    const rows = $$(".s-prob__row", root);
    if (!grid || !rows.length) return;

    const frame = el("div", "s-prob__frame");
    const imgs = rows.map((row, i) => {
      const clone = el("img", "s-prob__img", { "data-prob-img": String(i) });
      const thumb = $(".s-prob__thumb img", row.parentElement || root);
      if (thumb) cloneImageSource(thumb, clone);
      clone.setAttribute("sizes", "(min-width: 900px) 40vw, 100vw");
      frame.appendChild(clone);
      return clone;
    });
    const panel = el("div", "s-prob__panel", { "aria-hidden": "true" });
    panel.appendChild(frame);
    grid.appendChild(panel);

    const activate = (i) => {
      rows.forEach((row, k) => {
        const on = k === i;
        row.classList.toggle("is-active", on);
        if (row.hasAttribute("aria-pressed"))
          row.setAttribute("aria-pressed", String(on));
      });
      imgs.forEach((image, k) => image.classList.toggle("is-active", k === i));
    };
    // The rows are only controls while the sticky panel is visible (desktop); on small screens they are plain content.
    const desktop = window.matchMedia("(min-width: 900px)");
    const sync = () =>
      rows.forEach((row, i) => {
        if (desktop.matches) {
          row.setAttribute("role", "button");
          row.setAttribute("tabindex", "0");
          row.setAttribute(
            "aria-pressed",
            String(row.classList.contains("is-active")),
          );
        } else {
          row.removeAttribute("role");
          row.removeAttribute("tabindex");
          row.removeAttribute("aria-pressed");
        }
        if (i === 0 && !rows.some((r) => r.classList.contains("is-active")))
          activate(0);
      });
    rows.forEach((row, i) => {
      row.addEventListener("click", () => activate(i));
      row.addEventListener("focus", () => {
        if (desktop.matches) activate(i);
      });
      row.addEventListener("keydown", (e) => {
        if (desktop.matches && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          activate(i);
        }
      });
      row.addEventListener("pointerenter", (e) => {
        if (e.pointerType === "mouse" && desktop.matches) activate(i);
      });
    });
    activate(0);
    sync();
    if (desktop.addEventListener) desktop.addEventListener("change", sync);
  }

  /* Compare slider: the photo against a clone of itself through the thermal filter ("illustrative thermal view"). */
  function initCompare() {
    if (!live) return;
    $$("[data-compare]").forEach((root) => {
      if ($(".s-cmp__range", root)) return;
      const photo = $(".s-cmp__layer--after .s-cmp__img", root);
      if (!photo) return;
      ensureThermalFilter();
      const layer = el("div", "s-cmp__layer s-cmp__layer--before");
      const heat = el("img", "s-cmp__img");
      cloneImageSource(photo, heat);
      layer.appendChild(heat);
      adaptHeatFilter(root, heat);
      root.appendChild(layer);

      const tagHeat = el("span", "s-cmp__tag s-cmp__tag--before");
      tagHeat.textContent = root.getAttribute("data-label-heat") || "";
      const tagPhoto = el("span", "s-cmp__tag s-cmp__tag--after");
      tagPhoto.textContent = root.getAttribute("data-label-photo") || "";
      const range = el("input", "s-cmp__range", {
        type: "range",
        min: "0",
        max: "100",
        step: "1",
        value: "50",
        "aria-label": root.getAttribute("data-label-range") || "",
      });
      const handle = el("span", "s-cmp__handle", { "aria-hidden": "true" });
      const knob = el("span", "s-cmp__knob");
      const chevron = (d) =>
        '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="' +
        d +
        '"/></svg>';
      knob.innerHTML = chevron("m15 6-6 6 6 6") + chevron("m9 6 6 6-6 6");
      handle.appendChild(knob);
      [tagHeat, tagPhoto, range, handle].forEach((node) =>
        root.appendChild(node),
      );

      const set = () => root.style.setProperty("--pos", range.value + "%");
      range.addEventListener("input", set);
      set();
    });
  }

  /* === END REGION: SERVICE =============================== */

  /* === REGION: LOCATION (location agent) ================= */
  /* Page-specific UI of the location page (prototype motion-location.js "Part 1").
     Contracts: [data-signs] with [role=checkbox] chips, [data-signs-sum], [data-signs-title], [data-signs-text],
     optional [data-signs-urgent] (shown when a chip with data-urgent is on; keep its `hidden` attribute in the markup),
     [data-signs-clear]. Translated text via data attributes on [data-signs]:
       data-on-title="That is worth a call."
       data-on-text="You noticed {signs}. Damage you can see is often a small part of what is wet..."
       data-and="and"
     [data-near-pill]: nearby-town pills with a pointer-following light.
     [data-blocks] (the per-service city tabs): the tab list is built from the services that exist, and a deleted
       service can remove its tab AND panel from a saved page, so initBlocks() makes sure one tab is selected. */

  function initBlocks() {
    if (!live) return;
    $$("[data-blocks]").forEach((root) => {
      const tabs = $$('[role="tab"]', root);
      if (
        !tabs.length ||
        tabs.some((tab) => tab.getAttribute("aria-selected") === "true")
      )
        return;
      tabs[0].click();
    });
  }

  function initSigns() {
    if (!live) return;
    const root = $("[data-signs]");
    if (!root) return;
    const chips = $$('[role="checkbox"]', root);
    const sum = $("[data-signs-sum]", root);
    const title = $("[data-signs-title]", root);
    const text = $("[data-signs-text]", root);
    const urgent = $("[data-signs-urgent]", root);
    const clear = $("[data-signs-clear]", root);
    if (!chips.length || !sum || !title || !text) return;

    const idle = { title: title.textContent, text: text.textContent };
    const onTitle = root.dataset.onTitle || "That is worth a call.";
    const onText =
      root.dataset.onText ||
      "You noticed {signs}. Damage you can see is often a small part of what is wet, so a moisture check is the sensible next step.";
    const andWord = root.dataset.and || "and";
    const label = (chip) => {
      if (chip.dataset.phrase) return chip.dataset.phrase;
      const s = chip.textContent.replace(/\s+/g, " ").trim();
      return s.charAt(0).toLowerCase() + s.slice(1);
    };
    const join = (items) =>
      items.length < 2
        ? items.join("")
        : items.slice(0, -1).join(", ") +
          " " +
          andWord +
          " " +
          items[items.length - 1];
    const isOn = (chip) => chip.getAttribute("aria-checked") === "true";

    const update = (pulse) => {
      const on = chips.filter(isOn);
      const any = on.length > 0;
      root.classList.toggle("has-signs", any);
      if (any) {
        title.textContent = onTitle;
        text.textContent = onText.replace("{signs}", join(on.map(label)));
      } else {
        title.textContent = idle.title;
        text.textContent = idle.text;
      }
      if (urgent)
        urgent.hidden = !on.some((c) => c.hasAttribute("data-urgent"));
      if (clear) clear.hidden = !any;
      if (pulse) {
        sum.classList.remove("is-pulse");
        void sum.offsetWidth;
        if (any) sum.classList.add("is-pulse");
      }
    };

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chip.setAttribute("aria-checked", String(!isOn(chip)));
        update(true);
      });
    });
    if (clear) {
      clear.addEventListener("click", () => {
        chips.forEach((c) => c.setAttribute("aria-checked", "false"));
        update(false);
        chips[0].focus();
      });
    }
    update(false);
  }

  /* Nearby towns: a light follows the pointer inside each pill */
  function initNearScan() {
    if (!live) return;
    initBlocks(); // boot runs this step last, so every tab list is already wired by initTabs
    $$("[data-near-pill]").forEach((pill) => {
      pill.addEventListener("pointermove", (e) => {
        const b = pill.getBoundingClientRect();
        pill.style.setProperty("--mx", (e.clientX - b.left).toFixed(0) + "px");
        pill.style.setProperty("--my", (e.clientY - b.top).toFixed(0) + "px");
      });
    });
  }

  /* === END REGION: LOCATION ============================== */

  /* === REGION: CORE: boot (foundation agent) ============= */
  function boot(chunked) {
    const steps = [
      initHeader,
      initDropdowns,
      initMenu,
      initAccordions,
      initTabs,
      initLeadForms,
      initCopy,
      initSliders,
      initLinkedHighlights,
      initCallDock,
      markCurrent,
      initAnchors,
      // lens first: page regions below may rely on built DOM
      initScan,
      buildServicePeek,
      buildProcessLens,
      initEstimator,
      initFan,
      initToolLenses,
      initProblems,
      initCompare,
      initSigns,
      initNearScan,
    ];
    const finish = () => {
      window.TH.booted = true;
      window.dispatchEvent(new CustomEvent("th:booted"));
    };
    if (!chunked) {
      steps.forEach((step) => {
        try {
          step();
        } catch (err) {
          console.error("[thermal:" + step.name + "]", err);
        }
      });
      finish();
      return;
    }
    // Top-level windows: the steps run a few milliseconds at a time (one task each) so start-up never makes one long task.
    const next = () => {
      const t0 = performance.now();
      while (steps.length && performance.now() - t0 < 6) {
        const step = steps.shift();
        try {
          step();
        } catch (err) {
          console.error("[thermal:" + step.name + "]", err);
        }
      }
      if (steps.length) window.setTimeout(next, 0);
      else finish();
    };
    next();
  }

  /* Motion libraries: GSAP, ScrollTrigger, SplitText and motion.js are NOT script tags in the page. A top-level window
     loads them from here once the first frame is on screen, so ~75 KB of script (and its evaluation) never sits between
     the browser and the hero photo. They keep their order (async = false). The editor iframe (not `live`) never loads them. */
  const MOTION_FILES = [
    "vendor/gsap.min.js",
    "vendor/ScrollTrigger.min.js",
    "vendor/SplitText.min.js",
    "motion.js",
  ];
  function loadMotion() {
    if (!live || window.gsap) return;
    const tag = selfScript || $('script[src$="js/main.js"]');
    const src = tag && tag.getAttribute("src");
    if (!src) {
      document.documentElement.classList.add("motion-off");
      return;
    }
    MOTION_FILES.forEach((file) => {
      const script = document.createElement("script");
      script.src = src.replace(/main\.js(\?.*)?$/, file);
      script.async = false;
      document.body.appendChild(script);
    });
  }
  /** Run `fn` after the first frame has been painted (a hidden tab, which has no frames, falls back to a timer). */
  function afterPaint(fn) {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      fn();
    };
    window.requestAnimationFrame(() => window.setTimeout(go, 0));
    window.setTimeout(go, 300);
  }
  // Framed (editor): wire the click-driven UI at once, like before. Top-level: first paint, then the UI, then the motion libraries.
  if (!live) {
    if (document.readyState === "loading" && !$("footer"))
      document.addEventListener("DOMContentLoaded", boot);
    else boot();
  } else {
    afterPaint(() => {
      loadMotion();
      boot(true);
    });
  }
  /* === END REGION: CORE: boot ============================ */
})();
