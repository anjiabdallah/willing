import { DomEvent, divIcon } from 'leaflet';
import { Minus, Plus, Search, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

import 'leaflet/dist/leaflet.css';
import requestServer from '../utils/requestServer';

import type { GeocodingResponse, GeocodingResponseEntry } from '../../../server/src/types';

const customIcon = divIcon({
  className: 'custom-icon',
  html: `
    <div class="text-primary drop-shadow-md">
      <svg viewBox="0 0 24 24" fill="currentColor" class="w-14 h-14" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
      </svg>
    </div>`,
  iconSize: [56, 56],
  iconAnchor: [28, 56],
});

function MapSearchControl({ onLocationSelect }: { onLocationSelect: (item: GeocodingResponseEntry) => void }) {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResponse>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      DomEvent.disableClickPropagation(containerRef.current);
      DomEvent.disableScrollPropagation(containerRef.current);
    }
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsExpanded(false);
        setResults([]);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const data = await requestServer<GeocodingResponse>(`/geocoding/search?query=${encodeURIComponent(query)}`);
      setResults(data);
    } finally {
      setLoading(false);
    }
  };

  const selectLocation = (item: GeocodingResponseEntry) => {
    const coords: [number, number] = [item.latitude, item.longitude];
    onLocationSelect(item);
    map.flyTo(coords, 16, { duration: 2 });
    setResults([]);
    setQuery('');
    setIsExpanded(false);
    setHasSearched(false);
  };

  return (
    <div ref={containerRef} className="absolute top-2 right-2 z-1001 flex flex-col items-end">
      <div className="join shadow-lg bg-base-100 overflow-hidden rounded-lg border border-base-content/20 transition-all duration-300 ease-in-out">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search..."
          style={{
            width: isExpanded ? '240px' : '0px',
            paddingLeft: isExpanded ? '12px' : '0px',
            paddingRight: isExpanded ? '12px' : '0px',
            opacity: isExpanded ? 1 : 0,
          }}
          className="join-item input input-sm bg-transparent border-none focus:outline-none transition-all duration-300 ease-in-out"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
        />
        <button
          type="button"
          className="join-item btn btn-sm btn-square bg-base-100 border-none hover:bg-base-200 shrink-0 z-10"
          onClick={() => {
            if (!isExpanded) {
              setIsExpanded(true);
              setTimeout(() => inputRef.current?.focus(), 300);
            } else {
              handleSearch();
            }
          }}
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
        </button>
      </div>

      {results.length > 0 && isExpanded && (
        <div className="mt-1 bg-base-100 shadow-xl rounded-lg border border-base-content/20 w-69">
          <ul className="menu menu-compact p-0 max-h-72 flex-nowrap w-full overflow-scroll">
            {results.map((item, i) => {
              return (
                <li key={i} className="border-b border-base-content/5 last:border-none w-full">
                  <button type="button" className="flex flex-col items-start p-3 rounded-none active:bg-base-200 w-full" onClick={() => selectLocation(item)}>
                    <span className="font-bold text-xs truncate w-full text-left">{item.name}</span>
                    <span className="text-[10px] opacity-60 truncate w-full text-left leading-tight">{item.description}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="px-3 py-2 text-[10px] text-base-content/50 border-t border-base-content/10 bg-base-200/50">
            Search limited to Lebanon
          </div>
        </div>
      )}

      {hasSearched && results.length === 0 && isExpanded && !loading && (
        <div className="mt-1 bg-base-100 shadow-xl rounded-lg border border-base-content/20 w-69">
          <div className="p-4 text-center">
            <p className="text-sm text-base-content/70">No locations found</p>
            <p className="text-[10px] text-base-content/50 mt-1">Try a different search term</p>
          </div>
          <div className="px-3 py-2 text-[10px] text-base-content/50 border-t border-base-content/10 bg-base-200/50">
            Search limited to Lebanon
          </div>
        </div>
      )}
    </div>
  );
}

function MapZoomControl() {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      DomEvent.disableClickPropagation(containerRef.current);
      DomEvent.disableScrollPropagation(containerRef.current);
    }
  }, []);

  return (
    <div ref={containerRef} className="absolute top-2 left-2 z-1000 flex flex-col gap-1">
      <div className="join join-vertical shadow-lg">
        <button type="button" className="btn btn-square btn-sm join-item border border-base-content/20 bg-base-100 hover:bg-base-200" onClick={() => map.zoomIn()}>
          <Plus size={20} />
        </button>
        <button type="button" className="btn btn-square btn-sm join-item border border-base-content/20 bg-base-100 hover:bg-base-200" onClick={() => map.zoomOut()}>
          <Minus size={20} />
        </button>
      </div>
    </div>
  );
}

function MapEvents({ setPosition, readOnly }: { setPosition: (p: [number, number]) => void; readOnly: boolean }) {
  useMapEvents({
    click(e) {
      if (!readOnly) setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

interface LocationPickerProps {
  position: [number, number];
  setPosition: (pos: [number, number], name?: string) => void;
  readOnly?: boolean;
}

export default function LocationPicker({ position, setPosition, readOnly = false }: LocationPickerProps) {
  const [darkTheme, setDarkTheme] = useState(false);

  useEffect(() => {
    setDarkTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);

  return (
    <div className="h-96 border border-base-content/20 rounded-lg overflow-hidden relative shadow-inner">
      <MapContainer
        center={position}
        zoom={15}
        scrollWheelZoom={true}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          className={darkTheme ? 'brightness-300' : ''}
          attribution='&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={darkTheme
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'}
        />

        <MapZoomControl />

        {!readOnly && (
          <MapSearchControl onLocationSelect={({ latitude, longitude, name }) => setPosition([latitude, longitude], name)} />
        )}

        <MapEvents setPosition={setPosition} readOnly={readOnly} />

        <Marker
          icon={customIcon}
          position={position}
          draggable={!readOnly}
          eventHandlers={{
            dragend: (e) => {
              const { lat, lng } = e.target.getLatLng();
              setPosition([lat, lng]);
            },
          }}
        />
      </MapContainer>
    </div>
  );
}
