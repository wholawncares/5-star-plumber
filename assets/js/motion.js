/* =========================================================
   Thermal (theme-14): motion layer (GSAP 3 + ScrollTrigger + SplitText)

   FILE MAP (the page agents edit ONLY inside their own region):
     REGION: CORE      foundation agent: TM infra + site-wide effects
     REGION: HOME      home agent: home page sequences
     REGION: SERVICE   service agent: service page sequences
     REGION: LOCATION  location agent: location page sequences
   The page UI logic that must work without GSAP (tool lenses, problems rows, signs
   checklist...) lives in main.js, in the matching region.

   Rules this file follows
   - Nothing is required for content to be readable: no GSAP, no JS, the editor
     iframe, or prefers-reduced-motion all end in the same complete, static page.
     It returns immediately inside an iframe (the site editor's preview).
   - Every effect lives inside gsap.matchMedia() (TM.mm), so it is reverted
     (and inline styles cleared) when its media condition stops matching.
   - Sticky / stacked sequences use CSS `position: sticky` inside an
     explicitly sized parent. ScrollTrigger only reads progress; it never
     pins, so nothing can float over a neighbouring section.
   - Blur is used only while something is moving and always ends at 0.
   - Each page effect no-ops when its selectors are missing, so one file serves every page.
   - DOM built by main.js (lens heat layers, services peek, process lens images) already
     exists when this file runs (main.js runs at the end of <body>, this file is deferred).
   ========================================================= */

/* === REGION: CORE (foundation agent) ===================== */
(function () {
  "use strict";
  const root = document.documentElement;

  // Never run inside the site editor's preview iframe: no TM, so every region below no-ops too.
  if (window.self !== window.top) return;

  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.add("motion-off");
    return;
  }

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const hasSplit = !!window.SplitText;
  gsap.registerPlugin(ScrollTrigger);
  if (hasSplit) gsap.registerPlugin(window.SplitText);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const MQ = {
    motion: "(prefers-reduced-motion: no-preference)",
    reduce: "(prefers-reduced-motion: reduce)",
    full: "(min-width: 900px) and (min-height: 600px) and (prefers-reduced-motion: no-preference)",
    wide: "(min-width: 900px) and (prefers-reduced-motion: no-preference)",
    pointer:
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
  };
  const EASE = { out: "power3.out", expo: "expo.out", io: "power2.inOut" };
  const q = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  /** Call `fn` once, when `el` comes within `margin` of the viewport (or has already been scrolled past). Needs no layout reads. */
  const nearOnce = (el, margin, fn) => {
    if (!("IntersectionObserver" in window)) {
      fn();
      return () => {};
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (
          !entries.some(
            (entry) => entry.isIntersecting || entry.boundingClientRect.top < 0,
          )
        )
          return;
        io.disconnect();
        fn();
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  };

  /* ---- Start-up scheduling -------------------------------------
     Nothing here may delay the first paint / the LCP photo or run as ONE long task. Every effect is still
     registered with mm.add() exactly as before, but the registrations are queued, started after the first frame
     has been painted and run one per task (time-boxed), so a page with dozens of scroll effects never blocks the
     main thread. A hidden tab (no animation frames) starts after 250 ms. */
  const realMm = gsap.matchMedia();
  const queue = [];
  let started = false;
  let draining = false;
  const drain = () => {
    if (draining || !started) return;
    draining = true;
    const step = () => {
      const t0 = performance.now();
      while (queue.length && performance.now() - t0 < 6) {
        const job = queue.shift();
        try {
          job();
        } catch (err) {
          console.error("[motion]", err);
        }
      }
      if (queue.length) window.setTimeout(step, 0);
      else draining = false;
    };
    step();
  };
  const start = () => {
    if (started) return;
    started = true;
    drain();
  };
  // Headlines are measured and split by the first jobs: do that once the web font is in (a split measured on the fallback font would
  // re-wrap when Instrument Sans arrives), but never wait longer than 700 ms for it.
  const fontsReady =
    document.fonts && document.fonts.ready
      ? Promise.race([
          document.fonts.ready,
          new Promise((resolve) => window.setTimeout(resolve, 700)),
        ])
      : Promise.resolve();
  const mm = {
    add(query, setup) {
      queue.push(() => realMm.add(query, setup));
      drain();
    },
    /** Run a plain function in the same queue (after the effects registered before it). */
    run(fn) {
      queue.push(fn);
      drain();
    },
  };
  // main.js builds the JS-made elements (lens layers, process / peek images, town pills) in chunks; the effects below look for them,
  // so they are registered only once it has finished (it cannot fail to: a 2.5 s timer releases us anyway).
  const bootDone = new Promise((resolve) => {
    if (!window.TH || window.TH.booted) {
      resolve();
      return;
    }
    window.addEventListener("th:booted", () => resolve(), { once: true });
    window.setTimeout(resolve, 2500);
  });
  const go = () => Promise.all([fontsReady, bootDone]).then(start);
  window.requestAnimationFrame(() => window.setTimeout(go, 0));
  window.setTimeout(go, 250);

  /* ---- Refresh handling --------------------------------- */
  let refreshTimer = 0;
  const refresh = () => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 120);
  };
  window.addEventListener("load", refresh);
  window.addEventListener("layout:change", refresh);
  window.addEventListener("orientationchange", refresh);
  if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(refresh);
  /* Sections below the fold are skipped until they approach the viewport (content-visibility: auto, base.css), so their real
     height only appears when they are first rendered; every such size change re-measures ScrollTrigger (debounced), otherwise
     the triggers under that section would stay at placeholder positions. */
  if ("ResizeObserver" in window) {
    const seen = new WeakSet();
    const watcher = new ResizeObserver((entries) => {
      let changed = false;
      entries.forEach((entry) => {
        if (seen.has(entry.target)) changed = true;
        else seen.add(entry.target);
      });
      if (changed) refresh();
    });
    window.setTimeout(() => {
      q("main > section, .site-footer").forEach((section) => {
        if (getComputedStyle(section).contentVisibility === "auto")
          watcher.observe(section);
      });
    }, 0);
  }
  // Lazy images do not move anything: every <img> has width/height and sits in an aspect-ratio frame, so there is no refresh per image.

  /* ---- Public helpers ----------------------------------- */
  const TM = { gsap, ScrollTrigger, mm, MQ, EASE, q, refresh, hasSplit };
  window.TM = TM;

  /** Scroll progress (0..1) of `section` through its own sticky runway. Safe: read-only. */
  TM.runway = function (section, onUpdate, opts = {}) {
    return ScrollTrigger.create({
      trigger: section,
      start: opts.start || "top top",
      end: opts.end || "bottom bottom",
      onUpdate: (self) => onUpdate(self.progress, self),
      onRefresh: (self) => onUpdate(self.progress, self),
    });
  };

  /** Blur that only exists while moving: tween helper that always settles at 0. */
  TM.blurTo = function (targets, amount, dur = 0.5) {
    return gsap.fromTo(
      targets,
      { filter: `blur(${amount}px)` },
      {
        filter: "blur(0px)",
        duration: dur,
        ease: EASE.out,
        clearProps: "filter",
        overwrite: "auto",
      },
    );
  };

  /** Split a heading into masked lines and reveal them. Returns the SplitText instance (or null). */
  TM.splitLines = function (el, vars = {}) {
    if (!hasSplit) return null;
    return window.SplitText.create(el, {
      type: "lines",
      mask: "lines",
      linesClass: "split-line",
      aria: "none",
      autoSplit: true,
      ...vars,
    });
  };

  /* ---- Site-wide effects -------------------------------- */
  function initCore() {
    /* Reduced motion / no motion: open everything immediately */
    mm.add(MQ.reduce, () => {
      q("[data-reveal]").forEach((el) => el.classList.add("is-in"));
    });

    mm.add(MQ.motion, () => {
      /* 1. Scroll reveals: soft rise with a short blur that always clears */
      // Hidden by CSS (.js [data-reveal]) until their turn. One IntersectionObserver instead of a ScrollTrigger per element:
      // nothing is measured, so registering a page's worth of reveals costs no layout. Elements enter in batches of up to 6,
      // 80 ms apart, once the top of the element is above the 90% line of the viewport (like the batch it replaces).
      const items = q("[data-reveal]");
      const pending = [];
      let timer = 0;
      const flush = () => {
        timer = 0;
        const batch = pending.splice(0, 6);
        if (batch.length) {
          gsap.fromTo(
            batch,
            { y: 28, opacity: 0, filter: "blur(6px)" },
            {
              y: 0,
              opacity: 1,
              filter: "blur(0px)",
              duration: 0.9,
              ease: EASE.out,
              stagger: 0.09,
              clearProps: "filter,transform",
              onStart() {
                batch.forEach((b) => b.classList.add("is-in"));
              },
            },
          );
        }
        if (pending.length) timer = window.setTimeout(flush, 80);
      };
      const waiting = new Set(items);
      // An observer only reports CHANGES, so an element that a fast scroll or an anchor jump carries from below the viewport to above
      // it without a frame in between is never reported. Once scrolling pauses, whatever lies above the viewport is shown (no animation).
      let sweepTimer = 0;
      const sweep = () => {
        waiting.forEach((el) => {
          if (el.getBoundingClientRect().bottom < 0) {
            waiting.delete(el);
            watcher.unobserve(el);
            el.classList.add("is-in");
          }
        });
        if (!waiting.size) window.removeEventListener("scroll", onScroll);
      };
      const onScroll = () => {
        window.clearTimeout(sweepTimer);
        sweepTimer = window.setTimeout(sweep, 250);
      };
      const watcher =
        "IntersectionObserver" in window
          ? new IntersectionObserver(
              (entries) => {
                entries.forEach((entry) => {
                  if (entry.isIntersecting) {
                    waiting.delete(entry.target);
                    watcher.unobserve(entry.target);
                    pending.push(entry.target);
                  } else if (entry.boundingClientRect.top < 0) {
                    waiting.delete(entry.target);
                    watcher.unobserve(entry.target);
                    entry.target.classList.add("is-in");
                  } // already scrolled past: no animation
                });
                if (pending.length && !timer)
                  timer = window.setTimeout(flush, 80);
              },
              { rootMargin: "0px 0px -10% 0px" },
            )
          : null;
      if (watcher) {
        items.forEach((el) => watcher.observe(el));
        window.addEventListener("scroll", onScroll, { passive: true });
      } else items.forEach((el) => el.classList.add("is-in"));
      return () => {
        if (watcher) watcher.disconnect();
        window.removeEventListener("scroll", onScroll);
        window.clearTimeout(timer);
        window.clearTimeout(sweepTimer);
        items.forEach((el) => el.classList.add("is-in"));
      };
    });

    mm.add(MQ.motion, () => {
      /* 2. Headline line masks.
         The hero headline (data-split-now) is above the fold, so splitting it must not move anything: its width is
         frozen while it is split (a shrink-to-fit grid item would otherwise narrow to its widest line and re-wrap),
         and the split is reverted when the reveal ends. Headings below the fold are split lazily and are off-screen. */
      const splitCleanups = [];
      q("[data-split]").forEach((el) => {
        if (!hasSplit) return;
        const now = el.hasAttribute("data-split-now");
        // The width is frozen while a heading is split (a shrink-to-fit grid item would otherwise narrow to its widest line and re-wrap
        // when the split is reverted: a layout shift). +2px on the hero headline: split words add sub-pixel widths that must not
        // re-wrap a headline that fits on one line.
        // The height is frozen too: split lines are blocks, so `text-wrap: balance` can choose fewer lines for the split heading than for
        // the plain one, and reverting would then change the height of everything below it (a layout shift while it is on screen).
        const lock = () => {
          const box = el.getBoundingClientRect();
          el.style.width = Math.ceil(box.width) + (now ? 2 : 0) + "px";
          el.style.minHeight = box.height + "px";
        };
        const unlock = () => {
          el.style.removeProperty("width");
          el.style.removeProperty("min-height");
        };
        let done = false;
        const run = () => {
          if (done) return;
          done = true;
          lock();
          const split = TM.splitLines(el, {
            onSplit(self) {
              return gsap.from(self.lines, {
                yPercent: 112,
                duration: 1.05,
                ease: EASE.expo,
                stagger: 0.09,
                scrollTrigger: now
                  ? undefined
                  : { trigger: el, start: "top 88%", once: true },
                delay: now ? 0.15 : 0,
                onComplete: () => {
                  try {
                    self.revert();
                  } catch (_e) {
                    /* already reverted */
                  }
                  unlock();
                }, // back to plain text: no masks left behind
              });
            },
          });
          splitCleanups.push(() => {
            try {
              if (split) split.revert();
            } catch (_e) {
              /* noop */
            }
            unlock();
          });
        };
        // Splitting measures the heading (a forced layout), so only the hero headline is split at start-up; the others are split
        // while still well below the viewport (700px early), so the reveal looks the same and start-up does one split instead of dozens.
        if (now) run();
        else splitCleanups.push(nearOnce(el, "0px 0px 700px 0px", run));
      });
      return () => splitCleanups.forEach((fn) => fn());
    });

    mm.add(MQ.motion, () => {
      /* 3. Parallax photographs, strictly inside their clipped frame */
      q("[data-parallax]").forEach((img) => {
        const amount = parseFloat(img.dataset.parallax) || 0.1;
        gsap.fromTo(
          img,
          { yPercent: -amount * 100, scale: 1 + amount * 2.2 },
          {
            yPercent: amount * 100,
            ease: "none",
            scrollTrigger: {
              trigger:
                img.closest(".media, [data-parallax-frame]") ||
                img.parentElement,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.6,
            },
          },
        );
      });
    });

    /* 3b. Interior page hero stage (about, services, areas...): comes into focus like the service hero */
    mm.add(MQ.motion, () => {
      const stage = q(".p-hero__stage")[0];
      if (!stage) return;
      gsap.from(stage, {
        clipPath: "inset(9% 13% 9% 13% round 110px)",
        scale: 0.95,
        filter: "blur(12px)",
        duration: 1.6,
        ease: EASE.expo,
        delay: 0.2,
        clearProps: "clipPath,filter,transform",
      });
    });

    /* 4. Playful magnetic buttons (fine pointers only) */
    mm.add(MQ.pointer, () => {
      const cleanups = [];
      q("[data-magnetic]").forEach((el) => {
        const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" });
        const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" });
        const move = (e) => {
          const b = el.getBoundingClientRect();
          xTo((e.clientX - (b.left + b.width / 2)) * 0.18);
          yTo((e.clientY - (b.top + b.height / 2)) * 0.28);
        };
        const leave = () => {
          xTo(0);
          yTo(0);
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerleave", leave);
        cleanups.push(() => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerleave", leave);
          gsap.set(el, { clearProps: "x,y" });
        });
      });
      return () => cleanups.forEach((fn) => fn());
    });
  }

  try {
    initCore();
    mm.run(() => {
      // headings (hidden until now) are released as soon as the core effects above have run
      root.classList.add("motion-ready");
      window.dispatchEvent(new CustomEvent("motion:core-ready"));
    });
  } catch (err) {
    console.error("[motion-core]", err);
    root.classList.add("motion-off");
  }
})();
/* === END REGION: CORE ===================================== */

/* === REGION: HOME (home agent) ============================ */
(function () {
  "use strict";
  const TM = window.TM;
  if (!TM) return;
  const { gsap, ScrollTrigger, mm, MQ, EASE, q } = TM;
  const DESK_POINTER =
    "(hover: hover) and (pointer: fine) and (min-width: 900px) and (prefers-reduced-motion: no-preference)";
  const clamp = gsap.utils.clamp;

  try {
    /* Hero stage: its focus-in is a CSS animation (sections.css), so it starts at first paint and never waits for GSAP */

    /* ---- About: the heat bloom drifts together as you scroll */
    mm.add(MQ.motion, () => {
      const blobs = q(".goo-blob");
      const trigger = q(".about__collage")[0];
      if (!blobs.length || !trigger) return;
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger,
          start: "top 90%",
          end: "bottom 10%",
          scrub: 0.9,
        },
      });
      tl.fromTo(blobs[0], { x: -60, y: 50 }, { x: 40, y: -40, ease: "none" }, 0)
        .fromTo(blobs[1], { x: 90, y: -40 }, { x: -20, y: 60, ease: "none" }, 0)
        .fromTo(blobs[2], { x: -20, y: 90 }, { x: 70, y: -50, ease: "none" }, 0)
        .fromTo(
          blobs[3],
          { x: 60, y: 40 },
          { x: -80, y: -30, ease: "none" },
          0,
        );
    });

    /* ---- Bento tiles rise in with a short blur ----------- */
    // (handled by [data-reveal] in motion-core)

    /* ---- Services: pointer-following preview with velocity blur */
    mm.add(DESK_POINTER, () => {
      const section = q("[data-svc]")[0];
      const peek = q("[data-svc-peek]")[0];
      const list = q("[data-svc-index]")[0];
      if (!section || !peek || !list) return;
      const frame = q(".svc-peek__frame", peek)[0];
      const imgs = q(".svc-peek__img", peek);
      gsap.set(peek, {
        xPercent: -50,
        yPercent: -50,
        opacity: 0,
        scale: 0.7,
        x: 0,
        y: 0,
      });
      const xTo = gsap.quickTo(peek, "x", { duration: 0.55, ease: "power3" });
      const yTo = gsap.quickTo(peek, "y", { duration: 0.55, ease: "power3" });
      const rTo = gsap.quickTo(peek, "rotation", {
        duration: 0.7,
        ease: "power3",
      });
      const bTo = gsap.quickTo(frame, "--blur", {
        duration: 0.25,
        ease: "power2",
      });
      frame.style.filter = "blur(calc(var(--blur, 0) * 1px))";
      let last = null;
      let settle = 0;

      const onMove = (e) => {
        const b = section.getBoundingClientRect();
        const lr = list.getBoundingClientRect();
        // the preview lives in the empty gutter at the right of the list and only follows the pointer vertically,
        // so it never covers the service names or descriptions
        const x = lr.right - b.left - peek.offsetWidth / 2 - 24;
        const y = e.clientY - b.top;
        xTo(x);
        yTo(y);
        if (last) {
          const dx = e.clientX - last.x;
          const dy = e.clientY - last.y;
          rTo(clamp(-7, 7, dy * 0.22));
          bTo(clamp(0, 9, Math.hypot(dx, dy) * 0.16));
        }
        last = { x: e.clientX, y: e.clientY };
        window.clearTimeout(settle);
        settle = window.setTimeout(() => {
          bTo(0);
          rTo(0);
        }, 90);
      };
      const show = (key) => {
        imgs.forEach((im) =>
          im.classList.toggle("is-active", im.dataset.peek === key),
        );
        gsap.to(peek, {
          opacity: 1,
          scale: 1,
          duration: 0.5,
          ease: EASE.out,
          overwrite: "auto",
        });
      };
      const hide = () =>
        gsap.to(peek, {
          opacity: 0,
          scale: 0.8,
          duration: 0.35,
          ease: EASE.out,
          overwrite: "auto",
        });

      const rows = q(".svc-index__item", list);
      const enters = rows.map((row) => {
        const fn = () => show(row.dataset.peekKey);
        row.addEventListener("pointerenter", fn);
        return fn;
      });
      list.addEventListener("pointermove", onMove);
      list.addEventListener("pointerleave", hide);
      return () => {
        rows.forEach((row, i) =>
          row.removeEventListener("pointerenter", enters[i]),
        );
        list.removeEventListener("pointermove", onMove);
        list.removeEventListener("pointerleave", hide);
        window.clearTimeout(settle);
        gsap.set(peek, { clearProps: "all" });
        frame.style.removeProperty("filter");
        frame.style.removeProperty("--blur");
      };
    });

    /* ---- Process: sticky lens with a ring that fills as the job runs */
    mm.add(MQ.full, () => {
      const section = q("[data-process]")[0];
      if (!section) return;
      const steps = q(".process__step", section);
      const imgs = q(".process__lens-img", section);
      const lens = q("[data-process-lens]", section)[0];
      const media = q(".process__lens-media", section)[0];
      const runway = q(".process__runway", section)[0];
      if (!steps.length || !lens) return;
      section.classList.add("is-enhanced");
      let active = 0;

      const setActive = (i) => {
        if (i === active) return;
        imgs[active].classList.remove("is-active");
        imgs[i].classList.add("is-active");
        steps.forEach((s, k) => s.classList.toggle("is-active", k === i));
        gsap.fromTo(
          media,
          { filter: "blur(7px)" },
          {
            filter: "blur(0px)",
            duration: 0.9,
            ease: EASE.out,
            clearProps: "filter",
            overwrite: "auto",
          },
        );
        active = i;
      };
      steps.forEach((step, i) => {
        ScrollTrigger.create({
          trigger: step,
          start: "top 58%",
          end: "bottom 58%",
          onToggle: (self) => self.isActive && setActive(i),
        });
      });
      ScrollTrigger.create({
        trigger: runway,
        start: "top 62%",
        end: "bottom 62%",
        onUpdate: (self) =>
          lens.style.setProperty("--p", self.progress.toFixed(4)),
        onRefresh: (self) =>
          lens.style.setProperty("--p", self.progress.toFixed(4)),
      });
      TM.refresh();

      return () => {
        section.classList.remove("is-enhanced");
        lens.style.removeProperty("--p");
        imgs.forEach((im, k) => im.classList.toggle("is-active", k === 0));
        steps.forEach((s, k) => s.classList.toggle("is-active", k === 0));
        TM.refresh();
      };
    });

    /* ---- Service area: the photo opens like a lens ------- */
    mm.add(MQ.wide, () => {
      const frame = q("[data-area-frame]")[0];
      if (!frame) return;
      const img = q(".area__img", frame)[0];
      const card = q("[data-area-card]", frame)[0];
      gsap.fromTo(
        frame,
        { clipPath: "inset(12% 17% 12% 17% round 240px)" },
        {
          clipPath: "inset(0% 0% 0% 0% round 56px)",
          ease: "none",
          clearProps: "clipPath",
          scrollTrigger: {
            trigger: frame,
            start: "top 94%",
            end: "top 28%",
            scrub: 0.6,
          },
        },
      );
      gsap.fromTo(
        img,
        { scale: 1.3 },
        {
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: frame,
            start: "top 94%",
            end: "bottom 40%",
            scrub: 0.6,
          },
        },
      );
      gsap.from(card, {
        y: 48,
        opacity: 0,
        filter: "blur(8px)",
        duration: 1,
        ease: EASE.out,
        clearProps: "all",
        scrollTrigger: { trigger: frame, start: "top 40%", once: true },
      });
    });

    /* ---- Locations: rings open, towns appear ------------- */
    mm.add(MQ.motion, () => {
      const map = q("[data-loc-map]")[0];
      if (!map) return;
      const st = { trigger: map, start: "top 78%", once: true };
      gsap.from(q(".loc__ring", map), {
        scale: 0.55,
        opacity: 0,
        transformOrigin: "50% 50%",
        stagger: 0.12,
        duration: 1.4,
        ease: EASE.expo,
        clearProps: "all",
        scrollTrigger: st,
      });
      gsap.from(q(".loc__pin", map), {
        opacity: 0,
        filter: "blur(8px)",
        stagger: 0.08,
        duration: 0.9,
        ease: EASE.out,
        delay: 0.25,
        clearProps: "opacity,filter",
        scrollTrigger: st,
      });
    });

    /* ---- CTA: gooey heat bloom merges as you scroll ------ */
    mm.add(MQ.motion, () => {
      const section = q("[data-cta]")[0];
      if (!section) return;
      const [a, b, c, d] = ["a", "b", "c", "d"].map(
        (k) => q(".cta__blob--" + k, section)[0],
      );
      if (!a) return;
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top 92%",
          end: "bottom 8%",
          scrub: 1,
        },
      });
      tl.fromTo(a, { x: -140, y: 70 }, { x: 330, y: -90, ease: "none" }, 0)
        .fromTo(b, { x: 220, y: -60 }, { x: -60, y: 90, ease: "none" }, 0)
        .fromTo(c, { x: 90, y: 40 }, { x: -380, y: -60, ease: "none" }, 0)
        .fromTo(d, { x: -120, y: 100 }, { x: -260, y: -80, ease: "none" }, 0);
    });
    mm.add(DESK_POINTER, () => {
      const panel = q(".cta__panel")[0];
      const blob = q(".cta__blob--b")[0];
      if (!panel || !blob) return;
      const svg = q(".cta__goo", panel)[0];
      const xTo = gsap.quickTo(blob, "attr:cx", {
        duration: 1.2,
        ease: "power3",
      });
      const yTo = gsap.quickTo(blob, "attr:cy", {
        duration: 1.2,
        ease: "power3",
      });
      const move = (e) => {
        const r = svg.getBoundingClientRect();
        xTo(((e.clientX - r.left) / r.width) * 1200);
        yTo(((e.clientY - r.top) / r.height) * 600);
      };
      panel.addEventListener("pointermove", move);
      return () => {
        panel.removeEventListener("pointermove", move);
        blob.setAttribute("cx", 520);
        blob.setAttribute("cy", 150);
      };
    });
  } catch (err) {
    console.error("[motion-home]", err);
  }
})();
/* === END REGION: HOME ===================================== */

/* === REGION: SERVICE (service agent) ====================== */
(function () {
  "use strict";
  const TM = window.TM;
  if (!TM) return;
  const { gsap, ScrollTrigger, mm, MQ, EASE, q } = TM;
  const DESK_POINTER =
    "(hover: hover) and (pointer: fine) and (min-width: 900px) and (prefers-reduced-motion: no-preference)";
  /* The sticky use-case stack needs room for a whole card (real copy is longer than the prototype's): shorter or narrower
     windows keep the plain list of cards, so no text is ever clipped. */
  const STACK_MQ =
    "(min-width: 900px) and (min-height: 740px) and (prefers-reduced-motion: no-preference)";

  try {
    /* ---- Hero: the wide stage comes into focus, chips float, the lens sweeps once */
    mm.add(MQ.motion, () => {
      const stage = q("[data-s-stage]")[0];
      if (!stage) return;
      const base = q(".scan__base", stage)[0];
      const heat = q(".scan__heat-img", stage)[0];
      const chips = q(".s-hero__chip", stage);

      gsap.from(stage, {
        clipPath: "inset(9% 13% 9% 13% round 110px)",
        scale: 0.93,
        filter: "blur(14px)",
        duration: 1.8,
        ease: EASE.expo,
        delay: 0.25,
        clearProps: "clipPath,filter,transform",
      });
      gsap.from([base, heat].filter(Boolean), {
        scale: 1.2,
        duration: 2.3,
        ease: EASE.expo,
        delay: 0.25,
        clearProps: "transform",
      });
      gsap.from(chips, {
        opacity: 0,
        scale: 0.85,
        filter: "blur(8px)",
        duration: 0.9,
        ease: EASE.out,
        stagger: 0.14,
        delay: 1.1,
        clearProps: "opacity,filter,transform",
      });
      chips.forEach((chip, i) => {
        gsap.to(chip, {
          y: i % 2 ? 9 : -9,
          duration: 3 + i * 0.7,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          delay: 2 + i * 0.3,
        });
      });

      /* One lens sweep across the photo so the hover effect announces itself */
      const prox = { x: 0.1, r: 0 };
      const paint = () => {
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        stage.style.setProperty("--lx", (prox.x * w).toFixed(1) + "px");
        stage.style.setProperty(
          "--ly",
          ((0.56 + 0.07 * Math.sin(prox.x * 7)) * h).toFixed(1) + "px",
        );
        stage.style.setProperty(
          "--lr",
          (Math.max(70, Math.min(w * 0.24, 150)) * prox.r).toFixed(1) + "px",
        );
      };
      const sweep = gsap.timeline({ delay: 2.3, onUpdate: paint });
      sweep
        .to(prox, { r: 1, duration: 0.7, ease: EASE.out }, 0)
        .to(prox, { x: 0.9, duration: 3.2, ease: "power2.inOut" }, 0)
        .to(prox, { r: 0, duration: 0.8, ease: "power2.in" }, 2.5);
      const stopSweep = () => {
        sweep.kill();
      };
      stage.addEventListener("pointerenter", stopSweep, { once: true });
      stage.addEventListener("pointerdown", stopSweep, { once: true });
      return () => {
        stage.removeEventListener("pointerenter", stopSweep);
        stage.removeEventListener("pointerdown", stopSweep);
        stage.style.setProperty("--lr", "0px");
      };
    });

    /* ---- Audience: the two panels open like windows ------- */
    mm.add(MQ.motion, () => {
      q(".s-aud__panel").forEach((panel) => {
        const st = { trigger: panel, start: "top 86%", once: true };
        gsap.from(panel, {
          clipPath: "inset(7% 5% 7% 5% round 80px)",
          scale: 0.96,
          duration: 1.5,
          ease: EASE.expo,
          clearProps: "clipPath,transform",
          scrollTrigger: st,
        });
        gsap.from(q(".s-aud__card", panel), {
          y: 44,
          opacity: 0,
          filter: "blur(8px)",
          duration: 1,
          ease: EASE.out,
          delay: 0.25,
          clearProps: "opacity,filter,transform",
          scrollTrigger: st,
        });
      });
    });

    /* ---- Overview: the heat bar beside the pull quote draws ---- */
    mm.add(MQ.motion, () => {
      const quote = q(".s-over__quote")[0];
      if (!quote) return;
      gsap.fromTo(
        quote,
        { "--bar": 0 },
        {
          "--bar": 1,
          ease: "none",
          scrollTrigger: {
            trigger: quote,
            start: "top 88%",
            end: "bottom 60%",
            scrub: 0.6,
          },
        },
      );
    });

    /* ---- Process: the thread draws as you scroll ---------- */
    mm.add(MQ.motion, () => {
      const section = q("[data-s-proc]")[0];
      if (!section) return;
      const track = q("[data-s-track]", section)[0];
      const steps = q("[data-s-step]", section);
      const nodes = steps.map((s) => q(".s-proc__node", s)[0]);
      if (!track || !steps.length || nodes.some((n) => !n)) return;
      /* The animated thread is built here (never server-rendered), so the editor and the saved HTML never hold it. */
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "s-proc__thread");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      svg.innerHTML =
        '<defs><linearGradient id="sProcHeat" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="1000">' +
        '<stop offset="0" style="stop-color:var(--heat-violet)"/><stop offset=".3" style="stop-color:var(--heat-magenta)"/><stop offset=".55" style="stop-color:var(--heat-rose)"/>' +
        '<stop offset=".8" style="stop-color:var(--heat-orange)"/><stop offset="1" style="stop-color:var(--heat-yellow)"/></linearGradient></defs>' +
        '<path class="s-proc__thread-base" d="M0 0"/><path class="s-proc__thread-draw" d="M0 0"/>';
      track.insertBefore(svg, track.firstChild);
      const base = q(".s-proc__thread-base", svg)[0];
      const draw = q(".s-proc__thread-draw", svg)[0];
      const grad = q("#sProcHeat", svg)[0];

      let lastSignature = "";
      let len = 1;
      let samples = [];
      let nodeY = [];
      let height = 1;
      const prox = { p: 0 };

      const build = () => {
        const tb = track.getBoundingClientRect();
        height = tb.height;
        const pts = nodes.map((n) => {
          const b = n.getBoundingClientRect();
          return {
            x: b.left + b.width / 2 - tb.left,
            y: b.top + b.height / 2 - tb.top,
          };
        });
        nodeY = pts.map((p) => p.y);
        // refreshes and resizes call build() often; rebuilding the path + its samples is only needed when the geometry really changed
        const signature =
          tb.width.toFixed(0) +
          "x" +
          tb.height.toFixed(0) +
          ":" +
          pts.map((p) => p.x.toFixed(0) + "," + p.y.toFixed(0)).join(";");
        if (signature === lastSignature) return;
        lastSignature = signature;
        const amp = Math.min(64, tb.width * 0.055);
        let d = `M ${pts[0].x.toFixed(1)} ${Math.max(0, pts[0].y - 70).toFixed(1)} L ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          const dy = b.y - a.y;
          const dir = i % 2 ? -1 : 1;
          d += ` C ${(a.x + dir * amp).toFixed(1)} ${(a.y + dy * 0.35).toFixed(1)}, ${(b.x - dir * amp).toFixed(1)} ${(a.y + dy * 0.65).toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
        }
        const last = pts[pts.length - 1];
        d += ` L ${last.x.toFixed(1)} ${Math.min(tb.height, last.y + 70).toFixed(1)}`;
        svg.setAttribute(
          "viewBox",
          `0 0 ${tb.width.toFixed(1)} ${tb.height.toFixed(1)}`,
        );
        base.setAttribute("d", d);
        draw.setAttribute("d", d);
        if (grad) {
          grad.setAttribute("y2", tb.height.toFixed(1));
        }
        len = draw.getTotalLength();
        draw.style.strokeDasharray = len + " " + (len + 2);
        samples = [];
        const N = 72;
        for (let i = 0; i <= N; i++) {
          const l = (len * i) / N;
          samples.push([draw.getPointAtLength(l).y, l]);
        }
      };
      const lenAtY = (y) => {
        if (y <= samples[0][0]) return 0;
        for (let i = 1; i < samples.length; i++) {
          if (y <= samples[i][0]) {
            const [y0, l0] = samples[i - 1];
            const [y1, l1] = samples[i];
            return y1 === y0 ? l1 : l0 + ((y - y0) / (y1 - y0)) * (l1 - l0);
          }
        }
        return len;
      };
      const apply = () => {
        const front = prox.p * height;
        draw.style.strokeDashoffset = String(len - lenAtY(front));
        steps.forEach((s, i) =>
          s.classList.toggle("is-reached", front >= nodeY[i] - 4),
        );
      };
      const setP = gsap.quickTo(prox, "p", {
        duration: 0.55,
        ease: "power2.out",
        onUpdate: apply,
      });

      section.classList.add("is-threaded");
      build();
      apply();
      const st = ScrollTrigger.create({
        trigger: track,
        start: "top 62%",
        end: "bottom 62%",
        onUpdate: (self) => setP(self.progress),
        onRefresh: (self) => {
          build();
          prox.p = self.progress;
          apply();
        },
      });
      let ro;
      if ("ResizeObserver" in window) {
        ro = new ResizeObserver(() => {
          build();
          apply();
        });
        ro.observe(track);
      }
      TM.refresh();

      return () => {
        st.kill();
        if (ro) ro.disconnect();
        section.classList.remove("is-threaded");
        svg.remove();
        steps.forEach((s) => s.classList.remove("is-reached"));
      };
    });

    /* ---- Tools: lenses rise in one after another ---------- */
    mm.add(MQ.motion, () => {
      const row = q(".s-tools__row")[0];
      const items = q("[data-s-tool]");
      if (!row || !items.length) return;
      gsap.from(items, {
        y: 70,
        opacity: 0,
        filter: "blur(10px)",
        duration: 1.2,
        ease: EASE.out,
        stagger: 0.13,
        clearProps: "opacity,filter,transform",
        scrollTrigger: { trigger: row, start: "top 84%", once: true },
      });
    });

    /* ---- Cases: bounded sticky stack ----------------------
       CSS does the sticking (inside .s-cases__stack, which has an explicit height).
       JS only adds .is-enhanced and scales / softens earlier cards as the next one arrives. */
    mm.add(STACK_MQ, () => {
      const section = q("[data-s-cases]")[0];
      const stack = q("[data-s-stack]")[0];
      if (!section || !stack) return;
      const cards = q("[data-s-case]", stack);
      if (cards.length < 2) return;
      section.classList.add("is-enhanced");
      cards.forEach((c, i) => c.style.setProperty("--i", String(i)));
      const arrive = cards.map(() => 0);

      const apply = () => {
        cards.forEach((card, j) => {
          let depth = 0;
          for (let k = j + 1; k < cards.length; k++) depth += arrive[k];
          const blur = Math.min(depth, 1) * 3 + Math.max(0, depth - 1) * 0.8;
          gsap.set(card, {
            scale: 1 - 0.045 * depth,
            filter:
              blur > 0.05
                ? `blur(${blur.toFixed(2)}px) brightness(${(1 - 0.025 * depth).toFixed(3)})`
                : "none",
          });
        });
      };
      const topOf = (i) => parseFloat(getComputedStyle(cards[i]).top) || 0;
      const absTop = () => stack.getBoundingClientRect().top + window.scrollY;

      const triggers = [];
      cards.forEach((card, i) => {
        if (!i) return;
        triggers.push(
          ScrollTrigger.create({
            // card i meets the bottom edge of card i-1  ->  card i has settled on its own sticky line
            start: () =>
              absTop() +
              i * cards[0].offsetHeight -
              (topOf(i - 1) + cards[i - 1].offsetHeight + 40),
            end: () => absTop() + i * cards[0].offsetHeight - topOf(i),
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              arrive[i] = self.progress;
              apply();
            },
            onRefresh: (self) => {
              arrive[i] = self.progress;
              apply();
            },
          }),
        );
      });
      apply();
      TM.refresh();

      return () => {
        triggers.forEach((t) => t.kill());
        section.classList.remove("is-enhanced");
        cards.forEach((c) => {
          c.style.removeProperty("--i");
          gsap.set(c, { clearProps: "transform,filter,scale" });
        });
        TM.refresh();
      };
    });

    /* ---- Local: pills pop in and float; frame opens ------- */
    mm.add(MQ.motion, () => {
      const figure = q(".s-local__figure")[0];
      if (!figure) return;
      const frame = q(".s-local__frame", figure)[0];
      const pills = q(".s-local__pill", figure);
      const st = { trigger: figure, start: "top 82%", once: true };
      gsap.from(frame, {
        clipPath: "inset(6% 8% 6% 8% round 90px)",
        scale: 0.95,
        duration: 1.5,
        ease: EASE.expo,
        clearProps: "clipPath,transform",
        scrollTrigger: st,
      });
      gsap.from(pills, {
        opacity: 0,
        scale: 0.7,
        filter: "blur(8px)",
        duration: 0.9,
        ease: EASE.out,
        stagger: 0.15,
        delay: 0.5,
        clearProps: "opacity,filter,transform",
        scrollTrigger: st,
      });
      pills.forEach((pill, i) => {
        gsap.to(pill, {
          y: i % 2 ? 12 : -12,
          duration: 3.2 + i * 0.6,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          delay: 1.8 + i * 0.2,
        });
      });
    });

    /* ---- Compare: the divider glides to the middle once --- */
    mm.add(MQ.motion, () => {
      const root = q("[data-s-compare]")[0];
      if (!root) return;
      const range = q('input[type="range"]', root)[0];
      if (!range) return;
      const prox = { v: 88 };
      const set = () => {
        range.value = String(Math.round(prox.v));
        root.style.setProperty("--pos", prox.v.toFixed(1) + "%");
      };
      const tween = gsap.fromTo(
        prox,
        { v: 88 },
        {
          v: 50,
          duration: 2,
          ease: "power3.inOut",
          onUpdate: set,
          scrollTrigger: { trigger: root, start: "top 72%", once: true },
        },
      );
      const stop = () => tween.kill();
      root.addEventListener("pointerdown", stop, { once: true });
      range.addEventListener("keydown", stop, { once: true });
      return () => {
        root.removeEventListener("pointerdown", stop);
        range.removeEventListener("keydown", stop);
        range.value = "50";
        root.style.setProperty("--pos", "50%");
      };
    });

    /* ---- Docs: the pile fans open as it scrolls into view -- */
    mm.add(MQ.motion, () => {
      const fan = q("[data-s-fan]")[0];
      if (!fan) return;
      gsap.fromTo(
        fan,
        { "--open": 0.15 },
        {
          "--open": 1,
          ease: "none",
          scrollTrigger: {
            trigger: fan,
            start: "top 92%",
            end: "top 48%",
            scrub: 0.6,
          },
        },
      );
    });

    /* ---- ZIP chips and towns arrive in sequence ----------- */
    mm.add(MQ.motion, () => {
      const panel = q(".s-zip__panel")[0];
      if (panel) {
        gsap.from(q(".s-zip__chip", panel), {
          opacity: 0,
          filter: "blur(8px)",
          duration: 0.9,
          ease: EASE.out,
          stagger: 0.06,
          clearProps: "opacity,filter",
          scrollTrigger: { trigger: panel, start: "top 72%", once: true },
        });
      }
      const cloud = q(".s-towns__cloud")[0];
      if (cloud) {
        gsap.from(q("li", cloud), {
          yPercent: 35,
          opacity: 0,
          filter: "blur(10px)",
          duration: 1.1,
          ease: EASE.out,
          stagger: 0.09,
          clearProps: "opacity,filter,transform",
          scrollTrigger: { trigger: cloud, start: "top 82%", once: true },
        });
      }
      const rel = q(".s-rel__row")[0];
      if (rel) {
        gsap.from(q(".s-rel__item", rel), {
          y: 60,
          opacity: 0,
          filter: "blur(10px)",
          duration: 1.1,
          ease: EASE.out,
          stagger: 0.12,
          clearProps: "opacity,filter,transform",
          scrollTrigger: { trigger: rel, start: "top 84%", once: true },
        });
      }
    });

    /* ---- CTA: heat circles drift with scroll and the pointer */
    mm.add(MQ.motion, () => {
      const section = q("[data-s-cta]")[0];
      if (!section) return;
      const [a, b, c, d] = ["a", "b", "c", "d"].map(
        (k) => q(".s-cta__orb--" + k, section)[0],
      );
      if (!a) return;
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top 92%",
          end: "bottom 8%",
          scrub: 1,
        },
      });
      tl.fromTo(a, { x: -120, y: 60 }, { x: 320, y: -110, ease: "none" }, 0)
        .fromTo(b, { x: 160, y: -40 }, { x: -140, y: 120, ease: "none" }, 0)
        .fromTo(c, { x: 120, y: 30 }, { x: -360, y: -80, ease: "none" }, 0)
        .fromTo(d, { x: -80, y: 90 }, { x: -220, y: -90, ease: "none" }, 0);
    });
    mm.add(DESK_POINTER, () => {
      const panel = q(".s-cta__panel")[0];
      const orb = q(".s-cta__orb--c")[0];
      if (!panel || !orb) return;
      const xTo = gsap.quickTo(orb, "xPercent", {
        duration: 1.4,
        ease: "power3",
      });
      const yTo = gsap.quickTo(orb, "yPercent", {
        duration: 1.4,
        ease: "power3",
      });
      const move = (e) => {
        const r = panel.getBoundingClientRect();
        xTo(((e.clientX - r.left) / r.width - 0.5) * -60);
        yTo(((e.clientY - r.top) / r.height - 0.5) * -60);
      };
      panel.addEventListener("pointermove", move);
      return () => {
        panel.removeEventListener("pointermove", move);
        gsap.set(orb, { clearProps: "xPercent,yPercent" });
      };
    });
  } catch (err) {
    console.error("[motion-service]", err);
  }
})();
/* === END REGION: SERVICE ================================== */

/* === REGION: LOCATION (location agent) ==================== */
(function () {
  "use strict";

  const TM = window.TM;
  if (!TM) return;
  const { gsap, ScrollTrigger, mm, MQ, EASE, q } = TM;
  const DESK_POINTER =
    "(hover: hover) and (pointer: fine) and (min-width: 900px) and (prefers-reduced-motion: no-preference)";
  const NARROW_MOTION =
    "(max-width: 899px) and (prefers-reduced-motion: no-preference)";
  const RAIL =
    "(min-width: 1101px) and (min-height: 600px) and (prefers-reduced-motion: no-preference)";
  const clamp = gsap.utils.clamp;

  try {
    /* ---- 1. Hero: the disc opens like an iris, ripples spread ---- */
    mm.add(MQ.motion, () => {
      const hero = q("[data-hero]")[0];
      const disc = q("[data-hero-disc]")[0];
      if (!hero || !disc) return;
      const img = q(".l-hero__img", disc)[0];
      const caption = q("[data-hero-caption]")[0];
      const rings = q(".l-hero__ring, .l-hero__drop", hero);
      const ripples = q(".l-hero__ripple", hero);

      const tl = gsap.timeline({ defaults: { ease: EASE.expo } });
      tl.fromTo(
        disc,
        { clipPath: "circle(0% at 50% 50%)" },
        {
          clipPath: "circle(72% at 50% 50%)",
          duration: 1.7,
          ease: "power3.inOut",
          clearProps: "clipPath",
        },
        0.15,
      );
      if (img)
        tl.fromTo(
          img,
          { scale: 1.4, filter: "blur(14px)" },
          {
            scale: 1,
            filter: "blur(0px)",
            duration: 2,
            clearProps: "transform,filter",
          },
          0.1,
        );
      tl.from(
        rings,
        {
          opacity: 0,
          scale: 0.6,
          transformOrigin: "50% 50%",
          duration: 1.6,
          stagger: 0.1,
          clearProps: "opacity,transform",
        },
        0.35,
      );
      if (caption)
        tl.from(
          caption,
          {
            y: 22,
            opacity: 0,
            filter: "blur(6px)",
            duration: 0.9,
            ease: EASE.out,
            clearProps: "opacity,transform,filter",
          },
          1.05,
        );

      // Slow ripples that leave the disc, only while the hero is on screen
      const loops = ripples.map((r, i) =>
        gsap.fromTo(
          r,
          { scale: 1, opacity: 0.55, transformOrigin: "50% 50%" },
          {
            scale: 1.55,
            opacity: 0,
            duration: 4.4,
            ease: "sine.out",
            repeat: -1,
            delay: 1.6 + i * 1.45,
            paused: true,
          },
        ),
      );
      const st = ScrollTrigger.create({
        trigger: hero,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => loops.forEach((t) => t.paused(!self.isActive)),
      });
      loops.forEach((t) => t.paused(!st.isActive));
      return () => {
        st.kill();
        loops.forEach((t) => t.kill());
      };
    });

    /* Hero: gentle pointer depth between rings, disc and caption */
    mm.add(DESK_POINTER, () => {
      const hero = q("[data-hero]")[0];
      const rings = q(".l-hero__rings", hero)[0];
      const disc = q("[data-hero-disc]", hero)[0];
      const caption = q("[data-hero-caption]", hero)[0];
      if (!hero || !rings || !disc) return;
      const make = (el, k) =>
        el
          ? {
              x: gsap.quickTo(el, "x", { duration: 1.1, ease: "power3" }),
              y: gsap.quickTo(el, "y", { duration: 1.1, ease: "power3" }),
              k,
            }
          : null;
      const layers = [
        make(rings, 22),
        make(disc, -9),
        make(caption, -16),
      ].filter(Boolean);
      const move = (e) => {
        const nx = (e.clientX / window.innerWidth - 0.5) * 2;
        const ny = (e.clientY / window.innerHeight - 0.5) * 2;
        layers.forEach((l) => {
          l.x(nx * l.k);
          l.y(ny * l.k * 0.7);
        });
      };
      const leave = () =>
        layers.forEach((l) => {
          l.x(0);
          l.y(0);
        });
      hero.addEventListener("pointermove", move);
      hero.addEventListener("pointerleave", leave);
      return () => {
        hero.removeEventListener("pointermove", move);
        hero.removeEventListener("pointerleave", leave);
        gsap.set([rings, disc, caption].filter(Boolean), { clearProps: "x,y" });
      };
    });

    /* ---- 2. Trust capsule opens from the middle ----------------- */
    mm.add(MQ.motion, () => {
      const capsule = q("[data-trust-capsule]")[0];
      if (!capsule) return;
      const pills = q("[data-trust-pill]", capsule);
      const trigger = { trigger: capsule, start: "top 92%", once: true };
      gsap.fromTo(
        capsule,
        { clipPath: "inset(0% 50% 0% 50% round 999px)" },
        {
          clipPath: "inset(0% 0% 0% 0% round 999px)",
          duration: 1.3,
          ease: EASE.expo,
          clearProps: "clipPath",
          scrollTrigger: trigger,
        },
      );
      gsap.from(pills, {
        opacity: 0,
        y: 16,
        filter: "blur(6px)",
        duration: 0.8,
        stagger: 0.12,
        delay: 0.3,
        ease: EASE.out,
        clearProps: "opacity,transform,filter",
        scrollTrigger: trigger,
      });
    });

    /* ---- 3. About: the wide photo opens as you scroll ----------- */
    const aboutReveal = (fromClip) => () => {
      const frame = q("[data-about-frame]")[0];
      if (!frame) return;
      const img = q(".l-about__img", frame)[0];
      gsap.fromTo(
        frame,
        { clipPath: fromClip },
        {
          clipPath: "inset(0% 0% 0% 0% round 56px)",
          ease: "none",
          scrollTrigger: {
            trigger: frame,
            start: "top 94%",
            end: "top 28%",
            scrub: 0.6,
          },
        },
      );
      if (img)
        gsap.fromTo(
          img,
          { scale: 1.3 },
          {
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: frame,
              start: "top 94%",
              end: "bottom 45%",
              scrub: 0.6,
            },
          },
        );
    };
    mm.add(MQ.full, aboutReveal("inset(14% 18% 14% 18% round 240px)"));
    mm.add(NARROW_MOTION, aboutReveal("inset(8% 8% 8% 8% round 120px)"));

    /* ---- 4. Services: pill thumbnails stretch in ----------------- */
    mm.add(MQ.motion, () => {
      q("[data-svc-thumb]").forEach((thumb) => {
        gsap.from(thumb, {
          clipPath: "inset(0% 100% 0% 0% round 999px)",
          duration: 1.1,
          ease: EASE.expo,
          clearProps: "clipPath",
          scrollTrigger: { trigger: thumb, start: "top 92%", once: true },
        });
      });
    });

    /* ---- 6. Split: halves close in on each other ----------------- */
    mm.add(MQ.full, () => {
      const grid = q("[data-split-grid]")[0];
      const halves = q("[data-split-half]");
      if (!grid || halves.length < 2) return;
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: grid,
          start: "top 90%",
          end: "top 45%",
          scrub: 0.7,
        },
      });
      tl.fromTo(
        halves[0],
        { xPercent: -4 },
        { xPercent: 0, ease: "none" },
        0,
      ).fromTo(halves[1], { xPercent: 4 }, { xPercent: 0, ease: "none" }, 0);
    });

    /* ---- 7. Problems: cards drift at different speeds ------------ */
    mm.add(MQ.full, () => {
      const section = q("[data-prob]")[0];
      const cards = q("[data-prob-card]");
      if (!section || !cards.length) return;
      const drift = [14, 40, 22, 54];
      cards.forEach((card, i) => {
        const d = drift[i % drift.length];
        gsap.fromTo(
          card,
          { y: d },
          {
            y: -d,
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.8,
            },
          },
        );
      });
    });

    /* ---- 9. Pricing: rows warm up as the page reaches them ------- */
    mm.add(MQ.motion, () => {
      const rows = q(".l-price__row");
      const triggers = rows.map((row) =>
        ScrollTrigger.create({
          trigger: row,
          start: "top 72%",
          onEnter: () => row.classList.add("is-lit"),
          onLeaveBack: () => row.classList.remove("is-lit"),
        }),
      );
      return () => {
        triggers.forEach((t) => t.kill());
        rows.forEach((r) => r.classList.remove("is-lit"));
      };
    });

    /* ---- 10. Landmarks: photos slide inside their frames --------- */
    mm.add(MQ.motion, () => {
      const track = q("[data-slider-track]")[0];
      const cards = q("[data-lm-card]");
      if (!track || !cards.length) return;
      let raf = 0;
      const update = () => {
        raf = 0;
        const tb = track.getBoundingClientRect();
        const mid = tb.left + tb.width / 2;
        cards.forEach((card) => {
          const cb = card.getBoundingClientRect();
          const d = clamp(-1, 1, (cb.left + cb.width / 2 - mid) / tb.width);
          card.style.setProperty("--shift", (-d * 26).toFixed(1) + "px");
        });
      };
      const schedule = () => {
        if (!raf) raf = requestAnimationFrame(update);
      };
      track.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule);
      update();
      return () => {
        track.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        if (raf) cancelAnimationFrame(raf);
        cards.forEach((c) => c.style.removeProperty("--shift"));
      };
    });

    /* ---- 11. ZIP panel: rings open, chips pop in ----------------- */
    mm.add(MQ.motion, () => {
      const panel = q("[data-zip-panel]")[0];
      if (!panel) return;
      const rings = q(".l-zip__ring, .l-zip__dot", panel);
      const chips = q("[data-zip-chip]", panel);
      const trigger = { trigger: panel, start: "top 78%", once: true };
      gsap.from(rings, {
        opacity: 0,
        scale: 0.55,
        transformOrigin: "50% 50%",
        duration: 1.6,
        stagger: 0.12,
        ease: EASE.expo,
        clearProps: "opacity,transform",
        scrollTrigger: trigger,
      });
      gsap.from(chips, {
        opacity: 0,
        y: 22,
        scale: 0.92,
        filter: "blur(6px)",
        duration: 0.8,
        stagger: 0.05,
        delay: 0.2,
        ease: EASE.out,
        clearProps: "opacity,transform,filter",
        scrollTrigger: trigger,
      });
    });
    mm.add(DESK_POINTER, () => {
      const panel = q("[data-zip-panel]")[0];
      const group = q("[data-zip-rings]", panel)[0];
      if (!panel || !group) return;
      const xTo = gsap.quickTo(group, "x", { duration: 1.2, ease: "power3" });
      const yTo = gsap.quickTo(group, "y", { duration: 1.2, ease: "power3" });
      const move = (e) => {
        const b = panel.getBoundingClientRect();
        xTo(((e.clientX - b.left) / b.width - 0.5) * -46);
        yTo(((e.clientY - b.top) / b.height - 0.5) * -46);
      };
      const leave = () => {
        xTo(0);
        yTo(0);
      };
      panel.addEventListener("pointermove", move);
      panel.addEventListener("pointerleave", leave);
      return () => {
        panel.removeEventListener("pointermove", move);
        panel.removeEventListener("pointerleave", leave);
        gsap.set(group, { clearProps: "x,y" });
      };
    });

    /* ---- 12. Reviews: the second column drifts ------------------- */
    mm.add(MQ.full, () => {
      const section = q("[data-rev]")[0];
      const cards = q("[data-rev-card]");
      if (!section || cards.length < 2) return;
      const left0 = Math.min(
        ...cards.map((c) => c.getBoundingClientRect().left),
      );
      const second = cards.filter(
        (c) => c.getBoundingClientRect().left > left0 + 20,
      );
      second.forEach((card) => {
        gsap.fromTo(
          card,
          { y: 34 },
          {
            y: -26,
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.8,
            },
          },
        );
      });
    });

    /* ---- 13. Seasons: the heat rule draws across the columns ----- */
    mm.add(RAIL, () => {
      const track = q("[data-season-track]")[0];
      const rule = q("[data-season-rule]")[0];
      const cols = q("[data-season-col]");
      if (!track || !rule || !cols.length) return;
      track.classList.add("is-armed");
      const set = (p) =>
        cols.forEach((col, i) =>
          col.classList.toggle("is-lit", p >= (i + 0.35) / cols.length),
        );
      gsap.fromTo(
        rule,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: track,
            start: "top 82%",
            end: "top 38%",
            scrub: 0.6,
            onUpdate: (self) => set(self.progress),
            onRefresh: (self) => set(self.progress),
          },
        },
      );
      return () => {
        track.classList.remove("is-armed");
        cols.forEach((c) => c.classList.remove("is-lit"));
      };
    });

    /* ---- 16. CTA: the giant word drifts and warms ---------------- */
    mm.add(MQ.motion, () => {
      const panel = q("[data-cta-panel]")[0];
      const word = q("[data-cta-word] .l-cta__word-text", panel)[0];
      if (!panel || !word) return;
      gsap.fromTo(
        word,
        { yPercent: 16, backgroundPosition: "0% 50%" },
        {
          yPercent: -16,
          backgroundPosition: "100% 50%",
          ease: "none",
          scrollTrigger: {
            trigger: panel,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.8,
          },
        },
      );
    });
  } catch (err) {
    console.error("[motion-location]", err);
  }
})();
/* === END REGION: LOCATION ================================= */
