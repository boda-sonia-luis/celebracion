const RSVP_SHEET_URL =
    'https://script.google.com/macros/s/AKfycbyMQ6m-ECmoLZTfD68hAXAvOSbGMJFdnBpR91MawfNDGSJfVDs-QxAvCDnVYWQfOfeRVA/exec';
const RSVP_STORAGE_KEY = 'rsvp_responses';
const ASISTENCIA_CONFIRMADA = 'si';
const VIENE_ACOMPANADO = 'si';
const TOAST_DURATION_MS = 6000;
const SCROLLED_THRESHOLD_PX = 8;
const REVEAL_THRESHOLD = 0.15;
const ACTIVE_SECTION_MARGIN = '-45% 0px -50% 0px';
const SUBMIT_SENDING_TEXT = 'Enviando…';
const MENU_LABEL_OPEN = 'Abrir menú';
const MENU_LABEL_CLOSE = 'Cerrar menú';
const MISSING_FIELDS_MESSAGE = 'Por favor, completa todos los campos obligatorios.';
const SEND_ERROR_MESSAGE =
    'No hemos podido enviar tu respuesta. Por favor, inténtalo de nuevo en unos minutos.';

let toastHideTimeout = null;

document.addEventListener('DOMContentLoaded', function() {
    initHeaderShadow();
    initMobileMenu();
    initActiveNavLink();
    initReveal();
    initRsvpForm();
});

function initHeaderShadow() {
    const header = document.getElementById('siteHeader');

    function updateHeader() {
        header.classList.toggle('is-scrolled', window.scrollY > SCROLLED_THRESHOLD_PX);
    }

    window.addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();
}

function initMobileMenu() {
    const toggle = document.getElementById('navToggle');
    const menu = document.getElementById('navMenu');

    function setMenuOpen(isOpen) {
        menu.classList.toggle('is-open', isOpen);
        toggle.setAttribute('aria-expanded', String(isOpen));
        toggle.setAttribute('aria-label', isOpen ? MENU_LABEL_CLOSE : MENU_LABEL_OPEN);
    }

    toggle.addEventListener('click', function() {
        setMenuOpen(!menu.classList.contains('is-open'));
    });
    menu.querySelectorAll('.nav-link').forEach(function(link) {
        link.addEventListener('click', function() {
            setMenuOpen(false);
        });
    });
}

function initActiveNavLink() {
    const navLinks = Array.from(document.querySelectorAll('.nav-link'));
    const targets = navLinks.map(function(link) { return document.querySelector(link.hash); });
    const visibleTargets = new Set();

    function markActive(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                visibleTargets.add(entry.target);
            } else {
                visibleTargets.delete(entry.target);
            }
        });
        const current = targets.filter(function(target) { return visibleTargets.has(target); }).pop();
        navLinks.forEach(function(link, index) {
            link.classList.toggle('is-active', targets[index] === current);
        });
    }

    const observer = new IntersectionObserver(markActive, { rootMargin: ACTIVE_SECTION_MARGIN });
    targets.forEach(function(target) { observer.observe(target); });
}

function initReveal() {
    const observer = new IntersectionObserver(function(entries) {
        entries
            .filter(function(entry) { return entry.isIntersecting; })
            .forEach(function(entry) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
    }, { threshold: REVEAL_THRESHOLD });

    document.querySelectorAll('.reveal').forEach(function(element) {
        observer.observe(element);
    });
}

function initRsvpForm() {
    const form = document.getElementById('rsvp-form');
    const fields = getRsvpFields(form);

    fields.asistencia.addEventListener('change', function() { updateCompanionFields(fields); });
    fields.acompanante.addEventListener('change', function() { updateCompanionFields(fields); });
    fields.mensaje.addEventListener('input', function() { updateCharCounter(fields); });
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        submitRsvp(form, fields);
    });
}

function getRsvpFields(form) {
    return {
        nombre: form.elements.nombre,
        email: form.elements.email,
        asistencia: form.elements.asistencia,
        acompanante: form.elements.acompanante,
        nombreAcompanante: form.elements.nombreAcompanante,
        mensaje: form.elements.mensaje,
        acompananteGroup: document.getElementById('acompananteGroup'),
        nombreAcompananteGroup: document.getElementById('nombreAcompananteGroup'),
        counter: document.getElementById('mensajeCounter'),
        submitButton: form.querySelector('button[type="submit"]')
    };
}

function setFieldVisible(group, field, isVisible) {
    group.hidden = !isVisible;
    field.disabled = !isVisible;
    if (!isVisible) {
        field.value = '';
    }
}

function updateCompanionFields(fields) {
    const attends = fields.asistencia.value === ASISTENCIA_CONFIRMADA;
    setFieldVisible(fields.acompananteGroup, fields.acompanante, attends);

    const bringsCompanion = fields.acompanante.value === VIENE_ACOMPANADO;
    setFieldVisible(fields.nombreAcompananteGroup, fields.nombreAcompanante, bringsCompanion);
}

function updateCharCounter(fields) {
    fields.counter.textContent = fields.mensaje.value.length + '/' + fields.mensaje.maxLength;
}

function readRsvpData(fields) {
    return {
        nombre: fields.nombre.value.trim(),
        asistencia: fields.asistencia.value,
        acompanante: fields.acompanante.value,
        nombreAcompanante: fields.nombreAcompanante.value.trim(),
        email: fields.email.value.trim(),
        mensaje: fields.mensaje.value.trim()
    };
}

function isRsvpComplete(data, fields) {
    const companionMissing = !fields.acompanante.disabled && !data.acompanante;
    const companionNameMissing = !fields.nombreAcompanante.disabled && !data.nombreAcompanante;
    const emailValid = fields.email.checkValidity();

    return Boolean(data.nombre && emailValid && data.asistencia) &&
        !companionMissing && !companionNameMissing;
}

function submitRsvp(form, fields) {
    const data = readRsvpData(fields);

    if (!isRsvpComplete(data, fields)) {
        showToast(MISSING_FIELDS_MESSAGE);
        return;
    }

    setSubmitting(fields.submitButton, true);
    sendRsvp(data)
        .then(function() { handleRsvpSuccess(form, fields, data); })
        .catch(function(error) {
            console.error('Error enviando RSVP a la hoja de cálculo:', error);
            showToast(SEND_ERROR_MESSAGE);
        })
        .finally(function() { setSubmitting(fields.submitButton, false); });
}

function setSubmitting(button, isSubmitting) {
    if (isSubmitting) {
        button.dataset.label = button.innerHTML;
        button.textContent = SUBMIT_SENDING_TEXT;
    } else {
        button.innerHTML = button.dataset.label;
    }
    button.disabled = isSubmitting;
}

function sendRsvp(data) {
    return fetch(RSVP_SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(data)
    })
        .then(function(response) { return response.json(); })
        .then(function(result) {
            if (result.result !== 'ok') {
                throw new Error(result.message || 'No se pudo enviar la confirmación');
            }
        });
}

function handleRsvpSuccess(form, fields, data) {
    showToast('¡Gracias, ' + data.nombre + '! Hemos recibido tu respuesta.');
    form.reset();
    updateCompanionFields(fields);
    updateCharCounter(fields);
    saveRsvpLocally(data);
}

function saveRsvpLocally(data) {
    try {
        const saved = JSON.parse(localStorage.getItem(RSVP_STORAGE_KEY) || '[]');
        saved.push(Object.assign({ fecha: new Date().toISOString() }, data));
        localStorage.setItem(RSVP_STORAGE_KEY, JSON.stringify(saved));
    } catch (error) {
        console.warn('No se pudo guardar la confirmación en este navegador:', error);
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');

    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastHideTimeout);
    toastHideTimeout = setTimeout(function() {
        toast.classList.remove('visible');
    }, TOAST_DURATION_MS);
}
