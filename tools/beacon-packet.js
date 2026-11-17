#!/usr/bin/env node
/**
 * พิมพ์ค่าที่ต้องกรอกในแอป nRF Connect (Android) เพื่อให้มือถือทำตัวเป็น LINE Simple Beacon
 *
 * ใช้:  npm run beacon:packet -- <HWID> [device message hex]
 * เช่น  npm run beacon:packet -- 0123456789
 */
const { LINE_SERVICE_UUID, buildFrame, buildAdvertisingData, toHex } = require('../src/lineSimpleBeacon');

const [hwid, message = '00'] = process.argv.slice(2);
if (!hwid) {
  console.log('ใช้: npm run beacon:packet -- <HWID 10 ตัว> [device message hex]');
  process.exit(1);
}

try {
  const frame = buildFrame(hwid, message);
  const full = buildAdvertisingData(hwid, message);

  console.log(`
ค่าที่ต้องกรอกในแอป nRF Connect > ADVERTISER > เพิ่ม advertising packet
---------------------------------------------------------------
Advertising data:
  1) Complete list of 16-bit Service UUIDs : ${LINE_SERVICE_UUID}
  2) Service Data
       UUID : ${LINE_SERVICE_UUID}
       Data : ${toHex(frame).replace(/ /g, '')}

Options: Legacy advertising, Non-connectable, Interval 160 ms หรือใกล้เคียง

ข้อมูลทั้งหมดที่ beacon ปล่อยออกไป (ไว้เทียบ):
  ${toHex(full)}
`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
