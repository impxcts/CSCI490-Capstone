/**
 * theme.js - SafeBite's color palette.
 *
 * Every screen imports its colors from here instead of typing hex codes
 * directly, so changing a color in one place changes it everywhere.
 * The colors match the pitch deck.
 */

export const colors = {
  textPrimary: "#0B2B2E", // main text
  textSecondary: "#4C6B6E", // hints, labels, timestamps
  brandDark: "#013A40", // dark teal: logo text, camera panel background
  brandTeal: "#028090", // buttons and links
  brandMint: "#02C39A", // success messages, scan frame
  screenBackground: "#F4FAF9", // very light teal behind every screen
  surfaceWhite: "#FFFFFF", // text inputs, light buttons
  borderLight: "#D6E7E5", // input borders, list dividers
  lightTealText: "#BFE3E0", // secondary text on the dark camera panel
  errorText: "#B42318", // error messages
  errorBackground: "#FDECEA", // box behind error messages
  errorTextOnDark: "#FFB4AB", // error messages on the dark camera panel
  scanHintBackground: "rgba(1,58,64,0.8)", // see-through dark teal behind camera hint
};
