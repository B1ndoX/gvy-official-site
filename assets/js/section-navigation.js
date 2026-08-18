const DEFAULT_SECTION_IDS = ["fleet-signal", "operations", "archive", "recruit"];

export function resolveActiveSectionId(sectionPositions, probeY) {
  let activeId = "";

  for (const { id, top } of sectionPositions) {
    if (!id || !Number.isFinite(top) || top > probeY) break;
    activeId = id;
  }

  return activeId;
}

export function resolveHorizontalFollowTarget({
  scrollLeft,
  scrollWidth,
  clientWidth,
  railLeft,
  railRight,
  itemLeft,
  itemRight,
  edgePadding = 12,
}) {
  if (![scrollLeft, scrollWidth, clientWidth, railLeft, railRight, itemLeft, itemRight].every(Number.isFinite)) {
    return scrollLeft;
  }

  let nextScrollLeft = scrollLeft;
  if (itemLeft < railLeft + edgePadding) {
    nextScrollLeft -= railLeft + edgePadding - itemLeft;
  } else if (itemRight > railRight - edgePadding) {
    nextScrollLeft += itemRight - (railRight - edgePadding);
  }

  return Math.min(Math.max(0, nextScrollLeft), Math.max(0, scrollWidth - clientWidth));
}

export function initSectionNavigation({
  root = globalThis.document,
  view = root?.defaultView || globalThis,
  sectionIds = DEFAULT_SECTION_IDS,
} = {}) {
  const nav = root?.querySelector?.("[data-command-nav]");
  const rail = nav?.querySelector?.(".nav-links");
  const links = [...(nav?.querySelectorAll?.("[data-scroll-link][href^='#']") || [])];
  const sections = sectionIds
    .map((id) => root?.getElementById?.(id))
    .filter(Boolean);

  if (!nav || !links.length || !sections.length) return () => {};

  let frame = 0;
  let activeId = null;

  const followActiveLink = (link) => {
    if (!rail || !link) return;
    const railRect = rail.getBoundingClientRect?.();
    const itemRect = link.getBoundingClientRect?.();
    if (!railRect || !itemRect) return;

    const nextScrollLeft = resolveHorizontalFollowTarget({
      scrollLeft: Number(rail.scrollLeft || 0),
      scrollWidth: Number(rail.scrollWidth || 0),
      clientWidth: Number(rail.clientWidth || 0),
      railLeft: Number(railRect.left),
      railRight: Number(railRect.right),
      itemLeft: Number(itemRect.left),
      itemRight: Number(itemRect.right),
    });

    if (Math.abs(nextScrollLeft - Number(rail.scrollLeft || 0)) < 1) return;
    const behavior = view.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth";
    rail.scrollTo?.({ left: nextScrollLeft, top: 0, behavior });
  };

  const update = () => {
    frame = 0;
    const navHeight = Number(nav.getBoundingClientRect?.().height || 0);
    const viewportHeight = Number(view.innerHeight || 0);
    const probeY = Math.max(navHeight + 24, viewportHeight * 0.33);
    const nextId = resolveActiveSectionId(
      sections.map((section) => ({ id: section.id, top: section.getBoundingClientRect().top })),
      probeY,
    );

    if (nextId === activeId) {
      followActiveLink(links.find((link) => link.classList.contains("is-active")));
      return;
    }
    activeId = nextId;
    nav.dataset.activeSection = nextId;

    let activeLink = null;
    links.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${nextId}`;
      link.classList.toggle("is-active", isActive);
      if (isActive) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
      if (isActive) activeLink = link;
    });
    followActiveLink(activeLink);
  };

  const requestUpdate = () => {
    if (frame) return;
    frame = view.requestAnimationFrame?.(update) || 0;
    if (!frame) update();
  };

  view.addEventListener?.("scroll", requestUpdate, { passive: true });
  view.addEventListener?.("resize", requestUpdate, { passive: true });
  view.addEventListener?.("hashchange", requestUpdate);
  requestUpdate();

  return () => {
    if (frame) view.cancelAnimationFrame?.(frame);
    view.removeEventListener?.("scroll", requestUpdate);
    view.removeEventListener?.("resize", requestUpdate);
    view.removeEventListener?.("hashchange", requestUpdate);
    delete nav.dataset.activeSection;
    links.forEach((link) => {
      link.classList.remove("is-active");
      link.removeAttribute("aria-current");
    });
  };
}
