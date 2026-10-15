// ScanResult.js - what shows up after a barcode gets checked:
// the verdict, the product, the reasons why, the ingredients, and some buttons

import { useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, reasonColors, verdictStyles } from "../theme";
import SaferSwaps from "./SaferSwaps";

// the short sentence under each verdict
const VERDICT_SUMMARIES = {
  avoid: "This contains something on your avoid list.",
  caution: "Something here needs a closer look before you eat it.",
  safe: "Nothing from your avoid list was found in the ingredients.",
  unchecked: "Add what you avoid in your profile to get a verdict.",
};

// the icon next to each reason
const REASON_ICONS = {
  avoid: "close-circle",
  caution: "alert-circle",
  safe: "checkmark-circle",
  info: "information-circle",
};

// link to the product's page on Open Food Facts
const OPEN_FOOD_FACTS_PRODUCT_PAGE = "https://world.openfoodfacts.org/product/";

// scan is the result from the backend, session is who's logged in,
// onSessionExpired logs them out, onScanAnother goes back to the camera,
// onOpenProfile switches to the Profile tab, and onCheckSwap checks a safer swap
export default function ScanResult({
  scan,
  session,
  onSessionExpired,
  onScanAnother,
  onOpenProfile,
  onCheckSwap,
}) {
  // whether the ingredient list is open
  const [areIngredientsShown, setAreIngredientsShown] = useState(false);

  const verdictStyle = verdictStyles[scan.verdict] ?? verdictStyles.unchecked;
  const product = scan.product;
  const wasProductFound = Boolean(product?.was_found);
  const needsProfile = scan.verdict === "unchecked";

  // only offer swaps when there's a problem with a product we know about
  const canSuggestSwaps =
    wasProductFound && (scan.verdict === "avoid" || scan.verdict === "caution");

  return (
    <View style={styles.container}>
      {/* the colored verdict banner */}
      <View
        style={[styles.verdictBanner, { backgroundColor: verdictStyle.backgroundColor }]}
        accessible
        accessibilityLabel={`${verdictStyle.label}. ${VERDICT_SUMMARIES[scan.verdict] ?? ""}`}
      >
        <Ionicons name={verdictStyle.icon} size={44} color={verdictStyle.textColor} />
        <View style={styles.verdictTextGroup}>
          <Text style={[styles.verdictLabel, { color: verdictStyle.textColor }]}>
            {verdictStyle.label}
          </Text>
          <Text style={[styles.verdictSummary, { color: verdictStyle.textColor }]}>
            {VERDICT_SUMMARIES[scan.verdict]}
          </Text>
        </View>
      </View>

      {/* the product */}
      <View style={styles.card}>
        <View style={styles.productRow}>
          {product?.image_url ? (
            <Image
              source={{ uri: product.image_url }}
              style={styles.productImage}
              accessibilityIgnoresInvertColors
            />
          ) : (
            // placeholder icon if there's no photo
            <View style={[styles.productImage, styles.productImagePlaceholder]}>
              <Ionicons name="fast-food-outline" size={26} color={colors.textSecondary} />
            </View>
          )}
          <View style={styles.productTextGroup}>
            <Text style={styles.productName} numberOfLines={2}>
              {wasProductFound ? product.name || "Unnamed product" : "Unknown product"}
            </Text>
            {product?.brand ? <Text style={styles.productBrand}>{product.brand}</Text> : null}
            <Text style={styles.productBarcode}>Barcode {scan.barcode}</Text>
          </View>
        </View>
      </View>

      {/* the reasons */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Why</Text>
        {scan.reasons.map((reason, reasonIndex) => (
          <View key={reasonIndex} style={styles.reasonRow}>
            <Ionicons
              name={REASON_ICONS[reason.level] ?? REASON_ICONS.info}
              size={18}
              color={reasonColors[reason.level] ?? reasonColors.info}
              style={styles.reasonIcon}
            />
            <Text style={styles.reasonText}>{reason.message}</Text>
          </View>
        ))}

        {/* the ingredients (hidden until you tap since they can be long) */}
        {product?.ingredients_text ? (
          <>
            <Pressable
              style={styles.ingredientsToggle}
              onPress={() => setAreIngredientsShown(!areIngredientsShown)}
              accessibilityRole="button"
              accessibilityState={{ expanded: areIngredientsShown }}
            >
              <Text style={styles.linkText}>
                {areIngredientsShown ? "Hide ingredients" : "Show ingredients"}
              </Text>
              <Ionicons
                name={areIngredientsShown ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.brandTeal}
              />
            </Pressable>
            {areIngredientsShown ? (
              // take out the underscores Open Food Facts puts around allergens
              <Text style={styles.ingredientsText} selectable>
                {product.ingredients_text.replace(/_/g, "")}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>

      {/* safer swaps (only for Avoid and Caution) */}
      {canSuggestSwaps ? (
        <SaferSwaps
          barcode={scan.barcode}
          session={session}
          onSessionExpired={onSessionExpired}
          onCheckSwap={onCheckSwap}
        />
      ) : null}

      {/* buttons */}
      {needsProfile ? (
        <Pressable style={styles.primaryButton} onPress={onOpenProfile} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>Set up my profile</Text>
        </Pressable>
      ) : null}
      <Pressable
        style={needsProfile ? styles.secondaryButton : styles.primaryButton}
        onPress={onScanAnother}
        accessibilityRole="button"
      >
        <Ionicons
          name="scan"
          size={18}
          color={needsProfile ? colors.brandTeal : colors.surfaceWhite}
        />
        <Text style={needsProfile ? styles.secondaryButtonText : styles.primaryButtonText}>
          Scan another
        </Text>
      </Pressable>

      {/* credit Open Food Facts for the product info */}
      {wasProductFound ? (
        <Pressable
          onPress={() => Linking.openURL(OPEN_FOOD_FACTS_PRODUCT_PAGE + scan.barcode)}
          accessibilityRole="link"
        >
          <Text style={styles.creditText}>
            Product info from Open Food Facts (ODbL). Always check the label.
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.creditText}>Always check the label before eating.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12, // space between the cards
  },

  // verdict banner
  verdictBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 18,
  },
  verdictTextGroup: {
    flex: 1,
  },
  verdictLabel: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  verdictSummary: {
    fontSize: 15,
    lineHeight: 20,
    marginTop: 2,
    fontWeight: "500",
  },

  // cards
  card: {
    backgroundColor: colors.surfaceWhite,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.surfaceWhite,
  },
  productImagePlaceholder: {
    backgroundColor: colors.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
  },
  productTextGroup: {
    flex: 1, // fill the space next to the image
  },
  productName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  productBrand: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  productBarcode: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // reasons
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 5,
  },
  reasonIcon: {
    marginTop: 1, // lines the icon up with the text
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  ingredientsToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  linkText: {
    color: colors.brandTeal,
    fontSize: 15,
    fontWeight: "600",
  },
  ingredientsText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 6,
  },

  // buttons
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandTeal,
    borderRadius: 12,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: colors.surfaceWhite,
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: colors.brandTeal,
  },
  secondaryButtonText: {
    color: colors.brandTeal,
    fontSize: 16,
    fontWeight: "700",
  },
  creditText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: 4,
  },
});
