const { entranceMessages, counterMessages, welcomeOnFollow } = require('./messages');

/**
 * รับ event จาก LINE (หรือจากหน้าเว็บจำลอง) แล้วตัดสินใจว่าจะส่งอะไร
 *
 * client = ตัวส่งข้อความของ LINE SDK (ตอนเทสต์ใส่ตัวปลอมแทนได้)
 * store  = สมุดจด cooldown และจำนวนครั้งที่มาร้าน
 * onUser = เรียกทุกครั้งที่มีคนแอดเพื่อนหรือทักแชทเข้ามา (ใช้จำผู้รับข้อความของหน้าเว็บจำลอง)
 */
function createEventHandler({ client, store, config, onUser = () => {}, now = () => new Date() }) {
  // จำ webhookEventId ที่ทำไปแล้ว กัน LINE ส่ง event เดิมซ้ำ (redelivery)
  const seenEventIds = new Set();
  const MAX_SEEN = 1000;

  function alreadySeen(event) {
    const id = event.webhookEventId;
    if (!id) return false;
    if (seenEventIds.has(id)) return true;
    seenEventIds.add(id);
    if (seenEventIds.size > MAX_SEEN) {
      seenEventIds.delete(seenEventIds.values().next().value);
    }
    return false;
  }

  // ถ้ามี replyToken (event จริงจาก LINE) ตอบกลับฟรี
  // ถ้าไม่มี (event จากหน้าเว็บจำลอง) ส่งแบบ push ซึ่งนับโควตาข้อความ
  async function send(event, messages) {
    if (event.replyToken) {
      await client.replyMessage({ replyToken: event.replyToken, messages });
      return 'reply';
    }
    await client.pushMessage({ to: event.source.userId, messages });
    return 'push';
  }

  async function handleBeacon(event) {
    // LINE ยกเลิก event "leave" ไปแล้ว เหลือ enter, banner, stay
    // เราตอบเฉพาะตอนเจอ beacon ครั้งแรก (enter)
    if (event.beacon?.type !== 'enter') return { status: 'skipped', reason: 'not-enter' };

    const userId = event.source?.userId;
    if (!userId) return { status: 'skipped', reason: 'no-user' };

    // LINE Simple Beacon ถูกปลอมได้ เลยรับเฉพาะ hwid ที่ร้านลงทะเบียนไว้
    const beacon = config.findBeacon(event.beacon.hwid);
    if (!beacon) return { status: 'skipped', reason: 'unknown-beacon' };

    const claim = store.claim(userId, beacon.hwid, now());
    if (!claim.ok) {
      return { status: 'skipped', reason: 'cooldown', nextAllowedAt: claim.nextAllowedAt.toISOString() };
    }

    let messages;
    if (beacon.zone === 'entrance') {
      const visitCount = store.addVisit(userId);
      messages = entranceMessages({ shopName: config.shopName, visitCount, date: now() });
    } else {
      messages = counterMessages({ date: now() });
    }

    const via = await send(event, messages);
    return { status: 'sent', via, beacon: beacon.name, messages };
  }

  return async function handleEvent(event) {
    if (alreadySeen(event)) return { status: 'skipped', reason: 'duplicate-event' };

    switch (event.type) {
      case 'beacon':
        return handleBeacon(event);
      case 'follow': {
        if (event.source?.userId) onUser(event.source.userId);
        const via = await send(event, welcomeOnFollow(config.shopName));
        return { status: 'sent', via };
      }
      case 'message':
        if (event.source?.userId) onUser(event.source.userId);
        if (event.message?.type === 'text' && event.message.text.trim().toLowerCase() === 'myid') {
          // คำสั่งสำหรับนักพัฒนา: ดู user ID ของตัวเองโดยไม่ต้องเข้า LINE Developers Console
          const via = await send(event, [{ type: 'text', text: `User ID ของคุณ:\n${event.source.userId}` }]);
          return { status: 'sent', via };
        }
        if (event.message?.type === 'text') {
          const via = await send(event, [
            { type: 'text', text: 'ขอบคุณที่ทักมาครับ แวะมาที่ร้านเมื่อไหร่ ระบบจะส่งคูปองให้อัตโนมัติ ☕' },
          ]);
          return { status: 'sent', via };
        }
        return { status: 'skipped', reason: 'non-text-message' };
      default:
        return { status: 'skipped', reason: `unhandled-${event.type}` };
    }
  };
}

module.exports = { createEventHandler };
