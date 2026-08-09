import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import App from "@/app/App";
import "@/styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#32d5ff",
          colorSuccess: "#41d681",
          colorWarning: "#f6b443",
          colorError: "#ff5f6d",
          borderRadius: 14,
          fontFamily:
            "Avenir Next, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
        },
        components: {
          Layout: {
            bodyBg: "#101923",
            siderBg: "rgba(12, 20, 29, 0.92)"
          },
          Card: {
            colorBgContainer: "rgba(20, 33, 45, 0.72)"
          }
        }
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
