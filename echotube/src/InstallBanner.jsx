import { useEffect, useState } from 'react';

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('install_banner_dismissed') === 'true'
  );

  useEffect(() => {
    if (isStandalone()) return;

    const onBeforeInstall = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem('install_banner_dismissed', 'true');
  };

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  };

  if (dismissed || isStandalone()) return null;

  if (deferredPrompt) {
    return (
      <div className="install-banner">
        <div>
          <strong>Install EchoTube</strong>
          <p>Add to your home screen for background play and lock screen controls.</p>
        </div>
        <div className="install-banner-actions">
          <button type="button" className="install-banner-btn primary" onClick={installApp}>
            Install
          </button>
          <button type="button" className="install-banner-btn" onClick={dismiss}>
            Later
          </button>
        </div>
      </div>
    );
  }

  if (isIos() && !showIosHelp) {
    return (
      <div className="install-banner">
        <div>
          <strong>Use EchoTube as an app</strong>
          <p>Install it to your home screen for background playback.</p>
        </div>
        <div className="install-banner-actions">
          <button type="button" className="install-banner-btn primary" onClick={() => setShowIosHelp(true)}>
            How to install
          </button>
          <button type="button" className="install-banner-btn" onClick={dismiss}>
            Later
          </button>
        </div>
      </div>
    );
  }

  if (isIos() && showIosHelp) {
    return (
      <div className="install-banner">
        <div>
          <strong>Install on iPhone</strong>
          <p>Tap Share, then choose <strong>Add to Home Screen</strong>.</p>
        </div>
        <button type="button" className="install-banner-btn" onClick={dismiss}>
          Got it
        </button>
      </div>
    );
  }

  return null;
}
