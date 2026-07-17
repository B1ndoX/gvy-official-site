const TIMELINE_PREFIX = "gvy-";

function revealOnEnter(gsap, ScrollTrigger, targets, idPrefix) {
  gsap.utils.toArray(targets).forEach((target, index) => {
    gsap.fromTo(
      target,
      { autoAlpha: 0, y: 34 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.85,
        ease: "power3.out",
        scrollTrigger: {
          id: `${TIMELINE_PREFIX}${idPrefix}-${index}`,
          trigger: target,
          start: "top 86%",
          once: true,
        },
      },
    );
  });
}

function createDesktopTimelines(gsap, ScrollTrigger, root) {
  const hero = root.querySelector("[data-hero-sequence]");
  const heroMedia = root.querySelector(".hero-media");
  const heroTitle = root.querySelector("[data-hero-title]");
  const heroMotto = root.querySelector("[data-hero-motto]");
  const heroScroll = root.querySelector(".hero-scroll");

  if (hero) {
    gsap
      .timeline({
        scrollTrigger: {
          id: "gvy-hero",
          trigger: hero,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.75,
        },
      })
      .to(heroMedia, { scale: 1.1, filter: "brightness(0.58)", ease: "none" }, 0)
      .to(heroTitle, { yPercent: -24, autoAlpha: 0, ease: "none" }, 0.08)
      .to(heroMotto, { yPercent: -20, autoAlpha: 0, ease: "none" }, 0.18)
      .to(heroScroll, { autoAlpha: 0, ease: "none" }, 0);
  }

  const signal = root.querySelector("[data-signal-section]");
  if (signal) {
    const signalTimeline = gsap.timeline({
      scrollTrigger: {
        id: "gvy-signal",
        trigger: signal,
        start: "top 76%",
        end: "bottom 28%",
        scrub: 0.8,
      },
    });
    signalTimeline
      .fromTo("[data-signal-lockup]", { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, ease: "none" })
      .fromTo(".signal-orbit-one", { scale: 0.72, rotate: -12 }, { scale: 1.05, rotate: 8, ease: "none" }, 0)
      .fromTo(".signal-orbit-two", { scale: 0.65, rotateZ: -9 }, { scale: 1.08, rotateZ: 16, ease: "none" }, 0)
      .fromTo("[data-identity-rail] > div", { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, stagger: 0.08, ease: "none" }, 0.55);
  }

  const manifesto = root.querySelector("[data-manifesto-section]");
  if (manifesto) {
    gsap
      .timeline({
        scrollTrigger: {
          id: "gvy-manifesto",
          trigger: manifesto,
          start: "top 78%",
          end: "bottom 22%",
          scrub: 0.8,
        },
      })
      .fromTo(".manifesto-image img", { scale: 1.08, xPercent: 2 }, { scale: 1, xPercent: -2, ease: "none" }, 0)
      .fromTo("[data-manifesto-copy]", { autoAlpha: 0, y: 90 }, { autoAlpha: 1, y: 0, ease: "none" }, 0.05)
      .fromTo(".manifesto-rule", { scaleX: 0, transformOrigin: "left" }, { scaleX: 1, ease: "none" }, 0.5);
  }

  const operations = root.querySelector("[data-operations-section]");
  const visuals = gsap.utils.toArray("[data-operation-visual]", operations);
  const copies = gsap.utils.toArray("[data-operation-index]", operations);
  if (operations && visuals.length && copies.length) {
    gsap.set(visuals, { autoAlpha: 0, scale: 1.055 });
    gsap.set(copies, { autoAlpha: 0, y: 34 });
    gsap.set([visuals[0], copies[0]], { autoAlpha: 1 });
    gsap.set(copies[0], { y: 0 });

    const operationsTimeline = gsap.timeline({
      scrollTrigger: {
        id: "gvy-operations",
        trigger: operations,
        start: "top+=72% top",
        end: "bottom bottom",
        scrub: 0.7,
        invalidateOnRefresh: true,
      },
    });

    for (let index = 1; index < Math.min(visuals.length, copies.length); index += 1) {
      const position = index;
      operationsTimeline
        .to([visuals[index - 1], copies[index - 1]], { autoAlpha: 0, duration: 0.32, ease: "none" }, position)
        .fromTo(visuals[index], { autoAlpha: 0, scale: 1.055 }, { autoAlpha: 1, scale: 1, duration: 0.68, ease: "none" }, position + 0.2)
        .fromTo(copies[index], { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: 0.58, ease: "none" }, position + 0.28);
    }

    operationsTimeline.to(
      operations,
      { "--operations-progress": 1, duration: 0.2, ease: "none" },
      0,
    );
  }

  const archive = root.querySelector("[data-archive-section]");
  if (archive) {
    const archiveFeatures = gsap.utils.toArray(".archive-feature", archive);
    const archiveTimeline = gsap.timeline({
      scrollTrigger: {
        id: "gvy-archive",
        trigger: archive,
        start: "top 72%",
        end: "bottom 65%",
        scrub: 0.65,
      },
    });
    archiveFeatures.forEach((feature, index) => {
      archiveTimeline.fromTo(
        feature,
        { autoAlpha: 0, y: 90 },
        { autoAlpha: 1, y: 0, duration: 0.8, ease: "none" },
        index * 0.85,
      );
    });
    archiveTimeline.fromTo(".archive-grid", { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: "none" }, Math.max(2.4, archiveFeatures.length * 0.85));
  }

  const recruit = root.querySelector("[data-recruit-section]");
  if (recruit) {
    gsap
      .timeline({
        scrollTrigger: {
          id: "gvy-recruit",
          trigger: recruit,
          start: "top 84%",
          end: "center center",
          scrub: 0.75,
        },
      })
      .fromTo(".recruit-image img", { scale: 1.08 }, { scale: 1, ease: "none" }, 0)
      .fromTo("[data-recruit-copy]", { autoAlpha: 0, y: 70 }, { autoAlpha: 1, y: 0, ease: "none" }, 0.16);
  }
}

function createMobileTimelines(gsap, ScrollTrigger, root) {
  revealOnEnter(
    gsap,
    ScrollTrigger,
    root.querySelectorAll(
      ".signal-lockup, .identity-rail, .manifesto-copy, .section-heading, .operation-copy > *, .archive-feature, .archive-index, .recruit-copy",
    ),
    "mobile",
  );
}

function showStableLayout(gsap, root) {
  gsap.set(
    root.querySelectorAll(
      ".hero-title, .hero-motto, .signal-lockup, .identity-rail, .manifesto-copy, .operation-copy, .archive-feature, .archive-grid, .recruit-copy",
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
