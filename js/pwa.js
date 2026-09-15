'use strict';

(() => {
  let deferredPrompt = null;

  const $ = (id) => document.getElementById(id);
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  function showInstallButton() {
    const button = $('installAppBtn');
    if (!button || isStandalone()) return;
    button.classList.remove('hidden');
  }

  function hideInstallButton() {
    const button = $('installAppBtn');
    if (button) button.classList.add('hidden');
  }

  function openHelp(message, title = 'Instalar SOS Orçamentos IA') {
    const modal = $('pwaInstallModal');
    const text = $('pwaInstallMessage');
    const heading = $('pwaInstallTitle');
    if (!modal || !text || !heading) return;
    heading.textContent = title;
    text.innerHTML = message;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeHelp() {
    const modal = $('pwaInstallModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  async function install() {
    if (isStandalone()) {
      openHelp('O aplicativo já está instalado neste aparelho.', 'Aplicativo instalado');
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (result.outcome === 'accepted') hideInstallButton();
      return;
    }

    if (isIOS()) {
      openHelp(
        '<b>No iPhone ou iPad:</b><br>1. Abra este endereço no <b>Safari</b>.<br>2. Toque no botão <b>Compartilhar</b>.<br>3. Escolha <b>Adicionar à Tela de Início</b>.<br>4. Confirme em <b>Adicionar</b>.'
      );
      return;
    }

    openHelp(
      '<b>No Chrome ou Edge:</b><br>1. Abra o menu do navegador.<br>2. Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.<br>3. Confirme a instalação.'
    );
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      if (registration.waiting) registration.waiting.postMessage('SKIP_WAITING');
    } catch (error) {
      console.error('[SOS Orçamentos IA] Falha ao registrar Service Worker:', error);
    }
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallButton();
    if (window.App && typeof window.App.toast === 'function') {
      window.App.toast('SOS Orçamentos IA instalado.');
    }
  });

  window.addEventListener('DOMContentLoaded', () => {
    registerServiceWorker();
    if (isStandalone()) {
      document.documentElement.classList.add('pwa-standalone');
      hideInstallButton();
    } else if (isIOS()) {
      showInstallButton();
    } else {
      window.setTimeout(() => {
        if (!isStandalone() && !deferredPrompt && /android|mobile/i.test(navigator.userAgent)) showInstallButton();
      }, 1800);
    }

    const modal = $('pwaInstallModal');
    if (modal) {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) closeHelp();
      });
    }
  });

  function loadSupplierTextFix() {
    if (document.querySelector('script[data-cotarp-supplier-text-fix]')) return;
    const script = document.createElement('script');
    script.src = 'js/comparador-v12.1.5-text-fix.js?v=12.1.5';
    script.dataset.cotarpSupplierTextFix = '12.1.5';
    script.onload = () => console.info('[COTARP] Correção da importação de texto V12.1.5 carregada.');
    script.onerror = () => console.error('[COTARP] Falha ao carregar correção V12.1.5 da importação de texto.');
    document.head.appendChild(script);
  }

  function loadVisionModelFix() {
    const existing = document.querySelector('script[data-cotarp-vision-model-fix]');
    if (existing) {
      loadSupplierTextFix();
      return;
    }
    const script = document.createElement('script');
    script.src = 'js/comparador-v12.1.4-model-fix.js?v=12.1.4';
    script.dataset.cotarpVisionModelFix = '12.1.4';
    script.onload = () => {
      console.info('[COTARP] Correção de acesso à visão V12.1.4 carregada.');
      loadSupplierTextFix();
    };
    script.onerror = () => {
      console.error('[COTARP] Falha ao carregar correção V12.1.4 de visão.');
      loadSupplierTextFix();
    };
    document.head.appendChild(script);
  }

  function loadComparatorFix() {
    const existing = document.querySelector('script[data-cotarp-comparator-fix]');
    if (existing) {
      loadVisionModelFix();
      return;
    }
    const script = document.createElement('script');
    script.src = 'js/comparador-v12.1.3-fix.js?v=12.1.3';
    script.dataset.cotarpComparatorFix = '12.1.3';
    script.onload = () => {
      console.info('[COTARP] Correção do comparador V12.1.3 carregada.');
      loadVisionModelFix();
    };
    script.onerror = () => console.error('[COTARP] Falha ao carregar correção V12.1.3 do comparador.');
    document.head.appendChild(script);
  }

  window.addEventListener('load', loadComparatorFix);

  window.PWAInstall = { install, closeHelp };
})();