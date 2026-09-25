// Heal with Movement — site configuration
// Replace placeholder Cal.com links and keys before launch.
window.HWM_CONFIG = {
  cal: {
    // Cal.com username/team + event type slugs. Replace with real calLinks.
    calLink: {
      vermont: "healwithmovement/vermont-private",
      montreal: "healwithmovement/montreal-private",
      virtual: "healwithmovement/virtual-group",
    },
    // Set to your Cal.com origin if self-hosted; leave default for cal.com
    origin: "https://cal.com",
  },
  turnstileSiteKey: "{{TURNSTILE_SITE_KEY}}",
  intakeApiEndpoint: "/api/intake",
  analytics: {
    provider: "plausible", // or "cloudflare"
    domain: "healwithmovement.com",
  },
  contactEmail: "heidi@healwithmovement.com",
};
