"use strict";

// Port of Sonoff's ZHA quirk single-irrigation payload codec
// (encode_single_irrigation_payload / decode_single_irrigation_payload).

const SINGLE_IRRIGATION_PAYLOAD_LEN = 12;
const DEFAULT_ZB_AMOUNT_UNIT = 0x01;

// Valid ranges per the source quirk (MANUAL_IRRIGATION_*), enforced here so
// a stale 0 left over from the other mode (or a missing value) never ends
// up in the payload the firmware actually applies.
const DURATION_MIN = 1;
const DURATION_MAX = 719;
const DEFAULT_TOTAL_DURATION_MIN = 10;
const DEFAULT_FAIL_SAFE_DURATION_MIN = 10;
const AMOUNT_MIN = 1;
const AMOUNT_MAX = 10000;
const DEFAULT_AMOUNT = 30;

const SingleIrrigationMode = {
  DURATION: 0,
  VOLUME: 1,
};

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.round(number), min), max);
}

function encodeSingleIrrigationPayload(state) {
  let { irrigationMode } = state;
  let totalDurationMin = clamp(
    state.totalDurationMin,
    DURATION_MIN,
    DURATION_MAX,
    DEFAULT_TOTAL_DURATION_MIN,
  );
  let amount = clamp(state.amount, AMOUNT_MIN, AMOUNT_MAX, DEFAULT_AMOUNT);
  let failSafeDurationMin = clamp(
    state.failSafeDurationMin,
    DURATION_MIN,
    DURATION_MAX,
    DEFAULT_FAIL_SAFE_DURATION_MIN,
  );
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
    throw new Error("Single irrigation payload is too short");
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
