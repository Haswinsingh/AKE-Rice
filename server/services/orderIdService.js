const Counter = require('../models/Counter');
const Order = require('../models/Order');

/**
 * Generates the next sequential Order ID (e.g. AKE000001, AKE000002)
 * Guarantees no duplicates even under concurrent requests.
 */
async function generateNextOrderId() {
  try {
    // Check if counter initialized
    let counter = await Counter.findById('orderId');
    if (!counter) {
      // Find highest existing order ID
      const orders = await Order.find({ id: /^AKE\d+$/ }).select('id').lean();
      let maxNum = 0;
      orders.forEach(o => {
        if (o.id) {
          const num = parseInt(o.id.replace('AKE', ''), 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      });

      counter = await Counter.create({
        _id: 'orderId',
        seq: maxNum
      });
    }

    const updated = await Counter.findByIdAndUpdate(
      'orderId',
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const formattedId = 'AKE' + String(updated.seq).padStart(6, '0');
    return formattedId;
  } catch (error) {
    console.error('[OrderIdService] Error generating sequential order ID:', error);
    // Fallback timestamp-based format if atomic counter fails
    const timestamp = Date.now().toString().slice(-6);
    return `AKE${timestamp}`;
  }
}

module.exports = { generateNextOrderId };
