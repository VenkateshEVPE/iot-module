import { parseAlarm } from '../packages/protocols/alarm.js';
import { parseAlarmHVT001 } from '../packages/protocols/alarm-hvt001.js';

function run() {
  // sample packet from your log
  const hex = '787825261A0209061114CF01DBD3430869E777001400090194EA4EB800FFA34002043202008122CC0D0A';
  const packet = Buffer.from(hex, 'hex');

  console.log('Raw packet hex:', hex);

  // Try parse with generic alarm (0x26)
  try {
    const parsed = parseAlarm(packet);
    console.log('parseAlarm result:');
    console.log(JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.error('parseAlarm error:', e.message);
  }

  // Try parse with HVT001 parser
  try {
    const parsedHVT = parseAlarmHVT001(packet);
    console.log('parseAlarmHVT001 result:');
    console.log(JSON.stringify(parsedHVT, null, 2));
  } catch (e) {
    console.error('parseAlarmHVT001 error:', e.message);
  }
}

run();

