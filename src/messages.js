const FREE_DRINK_EVERY = 5;

/** ชั่วโมงตามเวลาประเทศไทย ไม่ว่าเซิร์ฟเวอร์จะตั้งเขตเวลาไว้ที่ไหน */
function bangkokHour(date) {
  return Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Bangkok' }).format(date)
  ) % 24;
}

function suggestionFor(date) {
  const hour = bangkokHour(date);
  if (hour < 11) return 'เช้านี้รับอเมริกาโน่ร้อนสักแก้วไหมครับ ☕';
  if (hour < 16) return 'บ่ายนี้อากาศร้อน ลองชาไทยเย็นหรือลาเต้เย็นดูไหมครับ 🧋';
  return 'ช่วงเย็นแนะนำโกโก้ร้อนคู่กับบราวนี่ครับ 🍫';
}

/** ข้อความเมื่อลูกค้าเดินผ่าน beacon โซนประตูหน้าร้าน */
function entranceMessages({ shopName, visitCount, date }) {
  if (visitCount === 1) {
    return [
      { type: 'text', text: `ยินดีต้อนรับสู่ ${shopName} ครั้งแรกครับ 🎉` },
      { type: 'text', text: 'รับส่วนลด 10% สำหรับแก้วแรก แสดงข้อความนี้ที่เคาน์เตอร์ได้เลย\nโค้ด: WELCOME10' },
    ];
  }

  if (visitCount % FREE_DRINK_EVERY === 0) {
    return [
      { type: 'text', text: `ขอบคุณที่แวะมาเป็นครั้งที่ ${visitCount} ครับ 🙏` },
      { type: 'text', text: 'วันนี้รับเครื่องดื่มฟรี 1 แก้ว แสดงข้อความนี้ที่เคาน์เตอร์ได้เลย\nโค้ด: FREECUP' },
    ];
  }

  const left = FREE_DRINK_EVERY - (visitCount % FREE_DRINK_EVERY);
  return [
    {
      type: 'text',
      text: `ยินดีต้อนรับกลับมาครับ ${suggestionFor(date)}\nอีก ${left} ครั้ง รับฟรี 1 แก้ว`,
    },
  ];
}

/** ข้อความเมื่อลูกค้าเดินไปถึงเคาน์เตอร์ */
function counterMessages({ date }) {
  return [{ type: 'text', text: `เมนูแนะนำตอนนี้: ${suggestionFor(date)}` }];
}

function welcomeOnFollow(shopName) {
  return [
    {
      type: 'text',
      text:
        `สวัสดีครับ ยินดีต้อนรับสู่ ${shopName} 👋\n` +
        'ครั้งหน้าที่แวะมาที่ร้าน ระบบจะส่งคูปองและเมนูแนะนำให้อัตโนมัติ\n\n' +
        'ให้ระบบทำงานได้ 2 ขั้น:\n' +
        '1. เปิด Bluetooth ในมือถือ\n' +
        '2. ใน LINE ไปที่ ตั้งค่า > ความเป็นส่วนตัว > เปิด LINE Beacon',
    },
  ];
}

module.exports = { entranceMessages, counterMessages, welcomeOnFollow, bangkokHour, FREE_DRINK_EVERY };
