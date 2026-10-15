// theme.js - all the app's colors in one place

export const colors = {
  textPrimary: "#0B2B2E", // main text
  textSecondary: "#4C6B6E", // lighter text like hints and timestamps
  brandDark: "#013A40", // dark teal (logo, camera background)
  brandTeal: "#028090", // buttons and links
  brandMint: "#02C39A", // the scan frame
  screenBackground: "#F4FAF9", // light teal behind every screen
  surfaceWhite: "#FFFFFF", // cards, inputs, light buttons
  surfaceTint: "#E6F2F1", // light backgrounds like image placeholders
  borderLight: "#D6E7E5", // borders and dividers
  lightTealText: "#BFE3E0", // text on the dark camera panel
  errorText: "#B42318", // error messages
  errorBackground: "#FDECEA", // box behind error messages
  scanHintBackground: "rgba(1,58,64,0.8)", // see-through teal behind the camera hint
};

// the look of each verdict: dark text on a light background, plus an icon
// (icon names come from https://icons.expo.fyi)
export const verdictStyles = {
  avoid: {
    label: "Avoid",
    headline: "Avoid this product",
    icon: "close-circle",
    textColor: "#B42318",
    backgroundColor: "#FEE4E2",
  },
  caution: {
    label: "Caution",
    headline: "Check before eating",
    icon: "alert-circle",
    textColor: "#93370D",
    backgroundColor: "#FEF0C7",
  },
  safe: {
    label: "Safe",
    headline: "No triggers found",
    icon: "checkmark-circle",
    textColor: "#067647",
    backgroundColor: "#DCFAE6",
  },
  unchecked: {
    label: "Not checked",
    headline: "Set up your profile",
    icon: "help-circle",
    textColor: "#4C6B6E",
    backgroundColor: "#E6F2F1",
  },
};

// icon colors for each reason in the "Why" list
export const reasonColors = {
  avoid: verdictStyles.avoid.textColor,
  caution: verdictStyles.caution.textColor,
  safe: verdictStyles.safe.textColor,
  info: colors.textSecondary,
};
