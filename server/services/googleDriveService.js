const { google } = require('googleapis');
const { Readable } = require('stream');
const ExcelJS = require('exceljs');
const Order = require('../models/Order');
const Sale = require('../models/Sale');
const DriveBackupLog = require('../models/DriveBackupLog');

/**
 * Check if Google Drive service account credentials are fully configured
 */
function isConfigured() {
  const email = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').trim();
  const folderId = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
  return !!(email && key && folderId);
}

/**
 * Initialize Google Drive API v3 client with Service Account JWT
 */
function getDriveClient() {
  if (!isConfigured()) return null;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim();
  let key = process.env.GOOGLE_PRIVATE_KEY.trim();
  // Properly handle escaped newlines in environment variable
  key = key.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file'
    ]
  });

  return google.drive({ version: 'v3', auth });
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Format date and time parts according to Asia/Kolkata timezone
 */
function getKolkataDateParts(dateInput) {
  let d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) d = new Date();

  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(d);
  const partMap = {};
  parts.forEach(p => { partMap[p.type] = p.value; });

  const year = partMap.year || String(d.getFullYear());
  const month = partMap.month || String(d.getMonth() + 1).padStart(2, '0');
  const day = partMap.day || String(d.getDate()).padStart(2, '0');
  const hour = partMap.hour || '00';
  const minute = partMap.minute || '00';
  const second = partMap.second || '00';

  const monthIdx = parseInt(month, 10) - 1;
  const monthFullName = MONTH_NAMES[monthIdx] || 'Month';
  const daySheetName = `${monthFullName} ${day}`;

  return {
    year,
    month,
    day,
    monthFullName,
    daySheetName,
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hour}:${minute}:${second}`,
    monthKey: `${year}_${month}`,
    monthFileName: `AKE_Rice_Transactions_${year}_${month}.xlsx`
  };
}

/**
 * Standard 22 columns for every Daily Transaction Worksheet
 */
const DAILY_SHEET_HEADERS = [
  'Transaction ID',
  'Order / Sale ID',
  'Date',
  'Time',
  'Transaction Type',
  'Customer / Shop Name',
  'Mobile Number',
  'Delivery Address / Counter Area',
  'Product Summary',
  'Product Details',
  'Quantity',
  'Subtotal (₹)',
  'Discount (₹)',
  'Delivery Charge (₹)',
  'Total Amount (₹)',
  'Payment Method',
  'Payment Status',
  'Order / Transaction Status',
  'Sales Staff Name',
  'POS Login ID',
  'Created By',
  'Notes / UPI Reference'
];

/**
 * Standard column width definitions for Daily Worksheets
 */
const DAILY_COLUMN_WIDTHS = [
  { key: 'txId', width: 18 },
  { key: 'orderSaleId', width: 16 },
  { key: 'date', width: 13 },
  { key: 'time', width: 11 },
  { key: 'txType', width: 18 },
  { key: 'customerName', width: 24 },
  { key: 'phone', width: 16 },
  { key: 'address', width: 28 },
  { key: 'products', width: 30 },
  { key: 'details', width: 32 },
  { key: 'qty', width: 10 },
  { key: 'subtotal', width: 14 },
  { key: 'discount', width: 13 },
  { key: 'delivery', width: 15 },
  { key: 'total', width: 15 },
  { key: 'paymentMethod', width: 18 },
  { key: 'paymentStatus', width: 18 },
  { key: 'orderStatus', width: 18 },
  { key: 'salesStaff', width: 20 },
  { key: 'posLoginId', width: 16 },
  { key: 'createdBy', width: 20 },
  { key: 'notes', width: 30 }
];

/**
 * Convert Order model to uniform Excel Transaction row object
 */
function formatOrderForExcel(order) {
  const dateParts = getKolkataDateParts(order.createdAt || order.date || new Date());
  const txId = `ORD_${order.id || order.orderId || order._id}`;
  const totalQty = parseInt(
    order.qty || 
    (Array.isArray(order.items) ? order.items.reduce((s, it) => s + (it.quantity || 1), 0) : 1), 
    10
  );
  const totalAmount = parseFloat(order.total || order.totalAmount || 0);
  const subtotal = order.subtotal !== undefined && !isNaN(parseFloat(order.subtotal)) 
    ? parseFloat(order.subtotal) 
    : totalAmount;
  const discount = order.discount !== undefined && !isNaN(parseFloat(order.discount)) 
    ? parseFloat(order.discount) 
    : 0;
  const deliveryCharge = order.deliveryCharge !== undefined && !isNaN(parseFloat(order.deliveryCharge)) 
    ? parseFloat(order.deliveryCharge) 
    : 0;

  let productDesc = order.product || 'Koppampatty Seeraga Samba Rice';
  if (Array.isArray(order.items) && order.items.length > 0) {
    productDesc = order.items.map(it => `${it.name || it.product || 'Rice'} (x${it.quantity || 1})`).join(', ');
  } else {
    productDesc = `${productDesc} (x${totalQty})`;
  }

  const unitWeightKg = order.productId === '25kg' || (order.product && order.product.includes('25')) ? 25 : 1;
  const totalWeightKg = order.stockDeductedKg || (totalQty * unitWeightKg);
  const productDetails = `ID: ${order.productId || order.orderId || '1kg'} | Rate: ₹${order.rate || 195}/kg | Weight: ${totalWeightKg} KG`;

  const customerName = (
    order.name ||
    order.customerName ||
    order.shippingAddress?.fullName ||
    order.shippingAddress?.name ||
    order.customer?.name ||
    'Valued Customer'
  ).trim();

  const customerPhone = (
    order.mobile ||
    order.phone ||
    order.shippingAddress?.phone ||
    order.shippingAddress?.mobile ||
    order.customer?.phone ||
    'N/A'
  ).trim();

  const customerAddress = (
    (order.address ? `${order.address}, ${order.area || ''}` : '') ||
    (order.shippingAddress ? `${order.shippingAddress.addressLine1 || ''}, ${order.shippingAddress.city || ''}, ${order.shippingAddress.state || ''} ${order.shippingAddress.pincode || ''}` : '') ||
    order.area ||
    'Online Delivery'
  ).trim().replace(/^,\s*|,\s*$/g, '');

  return {
    transactionId: txId,
    orderSaleId: order.id || order.orderId || 'N/A',
    date: dateParts.dateStr,
    time: dateParts.timeStr,
    transactionType: 'Online Order',
    customerName,
    customerPhone,
    customerAddress,
    productsPurchased: productDesc,
    productDetails,
    totalQuantity: totalQty,
    subtotal,
    discount,
    deliveryCharge,
    totalAmount,
    paymentMethod: order.payment || order.paymentType || 'Cash on Delivery',
    paymentStatus: order.paymentStatus || 'Pending Verification',
    orderSaleStatus: order.status || 'Pending',
    salesStaffName: 'Online Store',
    posLoginId: 'N/A - Customer',
    createdBy: customerName,
    notes: order.notes ? order.notes.trim() : (order.utr ? `UPI Ref / UTR: ${order.utr}` : ''),
    dateParts
  };
}

/**
 * Convert Sale model to uniform Excel Transaction row object
 */
function formatSaleForExcel(sale) {
  const rawDate = sale.transactionDate || sale.date || sale.createdAt || new Date();
  const dateParts = getKolkataDateParts(rawDate);
  const txId = `POS_${sale.id || sale.transactionId || sale._id}`;
  const totalQty = parseInt(sale.qty || sale.quantity || 1, 10);
  const totalAmount = parseFloat(sale.total || sale.totalAmount || 0);
  const subtotal = sale.subtotal !== undefined && !isNaN(parseFloat(sale.subtotal)) ? parseFloat(sale.subtotal) : totalAmount;
  const discount = sale.discount !== undefined && !isNaN(parseFloat(sale.discount)) ? parseFloat(sale.discount) : 0;
  const productName = sale.product || sale.riceType || '1 KG Rice';
  const unitWeightKg = productName.includes('25') ? 25 : 1;
  const rate = parseFloat(sale.rate || sale.ratePerKg || (unitWeightKg === 25 ? 185 : 195));
  const productDetails = `Rate: ₹${rate}/kg | Total Weight: ${totalQty * unitWeightKg} KG`;
  const customerMobile = (sale.mobile || sale.phone || sale.customerPhone || '').trim();

  return {
    transactionId: txId,
    orderSaleId: sale.id || sale.transactionId || 'N/A',
    date: dateParts.dateStr,
    time: dateParts.timeStr,
    transactionType: 'Offline POS Sale',
    customerName: (sale.customerName || sale.shop || 'Walk-in Customer').trim(),
    customerPhone: customerMobile ? customerMobile : 'N/A (Optional POS)',
    customerAddress: (sale.area || sale.customerAddress || sale.address || 'Retail Counter').trim(),
    productsPurchased: `${productName} (x${totalQty})`,
    productDetails,
    totalQuantity: totalQty,
    subtotal,
    discount,
    deliveryCharge: 0,
    totalAmount,
    paymentMethod: sale.payment || sale.paymentMethod || 'Cash',
    paymentStatus: sale.paymentStatus || 'Paid',
    orderSaleStatus: sale.status || sale.transactionStatus || 'Delivered',
    salesStaffName: sale.salesperson || sale.staffName || 'POS Staff',
    posLoginId: sale.staffUserId || 'pos_counter',
    createdBy: sale.salesperson || sale.staffName || 'POS Staff',
    notes: sale.notes || '',
    dateParts
  };
}

/**
 * Search or create a Year folder in Google Drive (e.g., '2026') under root folder
 */
async function getOrCreateYearFolder(drive, rootFolderId, year) {
  const query = `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${year}' and trashed = false`;
  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive'
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  // Create year subfolder if not found
  const folderMetadata = {
    name: String(year),
    mimeType: 'application/vnd.google-apps.folder',
    parents: [rootFolderId]
  };

  const folder = await drive.files.create({
    resource: folderMetadata,
    fields: 'id'
  });

  return folder.data.id;
}

/**
 * Find existing monthly Excel file by file name in the year folder
 */
async function findMonthlyFile(drive, yearFolderId, fileName) {
  const query = `'${yearFolderId}' in parents and name = '${fileName}' and trashed = false`;
  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name, webViewLink, webContentLink, modifiedTime, size)',
    spaces: 'drive'
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0];
  }
  return null;
}

/**
 * Get or create a Daily Worksheet formatted according to specifications
 */
function getOrCreateDailySheet(workbook, daySheetName) {
  let sheet = workbook.getWorksheet(daySheetName);
  if (sheet) return sheet;

  sheet = workbook.addWorksheet(daySheetName);

  // Freeze header row
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // Add standard 22 column headers
  sheet.addRow(DAILY_SHEET_HEADERS);
  const headerRow = sheet.getRow(1);
  headerRow.height = 28;

  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B4332' } // Dark Green theme
    };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF2D6A4F' } }
    };
    if ([1, 2, 3, 4, 5, 11, 16, 17, 18, 20].includes(colNumber)) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else if ([12, 13, 14, 15].includes(colNumber)) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    }
  });

  // Enable Auto-Filter across all 22 columns
  sheet.autoFilter = { from: 'A1', to: 'V1' };

  // Set appropriate column widths
  DAILY_COLUMN_WIDTHS.forEach((col, idx) => {
    sheet.getColumn(idx + 1).width = col.width;
  });

  return sheet;
}

/**
 * Check if a worksheet name represents a daily transaction sheet
 * (i.e. not the summary sheets)
 */
function isDailySheet(sheetName) {
  if (!sheetName) return false;
  const upper = sheetName.toUpperCase().trim();
  return upper !== 'MONTHLY SUMMARY' && upper !== 'PRODUCT SUMMARY' && upper !== 'TRANSACTIONS';
}

/**
 * Find and remove an existing transaction row across ANY sheet in the workbook.
 * Useful if an order is deleted, or its date was edited and it moved to a new daily sheet.
 */
function removeTransactionFromWorkbook(workbook, transactionId) {
  let removedInfo = null;

  workbook.worksheets.forEach(sheet => {
    // Only check daily sheets
    if (!isDailySheet(sheet.name)) return;

    for (let r = 2; r <= sheet.rowCount; r++) {
      const cellVal = sheet.getRow(r).getCell(1).value;
      if (cellVal === transactionId) {
        sheet.spliceRows(r, 1);
        removedInfo = { removed: true, sheetName: sheet.name, rowNumber: r };
        break;
      }
    }
  });

  return removedInfo;
}

/**
 * Upsert transaction row into its corresponding Daily Worksheet (e.g. "November 20").
 * Idempotently updates if row exists; appends if new; moves row if date changed.
 */
function upsertDailyTransactionRow(workbook, tx) {
  const targetDaySheetName = tx.dateParts.daySheetName;

  // 1. If transaction already exists in a different daily sheet (due to date change), remove it from old sheet
  workbook.worksheets.forEach(sheet => {
    if (sheet.name !== targetDaySheetName && isDailySheet(sheet.name)) {
      for (let r = 2; r <= sheet.rowCount; r++) {
        if (sheet.getRow(r).getCell(1).value === tx.transactionId) {
          sheet.spliceRows(r, 1);
          break;
        }
      }
    }
  });

  // 2. Get or create target day worksheet
  const daySheet = getOrCreateDailySheet(workbook, targetDaySheetName);

  // 3. Search target day worksheet for existing transaction row
  let targetRow = null;
  let isUpdate = false;

  for (let r = 2; r <= daySheet.rowCount; r++) {
    const row = daySheet.getRow(r);
    if (row.getCell(1).value === tx.transactionId) {
      targetRow = row;
      isUpdate = true;
      break;
    }
  }

  if (!targetRow) {
    targetRow = daySheet.addRow([]);
  }

  // 4. Populate 22 standard columns
  targetRow.getCell(1).value = tx.transactionId;
  targetRow.getCell(2).value = tx.orderSaleId;
  targetRow.getCell(3).value = tx.date;
  targetRow.getCell(4).value = tx.time;
  targetRow.getCell(5).value = tx.transactionType;
  targetRow.getCell(6).value = tx.customerName;
  targetRow.getCell(7).value = tx.customerPhone || tx.phone;
  targetRow.getCell(8).value = tx.customerAddress || tx.address;
  targetRow.getCell(9).value = tx.productsPurchased || tx.productsSummary;
  targetRow.getCell(10).value = tx.productDetails;
  targetRow.getCell(11).value = tx.totalQuantity;
  targetRow.getCell(12).value = tx.subtotal;
  targetRow.getCell(13).value = tx.discount;
  targetRow.getCell(14).value = tx.deliveryCharge;
  targetRow.getCell(15).value = tx.totalAmount;
  targetRow.getCell(16).value = tx.paymentMethod;
  targetRow.getCell(17).value = tx.paymentStatus;
  targetRow.getCell(18).value = tx.orderSaleStatus || tx.orderStatus;
  targetRow.getCell(19).value = tx.salesStaffName || tx.salesStaff;
  targetRow.getCell(20).value = tx.posLoginId;
  targetRow.getCell(21).value = tx.createdBy;
  targetRow.getCell(22).value = tx.notes;

  // Format currency numbers
  targetRow.getCell(12).numFmt = '₹#,##0.00';
  targetRow.getCell(13).numFmt = '₹#,##0.00';
  targetRow.getCell(14).numFmt = '₹#,##0.00';
  targetRow.getCell(15).numFmt = '₹#,##0.00';
  targetRow.getCell(11).numFmt = '#,##0';

  // Apply row styling & zebra striping
  targetRow.height = 24;
  const isEven = targetRow.number % 2 === 0;
  const bgArgb = isEven ? 'FFF9FAF8' : 'FFFFFFFF';

  targetRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF212529' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgArgb }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
    };

    if ([1, 2, 3, 4, 5, 11, 16, 17, 18, 20].includes(colNumber)) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else if ([12, 13, 14, 15].includes(colNumber)) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    }
  });

  return {
    action: isUpdate ? 'updated' : 'inserted',
    sheetName: targetDaySheetName,
    rowNumber: targetRow.number
  };
}

/**
 * Create initial empty workbook with MONTHLY SUMMARY and PRODUCT SUMMARY sheets.
 */
function buildInitialWorkbook(year, month) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AKE Rice Automation System';
  workbook.lastModifiedBy = 'AKE Rice Cloud Worker';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Create MONTHLY SUMMARY and PRODUCT SUMMARY
  recalculateSummarySheets(workbook, year, month);

  return workbook;
}

/**
 * Recompute and format:
 * 1. Sheet: MONTHLY SUMMARY (Executive KPIs + Daily Revenue Breakdown Table)
 * 2. Sheet: PRODUCT SUMMARY (Package Varieties, KG Weight, Revenue, Online vs Offline)
 * by aggregating rows across ALL Daily Worksheets.
 */
function recalculateSummarySheets(workbook, year, month) {
  let yr = year;
  let mo = month;
  if (typeof yr === 'string' && yr.includes('_') && !mo) {
    const splitParts = yr.split('_');
    yr = splitParts[0];
    mo = splitParts[1];
  }
  if (!yr || !mo) {
    const now = getKolkataDateParts(new Date());
    yr = yr || now.year;
    mo = mo || now.month;
  }

  let onlineCount = 0;
  let offlineCount = 0;
  let onlineRevenue = 0;
  let offlineRevenue = 0;
  let cashCount = 0;
  let cashAmount = 0;
  let upiCount = 0;
  let upiAmount = 0;
  let codCount = 0;
  let codAmount = 0;
  let otherPaymentCount = 0;
  let otherPaymentAmount = 0;
  let totalDiscounts = 0;
  let totalDelivery = 0;
  let cancelledCount = 0;
  let cancelledRevenue = 0;
  let pendingCount = 0;
  let pendingRevenue = 0;

  const dailyAggregates = {};
  const productAggregates = {};

  // Scan ALL daily worksheets
  workbook.worksheets.forEach(sheet => {
    if (!isDailySheet(sheet.name)) return;

    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const txId = String(row.getCell(1).value || '');
      const txDate = String(row.getCell(3).value || '');
      const txType = String(row.getCell(5).value || '');
      const totalAmount = parseFloat(row.getCell(15).value || 0) || 0;
      const discount = parseFloat(row.getCell(13).value || 0) || 0;
      const deliveryCharge = parseFloat(row.getCell(14).value || 0) || 0;
      const paymentMethod = String(row.getCell(16).value || '').toLowerCase();
      const paymentStatus = String(row.getCell(17).value || '');
      const orderStatus = String(row.getCell(18).value || '');
      const products = String(row.getCell(9).value || '');
      const qty = parseInt(row.getCell(11).value || 1, 10) || 1;

      if (!txId || !txType) continue;

      totalDiscounts += discount;
      totalDelivery += deliveryCharge;

      const isCancelled = orderStatus.toLowerCase() === 'cancelled';
      if (isCancelled) {
        cancelledCount++;
        cancelledRevenue += totalAmount;
      }

      const isPendingPayment = paymentStatus.toLowerCase().includes('pending') || paymentStatus.toLowerCase() === 'unpaid';
      if (isPendingPayment) {
        pendingCount++;
        pendingRevenue += totalAmount;
      }

      const isOnline = txType.includes('Online');
      if (isOnline) {
        onlineCount++;
        if (!isCancelled) onlineRevenue += totalAmount;
      } else {
        offlineCount++;
        if (!isCancelled) offlineRevenue += totalAmount;
      }

      // Payment mode breakdown
      if (paymentMethod.includes('cash on delivery') || paymentMethod === 'cod') {
        codCount++;
        codAmount += totalAmount;
      } else if (paymentMethod.includes('cash')) {
        cashCount++;
        cashAmount += totalAmount;
      } else if (paymentMethod.includes('online') || paymentMethod.includes('upi')) {
        upiCount++;
        upiAmount += totalAmount;
      } else {
        otherPaymentCount++;
        otherPaymentAmount += totalAmount;
      }

      // Daily Breakdown Aggregation
      if (txDate) {
        if (!dailyAggregates[txDate]) {
          dailyAggregates[txDate] = {
            date: txDate,
            onlineOrders: 0,
            offlineSales: 0,
            totalTransactions: 0,
            onlineRevenue: 0,
            offlineRevenue: 0,
            totalRevenue: 0
          };
        }
        const d = dailyAggregates[txDate];
        if (isOnline) {
          d.onlineOrders += 1;
          if (!isCancelled) d.onlineRevenue += totalAmount;
        } else {
          d.offlineSales += 1;
          if (!isCancelled) d.offlineRevenue += totalAmount;
        }
        d.totalTransactions += 1;
        if (!isCancelled) d.totalRevenue += totalAmount;
      }

      // Product Summary Aggregation
      let prodKey = 'Koppampatty Seeraga Samba Rice 1 KG (Retail Pouch)';
      let unitKg = 1;
      if (products.includes('25') || products.toLowerCase().includes('bag')) {
        prodKey = 'Koppampatty Seeraga Samba Rice 25 KG (Wholesale Bulk Bag)';
        unitKg = 25;
      }

      if (!productAggregates[prodKey]) {
        productAggregates[prodKey] = {
          name: prodKey,
          packsSold: 0,
          totalQty: 0,
          totalWeightKg: 0,
          revenue: 0,
          onlineQty: 0,
          offlineQty: 0
        };
      }
      const pa = productAggregates[prodKey];
      pa.packsSold += qty;
      pa.totalQty += qty;
      pa.totalWeightKg += (qty * unitKg);
      if (!isCancelled) pa.revenue += totalAmount;
      if (isOnline) pa.onlineQty += qty;
      else pa.offlineQty += qty;
    }
  });

  const totalTransactions = onlineCount + offlineCount;
  const totalRevenue = onlineRevenue + offlineRevenue;

  // -----------------------------------------------------------------
  // 1. BUILD / UPDATE SHEET: MONTHLY SUMMARY
  // -----------------------------------------------------------------
  const existingSummary = workbook.getWorksheet('MONTHLY SUMMARY');
  if (existingSummary) {
    workbook.removeWorksheet(existingSummary.id);
  }
  const summarySheet = workbook.addWorksheet('MONTHLY SUMMARY');

  // Title Row
  summarySheet.mergeCells('A1:C1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = `🌾 AKE RICE – MONTHLY BUSINESS SUMMARY (${yr}-${mo})`;
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4332' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(1).height = 36;

  // Header Subrow
  summarySheet.addRow(['Metric / Dimension', 'Transaction Count', 'Financial Total (₹)']);
  const subHeader = summarySheet.getRow(2);
  subHeader.height = 26;
  subHeader.eachCell(c => {
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D6A4F' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const summaryData = [
    ['Total Online Orders', onlineCount, onlineRevenue],
    ['Total Offline POS Sales', offlineCount, offlineRevenue],
    ['TOTAL TRANSACTIONS & REVENUE', totalTransactions, totalRevenue],
    ['Cash Transactions (Counter)', cashCount, cashAmount],
    ['Cash on Delivery (Online)', codCount, codAmount],
    ['UPI / Online Payments', upiCount, upiAmount],
    ['Other Payment Methods', otherPaymentCount, otherPaymentAmount],
    ['Total Discounts Given', '-', totalDiscounts],
    ['Total Delivery Charges', '-', totalDelivery],
    ['Cancelled Transactions', cancelledCount, cancelledRevenue],
    ['Pending / Unverified Payments', pendingCount, pendingRevenue]
  ];

  summaryData.forEach(([label, count, amount], idx) => {
    const row = summarySheet.addRow([label, count, amount]);
    row.height = 24;
    const isTotal = label.includes('TOTAL');

    row.getCell(1).font = { name: 'Calibri', size: 10, bold: isTotal };
    row.getCell(2).font = { name: 'Calibri', size: 10, bold: isTotal };
    row.getCell(3).font = { name: 'Calibri', size: 10, bold: isTotal };

    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(3).numFmt = '₹#,##0.00';
    if (typeof count === 'number') row.getCell(2).numFmt = '#,##0';

    if (isTotal) {
      row.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
        c.border = {
          top: { style: 'thin', color: { argb: 'FF1B4332' } },
          bottom: { style: 'double', color: { argb: 'FF1B4332' } }
        };
      });
    } else {
      const isAlt = idx % 2 === 0;
      row.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? 'FFF9FAF8' : 'FFFFFFFF' } };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
      });
    }
  });

  // Spacer row
  summarySheet.addRow([]);

  // Section Header: Daily Revenue Breakdown
  const dailyHeaderStart = summarySheet.rowCount + 1;
  summarySheet.mergeCells(`A${dailyHeaderStart}:G${dailyHeaderStart}`);
  const dailyTitleCell = summarySheet.getCell(`A${dailyHeaderStart}`);
  dailyTitleCell.value = '📅 DAILY REVENUE & TRANSACTION BREAKDOWN';
  dailyTitleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  dailyTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4332' } };
  dailyTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(dailyHeaderStart).height = 30;

  // Daily Breakdown Column Headers
  const dailyHeaders = [
    'Date',
    'Online Orders',
    'Offline Sales',
    'Total Transactions',
    'Online Revenue (₹)',
    'Offline Revenue (₹)',
    'Total Revenue (₹)'
  ];
  summarySheet.addRow(dailyHeaders);
  const dailySubHeader = summarySheet.getRow(dailyHeaderStart + 1);
  dailySubHeader.height = 24;
  dailySubHeader.eachCell(c => {
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D6A4F' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const sortedDates = Object.keys(dailyAggregates).sort();
  sortedDates.forEach((dateStr, idx) => {
    const d = dailyAggregates[dateStr];
    const row = summarySheet.addRow([
      d.date,
      d.onlineOrders,
      d.offlineSales,
      d.totalTransactions,
      d.onlineRevenue,
      d.offlineRevenue,
      d.totalRevenue
    ]);
    row.height = 22;

    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell(2).numFmt = '#,##0';
    row.getCell(3).numFmt = '#,##0';
    row.getCell(4).numFmt = '#,##0';
    row.getCell(5).numFmt = '₹#,##0.00';
    row.getCell(6).numFmt = '₹#,##0.00';
    row.getCell(7).numFmt = '₹#,##0.00';

    const isAlt = idx % 2 === 0;
    row.eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? 'FFF9FAF8' : 'FFFFFFFF' } };
      c.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
    });
  });

  summarySheet.getColumn(1).width = 38;
  summarySheet.getColumn(2).width = 22;
  summarySheet.getColumn(3).width = 24;
  summarySheet.getColumn(4).width = 20;
  summarySheet.getColumn(5).width = 22;
  summarySheet.getColumn(6).width = 22;
  summarySheet.getColumn(7).width = 22;

  // -----------------------------------------------------------------
  // 2. BUILD / UPDATE SHEET: PRODUCT SUMMARY
  // -----------------------------------------------------------------
  const existingProd = workbook.getWorksheet('PRODUCT SUMMARY');
  if (existingProd) {
    workbook.removeWorksheet(existingProd.id);
  }
  const prodSheet = workbook.addWorksheet('PRODUCT SUMMARY');

  // Title Row
  prodSheet.mergeCells('A1:G1');
  const prodTitleCell = prodSheet.getCell('A1');
  prodTitleCell.value = `🌾 AKE RICE – PRODUCT VARIETY & PACKAGING SUMMARY (${yr}-${mo})`;
  prodTitleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  prodTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4332' } };
  prodTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  prodSheet.getRow(1).height = 36;

  // Column Headers
  const prodHeaders = [
    'Product Name / Variety',
    'Packs / Bags Sold',
    'Total Quantity',
    'Total Weight (KG)',
    'Revenue (₹)',
    'Online Quantity',
    'Offline POS Quantity'
  ];
  prodSheet.addRow(prodHeaders);
  const prodHeaderRow = prodSheet.getRow(2);
  prodHeaderRow.height = 26;
  prodHeaderRow.eachCell(c => {
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D6A4F' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Ensure default varieties appear even if 0 sold
  if (!productAggregates['Koppampatty Seeraga Samba Rice 1 KG (Retail Pouch)']) {
    productAggregates['Koppampatty Seeraga Samba Rice 1 KG (Retail Pouch)'] = {
      name: 'Koppampatty Seeraga Samba Rice 1 KG (Retail Pouch)',
      packsSold: 0,
      totalQty: 0,
      totalWeightKg: 0,
      revenue: 0,
      onlineQty: 0,
      offlineQty: 0
    };
  }
  if (!productAggregates['Koppampatty Seeraga Samba Rice 25 KG (Wholesale Bulk Bag)']) {
    productAggregates['Koppampatty Seeraga Samba Rice 25 KG (Wholesale Bulk Bag)'] = {
      name: 'Koppampatty Seeraga Samba Rice 25 KG (Wholesale Bulk Bag)',
      packsSold: 0,
      totalQty: 0,
      totalWeightKg: 0,
      revenue: 0,
      onlineQty: 0,
      offlineQty: 0
    };
  }

  let grandPacks = 0;
  let grandQty = 0;
  let grandKg = 0;
  let grandRevenue = 0;
  let grandOnline = 0;
  let grandOffline = 0;

  Object.values(productAggregates).forEach((p, idx) => {
    grandPacks += p.packsSold;
    grandQty += p.totalQty;
    grandKg += p.totalWeightKg;
    grandRevenue += p.revenue;
    grandOnline += p.onlineQty;
    grandOffline += p.offlineQty;

    const row = prodSheet.addRow([
      p.name,
      p.packsSold,
      p.totalQty,
      p.totalWeightKg,
      p.revenue,
      p.onlineQty,
      p.offlineQty
    ]);
    row.height = 24;

    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(2).numFmt = '#,##0';
    row.getCell(3).numFmt = '#,##0';
    row.getCell(4).numFmt = '#,##0.00 "KG"';
    row.getCell(5).numFmt = '₹#,##0.00';
    row.getCell(6).numFmt = '#,##0';
    row.getCell(7).numFmt = '#,##0';

    const isAlt = idx % 2 === 0;
    row.eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? 'FFF9FAF8' : 'FFFFFFFF' } };
      c.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
    });
  });

  // Grand Total Row
  const totalRow = prodSheet.addRow([
    'GRAND TOTAL',
    grandPacks,
    grandQty,
    grandKg,
    grandRevenue,
    grandOnline,
    grandOffline
  ]);
  totalRow.height = 26;
  totalRow.eachCell((c, colNum) => {
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1B4332' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
    c.border = {
      top: { style: 'thin', color: { argb: 'FF1B4332' } },
      bottom: { style: 'double', color: { argb: 'FF1B4332' } }
    };
    if (colNum === 1) c.alignment = { vertical: 'middle', horizontal: 'left' };
    else if ([2, 3, 6, 7].includes(colNum)) c.alignment = { vertical: 'middle', horizontal: 'center' };
    else c.alignment = { vertical: 'middle', horizontal: 'right' };
  });

  totalRow.getCell(2).numFmt = '#,##0';
  totalRow.getCell(3).numFmt = '#,##0';
  totalRow.getCell(4).numFmt = '#,##0.00 "KG"';
  totalRow.getCell(5).numFmt = '₹#,##0.00';
  totalRow.getCell(6).numFmt = '#,##0';
  totalRow.getCell(7).numFmt = '#,##0';

  prodSheet.getColumn(1).width = 44;
  prodSheet.getColumn(2).width = 18;
  prodSheet.getColumn(3).width = 16;
  prodSheet.getColumn(4).width = 20;
  prodSheet.getColumn(5).width = 22;
  prodSheet.getColumn(6).width = 18;
  prodSheet.getColumn(7).width = 22;
}

/**
 * Upload or update Excel workbook in Google Drive using In-Memory Buffer
 */
async function saveWorkbookToDrive(drive, workbook, yearFolderId, existingFileId, fileName) {
  const buffer = await workbook.xlsx.writeBuffer();
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const media = {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: stream
  };

  if (existingFileId) {
    const res = await drive.files.update({
      fileId: existingFileId,
      media,
      fields: 'id, name, webViewLink, webContentLink, modifiedTime, size'
    });
    return {
      fileId: res.data.id,
      webViewLink: res.data.webViewLink,
      fileName,
      action: 'updated'
    };
  } else {
    const fileMetadata = {
      name: fileName,
      parents: [yearFolderId],
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    const res = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id, name, webViewLink, webContentLink, modifiedTime, size'
    });
    return {
      fileId: res.data.id,
      webViewLink: res.data.webViewLink,
      fileName,
      action: 'created'
    };
  }
}

/**
 * Export a single Online Order to Google Drive monthly workbook in its daily sheet.
 * If the order is deleted or a test order, it is automatically removed from active sheets.
 */
async function exportOrder(order) {
  const startTime = Date.now();

  // If order is deleted or test order, remove it from Drive workbook
  if (order.isDeleted || order.isTest) {
    if (!isConfigured()) return { success: true, message: 'Drive not configured, deletion local only.' };
    return await removeOrderFromDrive(order.id, order.date || order.createdAt);
  }

  if (!isConfigured()) {
    console.warn('[GoogleDrive] Service account credentials not configured. Skipping export.');
    if (order.save) {
      order.googleDriveExport = {
        status: 'not_configured',
        error: 'Google Drive credentials not configured.'
      };
      await order.save().catch(() => {});
    }
    return { success: false, reason: 'not_configured' };
  }

  try {
    const drive = getDriveClient();
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID.trim();
    const tx = formatOrderForExcel(order);
    const { year, month, monthFileName } = tx.dateParts;

    const yearFolderId = await getOrCreateYearFolder(drive, rootFolderId, year);
    const existingFile = await findMonthlyFile(drive, yearFolderId, monthFileName);
    let workbook;

    if (existingFile) {
      const fileRes = await drive.files.get(
        { fileId: existingFile.id, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(fileRes.data));
    } else {
      workbook = buildInitialWorkbook(year, month);
    }

    // Upsert row into corresponding Daily Worksheet (e.g. "November 20")
    const upsertRes = upsertDailyTransactionRow(workbook, tx);

    // Recalculate MONTHLY SUMMARY and PRODUCT SUMMARY sheets across all daily sheets
    recalculateSummarySheets(workbook, year, month);

    // Upload/update in Google Drive
    const saveRes = await saveWorkbookToDrive(
      drive,
      workbook,
      yearFolderId,
      existingFile ? existingFile.id : null,
      monthFileName
    );

    // Update MongoDB Order record
    order.googleDriveExport = {
      status: 'exported',
      fileId: saveRes.fileId,
      fileName: monthFileName,
      exportedAt: new Date(),
      error: null,
      retryCount: (order.googleDriveExport?.retryCount || 0)
    };
    if (order.save) {
      await order.save().catch(() => {});
    }

    // Record audit log
    await DriveBackupLog.create({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action: 'auto_export',
      status: 'success',
      year,
      month,
      fileName: monthFileName,
      fileId: saveRes.fileId,
      transactionType: 'Online Order',
      transactionId: tx.transactionId,
      recordsProcessed: 1,
      details: `${upsertRes.action === 'updated' ? 'Updated' : 'Inserted'} Order ${order.id} in sheet "${upsertRes.sheetName}" of ${monthFileName}`,
      durationMs: Date.now() - startTime
    }).catch(() => {});

    console.log(`[GoogleDrive] Exported Online Order ${order.id} to sheet "${upsertRes.sheetName}" in ${monthFileName}`);
    return { success: true, fileId: saveRes.fileId, fileName: monthFileName, sheetName: upsertRes.sheetName, action: upsertRes.action };
  } catch (err) {
    console.error(`[GoogleDrive Error] Failed exporting Online Order ${order.id}:`, err.message);
    if (order.save) {
      order.googleDriveExport = {
        status: 'failed',
        error: err.message,
        retryCount: (order.googleDriveExport?.retryCount || 0) + 1
      };
      await order.save().catch(() => {});
    }

    await DriveBackupLog.create({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action: 'auto_export',
      status: 'failed',
      transactionType: 'Online Order',
      transactionId: `ORD_${order.id || order._id}`,
      recordsProcessed: 0,
      error: err.message,
      durationMs: Date.now() - startTime
    }).catch(() => {});

    return { success: false, error: err.message };
  }
}

/**
 * Remove an order from its Google Drive monthly workbook and recalculate summaries.
 */
async function removeOrderFromDrive(orderId, orderDate) {
  if (!isConfigured()) return { success: false, reason: 'not_configured' };

  try {
    const drive = getDriveClient();
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID.trim();
    const dateParts = getKolkataDateParts(orderDate || new Date());
    const { year, month, monthFileName } = dateParts;

    const yearFolderId = await getOrCreateYearFolder(drive, rootFolderId, year);
    const existingFile = await findMonthlyFile(drive, yearFolderId, monthFileName);
    if (!existingFile) return { success: true, message: 'Monthly file does not exist.' };

    const fileRes = await drive.files.get(
      { fileId: existingFile.id, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(fileRes.data));

    const removeRes = removeTransactionFromWorkbook(workbook, `ORD_${orderId}`);
    if (removeRes && removeRes.removed) {
      recalculateSummarySheets(workbook, year, month);
      await saveWorkbookToDrive(drive, workbook, yearFolderId, existingFile.id, monthFileName);
      console.log(`[GoogleDrive] Removed ORD_${orderId} from sheet "${removeRes.sheetName}" in ${monthFileName}`);
    }

    return { success: true, removed: !!removeRes?.removed };
  } catch (err) {
    console.error(`[GoogleDrive Error] Failed to remove order ${orderId} from Drive:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Export a single POS Sale to Google Drive monthly workbook in its daily sheet.
 */
async function exportSale(sale) {
  const startTime = Date.now();

  // If sale is deleted or test sale, remove from Drive workbook
  if (sale.isDeleted || sale.isTest) {
    if (!isConfigured()) return { success: true, message: 'Drive not configured, deletion local only.' };
    return await removeSaleFromDrive(sale.id, sale.date || sale.transactionDate || sale.createdAt);
  }

  if (!isConfigured()) {
    console.warn('[GoogleDrive] Service account credentials not configured. Skipping export.');
    if (sale.save) {
      sale.googleDriveExport = {
        status: 'not_configured',
        error: 'Google Drive credentials not configured.'
      };
      await sale.save().catch(() => {});
    }
    return { success: false, reason: 'not_configured' };
  }

  try {
    const drive = getDriveClient();
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID.trim();
    const tx = formatSaleForExcel(sale);
    const { year, month, monthFileName } = tx.dateParts;

    const yearFolderId = await getOrCreateYearFolder(drive, rootFolderId, year);
    const existingFile = await findMonthlyFile(drive, yearFolderId, monthFileName);
    let workbook;

    if (existingFile) {
      const fileRes = await drive.files.get(
        { fileId: existingFile.id, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(fileRes.data));
    } else {
      workbook = buildInitialWorkbook(year, month);
    }

    const upsertRes = upsertDailyTransactionRow(workbook, tx);
    recalculateSummarySheets(workbook, year, month);

    const saveRes = await saveWorkbookToDrive(
      drive,
      workbook,
      yearFolderId,
      existingFile ? existingFile.id : null,
      monthFileName
    );

    sale.googleDriveExport = {
      status: 'exported',
      fileId: saveRes.fileId,
      fileName: monthFileName,
      exportedAt: new Date(),
      error: null,
      retryCount: (sale.googleDriveExport?.retryCount || 0)
    };
    if (sale.save) {
      await sale.save().catch(() => {});
    }

    await DriveBackupLog.create({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action: 'auto_export',
      status: 'success',
      year,
      month,
      fileName: monthFileName,
      fileId: saveRes.fileId,
      transactionType: 'Offline POS Sale',
      transactionId: tx.transactionId,
      recordsProcessed: 1,
      details: `${upsertRes.action === 'updated' ? 'Updated' : 'Inserted'} POS Sale ${sale.id} in sheet "${upsertRes.sheetName}" of ${monthFileName}`,
      durationMs: Date.now() - startTime
    }).catch(() => {});

    console.log(`[GoogleDrive] Exported POS Sale ${sale.id} to sheet "${upsertRes.sheetName}" in ${monthFileName}`);
    return { success: true, fileId: saveRes.fileId, fileName: monthFileName, sheetName: upsertRes.sheetName, action: upsertRes.action };
  } catch (err) {
    console.error(`[GoogleDrive Error] Failed exporting POS Sale ${sale.id}:`, err.message);
    if (sale.save) {
      sale.googleDriveExport = {
        status: 'failed',
        error: err.message,
        retryCount: (sale.googleDriveExport?.retryCount || 0) + 1
      };
      await sale.save().catch(() => {});
    }

    await DriveBackupLog.create({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action: 'auto_export',
      status: 'failed',
      transactionType: 'Offline POS Sale',
      transactionId: `POS_${sale.id || sale._id}`,
      recordsProcessed: 0,
      error: err.message,
      durationMs: Date.now() - startTime
    }).catch(() => {});

    return { success: false, error: err.message };
  }
}

/**
 * Remove a POS sale from its Google Drive monthly workbook and recalculate summaries.
 */
async function removeSaleFromDrive(saleId, saleDate) {
  if (!isConfigured()) return { success: false, reason: 'not_configured' };

  try {
    const drive = getDriveClient();
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID.trim();
    const dateParts = getKolkataDateParts(saleDate || new Date());
    const { year, month, monthFileName } = dateParts;

    const yearFolderId = await getOrCreateYearFolder(drive, rootFolderId, year);
    const existingFile = await findMonthlyFile(drive, yearFolderId, monthFileName);
    if (!existingFile) return { success: true, message: 'Monthly file does not exist.' };

    const fileRes = await drive.files.get(
      { fileId: existingFile.id, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(fileRes.data));

    const removeRes = removeTransactionFromWorkbook(workbook, `POS_${saleId}`);
    if (removeRes && removeRes.removed) {
      recalculateSummarySheets(workbook, year, month);
      await saveWorkbookToDrive(drive, workbook, yearFolderId, existingFile.id, monthFileName);
      console.log(`[GoogleDrive] Removed POS_${saleId} from sheet "${removeRes.sheetName}" in ${monthFileName}`);
    }

    return { success: true, removed: !!removeRes?.removed };
  } catch (err) {
    console.error(`[GoogleDrive Error] Failed to remove sale ${saleId} from Drive:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Batch export transactions grouped by year and month into their respective Daily Sheets.
 * Excludes deleted orders and test records automatically.
 */
async function exportBatchTransactions(orders = [], sales = [], triggeredBy = 'Admin') {
  const startTime = Date.now();
  if (!isConfigured()) {
    return {
      success: false,
      message: 'Google Drive credentials (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID) are not configured.'
    };
  }

  const drive = getDriveClient();
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID.trim();

  // Filter out any deleted or test transactions
  const validOrders = orders.filter(o => !o.isDeleted && !o.isTest);
  const validSales = sales.filter(s => !s.isDeleted && !s.isTest);

  const allTxs = [
    ...validOrders.map(o => ({ ...formatOrderForExcel(o), rawDoc: o, isOrder: true })),
    ...validSales.map(s => ({ ...formatSaleForExcel(s), rawDoc: s, isOrder: false }))
  ];

  if (allTxs.length === 0) {
    return { success: true, message: 'No valid transactions to export.', processedCount: 0 };
  }

  // Group by monthKey (e.g. '2026_11')
  const monthGroups = {};
  for (const tx of allTxs) {
    const key = tx.dateParts.monthKey;
    if (!monthGroups[key]) {
      monthGroups[key] = {
        year: tx.dateParts.year,
        month: tx.dateParts.month,
        fileName: tx.dateParts.monthFileName,
        transactions: []
      };
    }
    monthGroups[key].transactions.push(tx);
  }

  const results = [];
  let totalProcessed = 0;

  for (const [monthKey, group] of Object.entries(monthGroups)) {
    try {
      const yearFolderId = await getOrCreateYearFolder(drive, rootFolderId, group.year);
      const existingFile = await findMonthlyFile(drive, yearFolderId, group.fileName);
      let workbook;

      if (existingFile) {
        const fileRes = await drive.files.get(
          { fileId: existingFile.id, alt: 'media' },
          { responseType: 'arraybuffer' }
        );
        workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(Buffer.from(fileRes.data));
      } else {
        workbook = buildInitialWorkbook(group.year, group.month);
      }

      let insertedCount = 0;
      let updatedCount = 0;

      for (const tx of group.transactions) {
        const res = upsertDailyTransactionRow(workbook, tx);
        if (res.action === 'inserted') insertedCount++;
        else updatedCount++;
      }

      recalculateSummarySheets(workbook, group.year, group.month);

      const saveRes = await saveWorkbookToDrive(
        drive,
        workbook,
        yearFolderId,
        existingFile ? existingFile.id : null,
        group.fileName
      );

      // Update MongoDB status
      for (const tx of group.transactions) {
        const doc = tx.rawDoc;
        doc.googleDriveExport = {
          status: 'exported',
          fileId: saveRes.fileId,
          fileName: group.fileName,
          exportedAt: new Date(),
          error: null,
          retryCount: (doc.googleDriveExport?.retryCount || 0)
        };
        if (doc.save) {
          await doc.save().catch(() => {});
        }
      }

      totalProcessed += group.transactions.length;
      results.push({
        monthKey,
        fileName: group.fileName,
        fileId: saveRes.fileId,
        inserted: insertedCount,
        updated: updatedCount,
        total: group.transactions.length,
        webViewLink: saveRes.webViewLink
      });
    } catch (err) {
      console.error(`[GoogleDrive Error] Failed batch export for ${monthKey}:`, err.message);
      results.push({
        monthKey,
        fileName: group.fileName,
        error: err.message
      });
    }
  }

  await DriveBackupLog.create({
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    action: 'historical_export',
    status: results.some(r => r.error) ? 'partial' : 'success',
    recordsProcessed: totalProcessed,
    details: `Processed ${totalProcessed} transactions across ${Object.keys(monthGroups).length} monthly files with Daily Sheets.`,
    triggeredBy,
    durationMs: Date.now() - startTime
  }).catch(() => {});

  return {
    success: true,
    totalProcessed,
    results
  };
}

/**
 * Historical Data Export: Export all active non-test database transactions
 */
async function exportAllHistoricalTransactions(triggeredBy = 'Admin') {
  const orders = await Order.find({ isDeleted: { $ne: true }, isTest: { $ne: true } }).sort({ createdAt: 1 });
  const sales = await Sale.find({ isDeleted: { $ne: true }, isTest: { $ne: true } }).sort({ createdAt: 1 });
  return await exportBatchTransactions(orders, sales, triggeredBy);
}

/**
 * Retry Failed Exports: Re-export pending or failed transactions
 */
async function retryFailedExports(triggeredBy = 'Admin') {
  const failedOrders = await Order.find({
    isDeleted: { $ne: true },
    isTest: { $ne: true },
    $or: [
      { 'googleDriveExport.status': 'failed' },
      { 'googleDriveExport.status': 'pending' },
      { googleDriveExport: { $exists: false } }
    ]
  });

  const failedSales = await Sale.find({
    isDeleted: { $ne: true },
    isTest: { $ne: true },
    $or: [
      { 'googleDriveExport.status': 'failed' },
      { 'googleDriveExport.status': 'pending' },
      { googleDriveExport: { $exists: false } }
    ]
  });

  return await exportBatchTransactions(failedOrders, failedSales, triggeredBy);
}

/**
 * Sync Current Month Transactions into their daily sheets
 */
async function syncCurrentMonth(triggeredBy = 'Admin') {
  const nowParts = getKolkataDateParts(new Date());
  const yearMonthPrefix = `${nowParts.year}-${nowParts.month}`;

  const orders = await Order.find({
    isDeleted: { $ne: true },
    isTest: { $ne: true },
    $or: [
      { date: new RegExp(`^${yearMonthPrefix}`) },
      { createdAt: { $gte: new Date(`${nowParts.year}-${nowParts.month}-01T00:00:00.000Z`) } }
    ]
  });

  const sales = await Sale.find({
    isDeleted: { $ne: true },
    isTest: { $ne: true },
    $or: [
      { date: new RegExp(`^${yearMonthPrefix}`) },
      { transactionDate: new RegExp(`^${yearMonthPrefix}`) },
      { createdAt: { $gte: new Date(`${nowParts.year}-${nowParts.month}-01T00:00:00.000Z`) } }
    ]
  });

  return await exportBatchTransactions(orders, sales, triggeredBy);
}

/**
 * Handle Google Drive sync when all orders are deleted
 * Regenerates the active monthly workbook to an empty state with 0 transactions
 */
async function handleAllOrdersDeleted(triggeredBy = 'Super Admin') {
  if (!isConfigured()) return { success: false, reason: 'not_configured' };
  try {
    const drive = getDriveClient();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID.trim();
    const nowParts = getKolkataDateParts(new Date());

    const yearFolderId = await getOrCreateYearFolder(drive, folderId, nowParts.year);
    const existingFile = await findMonthlyFile(drive, yearFolderId, nowParts.monthFileName);

    const workbook = buildInitialWorkbook(nowParts.year, nowParts.month);
    recalculateSummarySheets(workbook, nowParts.year, nowParts.month);

    await saveWorkbookToDrive(drive, workbook, yearFolderId, existingFile ? existingFile.id : null, nowParts.monthFileName);

    await DriveBackupLog.create({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action: 'delete_all_orders',
      status: 'success',
      triggeredBy,
      fileId: existingFile ? existingFile.id : undefined,
      fileName: nowParts.monthFileName,
      stats: { ordersExported: 0, salesExported: 0, failedCount: 0 },
      details: 'All orders deleted in MongoDB; reset active monthly workbook to empty state.'
    }).catch(() => {});

    return { success: true, message: 'Google Drive monthly workbook updated to empty state.' };
  } catch (err) {
    console.error('[GoogleDrive] handleAllOrdersDeleted error:', err.message);
    await DriveBackupLog.create({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action: 'delete_all_orders',
      status: 'failed',
      triggeredBy,
      error: err.message,
      details: 'Failed to update Google Drive workbook after orders deleted.'
    }).catch(() => {});
    return { success: false, error: err.message };
  }
}

/**
 * Test Google Drive API connection & permissions
 */
async function testConnection() {
  if (!isConfigured()) {
    return {
      connected: false,
      configured: false,
      message: 'Google Drive credentials are not set in environment variables. Please configure GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_DRIVE_FOLDER_ID.'
    };
  }

  try {
    const drive = getDriveClient();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID.trim();

    const folderRes = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType, capabilities(canAddChildren, canEdit)'
    });

    return {
      connected: true,
      configured: true,
      folderId: folderRes.data.id,
      folderName: folderRes.data.name,
      canAddChildren: folderRes.data.capabilities?.canAddChildren,
      canEdit: folderRes.data.capabilities?.canEdit,
      message: `Successfully connected to Google Drive folder: "${folderRes.data.name}"`
    };
  } catch (err) {
    console.error('[GoogleDrive Error] testConnection failed:', err.message);
    return {
      connected: false,
      configured: true,
      error: err.message,
      message: `Failed to connect to Google Drive: ${err.message}`
    };
  }
}

/**
 * Gather backup status, active daily sheets, metrics, and drive files
 */
async function getBackupStatus() {
  const configured = isConfigured();
  let connected = false;
  let connectionError = null;
  let driveFiles = [];
  let rootFolder = null;
  let currentMonthSheets = [];

  const nowParts = getKolkataDateParts(new Date());

  if (configured) {
    try {
      const drive = getDriveClient();
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID.trim();

      const folderRes = await drive.files.get({
        fileId: folderId,
        fields: 'id, name'
      });
      rootFolder = folderRes.data;
      connected = true;

      // Find files in current year folder
      const yearFolderId = await getOrCreateYearFolder(drive, folderId, nowParts.year);
      const filesRes = await drive.files.list({
        q: `'${yearFolderId}' in parents and trashed = false`,
        fields: 'files(id, name, size, modifiedTime, webViewLink, webContentLink)',
        orderBy: 'name desc'
      });

      if (filesRes.data.files) {
        driveFiles = filesRes.data.files.map(f => ({
          ...f,
          year: nowParts.year
        }));

        // Check if current month workbook exists and inspect its daily sheets
        const curFile = driveFiles.find(f => f.name === nowParts.monthFileName);
        if (curFile) {
          try {
            const fileRes = await drive.files.get(
              { fileId: curFile.id, alt: 'media' },
              { responseType: 'arraybuffer' }
            );
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(Buffer.from(fileRes.data));
            currentMonthSheets = wb.worksheets
              .map(ws => ws.name)
              .filter(name => isDailySheet(name));
          } catch (e) {
            // non-fatal if inspection fails
          }
        }
      }
    } catch (err) {
      connected = false;
      connectionError = err.message;
    }
  }

  // Active MongoDB metrics (excluding deleted and test records)
  const totalOrders = await Order.countDocuments({ isDeleted: { $ne: true }, isTest: { $ne: true } });
  const exportedOrders = await Order.countDocuments({ isDeleted: { $ne: true }, isTest: { $ne: true }, 'googleDriveExport.status': 'exported' });
  const pendingOrders = await Order.countDocuments({
    isDeleted: { $ne: true },
    isTest: { $ne: true },
    $or: [{ 'googleDriveExport.status': 'pending' }, { googleDriveExport: { $exists: false } }]
  });
  const failedOrders = await Order.countDocuments({ isDeleted: { $ne: true }, isTest: { $ne: true }, 'googleDriveExport.status': 'failed' });

  const totalSales = await Sale.countDocuments({ isDeleted: { $ne: true }, isTest: { $ne: true } });
  const exportedSales = await Sale.countDocuments({ isDeleted: { $ne: true }, isTest: { $ne: true }, 'googleDriveExport.status': 'exported' });
  const pendingSales = await Sale.countDocuments({
    isDeleted: { $ne: true },
    isTest: { $ne: true },
    $or: [{ 'googleDriveExport.status': 'pending' }, { googleDriveExport: { $exists: false } }]
  });
  const failedSales = await Sale.countDocuments({ isDeleted: { $ne: true }, isTest: { $ne: true }, 'googleDriveExport.status': 'failed' });

  // Current month active transaction counts
  const currentMonthPrefix = `${nowParts.year}-${nowParts.month}`;
  const currentMonthOrders = await Order.countDocuments({
    isDeleted: { $ne: true },
    isTest: { $ne: true },
    $or: [
      { date: new RegExp(`^${currentMonthPrefix}`) },
      { createdAt: { $gte: new Date(`${nowParts.year}-${nowParts.month}-01T00:00:00.000Z`) } }
    ]
  });

  const currentMonthSales = await Sale.countDocuments({
    isDeleted: { $ne: true },
    isTest: { $ne: true },
    $or: [
      { date: new RegExp(`^${currentMonthPrefix}`) },
      { transactionDate: new RegExp(`^${currentMonthPrefix}`) },
      { createdAt: { $gte: new Date(`${nowParts.year}-${nowParts.month}-01T00:00:00.000Z`) } }
    ]
  });

  const logs = await DriveBackupLog.find({})
    .sort({ createdAt: -1 })
    .limit(15)
    .lean();

  return {
    configured,
    connected,
    connectionError,
    folderId: rootFolder ? rootFolder.id : (process.env.GOOGLE_DRIVE_FOLDER_ID || null),
    folderName: rootFolder ? rootFolder.name : null,
    metrics: {
      totalTransactions: totalOrders + totalSales,
      totalExported: exportedOrders + exportedSales,
      totalPending: pendingOrders + pendingSales,
      totalFailed: failedOrders + failedSales,
      onlineOrders: {
        total: totalOrders,
        exported: exportedOrders,
        pending: pendingOrders,
        failed: failedOrders
      },
      posSales: {
        total: totalSales,
        exported: exportedSales,
        pending: pendingSales,
        failed: failedSales
      },
      currentMonth: {
        year: nowParts.year,
        month: nowParts.month,
        fileName: nowParts.monthFileName,
        onlineOrders: currentMonthOrders,
        posSales: currentMonthSales,
        total: currentMonthOrders + currentMonthSales,
        dailySheetsCount: currentMonthSheets.length,
        dailySheets: currentMonthSheets
      }
    },
    driveFiles,
    logs
  };
}

module.exports = {
  isConfigured,
  getDriveClient,
  getKolkataDateParts,
  DAILY_SHEET_HEADERS,
  formatOrderForExcel,
  formatSaleForExcel,
  getOrCreateDailySheet,
  upsertDailyTransactionRow,
  removeTransactionFromWorkbook,
  buildInitialWorkbook,
  recalculateSummarySheets,
  saveWorkbookToDrive,
  exportOrder,
  removeOrderFromDrive,
  exportSale,
  removeSaleFromDrive,
  exportBatchTransactions,
  exportAllHistoricalTransactions,
  retryFailedExports,
  syncCurrentMonth,
  handleAllOrdersDeleted,
  testConnection,
  getBackupStatus
};
