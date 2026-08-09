import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/common/AppShell";
import { Dashboard } from "@/pages/Dashboard/Dashboard";
import { Generator } from "@/pages/Generator/Generator";
import { Batches } from "@/pages/Batches/Batches";
import { BatchDetail } from "@/pages/BatchDetail/BatchDetail";
import { Gallery } from "@/pages/Gallery/Gallery";
import { Settings } from "@/pages/Settings/Settings";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate replace to="/dashboard" />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/generator" element={<Generator />} />
        <Route path="/batches" element={<Batches />} />
        <Route path="/batches/:batchId" element={<BatchDetail />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
