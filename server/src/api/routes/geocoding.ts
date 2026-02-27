import { Router } from 'express';
import zod from 'zod';

import config from '../../config.js';
import { GeocodingResponse } from '../../types.js';

export interface LocationIQSearchEntry {
  place_id: string;
  licence: string;
  lat: string;
  lon: string;
  display_name: string;
  boundingbox: string[];
  importance: number;
}

export type LocationIQSearchResponse = LocationIQSearchEntry[];

const mockAddresses: GeocodingResponse = [
  {
    name: 'Martyrs\' Square',
    description: 'Beirut Central District, Beirut, Lebanon',
    latitude: 33.8973,
    longitude: 35.5071,
  },
  {
    name: 'Raouche Rocks',
    description: 'Raouche, Beirut, Lebanon',
    latitude: 33.8901,
    longitude: 35.4721,
  },
  {
    name: 'Byblos Old Souk',
    description: 'Jbeil, Mount Lebanon, Lebanon',
    latitude: 34.1206,
    longitude: 35.6465,
  },
  {
    name: 'Our Lady of Lebanon',
    description: 'Harissa, Keserwan, Lebanon',
    latitude: 33.9818,
    longitude: 35.6514,
  },
];

const queryLocationIQ = async (query: string) => {
  const params = new URLSearchParams();
  params.append('q', query);
  params.append('format', 'json');
  params.append('limit', '5');
  params.append('countrycodes', 'lb');
  params.append('key', config.LOCATION_IQ_API_KEY || '');

  const url = 'https://eu1.locationiq.com/v1/search?' + params.toString();

  const response = await fetch(url);
  if (!response.ok) {
    return [];
  }
  const json: LocationIQSearchResponse = await response.json();

  const addresses: GeocodingResponse = json.map((a) => {
    const [name, ...rest] = a.display_name.split(',');
    return {
      name: (name || '').trim(),
      description: rest.join(',').trim(),
      latitude: Number(a.lat),
      longitude: Number(a.lon),
    };
  });

  return addresses;
};

const geocodingRouter = Router();

geocodingRouter.get('/search', async (req, res) => {
  const { query } = zod.object({
    query: zod.string().nonempty(),
  }).parse(req.query);

  if (config.LOCATION_IQ_API_KEY) {
    const addresses = await queryLocationIQ(query);
    res.json(addresses);
  } else {
    res.json(mockAddresses);
  }
});

export default geocodingRouter;
