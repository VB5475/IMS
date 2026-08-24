import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileSpreadsheet,
  ClipboardList,
  FileText,
  FileStack,
  Archive,
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
  Users,
  Shield,
  KeyRound,
  Building2,
  HeartPulse,
  Handshake,
  MessageSquareWarning,
  RefreshCw,
  FilePlus,
  Building,
  FolderTree,
  Landmark,
  ShieldCheck,
  Truck,
  Route,
  Link2,
  UserCheck,
  Scale,
  Wrench,
  Workflow,
  Cog,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Search,
  ArrowLeft,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Globe,
  MapPinned,
  Map,
  BarChart3,
  FileBarChart2,
} from "lucide-react";
import { getDefaultRouteTitle, usePageHeaderContext } from "../context/PageHeaderContext";
import { useUser } from "../context/UserContext";
import ChangePasswordModal from "../pages/change-password/ChangePasswordModal";
import {
  PROD_BASE_PROJECT,
  BASE_PROJECT_OPTIONS,
  ENV_SWITCHER_ENABLED,
  switchBaseProject,
} from "../api/constants";
import { RB_CODES, rbRoutePath } from "../constants/rbCodes";
import { getRightsForPath } from "../session/moduleRights";
import { REPORTS_LIST } from "../constants/reportsConfig";
import ReportFilterModal from "../components/reports/ReportFilterModal";
import "./AppShell.css";

const BRAND_LOGO_SRC = "/test.png";

// Per-client nav config: add `visible: false` to any section or item below to
// hide it from the sidebar regardless of the viewing user's role/RB rights
// (see visibleNavSections below). Omitted `visible` defaults to shown.
const NAV_SECTIONS = [
  {
    label: "Home",
    icon: LayoutDashboard,
    visible: true,
    items: [
      { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true, visible: true },
      { to: rbRoutePath(RB_CODES.WORKFLOW_DASHBOARD), icon: Workflow, label: "Workflow Dashboard", end: false, visible: true },
    ],
  },


  {
    label: "Purchase",
    icon: ShoppingCart,
    visible: true,
    items: [
      { to: rbRoutePath(RB_CODES.PURCHASE_INDENT), icon: ShoppingCart, label: "Purchase Indent", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.PURCHASE_INQUIRY), icon: ClipboardList, label: "Purchase Inquiry", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.PURCHASE_QUOTATION), icon: FileText, label: "Purchase Quotation", end: false, visible: true },
      { to: "/purchase-quotation-comparison", icon: Scale, label: "Purchase Quotation Comparison", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.PURCHASE_ORDER), icon: ShoppingCart, label: "Purchase Order", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.PURCHASE_RATE_CONTRACT), icon: FileText, label: "Purchase Rate Contract", end: false, visible: false },
      { to: rbRoutePath(RB_CODES.GOODS_RECEIVED_NOTE), icon: PackageCheck, label: "Goods Received Note", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.PURCHASE_VOUCHER), icon: Receipt, label: "Purchase Voucher", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.TXN_ENTRY), icon: FileSpreadsheet, label: "Invoices", end: false, visible: false },
    ],
  },
  {
    label: "Assets",
    icon: Package,
    visible: true,
    items: [
      { to: rbRoutePath(RB_CODES.CWIP_TO_FA), icon: Layers, label: "CWIP To FA", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.ASSETS_DEPRECIATION), icon: TrendingDown, label: "Company Act Depreciation", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.ASSET_DEPRECIATION_PERCENTAGE), icon: Percent, label: "Depreciation Percentage", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.ASSETS_WRITE_OFF), icon: FileX, label: "Assets Write Off", end: false, visible: false },
      { to: rbRoutePath(RB_CODES.ASSETS_EMPLOYEE_ISSUE), icon: UserRound, label: "Assets Employee Issue", end: false, visible: true },

      { to: rbRoutePath(RB_CODES.ASSETS_EMPLOYEE_RETURN), icon: RotateCcw, label: "Assets Employee Return", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.ASSETS_DEPARTMENT_ISSUE), icon: Building2, label: "Assets Department Issue", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.ASSETS_HEALTH_STATUS_UPDATION), icon: HeartPulse, label: "Assets Health Status Updation", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.ASSETS_REVALUATION), icon: FileText, label: "Assets Revaluation", end: false, visible: false },
      { to: rbRoutePath(RB_CODES.ASSETS_CLIENT_ALLOCATION), icon: Handshake, label: "Assets Client Allocation", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.ASSETS_CLIENT_RELEASE), icon: Handshake, label: "Assets Client Release", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.ASSETS_RETURNABLE_GATE_PASS_OUT), icon: DoorOpen, label: "Assets Returnable Gate Pass Out", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.ASSETS_RETURNABLE_GATE_PASS_IN), icon: DoorClosed, label: "Assets Returnable Gate Pass In", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.ASSETS_STOCK_TRANSFER), icon: ArrowLeftRight, label: "Assets Stock Transfer", end: false, visible: false },
      { to: rbRoutePath(RB_CODES.ASSETS_ITEM_OPENING), icon: Package2, label: "Assets Item Opening", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.ASSETS_EMPLOYEE_TRANSFER), icon: ArrowLeftRight, label: "Employee Location Transfer", end: false, visible: true },
    ],
  },
  {
    label: "Maintenance",
    icon: Wrench,
    visible: true,
    items: [
      { to: rbRoutePath(RB_CODES.MAINTENANCE_DASHBOARD), icon: LayoutDashboard, label: "Maintenance Dashboard", end: false },
      { to: rbRoutePath(RB_CODES.COMPLAINT_REGISTER), icon: MessageSquareWarning, label: "Complaint Register", end: false },
      { to: rbRoutePath(RB_CODES.PREVENTIVE_MAINTENANCE_INTERNAL), icon: ShieldCheck, label: "Preventive Maintenance Internal", end: false },
      { to: rbRoutePath(RB_CODES.MAINTENANCE_CONTRACT_RENEWAL), icon: RefreshCw, label: "Maintenance Contract Renewal", end: false },
      { to: rbRoutePath(RB_CODES.MAINTENANCE_NEW_CONTRACT), icon: FilePlus, label: "Maintenance Contract (New)", end: false },
    ],
  },
  {
    label: "DMS",
    icon: FileStack,
    visible: true,
    items: [
      // Distinct from RB_CODES.DEPARTMENT_MASTER under Master above (different RB/table).
      { to: rbRoutePath(RB_CODES.DOP_MASTER), icon: ShieldCheck, label: "DOP Master", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.DM_DEPARTMENT_MASTER), icon: Archive, label: "Department Master", end: false, visible: false },
      { to: rbRoutePath(RB_CODES.DOCUMENT_TYPE_MASTER), icon: FileText, label: "Document Type Master", end: false, visible: false },
      { to: rbRoutePath(RB_CODES.DOCUMENT_SUBTYPE_MASTER), icon: FileStack, label: "Document SubType Master", end: false, visible: false },
      { to: rbRoutePath(RB_CODES.DM_TT2DOCTYPE_MASTER), icon: ArrowLeftRight, label: "Transaction To Document Type Master", end: false, visible: false },
      { to: rbRoutePath(RB_CODES.DM_GROUP_RIGHTS), icon: KeyRound, label: "Group Rights", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.DM_TRAN_TYPE_LINK), icon: Link2, label: "DM Tran Type Link", end: false, visible: false },
    ],
  },
  {
    label: "Master",
    icon: Settings,
    visible: true,
    items: [
      // end: true — Company's own route ("/admin/company") is a leaf with no
      // sub-routes, but it's also a literal path-prefix of Location Master
      // ("/admin/company/location-master") and Division Master
      // ("/admin/company/division-master"). With end:false (prefix match),
      // Company's nav link + section label lit up as "active" on those other
      // modules' pages too. end:true forces an exact-path match instead.

      { to: rbRoutePath(RB_CODES.LOCATION_MASTER), icon: MapPin, label: "Location Master", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.DEPARTMENT_MASTER), icon: Building2, label: "Department Master", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.SUPPLIER_MASTER), icon: Truck, label: "Supplier Master", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.TRANSPORTER_MASTER), icon: Route, label: "Transporter Master", end: false, visible: true },
      { to: "/admin/master/customer-master", icon: UserCheck, label: "Customer Master", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.MAIN_GROUP_MASTER), icon: Tag, label: "Main Group Master", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.SUB_MAIN_GROUP_MASTER), icon: Layers, label: "Sub Main Group Master", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.SUB_GROUP_MASTER), icon: Package, label: "Sub Group Master", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.COUNTRY_MASTER), icon: Globe, label: "Country Master", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.STATE_MASTER), icon: Map, label: "State Master", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.CITY_MASTER), icon: MapPinned, label: "City Master", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.ITEM_MASTER), icon: Package, label: "Item Master", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.ACCOUNT_GROUP_MASTER), icon: FolderTree, label: "Account Group Master", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.ACCOUNT_MASTER), icon: Landmark, label: "Account Master", end: false, visible: true },
    ],
  },
  {
    label: "Admin",
    icon: Settings,
    visible: true,
    items: [
      { to: rbRoutePath(RB_CODES.USER_MASTER), icon: Users, label: "User Master", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.USER_GROUP), icon: Shield, label: "User Group", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.DIVISION_WISE_RIGHTS), icon: KeyRound, label: "Division Wise Rights", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.USER_WISE_GROUP_RIGHTS), icon: KeyRound, label: "User Wise Group Rights", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.COMPANY), icon: Building, label: "Company", end: true, visible: true },
      { to: rbRoutePath(RB_CODES.DIVISION_MASTER), icon: Network, label: "Division Master", end: false, visible: true },
    ],
  },
  {
    label: "Utility",
    icon: Cog,
    visible: true,
    items: [
      { to: rbRoutePath(RB_CODES.ASSETS_ITEM_OPENING_EXCEL), icon: FileSpreadsheet, label: "Asset Item Opening Excel", end: false, visible: true },
      { to: rbRoutePath(RB_CODES.ITEM_MASTER_UPLOAD_EXCEL), icon: FileSpreadsheet, label: "Item Master Upload Excel", end: false, visible: true },
    ],
  },
  {
    // 2026-08-17 (/pm, verbal spec, no MRD) — each item opens the shared
    // ReportFilterModal directly (reportKey, no `to`/`end`) rather than
    // navigating to a route, per explicit user choice over a single
    // "Reports" hub page. See reportKey handling in renderNavItem below —
    // this is the one place in NAV_SECTIONS with items that don't navigate.
    label: "Reports",
    icon: BarChart3,
    visible: true,
    items: REPORTS_LIST.map((r) => ({
      key: r.key,
      reportKey: r.key,
      icon: FileBarChart2,
      label: r.label,
      visible: true,
    })),
  },
];

// Mirrors react-router NavLink's own isActive semantics (exact match when
// `end`, otherwise exact-or-descendant) so the parent section label can be
// highlighted without needing NavLink's internal match — used purely for
// the "you're in this general area" section-label signal, doesn't affect
// which link itself renders as active.
function isNavItemActive(pathname, to, end) {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Section containing the current route, so the accordion opens on the
 *  user's own context by default instead of an arbitrary first section. */
function findSectionForPath(pathname) {
  const match = NAV_SECTIONS.find(
    (section) =>
      section.visible !== false &&
      section.items.some(({ to, end }) => isNavItemActive(pathname, to, end))
  );
  if (match) return match.label;
  return NAV_SECTIONS.find((section) => section.visible !== false)?.label ?? null;
}

/**
 * Renders one nav item — a routed <NavLink> for the normal case, or a plain
 * <button> for a `reportKey` item (Reports section — opens ReportFilterModal
 * directly instead of navigating; see NAV_SECTIONS' "Reports" entry). Shared
 * by both the expanded accordion list and the collapsed-rail flyout so the
 * two render paths can't drift out of sync.
 */
function renderNavItem(item, { onReportClick, onNavigate } = {}) {
  const { to, icon: Icon, label, end, reportKey, key } = item;
  if (!to) {
    return (
      <button
        key={key ?? reportKey ?? label}
        type="button"
        className="ent-sidebar__link"
        onClick={() => {
          onReportClick?.(reportKey);
          onNavigate?.();
        }}
      >
        <span className="ent-sidebar__link-icon">
          <Icon size={16} strokeWidth={1.5} />
        </span>
        <span>{label}</span>
      </button>
    );
  }
  return (
    <NavLink
      key={to}
      to={to}
      end={end}
      className={({ isActive }) =>
        `ent-sidebar__link ${isActive ? "ent-sidebar__link--active" : ""}`
      }
      onClick={onNavigate}
    >
      <span className="ent-sidebar__link-icon">
        <Icon size={16} strokeWidth={1.5} />
      </span>
      <span>{label}</span>
    </NavLink>
  );
}

export default function AppShell({ children }) {
  // Standing constraint (/pm): the icon-only collapsed rail must keep working —
  // any new sidebar UI (search, badges, etc.) has to hide/adapt under !collapsed
  // rather than assuming the expanded layout, see navSearch below for the pattern.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navSearch, setNavSearch] = useState("");
  const location = useLocation();
  // Single-open accordion — independent of the whole-sidebar icon-rail
  // collapse above. Opening a section auto-closes whichever one was open;
  // starts on the section containing the current route.
  const [openSection, setOpenSection] = useState(() => findSectionForPath(location.pathname));
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  // Reports section (see reportKey items in NAV_SECTIONS above) — clicking
  // one opens ReportFilterModal directly, no dedicated route per report.
  const [activeReportKey, setActiveReportKey] = useState(null);
  const activeReport = useMemo(
    () => REPORTS_LIST.find((r) => r.key === activeReportKey) ?? null,
    [activeReportKey]
  );
  const navigate = useNavigate();
  const { header } = usePageHeaderContext() ?? { header: {} };
  const { userName, userId, logout, menuRights } = useUser();

  // Collapsed rail has no room for labels/search — reset any in-progress
  // filter so re-expanding the sidebar always starts from the full nav tree.
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (next) setNavSearch("");
      return next;
    });
  };

  const isSearching = navSearch.trim().length > 0;

  // Modules the login may not view drop out of the tree entirely, and any
  // section left with no items disappears with them. Entries whose target is
  // not an RB module route (Dashboard) resolve to no RB code and stay.
  // `visible: false` (static per-client nav config, see NAV_SECTIONS above)
  // is applied first and wins regardless of the user's RB role rights.
  const visibleNavSections = useMemo(() => {
    void menuRights;
    return NAV_SECTIONS.filter((section) => section.visible !== false)
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => item.visible !== false && getRightsForPath(item.to).canView
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [menuRights]);

  const filteredNavSections = useMemo(() => {
    const query = navSearch.trim().toLowerCase();
    if (!query) return visibleNavSections;
    return visibleNavSections.map((section) => ({
      ...section,
      items: section.items.filter((item) => item.label.toLowerCase().includes(query)),
    })).filter((section) => section.items.length > 0);
  }, [navSearch, visibleNavSections]);

  const toggleSection = (label) => {
    setOpenSection((prev) => (prev === label ? null : label));
  };

  // ── Collapsed icon-rail flyout ──────────────────────────────────────
  // Mobile never uses icon-rail mode (handleOpenMobileNav below forces
  // collapsed=false for the drawer), so hover is a safe assumption here —
  // no touch/click fallback needed.
  const [flyout, setFlyout] = useState(null); // { label, items, style } | null
  const flyoutCloseTimer = useRef(null);

  const cancelFlyoutClose = () => {
    if (flyoutCloseTimer.current) {
      clearTimeout(flyoutCloseTimer.current);
      flyoutCloseTimer.current = null;
    }
  };

  const scheduleFlyoutClose = () => {
    cancelFlyoutClose();
    flyoutCloseTimer.current = setTimeout(() => setFlyout(null), 150);
  };

  const openFlyout = (section, targetEl) => {
    cancelFlyoutClose();
    const rect = targetEl.getBoundingClientRect();
    // Long sections (e.g. Master, ~16 items) can run past the bottom of the
    // viewport with no way to reach the remaining items — cap the panel to
    // the space actually available below the hover point and let it scroll.
    const viewportMargin = 12;
    const maxHeight = Math.max(120, window.innerHeight - rect.top - viewportMargin);
    setFlyout({
      label: section.label,
      items: section.items,
      style: {
        position: "fixed",
        top: `${rect.top}px`,
        left: `${rect.right + 8}px`,
        maxHeight: `${maxHeight}px`,
        overflowY: "auto",
        zIndex: 2147483647,
      },
    });
  };

  // Collapsing back to expanded, or unmounting, shouldn't leave a stale flyout around.
  useEffect(() => {
    if (!collapsed) setFlyout(null);
  }, [collapsed]);

  useEffect(() => {
    setFlyout(null);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // Close the mobile drawer whenever the route changes (link click, back/forward, etc.)
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Keep the accordion in sync with the ACTUAL route, not just the route at
  // mount time. Without this, openSection only ever gets set once (its
  // useState initializer above) or via a manual section-header click — so
  // navigating away by any other means (logo → Dashboard, a nav link inside
  // a different section, browser back/forward) left whatever section was
  // already open still open instead of switching (or closing, for a route
  // like Dashboard whose own "Home" section should take over).
  useEffect(() => {
    setOpenSection(findSectionForPath(location.pathname));
  }, [location.pathname]);

  // Escape closes the mobile drawer, same convention as Modal/ConfirmDialog.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileNavOpen]);

  const handleOpenMobileNav = () => {
    setCollapsed(false); // the drawer always shows full labeled nav, never the icon rail
    setMobileNavOpen(true);
  };

  const title = header.title ?? getDefaultRouteTitle(location.pathname);
  const subtitle = header.subtitle ?? "FY 2025-26 · 01 Jun 2026";
  const profileInitial = (userName || userId || "U").charAt(0).toUpperCase();

  return (
    <div
      className={`ent-shell ${collapsed ? "ent-shell--collapsed" : ""} ${mobileNavOpen ? "ent-shell--mobile-nav-open" : ""}`}
    >
      {mobileNavOpen && (
        <div
          className="ent-mobile-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside className="ent-sidebar">
        <div className="ent-sidebar__header">
          <button
            type="button"
            className="ent-sidebar__brand"
            onClick={() => navigate("/")}
            title="Go to Dashboard"
          >
            <div className="ent-sidebar__logo">
              <img src={BRAND_LOGO_SRC} alt="IMS logo" className="ent-sidebar__logo-image" />
            </div>
            {!collapsed && (
              <div>
                <div className="ent-sidebar__name">IMS</div>
              </div>
            )}
          </button>
          <button
            type="button"
            className="ent-sidebar__collapse"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
          </button>
          <button
            type="button"
            className="ent-sidebar__mobile-close"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            <PanelLeftClose size={14} />
          </button>
        </div>

        {!collapsed && (
          <div className="ent-sidebar__search">
            <Search size={13} strokeWidth={2} />
            <input
              type="text"
              placeholder="Search navigation…"
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              aria-label="Search navigation"
            />
            {navSearch && (
              <button
                type="button"
                className="ent-sidebar__search-clear"
                onClick={() => setNavSearch("")}
                aria-label="Clear search"
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}

        <nav className="ent-sidebar__nav">
          {filteredNavSections.map((section) => {
            // Only meaningful when expanded — the collapsed rail renders one
            // icon per SECTION (not per item) below, since hovering it opens
            // the flyout with the full item list instead.
            const sectionOpen = isSearching || openSection === section.label;
            // "You're in this general area" signal — independent of accordion
            // open/closed state and of icon-rail collapse, purely based on
            // whether the current route belongs to this section.
            const sectionActive = section.items.some(({ to, end }) =>
              isNavItemActive(location.pathname, to, end)
            );
            const sectionLabelClass = `ent-sidebar__section-label ${sectionActive ? "ent-sidebar__section-label--active" : ""}`;
            return (
              <div
                key={section.label}
                className="ent-sidebar__section"
                onMouseEnter={collapsed ? (e) => openFlyout(section, e.currentTarget) : undefined}
                onMouseLeave={collapsed ? scheduleFlyoutClose : undefined}
              >
                {!collapsed && (
                  isSearching ? (
                    <div className={sectionLabelClass}>{section.label}</div>
                  ) : (
                    <button
                      type="button"
                      className="ent-sidebar__section-header"
                      onClick={() => toggleSection(section.label)}
                      aria-expanded={sectionOpen}
                    >
                      <span className={sectionLabelClass}>{section.label}</span>
                      {sectionOpen ? (
                        <ChevronDown size={12} strokeWidth={2.5} />
                      ) : (
                        <ChevronRight size={12} strokeWidth={2.5} />
                      )}
                    </button>
                  )
                )}
                {collapsed ? (
                  <div
                    className={`ent-sidebar__rail-icon ${sectionActive ? "ent-sidebar__rail-icon--active" : ""}`}
                    title={section.label}
                  >
                    <section.icon size={18} strokeWidth={1.75} />
                  </div>
                ) : (
                  sectionOpen &&
                  section.items.map((item) =>
                    renderNavItem(item, { onReportClick: setActiveReportKey })
                  )
                )}
              </div>
            );
          })}
          {!collapsed && navSearch && filteredNavSections.length === 0 && (
            <div className="ent-sidebar__search-empty">No matching modules.</div>
          )}
        </nav>

        {collapsed && flyout &&
          createPortal(
            <div
              className="ent-sidebar__flyout"
              style={flyout.style}
              onMouseEnter={cancelFlyoutClose}
              onMouseLeave={scheduleFlyoutClose}
            >
              <div className="ent-sidebar__flyout-label">{flyout.label}</div>
              {flyout.items.map((item) =>
                renderNavItem(item, {
                  onReportClick: setActiveReportKey,
                  onNavigate: () => setFlyout(null),
                })
              )}
            </div>,
            document.body
          )}

        {!collapsed && (
          <div className="ent-sidebar__footer">
            <span className="ent-sidebar__version">v2.4.0</span>
          </div>
        )}
      </aside>

      <div className="ent-main">
        <header className="ent-topbar">
          <div className="ent-topbar__left">
            <button
              type="button"
              className="ent-topbar__hamburger"
              onClick={handleOpenMobileNav}
              aria-label="Open navigation"
            >
              <Menu size={18} strokeWidth={2} />
            </button>
            {header.showBack && (
              <button
                type="button"
                className="ent-topbar__back"
                onClick={() => navigate(header.backTo || "/")}
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            )}
            <div className="ent-topbar__titles">
              <h1 className="ent-topbar__title">{title}</h1>
              {/* {subtitle && <p className="ent-topbar__subtitle">{subtitle}</p>} */}
            </div>
            {/* <div className="ent-topbar__search">
              <Search size={14} />
              <input type="text" placeholder="Global Search..." />
            </div> */}
          </div>
          <div className="ent-topbar__actions">
            {ENV_SWITCHER_ENABLED && (
              <>
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
              </>
            )}
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
                    className="ent-topbar__profile-dropdown-changepwd"
                    onClick={() => setChangePasswordOpen(true)}
                  >
                    <KeyRound size={14} strokeWidth={1.75} />
                    Change Password
                  </button>
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

      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onPasswordChanged={handleLogout}
      />

      <ReportFilterModal
        report={activeReport}
        onClose={() => setActiveReportKey(null)}
      />
    </div>
  );
}
