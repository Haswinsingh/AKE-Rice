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

  return {
    year,
    month,
    day,
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hour}:${minute}:${second}`,
    monthKey: `${year}_${month}`,
    monthFileName: `AKE_Rice_Transactions_${year}_${month}.xlsx`
  };
}

/**
 * Convert Order model to uniform Excel Transaction row object
 */
function formatOrderForExcel(order) {
  const dateParts = getKolkataDateParts(order.createdAt || order.date || new Date());
  const txId = `ORD_${order.id || order._id}`;
  const totalQty = parseInt(order.qty || 1, 10);
  const totalAmount = parseFloat(order.total || 0);

  const productDesc = `${order.product || 'Koppampatty Seeraga Samba Rice'} (x${totalQty})`;
  const unitWeightKg = order.productId === '25kg' || (order.product && order.product.includes('25')) ? 25 : 1;
  const totalWeightKg = order.stockDeductedKg || (totalQty * unitWeightKg);
  const productDetails = `ID: ${order.productId || '1kg'} | Rate: ₹${order.rate || 195}/kg | Weight: ${totalWeightKg} KG`;

  return {
    transactionId: txId,
    orderSaleId: order.id || 'N/A',
    date: dateParts.dateStr,
    time: dateParts.timeStr,
    transactionType: 'Online Order',
    customerName: (order.name || 'Valued Customer').trim(),
    customerPhone: (order.mobile || 'N/A').trim(),
    customerAddress: `${order.address || ''}, ${order.area || ''}`.trim().replace(/^,\s*|,\s*$/g, ''),
    productsPurchased: productDesc,
    productDetails,
    totalQuantity: totalQty,
    subtotal: totalAmount,
    discount: 0,
    deliveryCharge: 0,
    totalAmount,
    paymentMethod: order.payment || order.paymentType || 'Cash on Delivery',
    paymentStatus: order.paymentStatus || 'Pending Verification',
    orderSaleStatus: order.status || 'Pending',
    salesStaffName: 'Online Store',
    posLoginId: 'N/A - Customer',
    createdBy: (order.name || 'Website Customer').trim(),
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
  const productName = sale.product || sale.riceType || '1 KG Rice';
  const unitWeightKg = productName.includes('25') ? 25 : 1;
  const rate = parseFloat(sale.rate || sale.ratePerKg || (unitWeightKg === 25 ? 185 : 195));
  const productDetails = `Rate: ₹${rate}/kg | Total Weight: ${totalQty * unitWeightKg} KG`;

  return {
    transactionId: txId,
    orderSaleId: sale.id || sale.transactionId || 'N/A',
    date: dateParts.dateStr,
    time: dateParts.timeStr,
    transactionType: 'Offline POS Sale',
    customerName: (sale.customerName || sale.shop || 'Walk-in Customer').trim(),
    customerPhone: 'N/A - Retail POS',
    customerAddress: (sale.area || 'Retail Counter').trim(),
    productsPurchased: `${productName} (x${totalQty})`,
    productDetails,
    totalQuantity: totalQty,
    subtotal: totalAmount,
    discount: 0,
    deliveryCharge: 0,
    totalAmount,
    paymentMethod: sale.payment || sale.paymentMethod || 'Cash',
    paymentStatus: 'Paid',
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

  // Create new year folder
  const folderMetadata = {
    name: String(year),
    mimeType: 'application/vnd.google-apps.folder',
    parents: [rootFolderId]
  };

  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: 'id, name'
  });

  console.log(`[GoogleDrive] Created year folder '${year}' in Drive (ID: ${folder.data.id})`);
  return folder.data.id;
}

/**
 * Search for an existing monthly Excel file in Google Drive under year folder
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
 * Set up sheets, columns, formulas, and styles for a brand new monthly workbook
 */
function buildInitialWorkbook(year, month) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AKE Rice Automated Backup Service';
  workbook.lastModifiedBy = 'AKE Rice REST API';
  workbook.created = new Date();
  workbook.modified = new Date();

  // -------------------------------------------------------------
  // SHEET 1: TRANSACTIONS
  // -------------------------------------------------------------
  const txSheet = workbook.addWorksheet('TRANSACTIONS', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  txSheet.columns = [
    { header: 'Transaction ID', key: 'transactionId', width: 22 },
    { header: 'Order/Sale ID', key: 'orderSaleId', width: 16 },
    { header: 'Transaction Date', key: 'date', width: 16 },
    { header: 'Transaction Time', key: 'time', width: 16 },
    { header: 'Transaction Type', key: 'transactionType', width: 18 },
    { header: 'Customer Name', key: 'customerName', width: 26 },
    { header: 'Customer Phone', key: 'customerPhone', width: 18 },
    { header: 'Customer Address', key: 'customerAddress', width: 32 },
    { header: 'Products Purchased', key: 'productsPurchased', width: 30 },
    { header: 'Product Details', key: 'productDetails', width: 34 },
    { header: 'Total Quantity', key: 'totalQuantity', width: 15 },
    { header: 'Subtotal (₹)', key: 'subtotal', width: 16 },
    { header: 'Discount (₹)', key: 'discount', width: 15 },
    { header: 'Delivery Charge (₹)', key: 'deliveryCharge', width: 18 },
    { header: 'Total Amount (₹)', key: 'totalAmount', width: 18 },
    { header: 'Payment Method', key: 'paymentMethod', width: 20 },
    { header: 'Payment Status', key: 'paymentStatus', width: 18 },
    { header: 'Order/Sale Status', key: 'orderSaleStatus', width: 18 },
    { header: 'Sales Staff Name', key: 'salesStaffName', width: 22 },
    { header: 'POS Login ID', key: 'posLoginId', width: 18 },
    { header: 'Created By', key: 'createdBy', width: 20 },
    { header: 'Notes', key: 'notes', width: 32 }
  ];

  // Header row styling
  const headerRow = txSheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B4332' } // Dark Forest Green
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0D2319' } },
      bottom: { style: 'medium', color: { argb: 'FF0D2319' } },
      left: { style: 'thin', color: { argb: 'FF2D6A4F' } },
      right: { style: 'thin', color: { argb: 'FF2D6A4F' } }
    };
  });

  // -------------------------------------------------------------
  // SHEET 2: MONTHLY SUMMARY
  // -------------------------------------------------------------
  const summarySheet = workbook.addWorksheet('MONTHLY SUMMARY');
  summarySheet.columns = [
    { width: 36 },
    { width: 26 },
    { width: 32 }
  ];

  // -------------------------------------------------------------
  // SHEET 3: PRODUCT SUMMARY
  // -------------------------------------------------------------
  const productSheet = workbook.addWorksheet('PRODUCT SUMMARY');
  productSheet.columns = [
    { header: 'Product Name', key: 'productName', width: 32 },
    { header: 'Total Quantity Sold', key: 'totalQty', width: 22 },
    { header: 'Total Revenue (₹)', key: 'totalRevenue', width: 22 },
    { header: 'Number of Transactions', key: 'txCount', width: 24 }
  ];

  const prodHeader = productSheet.getRow(1);
  prodHeader.height = 28;
  prodHeader.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B4332' }
    };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  return workbook;
}

/**
 * Upsert transaction row into TRANSACTIONS worksheet.
 * Prevents duplicates by checking Column 1 (Transaction ID).
 * If exists: updates the row. If not: appends a new row.
 */
function upsertTransactionRow(txSheet, tx) {
  let targetRow = null;
  let isUpdate = false;

  const rowCount = txSheet.rowCount;
  for (let r = 2; r <= rowCount; r++) {
    const row = txSheet.getRow(r);
    const existingTxId = row.getCell(1).value;
    if (existingTxId && String(existingTxId).trim() === tx.transactionId) {
      targetRow = row;
      isUpdate = true;
      break;
    }
  }

  if (!targetRow) {
    targetRow = txSheet.addRow([]);
  }

  // Populate cell values
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

    // Center dates, times, quantities, and IDs
    if ([1, 2, 3, 4, 5, 11, 16, 17, 18, 20].includes(colNumber)) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else if ([12, 13, 14, 15].includes(colNumber)) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    }
  });

  return { action: isUpdate ? 'updated' : 'inserted', rowNumber: targetRow.number };
}

/**
 * Recompute and format Sheet 2 (MONTHLY SUMMARY) and Sheet 3 (PRODUCT SUMMARY)
 * based on all rows in Sheet 1 (TRANSACTIONS).
 */
function recalculateSummarySheets(workbook, year, month) {
  const txSheet = workbook.getWorksheet('TRANSACTIONS');
  if (!txSheet) return;

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

  const productAggregates = {};

  const rowCount = txSheet.rowCount;
  for (let r = 2; r <= rowCount; r++) {
    const row = txSheet.getRow(r);
    const txType = String(row.getCell(5).value || '');
    const totalAmount = parseFloat(row.getCell(15).value || 0) || 0;
    const paymentMethod = String(row.getCell(16).value || '').toLowerCase();
    const paymentStatus = String(row.getCell(17).value || '');
    const orderStatus = String(row.getCell(18).value || '');
    const products = String(row.getCell(9).value || '');
    const qty = parseInt(row.getCell(11).value || 1, 10) || 1;

    if (!txType) continue;

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

    if (txType.includes('Online')) {
      onlineCount++;
      if (!isCancelled) onlineRevenue += totalAmount;
    } else {
      offlineCount++;
      if (!isCancelled) offlineRevenue += totalAmount;
    }

    // Payment method breakdown
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

    // Product breakdown
    let matchedProd = 'Koppampatty Seeraga Samba Rice 1 KG';
    if (products.includes('25')) {
      matchedProd = 'Koppampatty Seeraga Samba Rice 25 KG (Bag)';
    }

    if (!productAggregates[matchedProd]) {
      productAggregates[matchedProd] = { qty: 0, revenue: 0, count: 0 };
    }
    if (!isCancelled) {
      productAggregates[matchedProd].qty += qty;
      productAggregates[matchedProd].revenue += totalAmount;
    }
    productAggregates[matchedProd].count += 1;
  }

  const totalTransactions = onlineCount + offlineCount;
  const totalRevenue = onlineRevenue + offlineRevenue;

  // -------------------------------------------------------------
  // UPDATE SHEET 2: MONTHLY SUMMARY
  // -------------------------------------------------------------
  let summarySheet = workbook.getWorksheet('MONTHLY SUMMARY');
  if (!summarySheet) {
    summarySheet = workbook.addWorksheet('MONTHLY SUMMARY');
  }

  // Clear existing rows
  summarySheet.spliceRows(1, summarySheet.rowCount + 1);

  // Title Row
  summarySheet.mergeCells('A1:C1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = `🌾 AKE RICE – MONTHLY BUSINESS SUMMARY (${year}-${month})`;
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
    ['TOTAL TRANSACTIONS', totalTransactions, totalRevenue],
    ['Cash Transactions (Counter)', cashCount, cashAmount],
    ['Cash on Delivery (Online)', codCount, codAmount],
    ['UPI / Online Payments', upiCount, upiAmount],
    ['Other Payment Methods', otherPaymentCount, otherPaymentAmount],
    ['Cancelled Transactions', cancelledCount, cancelledRevenue],
    ['Pending / Unverified Payments', pendingCount, pendingRevenue]
  ];

  summaryData.forEach(([label, count, amount], idx) => {
    const row = summarySheet.addRow([label, count, amount]);
    row.height = 24;
    row.getCell(1).font = { name: 'Calibri', size: 10, bold: label.includes('TOTAL') };
    row.getCell(2).font = { name: 'Calibri', size: 10, bold: label.includes('TOTAL') };
    row.getCell(3).font = { name: 'Calibri', size: 10, bold: label.includes('TOTAL') };

    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(3).numFmt = '₹#,##0.00';
    row.getCell(2).numFmt = '#,##0';

    if (label.includes('TOTAL')) {
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

  // -------------------------------------------------------------
  // UPDATE SHEET 3: PRODUCT SUMMARY
  // -------------------------------------------------------------
  let prodSheet = workbook.getWorksheet('PRODUCT SUMMARY');
  if (!prodSheet) {
    prodSheet = workbook.addWorksheet('PRODUCT SUMMARY');
  }

  // Clear existing data rows (keep header)
  prodSheet.spliceRows(2, prodSheet.rowCount);

  let grandProdQty = 0;
  let grandProdRevenue = 0;
  let grandProdTx = 0;

  for (const [prodName, stats] of Object.entries(productAggregates)) {
    const row = prodSheet.addRow([prodName, stats.qty, stats.revenue, stats.count]);
    row.height = 24;
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(2).numFmt = '#,##0';
    row.getCell(3).numFmt = '₹#,##0.00';
    row.getCell(4).numFmt = '#,##0';

    grandProdQty += stats.qty;
    grandProdRevenue += stats.revenue;
    grandProdTx += stats.count;

    row.eachCell(c => {
      c.font = { name: 'Calibri', size: 10 };
      c.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
    });
  }

  // Grand Total Row
  const totalRow = prodSheet.addRow(['TOTAL ALL PRODUCTS', grandProdQty, grandProdRevenue, grandProdTx]);
  totalRow.height = 26;
  totalRow.eachCell(c => {
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1B4332' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
    c.border = {
      top: { style: 'thin', color: { argb: 'FF1B4332' } },
      bottom: { style: 'double', color: { argb: 'FF1B4332' } }
    };
  });
  totalRow.getCell(2).numFmt = '#,##0';
  totalRow.getCell(3).numFmt = '₹#,##0.00';
  totalRow.getCell(4).numFmt = '#,##0';
  totalRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
  totalRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
  totalRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
}

/**
 * Save / Update Excel workbook directly in Google Drive
 */
async function saveWorkbookToDrive(drive, workbook, yearFolderId, existingFileId, fileName) {
  const buffer = await workbook.xlsx.writeBuffer();
  const mediaStream = Readable.from(Buffer.from(buffer));

  if (existingFileId) {
    const res = await drive.files.update({
      fileId: existingFileId,
      media: {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: mediaStream
      },
      fields: 'id, name, webViewLink, webContentLink, modifiedTime, size'
    });
    return { fileId: res.data.id, fileName: res.data.name, webViewLink: res.data.webViewLink, isNew: false };
  } else {
    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [yearFolderId],
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      },
      media: {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: mediaStream
      },
      fields: 'id, name, webViewLink, webContentLink, modifiedTime, size'
    });
    return { fileId: res.data.id, fileName: res.data.name, webViewLink: res.data.webViewLink, isNew: true };
  }
}

/**
 * Export a single Order to Google Drive monthly workbook
 */
async function exportOrder(order) {
  const startTime = Date.now();
  if (!isConfigured()) {
    console.warn('[GoogleDrive] Service account credentials not configured. Skipping export.');
    if (order.save) {
      order.googleDriveExport = {
        status: 'not_configured',
        error: 'Google Drive credentials (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_DRIVE_FOLDER_ID) not configured.'
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

    // 1. Get or create Year folder (e.g., '2026')
    const yearFolderId = await getOrCreateYearFolder(drive, rootFolderId, year);

    // 2. Find or create Monthly Excel workbook
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

    // 3. Upsert row in TRANSACTIONS sheet (duplicate prevention)
    let txSheet = workbook.getWorksheet('TRANSACTIONS');
    if (!txSheet) {
      txSheet = workbook.addWorksheet('TRANSACTIONS');
    }
    const upsertRes = upsertTransactionRow(txSheet, tx);

    // 4. Recalculate MONTHLY SUMMARY and PRODUCT SUMMARY sheets
    recalculateSummarySheets(workbook, year, month);

    // 5. Upload/update in Google Drive
    const saveRes = await saveWorkbookToDrive(
      drive,
      workbook,
      yearFolderId,
      existingFile ? existingFile.id : null,
      monthFileName
    );

    // 6. Update MongoDB Order record
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
      details: `${upsertRes.action === 'updated' ? 'Updated' : 'Inserted'} Online Order ${order.id} in ${monthFileName}`,
      durationMs: Date.now() - startTime
    }).catch(() => {});

    console.log(`[GoogleDrive] Exported Online Order ${order.id} to ${monthFileName} (${upsertRes.action})`);
    return { success: true, fileId: saveRes.fileId, fileName: monthFileName, action: upsertRes.action };
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
 * Export a single POS Sale to Google Drive monthly workbook
 */
async function exportSale(sale) {
  const startTime = Date.now();
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

    // 1. Get or create Year folder
    const yearFolderId = await getOrCreateYearFolder(drive, rootFolderId, year);

    // 2. Find or create Monthly Excel workbook
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

    // 3. Upsert row in TRANSACTIONS sheet
    let txSheet = workbook.getWorksheet('TRANSACTIONS');
    if (!txSheet) {
      txSheet = workbook.addWorksheet('TRANSACTIONS');
    }
    const upsertRes = upsertTransactionRow(txSheet, tx);

    // 4. Recalculate summary sheets
    recalculateSummarySheets(workbook, year, month);

    // 5. Upload/update in Google Drive
    const saveRes = await saveWorkbookToDrive(
      drive,
      workbook,
      yearFolderId,
      existingFile ? existingFile.id : null,
      monthFileName
    );

    // 6. Update MongoDB Sale record
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

    // Record audit log
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
      details: `${upsertRes.action === 'updated' ? 'Updated' : 'Inserted'} POS Sale ${sale.id} in ${monthFileName}`,
      durationMs: Date.now() - startTime
    }).catch(() => {});

    console.log(`[GoogleDrive] Exported POS Sale ${sale.id} to ${monthFileName} (${upsertRes.action})`);
    return { success: true, fileId: saveRes.fileId, fileName: monthFileName, action: upsertRes.action };
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
 * Batch export transactions grouped by year and month.
 * Performs a single download, bulk row insertion/update, and single upload per month file!
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

  // Normalize all transactions
  const allTxs = [
    ...orders.map(o => ({ ...formatOrderForExcel(o), rawDoc: o, isOrder: true })),
    ...sales.map(s => ({ ...formatSaleForExcel(s), rawDoc: s, isOrder: false }))
  ];

  if (allTxs.length === 0) {
    return { success: true, message: 'No transactions to export.', processedCount: 0 };
  }

  // Group by monthKey (e.g., '2026_01', '2026_02')
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

      let txSheet = workbook.getWorksheet('TRANSACTIONS');
      if (!txSheet) {
        txSheet = workbook.addWorksheet('TRANSACTIONS');
      }

      let insertedCount = 0;
      let updatedCount = 0;

      for (const tx of group.transactions) {
        const res = upsertTransactionRow(txSheet, tx);
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

      // Update MongoDB status for all processed transactions
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
    details: `Processed ${totalProcessed} transactions across ${Object.keys(monthGroups).length} monthly files.`,
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
 * Historical Data Export: Export all existing database transactions
 */
async function exportAllHistoricalTransactions(triggeredBy = 'Admin') {
  const orders = await Order.find({}).sort({ createdAt: 1 });
  const sales = await Sale.find({}).sort({ createdAt: 1 });
  return await exportBatchTransactions(orders, sales, triggeredBy);
}

/**
 * Retry Failed Exports: Look up pending or failed orders and sales and re-export them
 */
async function retryFailedExports(triggeredBy = 'Admin') {
  const failedOrders = await Order.find({
    $or: [
      { 'googleDriveExport.status': 'failed' },
      { 'googleDriveExport.status': 'pending' },
      { googleDriveExport: { $exists: false } }
    ]
  });

  const failedSales = await Sale.find({
    $or: [
      { 'googleDriveExport.status': 'failed' },
      { 'googleDriveExport.status': 'pending' },
      { googleDriveExport: { $exists: false } }
    ]
  });

  return await exportBatchTransactions(failedOrders, failedSales, triggeredBy);
}

/**
 * Sync Current Month Transactions: Export/update all transactions for the current month
 */
async function syncCurrentMonth(triggeredBy = 'Admin') {
  const nowParts = getKolkataDateParts(new Date());
  const yearMonthPrefix = `${nowParts.year}-${nowParts.month}`;

  // Fetch orders and sales for current month
  const orders = await Order.find({
    $or: [
      { date: new RegExp(`^${yearMonthPrefix}`) },
      { createdAt: { $gte: new Date(`${nowParts.year}-${nowParts.month}-01T00:00:00.000Z`) } }
    ]
  });

  const sales = await Sale.find({
    $or: [
      { date: new RegExp(`^${yearMonthPrefix}`) },
      { transactionDate: new RegExp(`^${yearMonthPrefix}`) },
      { createdAt: { $gte: new Date(`${nowParts.year}-${nowParts.month}-01T00:00:00.000Z`) } }
    ]
  });

  return await exportBatchTransactions(orders, sales, triggeredBy);
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

    // Verify root folder access
    const folderRes = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType, capabilities, owners'
    });

    const isFolder = folderRes.data.mimeType === 'application/vnd.google-apps.folder';
    if (!isFolder) {
      return {
        connected: false,
        configured: true,
        message: `ID '${folderId}' is not a Google Drive folder (MIME type: ${folderRes.data.mimeType}).`
      };
    }

    return {
      connected: true,
      configured: true,
      folderId,
      folderName: folderRes.data.name,
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
      canEdit: folderRes.data.capabilities?.canEdit || true,
      message: `Successfully connected to Google Drive folder "${folderRes.data.name}"!`
    };
  } catch (err) {
    return {
      connected: false,
      configured: true,
      error: err.message,
      message: `Failed to connect to Google Drive: ${err.message}`
    };
  }
}

/**
 * Get comprehensive backup status for the Admin Dashboard
 */
async function getBackupStatus() {
  const configured = isConfigured();
  const connTest = await testConnection();

  // Metric counts from MongoDB
  const totalOrders = await Order.countDocuments({});
  const exportedOrders = await Order.countDocuments({ 'googleDriveExport.status': 'exported' });
  const failedOrders = await Order.countDocuments({ 'googleDriveExport.status': 'failed' });
  const pendingOrders = totalOrders - exportedOrders - failedOrders;

  const totalSales = await Sale.countDocuments({});
  const exportedSales = await Sale.countDocuments({ 'googleDriveExport.status': 'exported' });
  const failedSales = await Sale.countDocuments({ 'googleDriveExport.status': 'failed' });
  const pendingSales = totalSales - exportedSales - failedSales;

  // Current month stats
  const nowParts = getKolkataDateParts(new Date());
  const yearMonthPrefix = `${nowParts.year}-${nowParts.month}`;

  const currentMonthOrders = await Order.countDocuments({
    $or: [
      { date: new RegExp(`^${yearMonthPrefix}`) },
      { createdAt: { $gte: new Date(`${nowParts.year}-${nowParts.month}-01T00:00:00.000Z`) } }
    ]
  });

  const currentMonthSales = await Sale.countDocuments({
    $or: [
      { date: new RegExp(`^${yearMonthPrefix}`) },
      { transactionDate: new RegExp(`^${yearMonthPrefix}`) },
      { createdAt: { $gte: new Date(`${nowParts.year}-${nowParts.month}-01T00:00:00.000Z`) } }
    ]
  });

  // Latest logs
  const logs = await DriveBackupLog.find({}).sort({ createdAt: -1 }).limit(10);

  // List existing Excel files in Google Drive if connected
  let driveFiles = [];
  if (connTest.connected) {
    try {
      const drive = getDriveClient();
      const res = await drive.files.list({
        q: `mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and name contains 'AKE_Rice_Transactions_' and trashed = false`,
        fields: 'files(id, name, webViewLink, webContentLink, modifiedTime, size, parents)',
        orderBy: 'name desc',
        pageSize: 30
      });
      driveFiles = res.data.files || [];
    } catch (e) {
      console.warn('[GoogleDrive] Could not list drive files:', e.message);
    }
  }

  return {
    configured,
    connected: connTest.connected,
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID ? `${process.env.GOOGLE_DRIVE_FOLDER_ID.slice(0, 6)}...` : null,
    folderName: connTest.folderName || 'AKE Rice Business Records',
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null,
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
        total: currentMonthOrders + currentMonthSales
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
  formatOrderForExcel,
  formatSaleForExcel,
  buildInitialWorkbook,
  upsertTransactionRow,
  recalculateSummarySheets,
  saveWorkbookToDrive,
  exportOrder,
  exportSale,
  exportBatchTransactions,
  exportAllHistoricalTransactions,
  retryFailedExports,
  syncCurrentMonth,
  testConnection,
  getBackupStatus
};
