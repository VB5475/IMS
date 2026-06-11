// dummyData.js — Backend response simulation
// Control Types: Label=0, TextBox=1, Date=2, Dropdown=4, Textarea=9

export const controlTypeMap = {
  LABEL: 0,
  TEXTBOX: 1,
  DATE: 2,
  DROPDOWN: 4,
  TEXTAREA: 9,
};

// export const controlTypeName = {
//   0: 'Label',
//   1: 'TextBox',
//   2: 'Date',
//   4: 'Dropdown',
//   9: 'Textarea'
// };

export const gridMeta = {
  title: "RB Marketing Action",
  division: "INDIAN CHEMICAL",
  year: "2025-2026",
  pagination: {
    pageSize: 5,
    pageSizeOptions: [5, 10, 25, 50, 100],
  },
};

export const columns = [
  { id: "cb", name: "", key: "cb", controlType: 0, isFixed: true, width: 42, filterable: false },
  {
    id: "industries",
    name: "Industries",
    key: "industries",
    controlType: 0,
    isFixed: true,
    width: 140,
    filterable: true,
    filterType: "select",
  },
  {
    id: "productGroup",
    name: "Product Group",
    key: "productGroup",
    controlType: 4,
    isFixed: true,
    width: 120,
    filterable: true,
    filterType: "select",
    dropdownOptions: ["ICHOSOL", "ICHOLACE", "ICHOPRINT", "ICHOACID"],
  },
  {
    id: "productName",
    name: "Product Name",
    key: "productName",
    controlType: 0,
    isFixed: true,
    width: 190,
    filterable: true,
    filterType: "text",
  },
  {
    id: "customer",
    name: "Customer",
    key: "customer",
    controlType: 1,
    isFixed: true,
    width: 170,
    filterable: true,
    filterType: "text",
  },
  {
    id: "sharingFrom",
    name: "Sharing From",
    key: "sharingFrom",
    controlType: 1,
    isFixed: false,
    width: 130,
    filterable: true,
    filterType: "text",
  },
  {
    id: "sharingTo",
    name: "Sharing To",
    key: "sharingTo",
    controlType: 1,
    isFixed: false,
    width: 130,
    filterable: true,
    filterType: "text",
  },
  {
    id: "taskStatus",
    name: "Task Status",
    key: "taskStatus",
    controlType: 4,
    isFixed: false,
    width: 140,
    filterable: true,
    filterType: "select",
    dropdownOptions: ["TNC", "In Progress", "Completed", "On Hold", "Cancelled"],
  },
  {
    id: "tcoDate",
    name: "TCO Date",
    key: "tcoDate",
    controlType: 2,
    isFixed: false,
    width: 130,
    filterable: true,
    filterType: "date",
  },
  {
    id: "tcoDays",
    name: "TCO Days",
    key: "tcoDays",
    controlType: 1,
    isFixed: false,
    width: 100,
    filterable: true,
    filterType: "number",
  },
  {
    id: "tcoStage",
    name: "TCO Stage",
    key: "tcoStage",
    controlType: 4,
    isFixed: false,
    width: 150,
    filterable: true,
    filterType: "select",
    dropdownOptions: ["Initial", "Evaluation", "Negotiation", "Closed"],
  },
  {
    id: "soNo",
    name: "SO No",
    key: "soNo",
    controlType: 1,
    isFixed: false,
    width: 120,
    filterable: true,
    filterType: "text",
  },
  {
    id: "exhibition",
    name: "Exhibition",
    key: "exhibition",
    controlType: 9,
    isFixed: false,
    width: 160,
    filterable: true,
    filterType: "text",
  },
  {
    id: "customerQty",
    name: "Customer Qty",
    key: "customerQty",
    controlType: 1,
    isFixed: false,
    width: 120,
    filterable: true,
    filterType: "number",
  },
  {
    id: "onenessQty",
    name: "Oneness Qty",
    key: "onenessQty",
    controlType: 1,
    isFixed: false,
    width: 120,
    filterable: true,
    filterType: "number",
  },
];

const productNames = [
  "ICHOSOL BLUE EAIP-LOOSE",
  "ICHOLACE BORDEAUX F2RNUPRD-LOOSE",
  "ICHOLACE LEMON YELLOW 3GHNUPRD-LOOSE",
  "ICHOPRINT RED M2G-LOOSE",
  "ICHOLACE YELLOW F4GNU PRD-LOOSE",
  "ICHOSOL BLACK RL-LOOSE",
  "ICHOPRINT NAVY BLUE R-LOOSE",
  "ICHOACID RED G-LOOSE",
  "ICHOLACE ORANGE 3R-LOOSE",
  "ICHOSOL VIOLET 4BL-LOOSE",
];

const customers = [
  "RAJ CHEMICAL CO",
  "BRIGHT ENTERPRISE",
  "NCI CHEMICAL INDUSTRY LTD",
  "SAHYOG G101",
  "PIDILITE INDUSTRIES LTD",
  "AAKASHI COLORANTS PVT LTD",
  "BRITACEL SILICON LTD",
  "APOLLO PAINTS PVT LTD",
  "KANORIA CHEMICALS",
  "MEGHMANI ORGANICS",
  "ATUL LTD",
  "CLARIANT CHEMICALS",
];

const industries = [
  "Printing & Signage",
  "Textile",
  "Ceramics & Pottery",
  "Agriculture",
  "Adhesive",
  "Home & Personal Care",
  "Paper",
  "Leather",
];

const sharingCodes = [
  "43e333333333",
  "oo;9",
  "5533",
  "5252",
  "sdfa",
  "A101 OWE",
  "RI01 OWE",
  "PI01 OWE",
  "SAHYOG A101",
  "SAHYOG J101",
  "SAHYOG G101",
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate() {
  const start = new Date(2025, 0, 1);
  const end = new Date(2026, 11, 31);
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split("T")[0];
}

export const rows = Array.from({ length: 25 }, (_, i) => {
  const industry = randomItem(industries);
  const pg = randomItem(["ICHOSOL", "ICHOLACE", "ICHOPRINT", "ICHOACID"]);
  const pn = randomItem(productNames);
  const cust = randomItem(customers);
  const sf = randomItem(sharingCodes);
  const st = randomItem(sharingCodes);
  const tco = randomItem(["TNC", "In Progress", "Completed", "On Hold"]);
  const stage = randomItem(["Initial", "Evaluation", "Negotiation", "Closed"]);
  const cq = Math.floor(Math.random() * 10000);
  const oq = Math.floor(Math.random() * 10000);

  return {
    id: i + 1,
    industries: industry,
    productGroup: pg,
    productName: pn,
    customer: cust,
    sharingFrom: sf,
    sharingTo: st,
    taskStatus: tco,
    tcoDate: randomDate(),
    tcoDays: String(Math.floor(Math.random() * 60) + 1),
    tcoStage: stage,
    soNo: Math.random() > 0.5 ? String(Math.floor(Math.random() * 900000) + 100000) : "",
    exhibition:
      Math.random() > 0.7
        ? "Competition standard"
        : Math.random() > 0.5
          ? "Previous Data"
          : "Waiting for customer",
    customerQty: cq,
    onenessQty: oq,
  };
});
