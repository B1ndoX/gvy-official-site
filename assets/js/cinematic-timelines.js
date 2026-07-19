const TIMELINE_PREFIX = "gvy-";

function fadeThroughViewport(
  gsap,
  ScrollTrigger,
  targets,
  idPrefix,
  {
    start = "top 88%",
    end = "bottom 12%",
    enterY = 34,
    exitY = -24,
    scrub = 0.7,
  } = {},
) {
  gsap.utils.toArray(targets).forEach((target, index) => {
    gsap
      .timeline({
        scrollTrigger: {
          id: `${TIMELINE_PREFIX}${idPrefix}-${index}`,
          trigger: target,
          start,
          end,
          scrub,
        },
      })
      .fromTo(
        target,
        { autoAlpha: 0, y: enterY },
        { autoAlpha: 1, y: 0, duration: 0.32, ease: "none" },
        0,
      )
      .to(target, { autoAlpha: 1, y: 0, duration: 0.4, ease: "none" }, 0.32)
      .to(target, { autoAlpha: 0, y: exitY, duration: 0.28, ease: "none" }, 0.72);
  });
}

function createHeroTimeline(gsap, root, { animateMedia }) {
  const hero = root.querySelector("[data-hero-sequence]");
  if (!hero) return;

  const heroMedia = root.querySelector(".hero-media");
  const heroTitle = root.querySelector("[data-hero-title]");
  const heroMotto = root.querySelector("[data-hero-motto]");
  const heroScroll = root.querySelector(".hero-scroll");
  const timeline = gsap.timeline({
    scrollTrigger: {
      id: "gvy-hero",
      trigger: hero,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.75,
    },
  });

  if (animateMedia && heroMedia) {
    timeline.fromTo(heroMedia, { scale: 1 }, { scale: 1.025, duration: 1, ease: "none" }, 0);
  }

  timeline
    .fromTo(
      heroTitle,
      { autoAlpha: 0, yPercent: 12 },
      { autoAlpha: 1, yPercent: 0, duration: 0.28, ease: "none" },
      0.08,
    )
    .to(heroTitle, { autoAlpha: 1, yPercent: 0, duration: 0.32, ease: "none" }, 0.36)
    .to(heroTitle, { autoAlpha: 0, yPercent: -18, duration: 0.28, ease: "none" }, 0.68)
    .fromTo(
      heroMotto,
      { autoAlpha: 0, yPercent: 14 },
      { autoAlpha: 1, yPercent: 0, duration: 0.26, ease: "none" },
      0.18,
    )
    .to(heroMotto, { autoAlpha: 1, yPercent: 0, duration: 0.26, ease: "none" }, 0.44)
    .to(heroMotto, { autoAlpha: 0, yPercent: -16, duration: 0.26, ease: "none" }, 0.7)
    .fromTo(heroScroll, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.24, ease: "none" }, 0);
}

function createDesktopTimelines(gsap, ScrollTrigger, root) {
  createHeroTimeline(gsap, root, { animateMedia: true });

  const signal = root.querySelector("[data-signal-section]");
  if (signal) {
    const signalTimeline = gsap.timeline({
      scrollTrigger: {
        id: "gvy-signal-visual",
        trigger: signal,
        start: "top 76%",
        end: "bottom 28%",
        scrub: 0.8,
      },
    });
    signalTimeline
      .fromTo(".signal-orbit-one", { scale: 0.72, rotate: -12 }, { scale: 1.05, rotate: 8, ease: "none" }, 0)
      .fromTo(".signal-orbit-two", { scale: 0.65, rotateZ: -9 }, { scale: 1.08, rotateZ: 16, ease: "none" }, 0);
  }
  fadeThroughViewport(
    gsap,
    ScrollTrigger,
    root.querySelectorAll("[data-signal-lockup], [data-identity-rail]"),
    "signal",
  );

  const manifesto = root.querySelector("[data-manifesto-section]");
  if (manifesto) {
    gsap
      .timeline({
        scrollTrigger: {
          id: "gvy-manifesto-visual",
          trigger: manifesto,
          start: "top 78%",
          end: "bottom 22%",
          scrub: 0.8,
        },
      })
      .fromTo(".manifesto-image img", { scale: 1.08, xPercent: 2 }, { scale: 1, xPercent: -2, ease: "none" }, 0)
      .fromTo(".manifesto-rule", { scaleX: 0, transformOrigin: "left" }, { scaleX: 1, ease: "none" }, 0.5);
  }
  fadeThroughViewport(gsap, ScrollTrigger, root.querySelectorAll("[data-manifesto-copy]"), "manifesto", {
    start: "top 86%",
    end: "bottom 16%",
    enterY: 64,
    exitY: -38,
  });

  fadeThroughViewport(gsap, ScrollTrigger, root.querySelectorAll(".section-heading"), "heading", {
    start: "top 90%",
    end: "bottom 16%",
    enterY: 42,
  });

  const operations = root.querySelector("[data-operations-section]");
  const visuals = gsap.utils.toArray("[data-operation-visual]", operations);
  const copies = gsap.utils.toArray("[data-operation-index]", operations);
  if (operations && visuals.length && copies.length) {
    gsap.set(visuals, { autoAlpha: 0, scale: 1.055 });
    gsap.set(copies, { autoAlpha: 0, y: 34 });
    gsap.set(visuals[0], { autoAlpha: 1 });

    const operationsTimeline = gsap.timeline({
      scrollTrigger: {
        id: "gvy-operations",
        trigger: operations,
        start: () =>
          `top+=${Math.round((root.defaultView?.innerHeight || 800) * 0.78)} top`,
        end: "bottom bottom",
        scrub: 0.7,
        invalidateOnRefresh: true,
      },
    });

    operationsTimeline.fromTo(
      copies[0],
      { autoAlpha: 0, y: 34 },
      { autoAlpha: 1, y: 0, duration: 0.65, ease: "none" },
      0.12,
    );

    for (let index = 1; index < Math.min(visuals.length, copies.length); index += 1) {
      const position = index;
      operationsTimeline
        .to([visuals[index - 1], copies[index - 1]], { autoAlpha: 0, duration: 0.32, ease: "none" }, position)
        .fromTo(visuals[index], { autoAlpha: 0, scale: 1.055 }, { autoAlpha: 1, scale: 1, duration: 0.68, ease: "none" }, position + 0.2)
        .fromTo(copies[index], { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: 0.58, ease: "none" }, position + 0.28);
    }

    const lastIndex = Math.min(visuals.length, copies.length) - 1;
    operationsTimeline.to(
      [visuals[lastIndex], copies[lastIndex]],
      { autoAlpha: 0, y: -24, duration: 0.42, ease: "none" },
      lastIndex + 1,
    );

    const operationsDuration = Math.max(1, operationsTimeline.duration());
    operationsTimeline.to(
      operations,
      { "--operations-progress": 1, duration: operationsDuration, ease: "none" },
      0,
    );
  }

  fadeThroughViewport(
    gsap,
    ScrollTrigger,
    root.querySelectorAll(".archive-feature, .archive-index"),
    "archive",
    { start: "top 88%", end: "bottom 10%", enterY: 58, exitY: -34, scrub: 0.65 },
  );

  const recruit = root.querySelector("[data-recruit-section]");
  if (recruit) {
    gsap
      .timeline({
        scrollTrigger: {
          id: "gvy-recruit-image",
          trigger: recruit,
          start: "top 84%",
          end: "center center",
          scrub: 0.75,
        },
      })
      .fromTo(".recruit-image img", { scale: 1.08 }, { scale: 1, ease: "none" }, 0);
  }
  fadeThroughViewport(gsap, ScrollTrigger, root.querySelectorAll("[data-recruit-copy]"), "recruit", {
    start: "top 88%",
    end: "bottom 8%",
    enterY: 56,
    exitY: -30,
  });
}

function createMobileTimelines(gsap, ScrollTrigger, root) {
  createHeroTimeline(gsap, root, { animateMedia: false });
  fadeThroughViewport(
    gsap,
    ScrollTrigger,
    root.querySelectorAll(
      ".signal-lockup, .identity-rail, .manifesto-copy, .section-heading, .operation-copy > *, .archive-feature, .archive-index, .recruit-copy",
    ),
    "mobile",
    { start: "top 92%", end: "bottom 8%", enterY: 28, exitY: -20, scrub: 0.6 },
  );
}

function showStableLayout(gsap, root) {
  gsap.set(
    root.querySelectorAll(
      ".hero-title, .hero-motto, .signal-lockup, .identity-rail, .manifesto-copy, .section-heading, .operation-copy, .archive-feature, .archive-index, .archive-grid, .recruit-copy",
    ),
    { clearProps: "all", autoAlpha: 1, x: 0, y: 0, scale: 1 },
  );
}

export function initCinematicTimelines({
  root = globalThis.document,
  gsap = globalThis.gsap,
  ScrollTrigger = globalThis.ScrollTrigger,
} = {}) {
  if (!root || !gsap || !ScrollTrigger) return { refresh() {}, cleanup() {} };

  gsap.registerPlugin(ScrollTrigger);
  const media = gsap.matchMedia();

  media.add(
    {
      desktop: "(min-width: 761px) and (prefers-reduced-motion: no-preference)",
      mobile: "(max-width: 760px) and (prefers-reduced-motion: no-preference)",
      reduced: "(prefers-reduced-motion: reduce)",
    },
    (context) => {
      if (context.conditions.reduced) showStableLayout(gsap, root);
      else if (context.conditions.desktop) createDesktopTimelines(gsap, ScrollTrigger, root);
      else if (context.conditions.mobile) createMobileTimelines(gsap, ScrollTrigger, root);
    },
  );

  return {
    refresh() {
      ScrollTrigger.refresh();
    },
    cleanup() {
      media.revert();
      ScrollTrigger.getAll()
        .filter((trigger) => trigger.vars?.id?.startsWith?.(TIMELINE_PREFIX))
        .forEach((trigger) => trigger.kill());
    },
  };
}
