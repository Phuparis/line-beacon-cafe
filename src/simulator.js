/**
 * สร้าง beacon event หน้าตาเหมือนที่ LINE ส่งมาจริง
 * ต่างกันแค่ไม่มี replyToken (เราสร้างเองไม่ได้) ระบบเลยส่งแบบ push แทน
 */
function buildSimulatedBeaconEvent({ hwid, userId, now = new Date() }) {
  return {
    type: 'beacon',
    mode: 'active',
    timestamp: now.getTime(),
    source: { type: 'user', userId },
    webhookEventId: `sim-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    deliveryContext: { isRedelivery: false },
    beacon: { hwid, type: 'enter' },
  };
}

module.exports = { buildSimulatedBeaconEvent };
