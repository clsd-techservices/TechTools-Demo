/*
 * CLSD demo site configuration
 * -------------------------------------------------------------
 * Used only on the hosted demo site. Every tool runs in demo mode against
 * sample data, and the CLSD branding is locked so visitors trying the setup
 * wizard can't restyle the presenter's screen.
 *
 * Copyright (c) 2026 Scott Boyer, Systems Coordinator, CLSD Technology Services. MIT License (see LICENSE).
 */
window.KIT_CONFIG = {
  configured: true,
  version: 1,
  demo: true,
  lockBranding: true,
  origin: true,

  identity: {
    districtName:  "Cornwall-Lebanon School District",
    districtShort: "CLSD",
    deptName:      "Technology Services",
    portalName:    "Tech Tools",
    authorName:    "Scott Boyer",
    authorTitle:   "Systems Coordinator",
    supportEmail:  "",
    logFolder:     "CLSD"
  },

  brand: {
    primary:   "#113699",
    secondary: "#5a8ff5",
    bgTint:    "navy",
    logo:      "assets/techtools-logo.png",
    watermark: "assets/Blue_Falcon2.png",
    watermarkOpacity: 0.05
  },

  microsoft: {
    tenantId: "",
    clientId: "",
    primaryDomain: "",
    groupTagExamples: "Staff-CW, 1to1-MS, Cart-HS"
  },

  ai: {
    provider: "anthropic",
    model: "",
    fallbackProvider: "groq",
    fallbackModel: "",
    keyStorage: "browser",
    keys: {}
  }
};
