'use strict';

// Port of Sonoff's ZHA quirk single-irrigation payload codec
// (encode_single_irrigation_payload / decode_single_irrigation_payload).

const SINGLE_IRRIGATION_PAYLOAD_LEN = 12;
const DEFAULT_ZB_AMOUNT_UNIT = 0x01;

const SingleIrrigationMode = {
  DURATION: 0,
  VOLUME: 1,
};

function encodeSingleIrrigationPayload(state) {
  let { irrigationMode, totalDurationMin, amount, failSafeDurationMin } = state;
  const zbAmountUnit = state.zbAmountUnit ?? DEFAULT_ZB_AMOUNT_UNIT;

  if (irrigationMode === SingleIrrigationMode.VOLUME) {
    totalDurationMin = 0;
  } else {
    irrigationMode = SingleIrrigationMode.DURATION;
    amount = 0;
    failSafeDurationMin = 0;
  }

  const payload = Buffer.alloc(SINGLE_IRRIGATION_PAYLOAD_LEN);
  payload.writeUInt8(irrigationMode, 0);
  payload.writeUInt16BE(totalDurationMin, 1);
  // Bytes 3-6 are reserved/unused by the firmware.
  payload.writeUInt8(zbAmountUnit, 7);
  payload.writeUInt16BE(amount, 8);
  payload.writeUInt16BE(failSafeDurationMin, 10);
  return payload;
}

function decodeSingleIrrigationPayload(data) {
  const buf = Buffer.from(data);
  if (buf.length < SINGLE_IRRIGATION_PAYLOAD_LEN) {
    throw new Error('Single irrigation payload is too short');
  }
  return {
    irrigationMode: buf.readUInt8(0),
    totalDurationMin: buf.readUInt16BE(1),
    zbAmountUnit: buf.readUInt8(7),
    amount: buf.readUInt16BE(8),
    failSafeDurationMin: buf.readUInt16BE(10),
  };
}

module.exports = {
  SingleIrrigationMode,
  encodeSingleIrrigationPayload,
  decodeSingleIrrigationPayload,
};
