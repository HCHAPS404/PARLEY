"use client";

import { AgGridReact, type AgGridReactProps } from "ag-grid-react";
import { AllEnterpriseModule, LicenseManager } from "ag-grid-enterprise";
import { ModuleRegistry, themeQuartz } from "ag-grid-community";

// Enterprise modules + licence must be set before any grid mounts.
ModuleRegistry.registerModules([AllEnterpriseModule]);
const license = process.env.NEXT_PUBLIC_AG_GRID_LICENSE;
if (license) LicenseManager.setLicenseKey(license);

const parleyTheme = themeQuartz.withParams({
  accentColor: "#0f766e",
  backgroundColor: "#fafaf9",
  headerBackgroundColor: "#f5f5f4",
  foregroundColor: "#1c1917",
  borderColor: "#e7e5e4",
  rowHoverColor: "#f0fdfa",
  fontFamily: "var(--font-inter), system-ui, sans-serif",
  headerFontFamily: "var(--font-space-grotesk), system-ui, sans-serif",
  fontSize: 13,
  spacing: 5,
});

export function DataGrid(props: AgGridReactProps) {
  return (
    <div className="h-full w-full">
      <AgGridReact theme={parleyTheme} {...props} />
    </div>
  );
}
