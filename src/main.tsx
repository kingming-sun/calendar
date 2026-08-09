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
          colorPrimary: "#4ee3ff",
          colorSuccess: "#63e6a7",
          colorWarning: "#f3b35b",
          colorError: "#ff6678",
          colorBgBase: "#081119",
          colorTextBase: "#e9f7ff",
          borderRadius: 16,
          fontFamily:
            "Manrope, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
        },
        components: {
          Layout: {
            bodyBg: "#081119",
            siderBg: "rgba(6, 13, 20, 0.86)"
          },
          Card: {
            colorBgContainer: "rgba(13, 27, 39, 0.86)"
          },
          Table: {
            colorBgContainer: "transparent",
            headerBg: "rgba(233, 247, 255, 0.045)"
          }
        }
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
