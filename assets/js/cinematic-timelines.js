const TIMELINE_PREFIX = "gvy-";

function fadeThroughViewport(
  gsap,
  ScrollTrigger,
  targets,
  idPrefix,
  {
    start = "top 88%",
    end = "bottom -12%",
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
      .to(target, { autoAlpha: 1, y: 0, duration: 0.56, ease: "none" }, 0.32)
      .to(target, { autoAlpha: 0, y: exitY, duration: 0.22, ease: "none" }, 0.88);
  });
}

function fadeTextSequenceThroughViewport(
  gsap,
  containers,
  idPrefix,
  {
    itemSelector = ":scope > *",
    start = "top 90%",
    end = "bottom -18%",
    enterY = 30,
    exitY = -18,
    scrub = 0.9,
  } = {},
) {
  gsap.utils.toArray(containers).forEach((container, index) => {
    const items = gsap.utils.toArray(container.querySelectorAll(itemSelector));
    if (!items.length) return;

    const enterDuration = 1;
    const enterStagger = 0.42;
    const lastEnterEnd = enterDuration + (items.length - 1) * enterStagger;
    const holdDuration = 3.2;
    const exitDuration = 1.55;
    const exitStagger = 0.12;
    const exitStart = lastEnterEnd + holdDuration;

    gsap
      .timeline({
        scrollTrigger: {
          id: `${TIMELINE_PREFIX}${idPrefix}-text-${index}`,
          trigger: container,
          start,
          end,
          scrub,
        },
      })
      .fromTo(
        items,
        { autoAlpha: 0, y: enterY },
        {
          autoAlpha: 1,
          y: 0,
          duration: enterDuration,
          stagger: enterStagger,
          ease: "none",
        },
        0,
      )
      .to(items, { autoAlpha: 1, y: 0, duration: holdDuration, ease: "none" }, lastEnterEnd)
      .to(
        items,
        {
          autoAlpha: 0,
          y: exitY,
          duration: exitDuration,
          stagger: exitStagger,
          ease: "none",
        },
        exitStart,
      );
  });
}

function createHeroTimeline(gsap, root, { animateMedia }) {
  const hero = root.querySelector("[data-hero-sequence]");
  if (!hero) return;

  const heroMedia = root.querySelector(".hero-media");
  const heroTitle = root.querySelector("[data-hero-title]");
  const heroMotto = root.querySelector("[data-hero-motto]");
  const heroScroll = root.querySelector(".hero-scroll");
  const heroText = [
    ...gsap.utils.toArray(":scope > .system-label, h1 > *", heroTitle),
    ...gsap.utils.toArray(":scope > *", heroMotto),
  ];
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
    timeline.fromTo(heroMedia, { scale: 1 }, { scale: 1.025, duration: 12.65, ease: "none" }, 0);
  }

  gsap.set([heroTitle, heroMotto], { autoAlpha: 1 });
  timeline
    .fromTo(
      heroText,
      { autoAlpha: 0, y: 26 },
      { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.42, ease: "none" },
      0.65,
    )
    .to(heroText, { autoAlpha: 1, y: 0, duration: 5.53, ease: "none" }, 4.37)
    .to(
      heroText,
      { autoAlpha: 0, y: -18, duration: 1.9, stagger: 0.14, ease: "none" },
      9.9,
    )
    .fromTo(heroScroll, { autoAlpha: 1 }, { autoAlpha: 0, duration: 2.4, ease: "none" }, 0);
}

function createArchiveGalleryTimeline(gsap, root) {
  const archiveIndex = root.querySelector("[data-archive-index]");
  const viewport = archiveIndex?.querySelector(".archive-grid-viewport");
  const track = archiveIndex?.querySelector("[data-archive-grid]");
  const current = archiveIndex?.querySelector("[data-archive-current]");
  const cards = track ? gsap.utils.toArray("button", track) : [];
  if (!archiveIndex || !viewport || !track || cards.length < 2) return;

  const lastIndex = cards.length - 1;
  let activeIndex = 0;

  cards.forEach((card) => card.removeAttribute("aria-current"));
  gsap.set(cards, { autoAlpha: 0.34, scale: 0.84 });
  gsap.set(cards[0], { autoAlpha: 1, scale: 1 });
  cards[0].setAttribute("aria-current", "true");

  const galleryTimeline = gsap.timeline({
    onUpdate() {
      const nextIndex = Math.round(this.progress() * lastIndex);
      if (nextIndex === activeIndex) return;
      cards[activeIndex]?.removeAttribute("aria-current");
      cards[nextIndex]?.setAttribute("aria-current", "true");
      activeIndex = nextIndex;
      if (current) current.textContent = String(nextIndex + 1).padStart(3, "0");
    },
    scrollTrigger: {
      id: "gvy-archive-gallery",
      trigger: archiveIndex,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.85,
      snap: {
        snapTo: 1 / lastIndex,
        duration: { min: 0.16, max: 0.32 },
        delay: 0.08,
        ease: "power1.inOut",
      },
      invalidateOnRefresh: true,
    },
  });

  galleryTimeline.to(
    track,
    {
      x: () => -Math.max(0, track.scrollWidth - viewport.clientWidth),
      duration: lastIndex,
      ease: "none",
    },
    0,
  );

  cards.forEach((card, index) => {
    if (index > 0) {
      galleryTimeline.to(
        card,
        { autoAlpha: 1, scale: 1, duration: 0.48, ease: "none" },
        index - 0.48,
      );
    }
    if (index < lastIndex) {
      galleryTimeline.to(
        card,
        { autoAlpha: 0.34, scale: 0.84, duration: 0.45, ease: "none" },
        index + 0.55,
      );
    }
  });
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
  fadeTextSequenceThroughViewport(
    gsap,
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
  fadeTextSequenceThroughViewport(gsap, root.querySelectorAll("[data-manifesto-copy]"), "manifesto", {
    start: "top 86%",
    end: "bottom -20%",
    enterY: 64,
    exitY: -38,
  });

  fadeTextSequenceThroughViewport(gsap, root.querySelectorAll(".section-heading"), "heading", {
    start: "top 90%",
    end: "bottom -18%",
    enterY: 42,
  });

  const operations = root.querySelector("[data-operations-section]");
  const visuals = gsap.utils.toArray("[data-operation-visual]", operations);
  const copies = gsap.utils.toArray("[data-operation-index]", operations);
  if (operations && visuals.length && copies.length) {
    gsap.set(visuals, { autoAlpha: 0, scale: 1.055 });
    gsap.set(copies, { autoAlpha: 0, y: 34 });
    copies.forEach((copy) => gsap.set(copy.children, { autoAlpha: 0, y: 18 }));
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

    const stageSpan = 2.35;

    operationsTimeline
      .fromTo(
        copies[0],
        { autoAlpha: 0, y: 34 },
        { autoAlpha: 1, y: 0, duration: 0.62, ease: "none" },
        0.18,
      )
      .fromTo(
        copies[0].children,
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 0.46, stagger: 0.09, ease: "none" },
        0.3,
      );

    for (let index = 1; index < Math.min(visuals.length, copies.length); index += 1) {
      const position = index * stageSpan;
      operationsTimeline
        .to(
          [visuals[index - 1], copies[index - 1]],
          { autoAlpha: 0, duration: 0.56, ease: "none" },
          position - 0.5,
        )
        .fromTo(
          visuals[index],
          { autoAlpha: 0, scale: 1.055 },
          { autoAlpha: 1, scale: 1, duration: 0.76, ease: "none" },
          position - 0.22,
        )
        .fromTo(
          copies[index],
          { autoAlpha: 0, y: 34 },
          { autoAlpha: 1, y: 0, duration: 0.68, ease: "none" },
          position - 0.1,
        )
        .fromTo(
          copies[index].children,
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.46, stagger: 0.09, ease: "none" },
          position + 0.04,
        );
    }

    const lastIndex = Math.min(visuals.length, copies.length) - 1;
    operationsTimeline.to(
      [visuals[lastIndex], copies[lastIndex]],
      { autoAlpha: 0, y: -24, duration: 0.72, ease: "none" },
      lastIndex * stageSpan + 1.72,
    );

    const operationsDuration = Math.max(1, operationsTimeline.duration());
    operationsTimeline.to(
      operations,
      { "--operations-progress": 1, duration: operationsDuration, ease: "none" },
      0,
    );
  }

  fadeThroughViewport(gsap, ScrollTrigger, root.querySelectorAll(".archive-feature button"), "archive-media", {
    start: "top 90%",
    end: "bottom -12%",
    enterY: 42,
    exitY: -26,
    scrub: 0.75,
  });
  createArchiveGalleryTimeline(gsap, root);
  fadeTextSequenceThroughViewport(
    gsap,
    root.querySelectorAll(".archive-feature > div"),
    "archive",
    { start: "top 92%", end: "bottom -18%", enterY: 32, exitY: -20 },
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
  fadeTextSequenceThroughViewport(gsap, root.querySelectorAll("[data-recruit-copy]"), "recruit", {
    start: "top 88%",
    end: "bottom -16%",
    enterY: 56,
    exitY: -30,
  });
}

function createMobileTimelines(gsap, ScrollTrigger, root) {
  createHeroTimeline(gsap, root, { animateMedia: false });
  fadeTextSequenceThroughViewport(
    gsap,
    root.querySelectorAll(
      ".signal-lockup, .identity-rail, .manifesto-copy, .section-heading, .operation-copy, .archive-feature > div, .recruit-copy",
    ),
    "mobile",
    { start: "top 92%", end: "bottom -14%", enterY: 28, exitY: -20, scrub: 0.8 },
  );
  fadeThroughViewport(gsap, ScrollTrigger, root.querySelectorAll(".archive-feature button"), "mobile-media", {
    start: "top 92%",
    end: "bottom -10%",
    enterY: 30,
    exitY: -18,
    scrub: 0.7,
  });
}

function showStableLayout(gsap, root) {
  gsap.set(
    root.querySelectorAll(
      ".hero-title, .hero-motto, .signal-lockup, .identity-rail, .manifesto-copy, .section-heading, .operation-copy, .archive-feature, .archive-index, .archive-grid, .archive-grid button, .recruit-copy",
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
