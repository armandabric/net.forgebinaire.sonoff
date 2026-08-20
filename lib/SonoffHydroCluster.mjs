import { Cluster, ZCLDataType, ZCLDataTypes } from "zigbee-clusters";

// The generic ZCL "Array" data type (id 0x48) that Sonoff uses to wrap its
// raw payload attributes: 1 byte element type + 2 byte little-endian
// element count + N element bytes. zigbee-clusters doesn't implement this
// generic type (it's commented out in @athombv/data-types), so it's
// defined here for the one element type (uint8) Sonoff actually uses.
const ARRAY_ELEMENT_TYPE_UINT8 = 0x20;

const sonoffByteArray = new ZCLDataType(
  0x48,
  "sonoffByteArray",
  -3,
  (buf, value, i) => {
    const data = Buffer.from(value);
    buf.writeUInt8(ARRAY_ELEMENT_TYPE_UINT8, i);
    buf.writeUInt16LE(data.length, i + 1);
    data.copy(buf, i + 3);
    return 3 + data.length;
  },
  (buf, i, returnLength) => {
    const elementType = buf.readUInt8(i);
    const length = buf.readUInt16LE(i + 1);
    // Skip validation for the zero-length case: it's also how the DataType
    // computes its default value (from a zero-filled buffer at construction
    // time), which has no real element type to check.
    if (length > 0) {
      if (elementType !== ARRAY_ELEMENT_TYPE_UINT8) {
        throw new Error(
          `Unsupported sonoffByteArray element type: 0x${elementType.toString(16)}`,
        );
      }
      if (i + 3 + length > buf.length) {
        throw new Error("Truncated sonoffByteArray payload");
      }
    }
    const result = buf.slice(i + 3, i + 3 + length);
    return returnLength ? { result, length: 3 + length } : result;
  },
);

// Sonoff manufacturer-specific cluster (0xFC11), as documented by Sonoff's
// own ZHA quirk for the Hydro One (SWV-ZFU/ZFE/ZNU/ZNE) water valve.
class SonoffHydroCluster extends Cluster {
  static get ID() {
    return 64529; // 0xFC11
  }

  static get NAME() {
    return "sonoffHydro";
  }

  static get ATTRIBUTES() {
    return {
      childLock: {
        id: 0x0000,
        type: ZCLDataTypes.bool,
      },
      waterValveState: {
        id: 0x500c,
        type: ZCLDataTypes.uint8,
      },
      singleIrrigationSet: {
        id: 0x501d,
        type: sonoffByteArray,
      },
      unitOfWaterFlow: {
        id: 0x5021,
        type: ZCLDataTypes.uint8,
      },
      // Duration of the last watering run, in minutes (not cumulative -
      // the source quirk marks this a plain "measurement", unlike volume).
      waterUsageDuration: {
        id: 0x501c,
        type: ZCLDataTypes.uint32,
      },
      // Lifetime cumulative volume used, in liters (assumed - the source
      // quirk declares no explicit unit for this attribute).
      waterUsageVolume: {
        id: 0x501b,
        type: ZCLDataTypes.uint32,
      },
    };
  }

  static get COMMANDS() {
    return {};
  }
}

Cluster.addCluster(SonoffHydroCluster);

export default SonoffHydroCluster;
