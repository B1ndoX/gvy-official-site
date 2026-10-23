// GVY-UI-A01: report the real clipboard result without shifting the controls.
export function initRecruitActions({ root = globalThis.document, view = root?.defaultView || globalThis } = {}) {
  const button = root?.querySelector?.('[data-copy-recruit]');
  const label = button?.querySelector('[data-copy-label]');
  const status = root?.querySelector?.('[data-copy-status]');
  const number = button?.querySelector('[data-recruit-number]');
  if (!button || !label || !status) return { cleanup() {} };

  let cleaned = false;
  const update = (state, text, message) => {
    button.dataset.copyState = state;
    button.disabled = state === 'copying';
    button.setAttribute('aria-busy', String(state === 'copying'));
    label.textContent = text;
    status.textContent = message;
  };
  const copy = async () => {
    if (cleaned || button.disabled) return;
    update('copying', '复制中', '正在复制 QQ 群号…');
    try {
      if (!view.navigator?.clipboard?.writeText) throw new Error('clipboard-unavailable');
      await view.navigator.clipboard.writeText(button.dataset.copyRecruit);
      if (!cleaned) update('copied', '已复制', '已复制，可前往 QQ 搜索');
    } catch {
      if (cleaned) return;
      update('error', '重试', '复制失败，请手动复制群号');
      // Leave the visible number selectable when browser permission is denied.
      if (number && root.createRange && view.getSelection) {
        const range = root.createRange(), selection = view.getSelection();
        range.selectNodeContents(number);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  };
  button.addEventListener('click', copy);
  return {
    cleanup() {
      if (cleaned) return;
      cleaned = true;
      button.removeEventListener('click', copy);
      button.disabled = false;
      button.removeAttribute('aria-busy');
    },
  };
}
