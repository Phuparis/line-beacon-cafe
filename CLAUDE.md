# CLAUDE.md: บันทึกโปรเจกต์สำหรับ Claude

อ่านไฟล์นี้ก่อนทำงานกับ repo นี้ จะได้ไม่ต้องให้เจ้าของเล่าใหม่
ตอบเจ้าของเป็นภาษาไทย อธิบายแบบเข้าใจง่าย เจ้าของมักทำงานจากมือถือ

## โปรเจกต์คืออะไร

LINE Beacon bot ของร้านกาแฟสมมติ "Beacon Brew" ทำไว้ใส่พอร์ตตอนสมัครงานสาย IT
ต่อยอดจากโปรเจกต์เก่าของเจ้าของ (LINE Beacon ในโรงพยาบาล ใช้บอร์ด Arduino ทำ beacon เอง)
ตอนนั้นเจอปัญหาข้อความส่งซ้ำรัว ๆ ซึ่งเวอร์ชันนี้แก้ด้วย cooldown

ลูกค้าเดินเข้าระยะ beacon แล้ว LINE OA ส่งข้อความต้อนรับ คูปอง และเมนูแนะนำอัตโนมัติ
ทดสอบได้ 3 แบบ: หน้าเว็บจำลอง, มือถือ Android + แอป nRF Connect, บอร์ด ESP32

## สิ่งที่ตั้งค่าไว้แล้ว

- **LINE Official Account**: ชื่อ Pawaris (ยังไม่ได้เปลี่ยนเป็น Beacon Brew), เบสิค ID `@763vygsq`, แพ็กเกจฟรี (push ได้ 300 ข้อความต่อเดือน)
  - เปิด Messaging API แล้ว, ปิดข้อความตอบกลับอัตโนมัติ, ปิดข้อความทักทาย, ปิดเวลาตอบข้อความ, เปิด Webhook แล้ว
- **Render**: Web Service ชื่อ `line-beacon-cafe`, Region Singapore, Instance Free, deploy อัตโนมัติจาก branch `main`
  - ลิงก์: `https://line-beacon-cafe.onrender.com` (เช็กในหน้า Render ถ้าไม่ตรง)
  - Environment Variables: `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `SIMULATOR_ENABLED=true`
  - ห้ามเขียนค่า secret หรือ token ลงใน repo
- **GitHub**: `Phuparis/line-beacon-cafe` (ตอนนี้เป็น Private)

## การตัดสินใจสำคัญ

- **ใช้แค่ Channel ID + secret**: เจ้าของเข้า LINE Developers Console จากมือถือไม่ได้ (เด้งไปแอป LINE OA)
  เลยให้เซิร์ฟเวอร์ขอ short-lived access token เอง (`src/lineAuth.js`, อายุ 30 วัน ขอใหม่อัตโนมัติ)
  และตั้ง Webhook URL เองจาก `RENDER_EXTERNAL_URL` ตอนเริ่มรัน
- **ผู้รับข้อความของหน้าเว็บจำลอง**: ใช้คนล่าสุดที่แอดเพื่อนหรือทักแชทร้าน (ไม่ต้องหา user ID)
  พิมพ์ `myid` ในแชทร้านเพื่อดู user ID ตัวเอง
  Render แบบฟรีหลับหลัง 15 นาทีและไฟล์หายตอนตื่น ต้องทักร้านใหม่ 1 ครั้งก่อนทดสอบ
- **cooldown 24 ชั่วโมงต่อ (ลูกค้า + beacon)**: จดก่อนส่ง กัน event ที่มาติดกัน
- **ตอบเฉพาะ beacon `enter`**: LINE ยกเลิก `leave` ไปตั้งแต่ปลายปี 2020
- **รับเฉพาะ hwid ที่อยู่ใน `config/beacons.json`**: LINE Simple Beacon ถูกปลอมได้
- **ตอบ 200 ให้ LINE ก่อนแล้วค่อยประมวลผล** และจำ `webhookEventId` กัน event ซ้ำ
- event จริงตอบแบบ reply (ฟรี), event จำลองส่งแบบ push (นับโควตา)

## สถานะ

- [x] แบบที่ 1 หน้าเว็บจำลอง ใช้งานได้จริงบน Render แล้ว (ทดสอบเมื่อ 17 พ.ย. 2026)
- [ ] ขอ LINE Simple Beacon Hardware ID แล้วใส่แทน `0123456789` ใน `config/beacons.json`
- [ ] ทดสอบแบบที่ 2 ด้วย Android เครื่องที่สอง + nRF Connect (`npm run beacon:packet -- <hwid>`)
- [ ] โค้ด ESP32 ยังไม่เคยคอมไพล์
- [ ] อัดวิดีโอเดโม ใส่ลิงก์เดโมและไอดีร้านใน README แล้วเปลี่ยน repo เป็น Public
- [ ] เปลี่ยนชื่อ LINE OA เป็น Beacon Brew (ถ้าต้องการ)

## ไอเดียต่อยอดที่เจ้าของสนใจ

- โหมดเช็กชื่อเข้างาน (บันทึกครั้งแรกของวัน, ปุ่มเลิกงานใน rich menu เพราะไม่มี event `leave`)
- ผู้ช่วยไอทีใน LINE: แจ้งปัญหาด้วยปุ่ม, ESP32 วัด Wi-Fi แต่ละชั้น, AI ตอบจากสถานะจริงของออฟฟิศ
  แล้วค่อยเปิดงานซ่อม (เน้นใช้งานง่าย มีคำแนะนำ 1 บรรทัดในแต่ละหน้า และประหยัดโทเคน)

## คำสั่ง

```bash
npm install
npm test                          # เทสต์ทั้งหมด ไม่ต้องต่อ LINE
npm start                         # รันเซิร์ฟเวอร์ (ต้องมี .env)
npm run beacon:packet -- <hwid>   # ค่าสำหรับแอป nRF Connect
```
