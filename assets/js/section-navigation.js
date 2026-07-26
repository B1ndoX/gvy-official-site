const DEFAULT_SECTION_IDS = ["fleet-signal", "operations", "archive", "recruit"];

export function resolveActiveSectionId(sectionPositions, probeY) {
  let activeId = "";

  for (const { id, top } of sectionPositions) {
    if (!id || !Number.isFinite(top) || top > probeY) break;
    activeId = id;
  }

  return activeId;
}

export function initSectionNavigation({
  root = globalThis.document,
  view = root?.defaultView || globalThis,
  sectionIds = DEFAULT_SECTION_IDS,
} = {}) {
  const nav = root?.querySelector?.("[data-command-nav]");
  const links = [...(nav?.querySelectorAll?.("[data-scroll-link][href^='#']") || [])];
  const sections = sectionIds
    .map((id) => root?.getElementById?.(id))
    .filter(Boolean);

  if (!nav || !links.length || !sections.length) return () => {};

  let frame = 0;
  let activeId = null;

  const update = () => {
    frame = 0;
    const navHeight = Number(nav.getBoundingClientRect?.().height || 0);
    const viewportHeight = Number(view.innerHeight || 0);
    const probeY = Math.max(navHeight + 24, viewportHeight * 0.33);
    const nextId = resolveActiveSectionId(
      sections.map((section) => ({ id: section.id, top: section.getBoundingClientRect().top })),
      probeY,
    );

    if (nextId === activeId) return;
    activeId = nextId;
    nav.dataset.activeSection = nextId;

    links.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${nextId}`;
      link.classList.toggle("is-active", isActive);
      if (isActive) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
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
