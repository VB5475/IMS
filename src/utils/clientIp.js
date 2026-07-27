/** Resolve the client device IPv4 for login / audit params (varchar(20)). */

const IPV4_RE =
  /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b/;

function clipIp(ip) {
  return String(ip || "").trim().slice(0, 20);
}

function isUsableIpv4(ip) {
  if (!ip || !IPV4_RE.test(ip)) return false;
  if (ip === "127.0.0.1" || ip.startsWith("0.")) return false;
  return true;
}

/**
 * Prefer the machine's LAN (host) address via WebRTC ICE.
 * Falls back to STUN-reflexive (public) if no host candidate appears.
 */
function getIpv4ViaWebRtc(timeoutMs = 1800) {
  return new Promise((resolve) => {
    if (typeof RTCPeerConnection === "undefined") {
      resolve("");
      return;
    }

    let settled = false;
    let reflexiveIp = "";
    let pc;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        pc?.close();
      } catch {
        /* ignore */
      }
      resolve(clipIp(value));
    };

    const timer = window.setTimeout(() => finish(reflexiveIp), timeoutMs);

    try {
      pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
    } catch {
      finish("");
      return;
    }

    pc.createDataChannel("");
    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        finish(reflexiveIp);
        return;
      }

      const text = event.candidate.candidate || "";
      const match = text.match(IPV4_RE);
      if (!match || !isUsableIpv4(match[0])) return;

      if (/\btyp\s+host\b/i.test(text)) {
        finish(match[0]);
        return;
      }

      if (!reflexiveIp && /\btyp\s+srflx\b/i.test(text)) {
        reflexiveIp = match[0];
      }
    };

    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => finish(""));
  });
}

async function getPublicIpv4(timeoutMs = 2500) {
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: ctrl.signal,
    });
    window.clearTimeout(timer);
    if (!res.ok) return "";
    const data = await res.json();
    const ip = String(data?.ip || "").trim();
    return isUsableIpv4(ip) ? clipIp(ip) : clipIp(ip.split(",")[0]);
  } catch {
    return "";
  }
}

/** Device IPv4 for SP params such as prmipaddress. */
export async function getClientIpAddress() {
  const localOrStun = await getIpv4ViaWebRtc();
  if (localOrStun) return localOrStun;
  return getPublicIpv4();
}
