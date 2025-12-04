import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Paper,
  CircularProgress,
  Alert,
  //Autocomplete,
  Chip,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ptBR } from 'date-fns/locale';
import { ref, get} from 'firebase/database';
import { database } from '../firebaseConfig';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PrintIcon from '@mui/icons-material/Print';
import SearchIcon from '@mui/icons-material/Search';

// Componente para ajustar o viewport do mapa
const MapController = ({ locations }) => {
  const map = useMap();

  useEffect(() => {
    if (locations && locations.length > 0) {
      // Calcular bounds das localizações
      const bounds = L.latLngBounds(
        locations.map(loc => [loc.latitude, loc.longitude])
      );
      
      // Ajustar zoom para mostrar todas as localizações com padding
      map.fitBounds(bounds, {
        padding: [50, 50], // Padding em pixels
        maxZoom: 16, // Zoom máximo para não ficar muito longe
      });
    }
  }, [locations, map]);

  return null;
};

// Fix para ícones do Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Ícones personalizados
const createCustomIcon = (color = '#701B20', isFirst = false, isLast = false) => {
  let iconColor = color;
  if (isFirst) iconColor = '#4CAF50'; // Verde para início
  if (isLast) iconColor = '#FF5722';  // Laranja para fim

  return L.divIcon({
    html: `
      <div style="
        background-color: ${iconColor};
        width: ${isFirst || isLast ? '16px' : '12px'};
        height: ${isFirst || isLast ? '16px' : '12px'};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        font-size: ${isFirst || isLast ? '10px' : '0px'};
      ">
        ${isFirst ? 'I' : isLast ? 'F' : ''}
      </div>
    `,
    iconSize: [isFirst || isLast ? 20 : 16, isFirst || isLast ? 20 : 16],
    iconAnchor: [isFirst || isLast ? 10 : 8, isFirst || isLast ? 10 : 8],
    className: 'custom-marker'
  });
};

const MapViewer = () => {
  const [devices, setDevices] = useState([]); // Lista de dispositivos com nomes
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedDeviceName, setSelectedDeviceName] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mapInitialized, setMapInitialized] = useState(false);
  const mapRef = useRef();

  // Carregar lista de dispositivos com nomes
  useEffect(() => {
    loadDevices();
    
    // Listener para quando um dispositivo for renomeado
    const handleDeviceRenamed = () => {
      loadDevices();
    };
    
    window.addEventListener('deviceRenamed', handleDeviceRenamed);
    return () => {
      window.removeEventListener('deviceRenamed', handleDeviceRenamed);
    };
  }, [loadDevices]);

  const loadDevices = async () => {
    try {
      const locationsRef = ref(database, 'locations');
      const snapshot = await get(locationsRef);
      
      if (snapshot.exists()) {
        const locationsData = snapshot.val();
        const deviceMap = new Map();
        
        Object.keys(locationsData).forEach((key) => {
          const data = locationsData[key];
          const deviceId = data.deviceId;
          const deviceName = data.deviceName || deviceId;
          
          if (!deviceMap.has(deviceId)) {
            deviceMap.set(deviceId, {
              id: deviceId,
              name: deviceName,
              lastSeen: data.timestamp
            });
          }
        });

        const devicesList = Array.from(deviceMap.values())
          .sort((a, b) => a.name.localeCompare(b.name));
        
        setDevices(devicesList);
        
        // Se há um dispositivo selecionado, atualizar seu nome
        if (selectedDevice && deviceMap.has(selectedDevice)) {
          setSelectedDeviceName(deviceMap.get(selectedDevice).name);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dispositivos:', error);
    }
  };

  const handleSearch = useCallback(async () => {
    if (!selectedDevice) {
      setError('Selecione um vendedor primeiro');
      return;
    }

    setLoading(true);
    setError('');
    setMapInitialized(false);
    
    try {
      const locationsRef = ref(database, 'locations');
      const snapshot = await get(locationsRef);
      
      if (snapshot.exists()) {
        const locationsData = snapshot.val();
        const selectedDateStr = selectedDate.toISOString().split('T')[0];
        
        const filtered = Object.keys(locationsData)
          .map(key => ({
            id: key,
            ...locationsData[key]
          }))
          .filter(location => {
            const locationDate = location.date || 
              new Date(location.timestamp).toISOString().split('T')[0];
            
            return (
              location.deviceId === selectedDevice &&
              locationDate === selectedDateStr
            );
          })
          .sort((a, b) => a.timestamp - b.timestamp);

        setFilteredLocations(filtered);
        
        // Atualizar nome do dispositivo selecionado
        const device = devices.find(d => d.id === selectedDevice);
        if (device) {
          setSelectedDeviceName(device.name);
        }
        
        // Marcar mapa como pronto para ajustar viewport
        setTimeout(() => setMapInitialized(true), 100);
      } else {
        setFilteredLocations([]);
      }
    } catch (error) {
      console.error('Erro ao buscar localizações:', error);
      setError('Erro ao carregar localizações. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }, [selectedDevice, selectedDate, devices]);

  // Buscar automaticamente quando selecionar dispositivo e data
  useEffect(() => {
    if (selectedDevice && selectedDate) {
      const timer = setTimeout(() => {
        handleSearch();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [selectedDevice, selectedDate, handleSearch]);

  const handlePrint = () => {
    if (filteredLocations.length === 0) {
      setError('Não há dados para imprimir');
      return;
    }
    
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório de Rota - ${selectedDeviceName || selectedDevice}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 25px;
              color: #333;
              line-height: 1.4;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 3px solid #701B20;
            }
            .company-name {
              color: #701B20;
              font-size: 28px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .report-title {
              color: #B89F5E;
              font-size: 20px;
              margin-bottom: 15px;
            }
            .info-section {
              margin-bottom: 25px;
              padding: 20px;
              background-color: #f8f8f8;
              border-radius: 8px;
              border-left: 5px solid #B89F5E;
            }
            .info-row {
              display: flex;
              margin-bottom: 10px;
              align-items: center;
            }
            .info-label {
              font-weight: bold;
              min-width: 180px;
              color: #701B20;
            }
            .map-container {
              width: 100%;
              height: 450px;
              margin: 25px 0;
              border: 2px solid #ddd;
              border-radius: 8px;
              overflow: hidden;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
              margin: 20px 0;
            }
            .stat-card {
              background: #701B20;
              color: white;
              padding: 15px;
              border-radius: 8px;
              text-align: center;
            }
            .stat-number {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .stat-label {
              font-size: 12px;
              opacity: 0.9;
            }
            .locations-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 25px;
              font-size: 12px;
            }
            .locations-table th {
              background-color: #701B20;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: bold;
            }
            .locations-table td {
              padding: 10px;
              border-bottom: 1px solid #ddd;
            }
            .locations-table tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              font-size: 11px;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 20px;
            }
            @media print {
              body { margin: 15px; }
              .no-print { display: none; }
              .page-break { page-break-before: always; }
            }
          </style>
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
            integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
            crossorigin=""/>
        </head>
        <body>
          <div class="header">
            <div class="company-name">ROTAS IMIGRAÇÃO</div>
            <div class="report-title">RELATÓRIO DE ROTA DIÁRIA</div>
          </div>
          
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">Vendedor:</span>
              <span><strong>${selectedDeviceName || selectedDevice}</strong></span>
            </div>
            <div class="info-row">
              <span class="info-label">Data:</span>
              <span>${selectedDate.toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            <div class="info-row">
              <span class="info-label">ID do Dispositivo:</span>
              <span style="font-family: monospace;">${selectedDevice}</span>
            </div>
          </div>
          
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-number">${filteredLocations.length}</div>
              <div class="stat-label">PONTOS REGISTRADOS</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${
                filteredLocations.length > 1 ? 
                Math.round((filteredLocations[filteredLocations.length - 1].timestamp - 
                filteredLocations[0].timestamp) / (1000 * 60 * 60)) : 0
              }h</div>
              <div class="stat-label">DURAÇÃO TOTAL</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${
                filteredLocations[0] ? formatTime(filteredLocations[0].timestamp).substring(0, 5) : '--:--'
              }</div>
              <div class="stat-label">INÍCIO</div>
            </div>
          </div>
          
          <div style="margin: 20px 0;">
            <h3 style="color: #701B20; margin-bottom: 10px;">🗺️ MAPA DA ROTA</h3>
            <div class="map-container" id="map"></div>
          </div>
          
          <h3 style="color: #701B20; margin-top: 30px;">📋 DETALHES DOS PONTOS</h3>
          <table class="locations-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Horário</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Velocidade</th>
                <th>Precisão</th>
              </tr>
            </thead>
            <tbody>
              ${filteredLocations.map((loc, index) => `
                <tr>
                  <td><strong>${index + 1}</strong></td>
                  <td>${formatTime(loc.timestamp)}</td>
                  <td style="font-family: monospace;">${loc.latitude.toFixed(6)}</td>
                  <td style="font-family: monospace;">${loc.longitude.toFixed(6)}</td>
                  <td>${loc.speed ? (loc.speed * 3.6).toFixed(1) + ' km/h' : 'N/A'}</td>
                  <td>${loc.accuracy ? loc.accuracy.toFixed(0) + ' m' : 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            <p>Relatório gerado automaticamente pelo Sistema Rotas Imigração</p>
            <p>Mapas fornecidos por OpenStreetMap © • ${new Date().toLocaleString('pt-BR')}</p>
          </div>
          
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
            integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
            crossorigin=""></script>
          <script>
            // Criar mapa para impressão
            const map = L.map('map').setView([
              ${filteredLocations[0]?.latitude || -23.5505}, 
              ${filteredLocations[0]?.longitude || -46.6333}
            ], 13);
            
            // Adicionar tiles do OpenStreetMap
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap',
              maxZoom: 19
            }).addTo(map);
            
            // Adicionar polyline
            ${filteredLocations.length > 0 ? `
              const coordinates = [
                ${filteredLocations.map(loc => `[${loc.latitude}, ${loc.longitude}]`).join(',\n                ')}
              ];
              
              const polyline = L.polyline(coordinates, {
                color: '#701B20',
                weight: 4,
                opacity: 0.8,
                lineJoin: 'round'
              }).addTo(map);
              
              // Ajustar view para mostrar toda a rota
              map.fitBounds(polyline.getBounds());
              
              // Adicionar marcadores de início e fim
              if (coordinates.length > 0) {
                // Marcador do início
                L.circleMarker(coordinates[0], {
                  radius: 10,
                  fillColor: '#4CAF50',
                  color: '#FFFFFF',
                  weight: 3,
                  fillOpacity: 1
                }).addTo(map).bindTooltip('Início - ${formatTime(filteredLocations[0].timestamp)}');
                
                // Marcador do fim
                L.circleMarker(coordinates[coordinates.length - 1], {
                  radius: 10,
                  fillColor: '#FF5722',
                  color: '#FFFFFF',
                  weight: 3,
                  fillOpacity: 1
                }).addTo(map).bindTooltip('Fim - ${formatTime(filteredLocations[filteredLocations.length - 1].timestamp)}');
              }
            ` : ''}
          </script>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Esperar mapa carregar antes de imprimir
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.onafterprint = () => {
        setTimeout(() => printWindow.close(), 500);
      };
    }, 1500);
  };

  const handleZoomToRoute = () => {
    if (mapRef.current && filteredLocations.length > 0) {
      const bounds = L.latLngBounds(
        filteredLocations.map(loc => [loc.latitude, loc.longitude])
      );
      mapRef.current.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 16
      });
    }
  };

  const handleZoomToPoint = (index) => {
    if (mapRef.current && filteredLocations[index]) {
      const location = filteredLocations[index];
      mapRef.current.setView([location.latitude, location.longitude], 16);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getRouteStats = () => {
    if (filteredLocations.length < 2) return null;
    
    const first = filteredLocations[0];
    const last = filteredLocations[filteredLocations.length - 1];
    const duration = (last.timestamp - first.timestamp) / (1000 * 60 * 60); // horas
    
    return {
      points: filteredLocations.length,
      duration: duration.toFixed(1),
      startTime: formatTime(first.timestamp),
      endTime: formatTime(last.timestamp)
    };
  };

  const routeStats = getRouteStats();

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 3, color: '#701B20', display: 'flex', alignItems: 'center', gap: 1 }}>
          <MyLocationIcon /> Visualizar Rotas
        </Typography>

        <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          {error && (
            <Alert 
              severity="error" 
              sx={{ mb: 2 }}
              onClose={() => setError('')}
            >
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2, alignItems: 'flex-start' }}>
            <FormControl sx={{ minWidth: 300 }}>
              <InputLabel shrink>Selecione o Vendedor</InputLabel>
              <Select
                value={selectedDevice}
                label="Selecione o Vendedor"
                onChange={(e) => {
                  setSelectedDevice(e.target.value);
                  const device = devices.find(d => d.id === e.target.value);
                  setSelectedDeviceName(device?.name || '');
                }}
                disabled={devices.length === 0}
                displayEmpty
                renderValue={(selected) => {
                  if (!selected) {
                    return <Typography color="text.secondary">Escolha um vendedor...</Typography>;
                  }
                  const device = devices.find(d => d.id === selected);
                  return device ? device.name : selected;
                }}
              >
                <MenuItem value="" disabled>
                  <Typography color="text.secondary">Selecione um vendedor</Typography>
                </MenuItem>
                {devices.map((device) => (
                  <MenuItem key={device.id} value={device.id}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <Typography>{device.name}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                        {device.id.substring(0, 8)}...
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <DatePicker
              label="Selecione a Data"
              value={selectedDate}
              onChange={(newValue) => setSelectedDate(newValue)}
              renderInput={(params) => <TextField {...params} sx={{ width: 200 }} />}
              maxDate={new Date()}
            />

            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={loading || !selectedDevice}
              startIcon={<SearchIcon />}
              sx={{
                backgroundColor: '#701B20',
                '&:hover': { backgroundColor: '#5a1519' },
                minWidth: 150,
                height: 56
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Buscar Rota'}
            </Button>

            <Button
              variant="outlined"
              onClick={handlePrint}
              disabled={filteredLocations.length === 0}
              startIcon={<PrintIcon />}
              sx={{
                borderColor: '#B89F5E',
                color: '#B89F5E',
                '&:hover': { borderColor: '#9c8549', backgroundColor: 'rgba(184, 159, 94, 0.04)' },
                minWidth: 150,
                height: 56
              }}
            >
              Imprimir
            </Button>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {filteredLocations.length > 0 ? (
                <>
                  <strong>{filteredLocations.length}</strong> localizações encontradas para{' '}
                  <strong>{selectedDeviceName || selectedDevice}</strong> em{' '}
                  <strong>{selectedDate.toLocaleDateString('pt-BR')}</strong>
                </>
              ) : (
                'Selecione um vendedor e uma data para visualizar a rota'
              )}
            </Typography>
            
            {filteredLocations.length > 0 && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip 
                  label={`${filteredLocations.length} pontos`} 
                  size="small" 
                  sx={{ backgroundColor: '#701B20', color: 'white' }}
                />
                {routeStats && (
                  <>
                    <Chip 
                      label={`${routeStats.duration}h`} 
                      size="small" 
                      variant="outlined"
                      sx={{ borderColor: '#B89F5E', color: '#B89F5E' }}
                    />
                    <Tooltip title="Zoom na rota completa">
                      <IconButton 
                        size="small" 
                        onClick={handleZoomToRoute}
                        sx={{ color: '#701B20' }}
                      >
                        <ZoomInIcon />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Stack>
            )}
          </Box>
        </Paper>

        <Paper sx={{ height: '600px', overflow: 'hidden', position: 'relative', borderRadius: 2 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress sx={{ color: '#701B20' }} />
              <Typography sx={{ ml: 2, color: '#701B20' }}>Carregando rota...</Typography>
            </Box>
          ) : filteredLocations.length > 0 ? (
            <>
              <MapContainer
                center={[filteredLocations[0].latitude, filteredLocations[0].longitude]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                ref={mapRef}
                whenCreated={mapInstance => { 
                  mapRef.current = mapInstance;
                }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                
                {mapInitialized && <MapController locations={filteredLocations} />}
                
                <Polyline
                  pathOptions={{ 
                    color: '#701B20', 
                    weight: 4, 
                    opacity: 0.8,
                    lineJoin: 'round',
                    lineCap: 'round'
                  }}
                  positions={filteredLocations.map(loc => [loc.latitude, loc.longitude])}
                />

                {filteredLocations.map((location, index) => {
                  const isFirst = index === 0;
                  const isLast = index === filteredLocations.length - 1;
                  
                  return (
                    <Marker
                      key={location.id}
                      position={[location.latitude, location.longitude]}
                      icon={createCustomIcon('#701B20', isFirst, isLast)}
                      eventHandlers={{
                        click: () => handleZoomToPoint(index)
                      }}
                    >
                      <Popup>
                        <Box sx={{ p: 1, minWidth: 200 }}>
                          <Typography variant="subtitle2" sx={{ color: '#701B20', mb: 1 }}>
                            Ponto {index + 1} {isFirst ? '(Início)' : isLast ? '(Fim)' : ''}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Horário:</strong> {formatTime(location.timestamp)}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Latitude:</strong> {location.latitude.toFixed(6)}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Longitude:</strong> {location.longitude.toFixed(6)}
                          </Typography>
                          {location.speed && (
                            <Typography variant="body2">
                              <strong>Velocidade:</strong> {(location.speed * 3.6).toFixed(1)} km/h
                            </Typography>
                          )}
                          {location.accuracy && (
                            <Typography variant="body2">
                              <strong>Precisão:</strong> {location.accuracy.toFixed(0)}m
                            </Typography>
                          )}
                          <Button 
                            size="small" 
                            sx={{ mt: 1, color: '#701B20' }}
                            onClick={() => handleZoomToPoint(index)}
                          >
                            Centralizar aqui
                          </Button>
                        </Box>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
              
              {/* Legenda do mapa */}
              <Box sx={{
                position: 'absolute',
                bottom: 10,
                right: 10,
                backgroundColor: 'white',
                padding: '10px 15px',
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                zIndex: 1000
              }}>
                <Typography variant="caption" fontWeight="bold" sx={{ mb: 1, display: 'block' }}>
                  Legenda:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <Box sx={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: '50%', 
                    backgroundColor: '#4CAF50',
                    border: '2px solid white',
                    mr: 1
                  }} />
                  <Typography variant="caption">Início da rota</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <Box sx={{ 
                    width: 10, 
                    height: 10, 
                    borderRadius: '50%', 
                    backgroundColor: '#701B20',
                    border: '2px solid white',
                    mr: 1
                  }} />
                  <Typography variant="caption">Pontos intermediários</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: '50%', 
                    backgroundColor: '#FF5722',
                    border: '2px solid white',
                    mr: 1
                  }} />
                  <Typography variant="caption">Fim da rota</Typography>
                </Box>
              </Box>
            </>
          ) : (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100%',
              flexDirection: 'column',
              color: '#666',
              p: 4
            }}>
              <MyLocationIcon sx={{ fontSize: 60, color: '#ddd', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1, textAlign: 'center' }}>
                Nenhuma rota selecionada
              </Typography>
              <Typography variant="body2" sx={{ textAlign: 'center', maxWidth: 400 }}>
                Selecione um vendedor e uma data para visualizar a rota diária.
                O mapa será automaticamente ajustado para mostrar todos os pontos.
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </LocalizationProvider>
  );
};

export default MapViewer;