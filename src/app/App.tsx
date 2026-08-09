import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { App as AntApp } from "antd";
import { AppRouter } from "@/app/router";
import { useAppStore } from "@/stores/appStore";

export default function App() {
  const initialize = useAppStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <AntApp>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AntApp>
  );
}
