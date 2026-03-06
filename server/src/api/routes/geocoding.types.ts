export type GeocodingResponseEntry = {
  name: string;
  description: string;
  latitude: number;
  longitude: number;
};

export type GeocodingResponse = GeocodingResponseEntry[];
