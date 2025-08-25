// client/src/layouts/DashboardLayout.jsx
import React from "react";
import DashHeader from "../components/DashHeader";
import DashFooter from "../components/DashFooter";
import "../styles/DashboardLayout.css";

const DashboardLayout = ({ children }) => {
  return (
    <div className="dashboard-layout">
      <DashHeader />
      <main className="dashboard-content">{children}</main>
      <DashFooter />
    </div>
  );
};

export default DashboardLayout;
