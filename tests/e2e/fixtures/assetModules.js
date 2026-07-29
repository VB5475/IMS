// Registry of the 10 near-identical "Assets Item Picker" transaction modules.
// Shared by configuration-validation.spec.js and item-picker.spec.js so the
// module list only needs to be maintained in one place.
export const ASSET_MODULES = [
  { name: "Assets Client Allocation", route: "/assets-client-allocation" },
  { name: "Assets Department Issue", route: "/assets-department-issue" },
  { name: "Assets Employee Issue", route: "/assets-employee-issue" },
  { name: "Assets Employee Return", route: "/assets-employee-return" },
  { name: "Employee Location Transfer", route: "/assets-employee-transfer" },
  { name: "Assets Health Status Updation", route: "/assets-health-status-updation" },
  { name: "Assets Returnable Gate Pass In", route: "/assets-returnable-gate-pass-in" },
  { name: "Assets Returnable Gate Pass Out", route: "/assets-returnable-gate-pass-out" },
  { name: "Assets Revaluation", route: "/assets-revaluation" },
  { name: "Assets Stock Transfer", route: "/assets-stock-transfer" },
];
