import type { Finding, Recognizer } from "../types.js";
import { ipv4Valid, ipv6Valid } from "../validators.js";
import { finding } from "./util.js";

const IPV4_RE = /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d]|\.\d)/g;
const IPV6_RE = /(?<![0-9a-fA-F:])(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(?![0-9a-fA-F:])/g;

export const ipRecognizer: Recognizer = {
  id: "ip-address",
  entityTypes: ["IP_ADDRESS"],
  analyze(text) {
    const out: Finding[] = [];
    for (const m of text.matchAll(IPV4_RE)) {
      if (ipv4Valid(m[0]))
        out.push(finding("IP_ADDRESS", m.index, m.index + m[0].length, 0.85, "ip-address"));
    }
    for (const m of text.matchAll(IPV6_RE)) {
      if (m[0].includes("::") || m[0].split(":").length === 8) {
        if (ipv6Valid(m[0]))
          out.push(finding("IP_ADDRESS", m.index, m.index + m[0].length, 0.85, "ip-address"));
      }
    }
    return out;
  },
};

const MAC_RE = /(?<![0-9A-Fa-f:-])(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}(?![0-9A-Fa-f:-])/g;

export const macRecognizer: Recognizer = {
  id: "mac-address",
  entityTypes: ["MAC_ADDRESS"],
  analyze(text) {
    const out: Finding[] = [];
    for (const m of text.matchAll(MAC_RE)) {
      out.push(finding("MAC_ADDRESS", m.index, m.index + m[0].length, 0.9, "mac-address"));
    }
    return out;
  },
};

const GPS_RE = /(?<![\d.])([-+]?\d{1,2}\.\d{4,})\s*,\s*([-+]?\d{1,3}\.\d{4,})(?![\d.])/g;

export const gpsRecognizer: Recognizer = {
  id: "gps",
  entityTypes: ["GPS_COORDINATES"],
  analyze(text) {
    const out: Finding[] = [];
    for (const m of text.matchAll(GPS_RE)) {
      if (Math.abs(Number(m[1])) <= 90 && Math.abs(Number(m[2])) <= 180) {
        out.push(finding("GPS_COORDINATES", m.index, m.index + m[0].length, 0.85, "gps"));
      }
    }
    return out;
  },
};
