"use client";

import { useEffect, useState } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, theme as antTheme } from "antd";
import { antdTheme } from "@/lib/antd-theme";

function useDarkMode(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains("dark"));
    read();
    const obs = new MutationObserver(read);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export function AntdProvider({ children }: { children: React.ReactNode }) {
  const dark = useDarkMode();
  return (
    <AntdRegistry>
      <ConfigProvider
        theme={{
          ...antdTheme(dark),
          algorithm: dark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        }}
      >
        {children}
      </ConfigProvider>
    </AntdRegistry>
  );
}
