// data/hospitals.js — Selected Nigerian teaching hospitals & FMCs.
// Coordinates are approximate centroids; phone numbers are illustrative and
// MUST be verified before any production release.

export const HOSPITALS = [
  { id: 'nat-abuja', n: 'National Hospital Abuja', s: 'FCT', t: '112', p: '+2348036141111', lat: 9.0764, lng: 7.4838 },
  { id: 'uath', n: 'University of Abuja Teaching Hospital', s: 'FCT', t: '112', p: '+2348036140000', lat: 8.0935, lng: 7.0876 },
  { id: 'unth', n: 'University of Nigeria Teaching Hospital (UNTH)', s: 'Enugu', t: '112', p: '+2348033141111', lat: 6.4321, lng: 7.4298 },
  { id: 'luth', n: 'Lagos University Teaching Hospital (LUTH)', s: 'Lagos', t: '767', p: '+2348023000421', lat: 6.5146, lng: 3.3739 },
  { id: 'lasuth', n: 'Lagos State University Teaching Hospital (LASUTH)', s: 'Lagos', t: '767', p: '+2348023000490', lat: 6.6139, lng: 3.3570 },
  { id: 'mainland-yaba', n: 'Mainland General Hospital, Yaba', s: 'Lagos', t: '767', p: '+2348023000123', lat: 6.5086, lng: 3.3745 },
  { id: 'fmc-ebute-metta', n: 'Federal Medical Centre, Ebute Metta', s: 'Lagos', t: '767', p: '+2348023000234', lat: 6.4674, lng: 3.3779 },
  { id: 'uch', n: 'University College Hospital (UCH), Ibadan', s: 'Oyo', t: '112', p: '+2348033140000', lat: 7.4281, lng: 3.9086 },
  { id: 'oauth', n: 'Obafemi Awolowo University Teaching Hospital', s: 'Osun', t: '112', p: '+2348033142222', lat: 7.5210, lng: 4.5275 },
  { id: 'ubth', n: 'University of Benin Teaching Hospital (UBTH)', s: 'Edo', t: '112', p: '+2348033143333', lat: 6.4157, lng: 5.6124 },
  { id: 'fmc-asaba', n: 'Federal Medical Centre, Asaba', s: 'Delta', t: '112', p: '+2348033144444', lat: 6.2052, lng: 6.6950 },
  { id: 'nauth', n: 'Nnamdi Azikiwe University Teaching Hospital (NAUTH)', s: 'Anambra', t: '112', p: '+2348033145555', lat: 6.1432, lng: 6.7908 },
  { id: 'upth', n: 'University of Port Harcourt Teaching Hospital (UPTH)', s: 'Rivers', t: '112', p: '+2348033146666', lat: 5.0244, lng: 7.0376 },
  { id: 'fmc-owerri', n: 'Federal Medical Centre, Owerri', s: 'Imo', t: '112', p: '+2348033147777', lat: 5.4893, lng: 7.0287 },
  { id: 'abuth', n: 'Ahmadu Bello University Teaching Hospital (ABUTH)', s: 'Kaduna', t: '112', p: '+2348033148888', lat: 10.5908, lng: 7.4390 },
  { id: 'bdtk', n: 'Barau Dikko Teaching Hospital, Kaduna', s: 'Kaduna', t: '112', p: '+2348033149999', lat: 10.5222, lng: 7.4385 },
  { id: 'akth', n: 'Aminu Kano Teaching Hospital (AKTH)', s: 'Kano', t: '112', p: '+2348033141000', lat: 12.0475, lng: 8.5186 },
  { id: 'fmc-kano', n: 'Federal Medical Centre, Kano', s: 'Kano', t: '112', p: '+2348033141100', lat: 12.0022, lng: 8.5920 },
  { id: 'uduth', n: 'Usmanu Danfodiyo University Teaching Hospital (UDUTH)', s: 'Sokoto', t: '112', p: '+2348033141200', lat: 13.0622, lng: 5.2339 },
  { id: 'fmc-kebbi', n: 'Federal Medical Centre, Birnin Kebbi', s: 'Kebbi', t: '112', p: '+2348033141300', lat: 12.4539, lng: 4.1976 },
  { id: 'umth', n: 'University of Maiduguri Teaching Hospital (UMTH)', s: 'Borno', t: '112', p: '+2348033141400', lat: 11.7928, lng: 13.1395 },
  { id: 'fmc-yola', n: 'Federal Medical Centre, Yola', s: 'Adamawa', t: '112', p: '+2348033141500', lat: 9.2035, lng: 12.4954 },
  { id: 'fmc-gombe', n: 'Federal Medical Centre, Gombe', s: 'Gombe', t: '112', p: '+2348033141600', lat: 10.2900, lng: 11.1670 },
  { id: 'juth', n: 'Jos University Teaching Hospital (JUTH)', s: 'Plateau', t: '112', p: '+2348033141700', lat: 9.8965, lng: 8.8583 },
  { id: 'fmc-makurdi', n: 'Federal Medical Centre, Makurdi', s: 'Benue', t: '112', p: '+2348033141800', lat: 7.7322, lng: 8.5390 },
  { id: 'fmc-lokoja', n: 'Federal Medical Centre, Lokoja', s: 'Kogi', t: '112', p: '+2348033141900', lat: 7.8024, lng: 6.7430 },
  { id: 'uith', n: 'University of Ilorin Teaching Hospital (UITH)', s: 'Kwara', t: '112', p: '+2348033142000', lat: 8.4846, lng: 4.5428 },
  { id: 'fmc-abeokuta', n: 'Federal Medical Centre, Abeokuta', s: 'Ogun', t: '112', p: '+2348033142100', lat: 7.1610, lng: 3.3425 },
  { id: 'fmc-owo', n: 'Federal Medical Centre, Owo', s: 'Ondo', t: '112', p: '+2348033142200', lat: 7.1960, lng: 5.5915 },
  { id: 'eksuth', n: 'Ekiti State University Teaching Hospital', s: 'Ekiti', t: '112', p: '+2348033142300', lat: 7.7187, lng: 5.2564 },
];

export const HOSPITAL_IDS = HOSPITALS.map((h) => h.id);

export function getHospital(id) {
  return HOSPITALS.find((h) => h.id === id) || null;
}

/**
 * List hospitals, optionally filtered by state and sorted by distance.
 * @param {object} opts
 * @param {string} [opts.state]   Filter by state name (case-insensitive).
 * @param {number} [opts.lat]     User latitude.
 * @param {number} [opts.lng]     User longitude.
 * @param {number} [opts.limit]  Cap number of results.
 */
export function listHospitals(opts = {}) {
  let list = HOSPITALS.slice();
  if (opts.state) {
    const s = String(opts.state).toLowerCase().trim();
    list = list.filter((h) => h.s.toLowerCase() === s);
  }
  if (typeof opts.lat === 'number' && typeof opts.lng === 'number') {
    list = list.map((h) => ({ ...h, distanceKm: haversineKm(opts.lat, opts.lng, h.lat, h.lng) }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  } else {
    list.sort((a, b) => a.n.localeCompare(b.n));
  }
  if (opts.limit) list = list.slice(0, opts.limit);
  return list;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

/** Distinct list of states that have a hospital. */
export function listStates() {
  const set = new Set(HOSPITALS.map((h) => h.s));
  return Array.from(set).sort();
}
