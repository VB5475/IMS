import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileSpreadsheet,
  ClipboardList,
  FileText,
  ShoppingCart,
  Receipt,
  PackageCheck,
  Layers,
  Tag,
  MapPin,
  Network,
  Package,
  TrendingDown,
  UserRound,
  RotateCcw,
  FileX,
  DoorOpen,
  DoorClosed,
  ArrowLeftRight,
  Package2,
  LayoutList,
  Users,
  Shield,
  KeyRound,
  Building2,
  HeartPulse,
  Handshake,
  MessageSquareWarning,
  Building,
  FolderTree,
  Landmark,
  Truck,
  UserCheck,
  Scale,
  PanelLeftClose,
  PanelLeft,
  Bell,
  Search,
  Settings,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import { getDefaultRouteTitle, usePageHeaderContext } from "../context/PageHeaderContext";
import { useUser } from "../context/UserContext";
import { PROD_BASE_PROJECT, BASE_PROJECT_OPTIONS, switchBaseProject } from "../api/constants";
import "./AppShell.css";

const BRAND_LOGO_SRC = "/test.png";

const NAV_SECTIONS = [
  {
    label: "Home",
    items: [{ to: "/", icon: LayoutDashboard, label: "Dashboard", end: true }],
  },
  {
    label: "Master",
    items: [
      { to: "/admin/user-master", icon: Users, label: "User Master", end: false },
      { to: "/admin/user-group", icon: Shield, label: "User Group", end: false },
      { to: "/admin/division-wise-rights", icon: KeyRound, label: "Division Wise Rights", end: false },
      { to: "/admin/item-master", icon: Package, label: "Item Master", end: false },
      { to: "/admin/department-master", icon: Building2, label: "Department Master", end: false },
      { to: "/admin/company", icon: Building, label: "Company", end: false },
      { to: "/admin/main-group-master", icon: Tag, label: "Main Group Master", end: false },
      { to: "/admin/master/item/sub-main-group-master", icon: Layers, label: "Sub Main Group Master", end: false },
      { to: "/admin/master/item/sub-group-master", icon: Package, label: "Sub Group Master", end: false },
      { to: "/admin/company/location-master", icon: MapPin, label: "Location Master", end: false },
      { to: "/admin/company/division-master", icon: Network, label: "Division Master", end: false },
      { to: "/admin/master/supplier-master", icon: Truck, label: "Supplier Master", end: false },
      { to: "/admin/master/customer-master", icon: UserCheck, label: "Customer Master", end: false },
      { to: "/account/master/asset-item-master", icon: LayoutList, label: "Asset Item Master", end: false },
      { to: "/admin/account-group-master", icon: FolderTree, label: "Account Group Master", end: false },
      { to: "/admin/account-master", icon: Landmark, label: "Account Master", end: false },
    ],
  },
  {
    label: "Purchase",
    items: [
      { to: "/purchase-indent", icon: ShoppingCart, label: "Purchase Indent", end: false },
      { to: "/purchase-inquiry", icon: ClipboardList, label: "Purchase Inquiry", end: false },
      { to: "/purchase-quotation", icon: FileText, label: "Purchase Quotation", end: false },
      { to: "/purchase-quotation-comparison", icon: Scale, label: "Purchase Quotation Comparison", end: false },
      { to: "/purchase-order", icon: ShoppingCart, label: "Purchase Order", end: false },
      { to: "/goods-received-note", icon: PackageCheck, label: "Goods Received Note", end: false },
      { to: "/purchase-voucher", icon: Receipt, label: "Purchase Voucher", end: false },
      { to: "/txn-entry", icon: FileSpreadsheet, label: "Invoices", end: false },
    ],
  },
  {
    label: "Assets",
    items: [
      { to: "/cwip-to-fa", icon: Layers, label: "CWIP To FA", end: false },
      { to: "/assets-depreciation", icon: TrendingDown, label: "Company Act Depreciation", end: false },
      { to: "/assets-write-off", icon: FileX, label: "Assets Write Off", end: false },
      { to: "/assets-employee-issue", icon: UserRound, label: "Assets Employee Issue", end: false },
      { to: "/assets-employee-return", icon: RotateCcw, label: "Assets Employee Return", end: false },
      { to: "/assets-department-issue", icon: Building2, label: "Assets Department Issue", end: false },
      { to: "/assets-health-status-updation", icon: HeartPulse, label: "Assets Health Status Updation", end: false },
      { to: "/assets-revaluation", icon: FileText, label: "Assets Revaluation", end: false },
      { to: "/assets-client-allocation", icon: Handshake, label: "Assets Client Allocation", end: false },
      { to: "/assets-returnable-gate-pass-out", icon: DoorOpen, label: "Assets Returnable Gate Pass Out", end: false },
      { to: "/assets-returnable-gate-pass-in", icon: DoorClosed, label: "Assets Returnable Gate Pass In", end: false },
      { to: "/assets-stock-transfer", icon: ArrowLeftRight, label: "Assets Stock Transfer", end: false },
      { to: "/assets-item-opening", icon: Package2, label: "Assets Item Opening", end: false },
      { to: "/account/master/asset-item-opening-excel", icon: FileSpreadsheet, label: "Asset Item Opening Excel", end: false },
    ],
  },
  {
    label: "Maintenance",
    items: [
      { to: "/complaint-register", icon: MessageSquareWarning, label: "Complaint Register", end: false },
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
              <img src={BRAND_LOGO_SRC} alt="IMS logo" className="ent-sidebar__logo-image" />
            </div>
            {!collapsed && (
              <div>
                <div className="ent-sidebar__name">IMS Group</div>
                <div className="ent-sidebar__tag">Asset Management System</div>
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
            <div className="ent-env-switcher" role="group" aria-label="API environment">
              {BASE_PROJECT_OPTIONS.map((opt) => {
                const isActive = opt === PROD_BASE_PROJECT;
                return (
                  <button
                    key={opt}
                    type="button"
                    className={`ent-env-switcher__btn${isActive ? " ent-env-switcher__btn--active" : ""}${opt === "IMS_PGLIVE" ? " ent-env-switcher__btn--pg" : ""}`}
                    title={isActive ? `Active: ${opt}` : `Switch to ${opt}`}
                    onClick={() => { if (!isActive) switchBaseProject(opt); }}
                    aria-pressed={isActive}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
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
