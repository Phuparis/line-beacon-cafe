const fs = require('fs');
const path = require('path');

/**
 * "สมุดจด" ว่าส่งข้อความให้ใคร ที่ beacon ไหน ไปเมื่อไหร่
 * และลูกค้าแต่ละคนมาร้านแล้วกี่ครั้ง
 *
 * เก็บลงไฟล์ JSON เพื่อให้ข้อมูลไม่หายตอนปิดเซิร์ฟเวอร์
 * (ถ้า filePath เป็น null จะเก็บในหน่วยความจำอย่างเดียว ใช้ตอนเทสต์)
 * ระบบจริงที่มีผู้ใช้เยอะควรเปลี่ยนไปใช้ฐานข้อมูล เช่น SQLite หรือ PostgreSQL
 */
class CooldownStore {
  constructor(filePath, cooldownMs) {
    this.filePath = filePath;
    this.cooldownMs = cooldownMs;
    this.data = { lastSent: {}, visits: {} };
    if (filePath && fs.existsSync(filePath)) {
      this.data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  }

  /**
   * ขอสิทธิ์ส่งข้อความให้ userId ที่ beacon hwid
   * จดเวลาไว้ก่อนส่งจริง เพื่อกัน event ที่เข้ามาติดกันในเสี้ยววินาทีส่งซ้ำ
   */
  claim(userId, hwid, now = new Date()) {
    const key = `${userId}:${hwid}`;
    const last = this.data.lastSent[key];
    if (last && now.getTime() - last < this.cooldownMs) {
      return { ok: false, nextAllowedAt: new Date(last + this.cooldownMs) };
    }
    this.data.lastSent[key] = now.getTime();
    this.save();
    return { ok: true };
  }

  /** นับจำนวนครั้งที่ลูกค้ามาร้าน แล้วคืนค่าครั้งล่าสุด */
  addVisit(userId) {
    this.data.visits[userId] = (this.data.visits[userId] || 0) + 1;
    this.save();
    return this.data.visits[userId];
  }

  /** ผู้รับข้อความของหน้าเว็บจำลอง (คนล่าสุดที่แอดเพื่อนหรือทักแชทร้าน) */
  setDemoUser(userId) {
    if (this.data.demoUserId === userId) return;
    this.data.demoUserId = userId;
    this.save();
  }

  getDemoUser() {
    return this.data.demoUserId || null;
  }

  reset(userId) {
    if (!userId) {
      this.data = { lastSent: {}, visits: {} };
    } else {
      delete this.data.visits[userId];
      for (const key of Object.keys(this.data.lastSent)) {
        if (key.startsWith(`${userId}:`)) delete this.data.lastSent[key];
      }
    }
    this.save();
  }

  save() {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }
}

module.exports = { CooldownStore };
