import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  IconButton,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tooltip,
  Snackbar,
  Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { ref, get, update, onValue } from 'firebase/database';
import { database } from '../firebaseConfig';

const DeviceManager = () => {
  const [devices, setDevices] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [deviceName, setDeviceName] = useState('');
  const [copiedDeviceId, setCopiedDeviceId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    loadDevices();
    
    // Monitorar mudanças em tempo real
    const locationsRef = ref(database, 'locations');
    const unsubscribe = onValue(locationsRef, () => {
      loadDevices();
    });

    return () => unsubscribe();
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
              lastSeen: data.timestamp,
              locationsCount: 1,
              lastLatitude: data.latitude,
              lastLongitude: data.longitude,
              lastDate: data.date,
              lastTime: data.time,
            });
          } else {
            const device = deviceMap.get(deviceId);
            device.locationsCount += 1;
            if (data.timestamp > device.lastSeen) {
              device.lastSeen = data.timestamp;
              device.lastLatitude = data.latitude;
              device.lastLongitude = data.longitude;
              device.lastDate = data.date;
              device.lastTime = data.time;
            }
          }
        });

        setDevices(Array.from(deviceMap.values()));
      }
    } catch (error) {
      console.error('Erro ao carregar dispositivos:', error);
      showSnackbar('Erro ao carregar dispositivos', 'error');
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleEditClick = (device) => {
    setEditingDevice(device);
    setDeviceName(device.name);
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!editingDevice || !deviceName.trim()) {
      showSnackbar('Nome do vendedor é obrigatório', 'error');
      return;
    }

    setLoading(true);
    
    try {
      // Primeiro, buscar todas as localizações do dispositivo
      const locationsRef = ref(database, 'locations');
      const snapshot = await get(locationsRef);
      
      if (!snapshot.exists()) {
        showSnackbar('Nenhuma localização encontrada para este dispositivo', 'error');
        return;
      }

      const locationsData = snapshot.val();
      const updates = {};
      const newName = deviceName.trim();
      let updatedCount = 0;

      // Atualizar deviceName em todas as localizações do dispositivo
      Object.keys(locationsData).forEach((key) => {
        const location = locationsData[key];
        if (location.deviceId === editingDevice.id) {
          updates[`locations/${key}/deviceName`] = newName;
          updatedCount++;
        }
      });

      if (updatedCount === 0) {
        showSnackbar('Nenhuma localização encontrada para este dispositivo', 'warning');
        return;
      }

      // Salvar também no nó devices para referência futura
      updates[`devices/${editingDevice.id}/name`] = newName;
      updates[`devices/${editingDevice.id}/id`] = editingDevice.id;
      updates[`devices/${editingDevice.id}/lastSeen`] = editingDevice.lastSeen || Date.now();
      updates[`devices/${editingDevice.id}/createdAt`] = editingDevice.createdAt || Date.now();

      console.log('Atualizações a serem feitas:', updates);

      // Executar todas as atualizações de uma vez
      await update(ref(database), updates);
      
      setOpenDialog(false);
      showSnackbar(`Vendedor "${editingDevice.id}" renomeado para "${newName}"`, 'success');
      
      // Recarregar dados
      setTimeout(() => {
        loadDevices();
        // Disparar evento para atualizar outros componentes
        window.dispatchEvent(new Event('deviceRenamed'));
      }, 1000);

    } catch (error) {
      console.error('Erro detalhado ao atualizar nome:', error);
      
      // Verificar tipo específico de erro
      if (error.code === 'PERMISSION_DENIED') {
        showSnackbar(
          'Permissão negada. Verifique: 1) Se está logado 2) Regras do Firebase 3) Permissões do usuário',
          'error'
        );
      } else if (error.message.includes('quota')) {
        showSnackbar('Limite do Firebase atingido. Tente novamente mais tarde.', 'error');
      } else {
        showSnackbar(`Erro ao salvar: ${error.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  //const formatLastSeen = (timestamp) => {
    //if (!timestamp) return 'Nunca';
    //const date = new Date(timestamp);
    //return date.toLocaleString('pt-BR');
  //};

  const handleCopyDeviceId = (deviceId) => {
    navigator.clipboard.writeText(deviceId);
    setCopiedDeviceId(deviceId);
    showSnackbar('ID copiado para a área de transferência!', 'info');
    setTimeout(() => setCopiedDeviceId(null), 2000);
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 2, color: '#701B20' }}>
        📱 Gerenciar Vendedores ({devices.length} dispositivos)
      </Typography>
      
      <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
        <Table stickyHeader>
          <TableHead sx={{ backgroundColor: '#701B20' }}>
            <TableRow>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.9rem' }}>
                ID do Dispositivo
              </TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.9rem' }}>
                Nome do Vendedor
              </TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.9rem' }}>
                Última Atividade
              </TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.9rem' }}>
                Localizações
              </TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.9rem' }}>
                Ações
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {devices.map((device) => (
              <TableRow 
                key={device.id} 
                hover
                sx={{ 
                  '&:hover': { backgroundColor: '#f9f9f9' },
                  '&:nth-of-type(odd)': { backgroundColor: '#fafafa' }
                }}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Tooltip title={copiedDeviceId === device.id ? "Copiado!" : "Clique para copiar"}>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontFamily: "'Roboto Mono', monospace",
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          backgroundColor: '#f5f5f5',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          '&:hover': { backgroundColor: '#e0e0e0' }
                        }}
                        onClick={() => handleCopyDeviceId(device.id)}
                      >
                        {device.id}
                      </Typography>
                    </Tooltip>
                    <IconButton
                      size="small"
                      onClick={() => handleCopyDeviceId(device.id)}
                      title="Copiar ID"
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={device.name}
                    sx={{
                      backgroundColor: '#B89F5E',
                      color: '#FFFFFF',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      maxWidth: '180px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      '&:hover': {
                        backgroundColor: '#9c8549',
                      }
                    }}
                    title={device.name}
                  />
                </TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      {device.lastDate || new Date(device.lastSeen).toLocaleDateString('pt-BR')}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#666', fontSize: '0.8rem' }}>
                      {device.lastTime || new Date(device.lastSeen).toLocaleTimeString('pt-BR')}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Tooltip title={`${device.locationsCount} localizações registradas`}>
                    <Chip
                      label={device.locationsCount.toLocaleString('pt-BR')}
                      variant="outlined"
                      sx={{ 
                        borderColor: '#701B20', 
                        color: '#701B20',
                        fontWeight: 'bold',
                        fontSize: '0.9rem'
                      }}
                    />
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Tooltip title="Renomear vendedor">
                    <IconButton
                      size="small"
                      onClick={() => handleEditClick(device)}
                      sx={{ 
                        color: '#701B20',
                        '&:hover': { 
                          backgroundColor: 'rgba(112, 27, 32, 0.1)' 
                        }
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {devices.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    📭 Nenhum dispositivo encontrado
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Aguarde o envio da primeira localização do app mobile
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog 
        open={openDialog} 
        onClose={() => !loading && setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: '#701B20', fontWeight: 'bold' }}>
          ✏️ Renomear Vendedor
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Dispositivo ID: 
              <Box component="span" sx={{ 
                fontFamily: 'monospace', 
                backgroundColor: '#f5f5f5', 
                padding: '2px 6px', 
                borderRadius: '4px',
                ml: 1
              }}>
                {editingDevice?.id}
              </Box>
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
              Localizações encontradas: {editingDevice?.locationsCount || 0}
            </Typography>
            
            <TextField
              autoFocus
              margin="dense"
              label="Nome do Vendedor"
              fullWidth
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              sx={{ mt: 2 }}
              helperText="Este nome será usado nos filtros e relatórios"
              variant="outlined"
              disabled={loading}
              error={!deviceName.trim()}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setOpenDialog(false)}
            sx={{ color: '#666' }}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={loading || !deviceName.trim()}
            sx={{ 
              backgroundColor: '#701B20', 
              '&:hover': { backgroundColor: '#5a1519' },
              '&.Mui-disabled': {
                backgroundColor: '#cccccc'
              }
            }}
          >
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DeviceManager;