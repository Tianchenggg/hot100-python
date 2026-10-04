(() => {
  const key = 'hot100-python:v1:skin';
  const names = { codex: 'Codex', claude: 'Claude Code' };
  const normalize = value => Object.hasOwn(names, value) ? value : 'codex';
  let skin = 'codex';
  try { skin = normalize(localStorage.getItem(key)); } catch {}
  document.documentElement.dataset.skin = skin;

  document.addEventListener('DOMContentLoaded', () => {
    const panel = document.getElementById('skinPanel');
    const triggers = [...document.querySelectorAll('.skin-trigger')];
    const options = [...panel.querySelectorAll('[data-skin-option]')];
    const status = document.getElementById('skinStatus');
    let opener;

    function update() {
      document.documentElement.dataset.skin = skin;
      options.forEach(option => {
        const selected = option.dataset.skinOption === skin;
        option.setAttribute('aria-checked', String(selected));
        option.tabIndex = selected ? 0 : -1;
      });
      triggers.forEach(trigger => { trigger.title = `设置 · ${names[skin]}`; });
    }

    function select(value) {
      skin = normalize(value);
      update();
      try {
        localStorage.setItem(key, skin);
        status.textContent = `已切换为 ${names[skin]} 皮肤`;
      } catch {
        status.textContent = `已切换为 ${names[skin]} 皮肤，浏览器未能保存设置`;
      }
    }

    function close(restoreFocus = false) {
      if (panel.hidden) return;
      panel.hidden = true;
      triggers.forEach(trigger => trigger.setAttribute('aria-expanded', 'false'));
      if (restoreFocus) opener?.focus({ preventScroll: true });
    }

    triggers.forEach(trigger => trigger.addEventListener('click', () => {
      if (!panel.hidden) { close(true); return; }
      opener = trigger;
      panel.hidden = false;
      triggers.forEach(button => button.setAttribute('aria-expanded', 'true'));
      options.find(option => option.dataset.skinOption === skin).focus({ preventScroll: true });
    }));
    document.getElementById('closeSkinPanel').addEventListener('click', () => close(true));
    options.forEach(option => option.addEventListener('click', () => {
      select(option.dataset.skinOption);
      close(true);
    }));
    panel.addEventListener('keydown', event => {
      if (!event.target.matches('[data-skin-option]')) return;
      const current = options.indexOf(event.target);
      let next;
      if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (current + 1) % options.length;
      else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (current - 1 + options.length) % options.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = options.length - 1;
      else return;
      event.preventDefault();
      select(options[next].dataset.skinOption);
      options[next].focus();
    });
    document.addEventListener('keydown', event => {
      if (!panel.hidden && event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }
    }, true);
    function outside(target) { return !panel.contains(target) && !triggers.some(trigger => trigger.contains(target)); }
    document.addEventListener('pointerdown', event => { if (outside(event.target)) close(); });
    document.addEventListener('focusin', event => { if (outside(event.target)) close(); });
    window.addEventListener('resize', () => close());
    window.addEventListener('storage', event => {
      if (event.key !== key && event.key !== null) return;
      skin = normalize(event.newValue);
      update();
    });
    update();
  });
})();
