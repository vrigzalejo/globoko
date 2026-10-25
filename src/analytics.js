const ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

/** Load gtag only when a measurement ID is set for this build. */
export function startAnalytics() {
  if (typeof ID !== 'string' || !/^G-[A-Z0-9]+$/i.test(ID)) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', ID);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ID)}`;
  document.head.appendChild(script);
}
