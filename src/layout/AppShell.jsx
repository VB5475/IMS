import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileSpreadsheet,
  ClipboardList,
  FileText,
  ShoppingCart,
  PanelLeftClose,
  PanelLeft,
  Box,
  Bell,
  Search,
  Settings,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import { getDefaultRouteTitle, usePageHeaderContext } from "../context/PageHeaderContext";
import { useUser } from "../context/UserContext";
import "./AppShell.css";

const NAV_SECTIONS = [
  {
    label: "Home",
    items: [{ to: "/", icon: LayoutDashboard, label: "Dashboard", end: true }],
  },
  {
    label: "Modules",
    items: [
      { to: "/txn-entry", icon: FileSpreadsheet, label: "Invoices", end: false },
      { to: "/purchase-inquiry", icon: ClipboardList, label: "Purchase Inquiry", end: false },
      { to: "/purchase-quotation", icon: FileText, label: "Purchase Quotation", end: false },
      { to: "/purchase-order", icon: ShoppingCart, label: "Purchase Order", end: false },
    ],
  },
];

export default function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { header } = usePageHeaderContext() ?? { header: {} };
  const { userName, userId, logout } = useUser();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const title = header.title ?? getDefaultRouteTitle(location.pathname);
  const subtitle = header.subtitle ?? "FY 2025-26 · 01 Jun 2026";
  const profileInitial = (userName || userId || "U").charAt(0).toUpperCase();

  return (
    <div className={`ent-shell ${collapsed ? "ent-shell--collapsed" : ""}`}>
      <aside className="ent-sidebar">
        <div className="ent-sidebar__header">
          <div className="ent-sidebar__brand">
            <div className="ent-sidebar__logo">
              <Box size={16} strokeWidth={2} />
            </div>
            {!collapsed && (
              <div>
                <div className="ent-sidebar__name">Horizon Enterprise</div>
                <div className="ent-sidebar__tag">Business Suite</div>
              </div>
            )}
          </div>
          <button
            type="button"
            className="ent-sidebar__collapse"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
          </button>
        </div>

        <nav className="ent-sidebar__nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="ent-sidebar__section">
              {!collapsed && <div className="ent-sidebar__section-label">{section.label}</div>}
              {section.items.map(({ to, icon: Icon, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `ent-sidebar__link ${isActive ? "ent-sidebar__link--active" : ""}`
                  }
                  title={collapsed ? label : undefined}
                >
                  <span className="ent-sidebar__link-icon">
                    <Icon size={16} strokeWidth={1.5} />
                  </span>
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {!collapsed && (
          <div className="ent-sidebar__footer">
            <span className="ent-sidebar__version">v2.4.0</span>
          </div>
        )}
      </aside>

      <div className="ent-main">
        <header className="ent-topbar">
          <div className="ent-topbar__left">
            {header.showBack && (
              <button
                type="button"
                className="ent-topbar__back"
                onClick={() => navigate(header.backTo || "/")}
              >
                <ArrowLeft size={14} />
                Back
              </button>
            )}
            <div className="ent-topbar__titles">
              <h1 className="ent-topbar__title">{title}</h1>
              {subtitle && <p className="ent-topbar__subtitle">{subtitle}</p>}
            </div>
            <div className="ent-topbar__search">
              <Search size={14} />
              <input type="text" placeholder="Global Search..." />
            </div>
          </div>
          <div className="ent-topbar__actions">
            <button type="button" className="ent-topbar__icon-btn" aria-label="Notifications">
              <Bell size={16} strokeWidth={1.5} />
              <span className="ent-topbar__badge">3</span>
            </button>
            <button type="button" className="ent-topbar__icon-btn" aria-label="Settings">
              <Settings size={16} strokeWidth={1.5} />
            </button>
            <div className="ent-topbar__divider" />
            <div className="ent-topbar__profile-menu">
              <div className="ent-topbar__profile">
                <div className="ent-topbar__profile-text">
                  <span className="ent-topbar__profile-name">{userName || userId}</span>
                  <span className="ent-topbar__profile-role">{userId}</span>
                </div>
                <div className="ent-topbar__avatar">{profileInitial}</div>
              </div>
              <div className="ent-topbar__profile-dropdown">
                <div className="ent-topbar__profile-dropdown-panel">
                  <div className="ent-topbar__profile-dropdown-header">
                    <div className="ent-topbar__avatar ent-topbar__avatar--dropdown">
                      {profileInitial}
                    </div>
                    <div>
                      <div className="ent-topbar__profile-dropdown-name">{userName || userId}</div>
                      <div className="ent-topbar__profile-dropdown-id">{userId}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ent-topbar__profile-dropdown-logout"
                    onClick={handleLogout}
                  >
                    <LogOut size={14} strokeWidth={1.75} />
                    Log out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="ent-content enterprise-content">{children}</main>
      </div>
    </div>
  );
}
