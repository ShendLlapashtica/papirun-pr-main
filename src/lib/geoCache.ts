// Fires ONE geolocation request for the entire session and caches the result.
// All callers share the same underlying browser GPS request — no duplicate calls.

type Result = { lat: number; lng: number } | null;
type Cb = (result: Result) => void;

let settled = false;
let cached: Result = null;
const subscribers: Cb[] = [];

function settle(result: Result) {
  cached = result;
  settled = true;
  subscribers.splice(0).forEach(fn => fn(result));
}

export function prewarmGeo() {
  if (!('geolocation' in navigator)) { settle(null); return; }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => settle({ lat: coords.latitude, lng: coords.longitude }),
    () => settle(null),
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
  );
}

// Call immediately if settled; otherwise queue until prewarm resolves.
// Returns cleanup (unsubscribes if component unmounts before result).
export function subscribeGeo(fn: Cb): () => void {
  if (settled) { fn(cached); return () => {}; }
  subscribers.push(fn);
  return () => {
    const i = subscribers.indexOf(fn);
    if (i !== -1) subscribers.splice(i, 1);
  };
}
