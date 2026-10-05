// Campus spots the chapter cares about, offered as one-tap presets in the
// event location picker and drawn on the House Presence map. Coordinates were
// geocoded from OpenStreetMap (Photon), not typed from memory.
// Not yet listed: Wells Quad and Collins LLC — the geocoder couldn't place them.
export type PlaceKind = "recreation" | "residence";

export interface Place {
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
}

export const PLACES: Place[] = [
  { name: "SRSC (Student Recreational Sports Center)", kind: "recreation", lat: 39.17343, lng: -86.5124 },
  { name: "Ashton Center", kind: "residence", lat: 39.17081, lng: -86.51146 },
  { name: "Briscoe Quad", kind: "residence", lat: 39.17827, lng: -86.52006 },
  { name: "Eigenmann Hall", kind: "residence", lat: 39.17099, lng: -86.50874 },
  { name: "Forest Quad", kind: "residence", lat: 39.16436, lng: -86.51282 },
  { name: "Foster Quad", kind: "residence", lat: 39.17557, lng: -86.51889 },
  { name: "McNutt Quad", kind: "residence", lat: 39.17646, lng: -86.51993 },
  { name: "Read Hall", kind: "residence", lat: 39.16614, lng: -86.51489 },
  { name: "Teter Quad", kind: "residence", lat: 39.17047, lng: -86.51339 },
  { name: "Tulip Tree Apartments", kind: "residence", lat: 39.1725, lng: -86.50445 },
  { name: "Union Street Center", kind: "residence", lat: 39.17074, lng: -86.50954 },
  { name: "Willkie Quad", kind: "residence", lat: 39.16616, lng: -86.51102 },
  { name: "Wright Quad", kind: "residence", lat: 39.17041, lng: -86.51429 },
];
