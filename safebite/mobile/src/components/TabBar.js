// TabBar.js - the Scan / History / Profile bar at the bottom of the screen

import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../theme";

// the tabs in order (filled icon when picked, outline when not)
export const TABS = [
  { key: "scan", label: "Scan", icon: "scan", inactiveIcon: "scan-outline" },
  { key: "history", label: "History", icon: "time", inactiveIcon: "time-outline" },
  { key: "profile", label: "Profile", icon: "person-circle", inactiveIcon: "person-circle-outline" },
];

// activeTab is the tab that's showing, onSelectTab runs when you tap one
export default function TabBar({ activeTab, onSelectTab }) {
  // extra space at the bottom so the tabs don't sit under the iPhone home bar
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(safeAreaInsets.bottom, 8) }]}>
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        const tabColor = isActive ? colors.brandTeal : colors.textSecondary;

        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => onSelectTab(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons
              name={isActive ? tab.icon : tab.inactiveIcon}
              size={25}
              color={tabColor}
            />
            <Text style={[styles.tabLabel, { color: tabColor }, isActive && styles.activeLabel]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surfaceWhite,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
  },
  tab: {
    flex: 1, // all tabs are the same width
    alignItems: "center",
    gap: 2,
    paddingVertical: 2,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  activeLabel: {
    fontWeight: "700",
  },
});
