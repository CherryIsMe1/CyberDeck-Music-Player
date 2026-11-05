(() => {
    document.addEventListener('DOMContentLoaded', () => {
        const userAgent = navigator.userAgent || '';
        const isLinuxTauri = typeof window.__TAURI__ !== 'undefined'
            && /Linux/i.test(userAgent)
            && !/Android/i.test(userAgent);

        if (!isLinuxTauri) return;

        document.body.classList.add('linux-app');
        ['themeSelect', 'presetSelect', 'sortSelect'].forEach((id) => {
            enhanceLinuxSelect(document.getElementById(id));
        });
    });

    function enhanceLinuxSelect(select) {
        if (!select || select.dataset.linuxSelectEnhanced) return;

        const wrapper = document.createElement('div');
        const variant = select.id === 'presetSelect' ? 'preset' : (select.id === 'themeSelect' ? 'theme' : 'sort');
        wrapper.className = `linux-select linux-select--${variant}`;

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'linux-select-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-label', variant === 'preset' ? 'Equalizer preset' : (variant === 'theme' ? 'Select theme' : 'Sort tracks'));

        const menu = document.createElement('div');
        menu.id = `linux-${select.id}-listbox`;
        menu.className = `linux-select-menu linux-select-menu--${variant}`;
        menu.setAttribute('role', 'listbox');
        menu.setAttribute('aria-label', variant === 'preset' ? 'Equalizer presets' : (variant === 'theme' ? 'Available themes' : 'Sort tracks by'));
        menu.hidden = true;
        trigger.setAttribute('aria-controls', menu.id);

        const parent = select.parentElement;
        parent.insertBefore(wrapper, select);
        wrapper.append(trigger, select);
        document.body.appendChild(menu);

        select.dataset.linuxSelectEnhanced = 'true';
        select.classList.add('linux-select-source');
        select.setAttribute('aria-hidden', 'true');
        select.tabIndex = -1;

        let optionButtons = [];

        function rebuildOptions() {
            menu.replaceChildren();
            optionButtons = Array.from(select.options, (option, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'linux-select-option';
                button.setAttribute('role', 'option');
                button.dataset.optionIndex = String(index);
                button.textContent = option.textContent.trim();
                button.disabled = option.disabled;
                button.tabIndex = -1;
                menu.appendChild(button);

                button.addEventListener('click', () => {
                    if (button.disabled) return;
                    const changed = select.value !== option.value;
                    select.value = option.value;
                    syncSelection();
                    closeMenu(true);
                    if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
                });
                return button;
            });
        }

        rebuildOptions();

        // Observe dynamic options additions/deletions (e.g. custom themes)
        const observer = new MutationObserver(() => {
            rebuildOptions();
            syncSelection();
        });
        observer.observe(select, { childList: true });

        function syncSelection() {
            const selectedOption = select.options[select.selectedIndex];
            trigger.textContent = selectedOption ? selectedOption.textContent.trim() : 'SELECT';
            trigger.title = trigger.textContent;
            optionButtons.forEach((button, index) => {
                const selected = index === select.selectedIndex;
                button.setAttribute('aria-selected', String(selected));
                button.classList.toggle('is-selected', selected);
            });
        }

        function openMenu(focusSelected) {
            if (select.disabled) return;
            menu.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
            positionMenu();
            const active = optionButtons.find((button, index) => !button.disabled && index === select.selectedIndex)
                || optionButtons.find((button) => !button.disabled);
            optionButtons.forEach((button) => { button.tabIndex = -1; });
            if (active) {
                active.tabIndex = 0;
                if (focusSelected) active.focus();
            }
        }

        function positionMenu() {
            const bounds = trigger.getBoundingClientRect();
            const maxHeight = Math.max(140, Math.min(300, window.innerHeight - 24));
            menu.style.maxHeight = `${maxHeight}px`;

            const minWidth = variant === 'sort' ? 200 : (variant === 'preset' ? 175 : 110);
            menu.style.width = 'auto';
            const naturalWidth = menu.scrollWidth + 14;
            const width = Math.min(Math.max(bounds.width, minWidth, naturalWidth), window.innerWidth - 16);

            const alignRight = variant === 'sort' || variant === 'preset' || variant === 'theme';
            const left = Math.max(8, Math.min(
                alignRight ? bounds.right - width : bounds.left,
                window.innerWidth - width - 8
            ));

            const height = Math.min(menu.scrollHeight, maxHeight);
            const canOpenAbove = (variant === 'preset' || bounds.bottom + height > window.innerHeight - 8)
                && bounds.top > height + 8;
            const top = canOpenAbove
                ? bounds.top - height - 4
                : Math.max(8, Math.min(bounds.bottom + 4, window.innerHeight - height - 8));

            menu.style.left = `${Math.round(left)}px`;
            menu.style.top = `${Math.round(top)}px`;
            menu.style.width = `${Math.round(width)}px`;
        }

        function closeMenu(restoreFocus) {
            menu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            optionButtons.forEach((button) => { button.tabIndex = -1; });
            if (restoreFocus) trigger.focus();
        }

        function focusOption(index) {
            const enabled = optionButtons.filter((button) => !button.disabled);
            if (enabled.length === 0) return;
            enabled.forEach((button) => { button.tabIndex = -1; });
            const target = enabled[(index + enabled.length) % enabled.length];
            target.tabIndex = 0;
            target.focus();
        }

        function moveFocusFromTrigger(reverse) {
            const focusable = Array.from(document.querySelectorAll(
                'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
            )).filter((element) => element.getClientRects().length > 0
                && !menu.contains(element)
                && !element.closest('[aria-hidden="true"]'));
            const triggerIndex = focusable.indexOf(trigger);
            const target = focusable[triggerIndex + (reverse ? -1 : 1)];
            closeMenu(false);
            if (target) target.focus();
        }

        trigger.addEventListener('click', () => {
            if (menu.hidden) openMenu(true);
            else closeMenu(true);
        });

        trigger.addEventListener('keydown', (event) => {
            if (!['ArrowDown', 'ArrowUp', ' ', 'Enter'].includes(event.key)) return;
            event.stopPropagation();
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                openMenu(true);
            }
        });

        menu.addEventListener('keydown', (event) => {
            event.stopPropagation();
            const current = optionButtons.indexOf(document.activeElement);
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    focusOption(current + 1);
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    focusOption(current - 1);
                    break;
                case 'Home':
                    event.preventDefault();
                    focusOption(0);
                    break;
                case 'End':
                    event.preventDefault();
                    focusOption(optionButtons.length - 1);
                    break;
                case 'Enter':
                case ' ':
                    event.preventDefault();
                    if (optionButtons[current]) optionButtons[current].click();
                    break;
                case 'Escape':
                    event.preventDefault();
                    closeMenu(true);
                    break;
                case 'Tab':
                    event.preventDefault();
                    moveFocusFromTrigger(event.shiftKey);
                    break;
            }
        });

        document.addEventListener('pointerdown', (event) => {
            if (!wrapper.contains(event.target) && !menu.contains(event.target)) closeMenu(false);
        });
        document.addEventListener('scroll', (event) => {
            if (!menu.hidden && !menu.contains(event.target)) closeMenu(false);
        }, true);
        window.addEventListener('resize', () => closeMenu(false));
        select.addEventListener('change', syncSelection);
        syncSelection();
    }
})();
