const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '919176049099';
const UPI_ID = process.env.UPI_ID || 'kaviyansellappan15@oksbi';

/**
 * Generate formatted WhatsApp order text preserving original template
 */
function generateWaTextForOrder(order) {
  let waText = `🛒 NEW ORDER\n\n`;
  waText += `Order ID:\n${order.id}\n\n`;
  waText += `Customer Name:\n${order.name}\n\n`;
  waText += `Mobile:\n${order.mobile}\n\n`;
  waText += `Address:\n${order.address || order.area}\n\n`;
  waText += `Products:\n${order.product}\n\n`;
  waText += `Quantity:\n${order.qty}\n\n`;
  waText += `Total Amount:\n₹${(order.total || 0).toLocaleString('en-IN')}\n\n`;
  waText += `Payment Method:\n${order.payment || 'Cash on Delivery'}\n\n`;
  
  if (order.payment === 'Online Payment' || order.payment === 'Online') {
    waText += `UPI ID:\n${order.upiId || UPI_ID}\n\n`;
    waText += `Transaction ID:\n${order.utr || 'N/A'}\n\n`;
  } else {
    waText += `Transaction ID:\nN/A\n\n`;
  }
  
  waText += `Payment Status:\n${order.paymentStatus || 'Pending Verification'}\n\n`;
  waText += `Thank you for your order.`;
  return waText;
}

/**
 * Generate full wa.me URL
 */
function getWhatsAppUrl(order) {
  const text = generateWaTextForOrder(order);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

module.exports = {
  generateWaTextForOrder,
  getWhatsAppUrl,
  WHATSAPP_NUMBER,
  UPI_ID
};
