const TIMELINE_PREFIX = "gvy-";
const LARGE_16_9_DESKTOP_QUERY = "(min-width: 1920px) and (max-width: 2560px) and (min-height: 1100px) and (min-aspect-ratio: 17 / 10)";

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
    start = "top 96%",
    end = "bottom -28%",
    enterY = 38,
    exitY = -22,
    scrub = 1.2,
  } = {},
) {
  gsap.utils.toArray(containers).forEach((container, index) => {
    const items = gsap.utils.toArray(container.querySelectorAll(itemSelector));
    if (!items.length) return;

    const enterDuration = 1.9;
    const enterStagger = 0.56;
    const lastEnterEnd = enterDuration + (items.length - 1) * enterStagger;
    const holdDuration = 4.6;
    const exitDuration = 1.9;
    const exitStagger = 0.16;
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

function createHeroTimeline(
  gsap,
  root,
  {
    animateMedia,
    animateBlur = true,
    enterDuration = 3.8,
    enterStagger = 0.76,
    holdDuration = 7.8,
    exitDuration = 5.8,
    exitStagger = 0.18,
    lockExit = false,
  },
) {
  const hero = root.querySelector("[data-hero-sequence]");
  if (!hero) return;

  const heroMedia = root.querySelector(".hero-media");
  const heroTitle = root.querySelector("[data-hero-title]");
  const heroMotto = root.querySelector("[data-hero-motto]");
  const heroScroll = root.querySelector(".hero-scroll");
  const commandNav = root.querySelector("[data-command-nav]");
  const heroText = [
    ...gsap.utils.toArray(":scope > .system-label, h1 > *", heroTitle),
    ...gsap.utils.toArray(":scope > *", heroMotto),
  ];
  const heroExitText = [...heroText].reverse();
  const enterStart = 1;
  const enterEnd = enterStart + enterDuration + (heroText.length - 1) * enterStagger;
  const exitStart = enterEnd + holdDuration;
  const exitSpan = exitDuration + (heroExitText.length - 1) * exitStagger;
  const exitEnd = exitStart + exitSpan;
  const rootElement = root.documentElement;
  gsap.set(heroText, {
    autoAlpha: 0,
    y: 34,
    filter: animateBlur ? "blur(10px)" : "none",
  });

  const syncLockedExit = () => {
    if (!lockExit || !rootElement) return;
    const stableHeight = Number.parseFloat(
      root.documentElement?.style?.getPropertyValue("--gvy-mobile-full-height") || "",
    );
    const viewportHeight = stableHeight > 0 ? stableHeight : root.defaultView?.innerHeight || 1;
    const bottomRatio = hero.getBoundingClientRect().bottom / viewportHeight;
    if (bottomRatio <= 0.42) {
      rootElement.setAttribute("data-hero-exit-complete", "true");
    } else if (bottomRatio >= 1.02) {
      rootElement.removeAttribute("data-hero-exit-complete");
    }
  };
  if (lockExit) rootElement?.removeAttribute("data-hero-exit-complete");
  const timeline = gsap.timeline({
    scrollTrigger: {
      id: "gvy-hero",
      trigger: hero,
      start: "top top",
      end: "bottom 40%",
      scrub: 1.4,
      invalidateOnRefresh: true,
      onUpdate: syncLockedExit,
      onRefresh: syncLockedExit,
    },
  });

  if (animateMedia && heroMedia) {
    timeline.fromTo(heroMedia, { scale: 1 }, { scale: 1.025, duration: 12.65, ease: "none" }, 0);
  }

  gsap.set([heroTitle, heroMotto], { autoAlpha: 1 });
  if (commandNav) gsap.set(commandNav, { autoAlpha: 0, yPercent: -100 });
  timeline
    .addLabel("hero-enter", enterStart)
    .to(
      heroText,
      {
        autoAlpha: 1,
        y: 0,
        filter: "none",
        duration: enterDuration,
        stagger: enterStagger,
        ease: "power2.out",
      },
      "hero-enter",
    )
    .addLabel("hero-complete", enterEnd)
    .to(
      heroText,
      {
        autoAlpha: 1,
        y: 0,
        filter: "none",
        duration: exitStart - enterEnd,
        ease: "none",
      },
      "hero-complete",
    )
    .addLabel("hero-exit", exitStart)
    .to(
      heroExitText,
      {
        autoAlpha: 0,
        y: -18,
        duration: exitDuration,
        stagger: exitStagger,
        ease: "power2.inOut",
      },
      "hero-exit",
    )
    .to(
      hero,
      {
        "--hero-transition-opacity": 1,
        duration: exitSpan,
        ease: "none",
      },
      "hero-exit",
    )
    .addLabel("hero-exit-complete", exitEnd)
    .fromTo(heroScroll, { autoAlpha: 1 }, { autoAlpha: 0, duration: 3.2, ease: "none" }, 0);
  if (commandNav) {
    timeline.to(
      commandNav,
      { autoAlpha: 1, yPercent: 0, duration: 1.8, ease: "power2.out" },
      9.6,
    );
  }
}

function createDesktopTimelines(gsap, ScrollTrigger, root) {
  const cleanups = [];
  const large16x9Desktop = root.defaultView?.matchMedia?.(LARGE_16_9_DESKTOP_QUERY).matches === true;
  createHeroTimeline(gsap, root, {
    animateMedia: true,
    enterDuration: large16x9Desktop ? 3.5 : 3.8,
    enterStagger: large16x9Desktop ? 0.7 : 0.76,
  });

  const signal = root.querySelector("[data-signal-section]");
  if (signal) {
    const signalTextItems = gsap.utils.toArray(
      "[data-signal-lockup] > :not(.signal-rule):not(.identity-rail)",
      signal,
    );
    const signalTimeline = gsap.timeline({
      scrollTrigger: {
        id: "gvy-signal-visual",
        trigger: signal,
        start: "top 72%",
        end: "top 8%",
        scrub: 0.92,
        invalidateOnRefresh: true,
      },
    });
    signalTimeline
      .fromTo(".signal-backdrop img", { scale: 1.045, xPercent: 0.8 }, { scale: 1.012, xPercent: -0.4, duration: 1, ease: "none" }, 0)
      .fromTo("[data-signal-emblem]", { autoAlpha: 0.06, scale: 0.84, y: 44 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.94, ease: "power2.out" }, 0.08)
      .fromTo(signalTextItems, { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: 0.52, stagger: 0.12, ease: "power2.out" }, 0.12)
      .fromTo(".signal-rule", { scaleX: 0, transformOrigin: "left" }, { scaleX: 1, duration: 0.26, ease: "power1.out" }, 0.76);

    gsap
      .timeline({
        scrollTrigger: {
          id: "gvy-signal-drift",
          trigger: signal,
          start: "top 100%",
          end: "bottom 0%",
          scrub: 1.1,
          invalidateOnRefresh: true,
        },
      })
      .fromTo(".signal-main", { yPercent: 12 }, { yPercent: -11, duration: 1, ease: "none" }, 0);

    gsap
      .timeline({
        scrollTrigger: {
          id: "gvy-signal-orbits",
          trigger: signal,
          start: "top 100%",
          end: "bottom 0%",
          scrub: 0.9,
          invalidateOnRefresh: true,
        },
      })
      .fromTo(".signal-orbit-one", { autoAlpha: 0.24, scale: 0.72, rotate: -9 }, { autoAlpha: 0.92, scale: 1.18, rotate: 8, duration: 1, ease: "none" }, 0)
      .fromTo(".signal-orbit-two", { autoAlpha: 0.42, scale: 1.15, rotate: 7 }, { autoAlpha: 0.82, scale: 0.84, rotate: -8, duration: 1, ease: "none" }, 0)
      .fromTo(".signal-orbit-three", { autoAlpha: 0.2, scale: 0.68, rotate: -4 }, { autoAlpha: 0.76, scale: 1.22, rotate: 10, duration: 1, ease: "none" }, 0);
  }
  const identityRail = root.querySelector("[data-identity-rail]");
  const identityCells = gsap.utils.toArray(":scope > div", identityRail);
  if (identityRail && identityCells.length) {
    gsap
      .timeline({
        scrollTrigger: {
          id: "gvy-signal-identity",
          trigger: signal,
          start: "top 66%",
          end: "top 7%",
          scrub: 0.92,
          invalidateOnRefresh: true,
        },
      })
      .fromTo(
        identityCells,
        { autoAlpha: 0, y: 22, scale: 0.97, transformOrigin: "50% 100%" },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.7,
          stagger: 0.1,
          ease: "power2.out",
        },
        0,
      );
  }

  fadeTextSequenceThroughViewport(gsap, root.querySelectorAll(".section-heading"), "heading", {
    start: "top 90%",
    end: "bottom -18%",
    enterY: 42,
  });

  const operations = root.querySelector("[data-operations-section]");
  const operationsStage = operations?.querySelector("[data-operations-stage]");
  const operationProgress = operations?.querySelector(".operation-progress");
  const progressSegments = gsap.utils.toArray("[data-operation-jump]", operations);
  const visuals = gsap.utils.toArray("[data-operation-visual]", operations);
  const copies = gsap.utils.toArray("[data-operation-index]", operations);
  if (operations && visuals.length && copies.length) {
    const operationCount = Math.min(visuals.length, copies.length);
    const lastIndex = operationCount - 1;
    gsap.set(visuals, { autoAlpha: 0, scale: 1.055 });
    gsap.set(copies, { autoAlpha: 0, y: 34 });
    copies.forEach((copy) => gsap.set(copy.children, { autoAlpha: 0, y: 18 }));
    gsap.set(visuals[0], { autoAlpha: 1 });
    gsap.set([operationsStage, operationProgress], { autoAlpha: 1 });
    gsap.set(operationsStage, {
      "--operations-entry-shade": 1,
      "--operations-exit-shade": 0,
    });

    const stageSpan = 2.5;
    const stageSettleOffset = 0.82;
    let operationsTimeline;
    let activeOperationIndex = -1;
    const syncActiveOperation = () => {
      const currentTime = operationsTimeline?.time?.() || 0;
      let nextIndex = 0;
      for (let index = 1; index < operationCount; index += 1) {
        if (currentTime >= index * stageSpan - 0.22) nextIndex = index;
      }
      if (nextIndex !== activeOperationIndex) {
        activeOperationIndex = nextIndex;
        operations.dataset.operationActive = String(nextIndex);
      }

      progressSegments.forEach((segment, index) => {
        const segmentStart = index === 0 ? 0 : index * stageSpan - 0.22;
        const segmentEnd = index === lastIndex
          ? lastIndex * stageSpan + 2
          : (index + 1) * stageSpan - 0.22;
        const segmentProgress = Math.max(
          0,
          Math.min(1, (currentTime - segmentStart) / Math.max(0.01, segmentEnd - segmentStart)),
        );
        segment.style.setProperty("--segment-progress", segmentProgress.toFixed(4));
        segment.classList.toggle("is-past", index < nextIndex);
        segment.classList.toggle("is-current", index === nextIndex);
        if (index === nextIndex) segment.setAttribute("aria-current", "step");
        else segment.removeAttribute("aria-current");
      });
    };

    operationsTimeline = gsap.timeline({
      scrollTrigger: {
        id: "gvy-operations",
        trigger: operations,
        start: () =>
          `top+=${Math.round((root.defaultView?.innerHeight || 800) * 0.78)} top`,
        end: "bottom bottom",
        scrub: 0.42,
        invalidateOnRefresh: true,
        onUpdate: syncActiveOperation,
        onRefresh: syncActiveOperation,
      },
    });
    syncActiveOperation();

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

    for (let index = 1; index < operationCount; index += 1) {
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

    operationsTimeline
      .to(
        operationProgress,
        { autoAlpha: 0, duration: 0.38, ease: "none" },
        lastIndex * stageSpan + 2,
      );

    operationsTimeline
      .to(
        operationsStage,
        { "--operations-entry-shade": 0, duration: 1.25, ease: "none" },
        0,
      )
      .to(
        operationsStage,
        { "--operations-exit-shade": 1, duration: 1.46, ease: "none" },
        lastIndex * stageSpan + 0.92,
      );

    const handleOperationJump = (event) => {
      const segment = event.currentTarget;
      const index = Number.parseInt(segment.dataset.operationJump || "0", 10);
      const trigger = operationsTimeline.scrollTrigger;
      const view = root.defaultView;
      if (!trigger || !view || !Number.isFinite(index) || index < 0 || index > lastIndex) return;

      const targetTime = Math.min(
        operationsTimeline.duration(),
        index * stageSpan + stageSettleOffset,
      );
      const targetProgress = targetTime / Math.max(0.01, operationsTimeline.duration());
      const targetScroll = trigger.start + (trigger.end - trigger.start) * targetProgress;
      view.scrollTo({ top: targetScroll, behavior: "smooth" });
    };

    progressSegments.forEach((segment) => segment.addEventListener("click", handleOperationJump));
    cleanups.push(() => {
      progressSegments.forEach((segment) => segment.removeEventListener("click", handleOperationJump));
    });
    syncActiveOperation();
  }

  fadeThroughViewport(gsap, ScrollTrigger, root.querySelectorAll(".archive-feature button"), "archive-media", {
    start: "top 90%",
    end: "bottom -12%",
    enterY: 42,
    exitY: -26,
    scrub: 0.75,
  });
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

  return () => cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
}

function createMobileTimelines(gsap, ScrollTrigger, root) {
  createHeroTimeline(gsap, root, {
    animateMedia: false,
    animateBlur: false,
    holdDuration: 15,
    exitDuration: 10.4,
    exitStagger: 0.12,
    lockExit: true,
  });
  showMobileStableContent(gsap, root);

  const signal = root.querySelector("[data-signal-section]");
  if (signal) {
    gsap
      .timeline({
        scrollTrigger: {
          id: "gvy-mobile-signal-orbits",
          trigger: signal,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.65,
        },
      })
      .fromTo(".signal-orbit-one", { scale: 0.88, rotate: -5 }, { scale: 1.04, rotate: 5, ease: "none" }, 0)
      .fromTo(".signal-orbit-two", { scale: 0.9, rotateZ: -4 }, { scale: 1.05, rotateZ: 7, ease: "none" }, 0)
      .fromTo(".signal-orbit-three", { scale: 0.92, rotateZ: 4 }, { scale: 1.08, rotateZ: -6, ease: "none" }, 0);
  }

  const createImageBreath = (selector, trigger, id) => {
    if (!trigger) return;
    gsap.fromTo(
      selector,
      { scale: 1.045, yPercent: -1.5 },
      {
        scale: 1,
        yPercent: 1.5,
        ease: "none",
        scrollTrigger: {
          id,
          trigger,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.75,
        },
      },
    );
  };

  createImageBreath(".signal-backdrop img", root.querySelector("[data-signal-section]"), "gvy-mobile-signal-image");
  createImageBreath(".recruit-image img", root.querySelector("[data-recruit-section]"), "gvy-mobile-recruit-image");
}

function showMobileStableContent(gsap, root) {
  gsap.set(
    root.querySelectorAll(
      ".signal-lockup, .signal-lockup > *, .signal-emblem, .identity-rail, .identity-rail > *, .section-heading, .section-heading > *, .operations-stage, .operation-copy, .operation-copy > *, .operation-progress, .archive-feature, .archive-feature button, .archive-feature > div, .archive-feature > div > *, .archive-index, .archive-index-heading, .archive-index-heading > *, .archive-grid, .archive-grid button, .recruit-copy, .recruit-copy > *",
    ),
    { clearProps: "opacity,visibility,transform,filter" },
  );
}

function showStableLayout(gsap, root) {
  root.documentElement?.removeAttribute("data-hero-exit-complete");
  gsap.set(
    root.querySelectorAll(
      ".command-nav, .hero-title, .hero-title > *, .hero-title h1 > *, .hero-motto, .hero-motto > *, .signal-lockup, .signal-lockup > *, .signal-emblem, .identity-rail, .identity-rail > *, .section-heading, .section-heading > *, .operations-stage, .operation-visual, .operation-copy, .operation-copy > *, .operation-progress, .archive-feature, .archive-feature button, .archive-feature > div, .archive-feature > div > *, .archive-index, .archive-index-heading, .archive-index-heading > *, .archive-grid, .archive-grid button, .recruit-copy, .recruit-copy > *",
    ),
    { clearProps: "all", autoAlpha: 1, x: 0, y: 0, scale: 1 },
  );
}

export function initCinematicTimelines({
  root = globalThis.document,
  gsap = globalThis.gsap,
  ScrollTrigger = globalThis.ScrollTrigger,
} = {}) {
  if (!root || !gsap || !ScrollTrigger) return { cleanup() {} };

  gsap.registerPlugin(ScrollTrigger);
  // Mobile browser chrome changes the visual viewport height while the user
  // scrolls. Recalculating every trigger for those transient resizes can make
  // the document jump between two paint states, especially on iOS Safari.
  ScrollTrigger.config?.({ ignoreMobileResize: true });
  const media = gsap.matchMedia();

  media.add(
    {
      desktop: "(min-width: 761px) and (max-width: 2560px) and (prefers-reduced-motion: no-preference)",
      wide: "(min-width: 2561px) and (prefers-reduced-motion: no-preference)",
      mobile: "(max-width: 760px) and (prefers-reduced-motion: no-preference)",
      reduced: "(prefers-reduced-motion: reduce)",
    },
    (context) => {
      if (context.conditions.reduced) showStableLayout(gsap, root);
      else if (context.conditions.desktop) return createDesktopTimelines(gsap, ScrollTrigger, root);
      else if (context.conditions.wide) showStableLayout(gsap, root);
      else if (context.conditions.mobile) createMobileTimelines(gsap, ScrollTrigger, root);
    },
  );

  return {
    cleanup() {
      root.documentElement?.removeAttribute("data-hero-exit-complete");
      media.revert();
      ScrollTrigger.getAll()
        .filter((trigger) => trigger.vars?.id?.startsWith?.(TIMELINE_PREFIX))
        .forEach((trigger) => trigger.kill());
    },
  };
}
