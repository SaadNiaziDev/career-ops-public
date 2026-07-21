import type { ThemeConfig } from "antd";

/** Maps career-ops brand tokens onto Ant Design — dossier / pipeline aesthetic. */
export function antdTheme(dark: boolean): ThemeConfig {
  return {
    cssVar: { key: "co" },
    token: {
      colorPrimary: dark ? "#dd7627" : "#b85a18",
      colorBgBase: dark ? "#0a0a0a" : "#f7f6f3",
      colorBgContainer: dark ? "#161616" : "#ffffff",
      colorBorder: dark ? "#262626" : "hsl(40 9% 86%)",
      colorText: dark ? "#fafafa" : "hsl(30 10% 11%)",
      colorTextSecondary: dark ? "#a1a1aa" : "hsl(35 9% 34%)",
      colorWarning: dark ? "#fbbf24" : "#d97706",
      borderRadius: 12,
      borderRadiusLG: 16,
      fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      fontSize: 14,
      boxShadowTertiary: dark
        ? "0 1px 2px rgba(0,0,0,0.45)"
        : "0 1px 3px rgba(30,20,10,0.06), 0 1px 2px rgba(30,20,10,0.04)",
    },
    components: {
      Menu: {
        itemBg: "transparent",
        itemSelectedBg: dark ? "rgba(221, 118, 39, 0.14)" : "rgba(221, 118, 39, 0.12)",
        itemSelectedColor: dark ? "#dd7627" : "#b85a18",
        itemBorderRadius: 10,
      },
      Table: {
        headerBg: dark ? "#111111" : "#f2f1ed",
        rowHoverBg: dark ? "#232323" : "#efeeea",
        borderRadius: 12,
      },
      Card: {
        paddingLG: 20,
        headerFontSize: 15,
      },
      Tabs: {
        inkBarColor: dark ? "#dd7627" : "#b85a18",
        itemSelectedColor: dark ? "#dd7627" : "#b85a18",
      },
      Statistic: {
        titleFontSize: 12,
        contentFontSize: 28,
      },
      Button: {
        primaryShadow: "none",
      },
    },
  };
}
