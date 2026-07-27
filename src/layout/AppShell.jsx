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
  Percent,
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
  RefreshCw,
  Building,
  FolderTree,
  Landmark,
  Truck,
  UserCheck,
  Scale,
  PanelLeftClose,
  PanelLeft,
  Search,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import { getDefaultRouteTitle, usePageHeaderContext } from "../context/PageHeaderContext";
import { useUser } from "../context/UserContext";
import { PROD_BASE_PROJECT, BASE_PROJECT_OPTIONS, switchBaseProject } from "../api/constants";
import { RB_CODES, rbRoutePath } from "../constants/rbCodes";
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
      { to: rbRoutePath(RB_CODES.USER_MASTER), icon: Users, label: "User Master", end: false },
      { to: rbRoutePath(RB_CODES.USER_GROUP), icon: Shield, label: "User Group", end: false },
      { to: rbRoutePath(RB_CODES.DIVISION_WISE_RIGHTS), icon: KeyRound, label: "Division Wise Rights", end: false },
      { to: rbRoutePath(RB_CODES.ITEM_MASTER), icon: Package, label: "Item Master", end: false },
      { to: rbRoutePath(RB_CODES.DEPARTMENT_MASTER), icon: Building2, label: "Department Master", end: false },
      { to: rbRoutePath(RB_CODES.COMPANY), icon: Building, label: "Company", end: false },
      { to: rbRoutePath(RB_CODES.MAIN_GROUP_MASTER), icon: Tag, label: "Main Group Master", end: false },
      { to: rbRoutePath(RB_CODES.SUB_MAIN_GROUP_MASTER), icon: Layers, label: "Sub Main Group Master", end: false },
      { to: rbRoutePath(RB_CODES.SUB_GROUP_MASTER), icon: Package, label: "Sub Group Master", end: false },
      { to: rbRoutePath(RB_CODES.LOCATION_MASTER), icon: MapPin, label: "Location Master", end: false },
      { to: rbRoutePath(RB_CODES.DIVISION_MASTER), icon: Network, label: "Division Master", end: false },
      { to: rbRoutePath(RB_CODES.SUPPLIER_MASTER), icon: Truck, label: "Supplier Master", end: false },
      { to: "/admin/master/customer-master", icon: UserCheck, label: "Customer Master", end: false },
      { to: rbRoutePath(RB_CODES.ASSET_ITEM_MASTER), icon: LayoutList, label: "Asset Item Master", end: false },
      { to: rbRoutePath(RB_CODES.ACCOUNT_GROUP_MASTER), icon: FolderTree, label: "Account Group Master", end: false },
      { to: rbRoutePath(RB_CODES.ACCOUNT_MASTER), icon: Landmark, label: "Account Master", end: false },
    ],
  },
  {
    label: "Purchase",
    items: [
      { to: rbRoutePath(RB_CODES.PURCHASE_INDENT), icon: ShoppingCart, label: "Purchase Indent", end: false },
      { to: rbRoutePath(RB_CODES.PURCHASE_INQUIRY), icon: ClipboardList, label: "Purchase Inquiry", end: false },
      { to: rbRoutePath(RB_CODES.PURCHASE_QUOTATION), icon: FileText, label: "Purchase Quotation", end: false },
      { to: "/purchase-quotation-comparison", icon: Scale, label: "Purchase Quotation Comparison", end: false },
      { to: rbRoutePath(RB_CODES.PURCHASE_ORDER), icon: ShoppingCart, label: "Purchase Order", end: false },
      { to: rbRoutePath(RB_CODES.GOODS_RECEIVED_NOTE), icon: PackageCheck, label: "Goods Received Note", end: false },
      { to: rbRoutePath(RB_CODES.PURCHASE_VOUCHER), icon: Receipt, label: "Purchase Voucher", end: false },
      { to: rbRoutePath(RB_CODES.TXN_ENTRY), icon: FileSpreadsheet, label: "Invoices", end: false },
    ],
  },
  {
    label: "Assets",
    items: [
      { to: rbRoutePath(RB_CODES.CWIP_TO_FA), icon: Layers, label: "CWIP To FA", end: false },
      { to: rbRoutePath(RB_CODES.ASSETS_DEPRECIATION), icon: TrendingDown, label: "Company Act Depreciation", end: false },
      { to: rbRoutePath(RB_CODES.ASSET_DEPRECIATION_PERCENTAGE), icon: Percent, label: "Depreciation Percentage", end: false },
      { to: rbRoutePath(RB_CODES.ASSETS_WRITE_OFF), icon: FileX, label: "Assets Write Off", end: false },
      { to: rbRoutePath(RB_CODES.ASSETS_EMPLOYEE_ISSUE), icon: UserRound, label: "Assets Employee Issue", end: false },
      { to: rbRoutePath(RB_CODES.ASSETS_EMPLOYEE_TRANSFER), icon: ArrowLeftRight, label: "Assets Employee Transfer", end: false },
      { to: rbRoutePath(RB_CODES.ASSETS_EMPLOYEE_RETURN), icon: RotateCcw, label: "Assets Employee Return", end: false },
      { to: rbRoutePath(RB_CODES.ASSETS_DEPARTMENT_ISSUE), icon: Building2, label: "Assets Department Issue", end: false },
      { to: rbRoutePath(RB_CODES.ASSETS_HEALTH_STATUS_UPDATION), icon: HeartPulse, label: "Assets Health Status Updation", end: false },
      { to: rbRoutePath(RB_CODES.ASSETS_REVALUATION), icon: FileText, label: "Assets Revaluation", end: false },
      { to: rbRoutePath(RB_CODES.ASSETS_CLIENT_ALLOCATION), icon: Handshake, label: "Assets Client Allocation", end: false },
      { to: rbRoutePath(RB_CODES.ASSETS_RETURNABLE_GATE_PASS_OUT), icon: DoorOpen, label: "Assets Returnable Gate Pass Out", end: false },
      { to: rbRoutePath(RB_CODES.ASSETS_RETURNABLE_GATE_PASS_IN), icon: DoorClosed, label: "Assets Returnable Gate Pass In", end: false },
      { to: rbRoutePath(RB_CODES.ASSETS_STOCK_TRANSFER), icon: ArrowLeftRight, label: "Assets Stock Transfer", end: false },
      { to: rbRoutePath(RB_CODES.ASSETS_ITEM_OPENING), icon: Package2, label: "Assets Item Opening", end: false },
      { to: rbRoutePath(RB_CODES.ASSETS_ITEM_OPENING_EXCEL), icon: FileSpreadsheet, label: "Asset Item Opening Excel", end: false },
    ],
  },
  {
    label: "Maintenance",
    items: [
      { to: rbRoutePath(RB_CODES.MAINTENANCE_DASHBOARD), icon: LayoutDashboard, label: "Maintenance Dashboard", end: false },
      { to: rbRoutePath(RB_CODES.COMPLAINT_REGISTER), icon: MessageSquareWarning, label: "Complaint Register", end: false },
      { to: rbRoutePath(RB_CODES.MAINTENANCE_CONTRACT_RENEWAL), icon: RefreshCw, label: "Maintenance Contract Renewal", end: false },
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
