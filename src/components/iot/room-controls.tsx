'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Thermometer, Lightbulb, Lock, Tv, Blinds, AirVent, Wind,
  Power, PowerOff, Sun, Moon, ChevronUp, ChevronDown,
  Volume2, VolumeX, Wifi, WifiOff, RefreshCw
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Room {
  id: string;
  number: string;
  name?: string;
  floor: number;
  status: string;
  roomType?: { name: string };
  iotDevices: Device[];
}

interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
  currentState: Record<string, any>;
  room?: { number: string; name?: string };
}

interface RoomControlsProps {
  roomId?: string;
}

export default function RoomControls({ roomId }: RoomControlsProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [controlling, setControlling] = useState<string | null>(null);
  const [unlockConfirmDeviceId, setUnlockConfirmDeviceId] = useState<string | null>(null);

  useEffect(() => {
    fetchRoomsWithDevices();
  }, []);

  const fetchRoomsWithDevices = async () => {
    try {
      setLoading(true);
      
      // Fetch rooms
      const roomsRes = await fetch('/api/rooms');
      let roomsData: Room[] = [];
      if (roomsRes.ok) {
        const data = await roomsRes.json();
        roomsData = data.rooms || [];
      }

      // Fetch IoT devices with room info
      const devicesRes = await fetch('/api/iot/devices');
      if (devicesRes.ok) {
        const data = await devicesRes.json();
        
        // Group devices by room
        const devicesByRoom: Record<string, Device[]> = {};
        data.devices.forEach((device: Device) => {
          const room = (device as any).room;
          if (room) {
            const roomKey = room.number;
            if (!devicesByRoom[roomKey]) {
              devicesByRoom[roomKey] = [];
            }
            devicesByRoom[roomKey].push(device);
          }
        });

        // Attach devices to rooms
        roomsData = roomsData.map(room => ({
          ...room,
          iotDevices: devicesByRoom[room.number] || []
        }));

        setRooms(roomsData);
        
        // Select first room with devices or first room
        if (roomsData.length > 0) {
          const roomWithDevices = roomsData.find(r => r.iotDevices.length > 0);
          setSelectedRoom(roomWithDevices || roomsData[0]);
          setDevices((roomWithDevices || roomsData[0]).iotDevices);
        }
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to fetch rooms');
    } finally {
      setLoading(false);
    }
  };

  const sendCommand = async (deviceId: string, command: string, params: any = {}) => {
    if (command === 'unlock') {
      setUnlockConfirmDeviceId(deviceId);
      return;
    }
    executeCommand(deviceId, command, params);
  };

  const executeCommand = async (deviceId: string, command: string, params: any = {}) => {
    try {
      setControlling(deviceId);
      const response = await fetch(`/api/iot/devices/${deviceId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, parameters: params, source: 'manual' })
      });

      if (response.ok) {
        // Update local state
        setDevices(prev => prev.map(d => {
          if (d.id === deviceId) {
            let newState = { ...d.currentState };
            switch (command) {
              case 'turn_on':
                newState.isOn = true;
                newState.power = 'on';
                break;
              case 'turn_off':
                newState.isOn = false;
                newState.power = 'off';
                break;
              case 'set_temperature':
                newState.temperature = params.temperature;
                break;
              case 'set_brightness':
                newState.brightness = params.brightness;
                break;
              case 'lock':
                newState.locked = true;
                break;
              case 'unlock':
                newState.locked = false;
                break;
            }
            return { ...d, currentState: newState };
          }
          return d;
        }));
        toast.success('Command sent successfully');
      } else {
        toast.error('Failed to send command');
      }
    } catch (error) {
      console.error('Error sending command:', error);
      toast.error('Failed to send command');
    } finally {
      setControlling(null);
    }
  };

  const handleRoomSelect = (roomNumber: string) => {
    const room = rooms.find(r => r.number === roomNumber);
    if (room) {
      setSelectedRoom(room);
      setDevices(room.iotDevices);
    }
  };

  // Get devices by type
  const getDevicesByType = (type: string) => devices.filter(d => d.type === type);
  const thermostats = getDevicesByType('thermostat');
  const lights = getDevicesByType('light');
  const locks = getDevicesByType('lock');
  const tvs = getDevicesByType('tv');
  const blinds = getDevicesByType('blind');
  const acs = getDevicesByType('ac');

  // Control Panel Components
  const ThermostatControl = ({ device }: { device: Device }) => {
    const temp = device.currentState?.temperature || 22;
    const isOn = device.currentState?.isOn ?? true;
    
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Thermometer className="h-4 w-4" />
              {device.name}
            </CardTitle>
            <Switch
              checked={isOn}
              onCheckedChange={(checked) => 
                sendCommand(device.id, checked ? 'turn_on' : 'turn_off')
              }
              disabled={controlling === device.id}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <span className="text-4xl font-bold">{temp}°C</span>
          </div>
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => sendCommand(device.id, 'set_temperature', { temperature: temp - 1 })}
              disabled={controlling === device.id}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => sendCommand(device.id, 'set_temperature', { temperature: temp + 1 })}
              disabled={controlling === device.id}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex justify-center gap-2">
            <Button
              variant={device.currentState?.mode === 'cool' ? 'default' : 'outline'}
              size="sm"
              onClick={() => sendCommand(device.id, 'set_mode', { mode: 'cool' })}
            >
              Cool
            </Button>
            <Button
              variant={device.currentState?.mode === 'heat' ? 'default' : 'outline'}
              size="sm"
              onClick={() => sendCommand(device.id, 'set_mode', { mode: 'heat' })}
            >
              Heat
            </Button>
            <Button
              variant={device.currentState?.mode === 'auto' ? 'default' : 'outline'}
              size="sm"
              onClick={() => sendCommand(device.id, 'set_mode', { mode: 'auto' })}
            >
              Auto
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const LightControl = ({ device }: { device: Device }) => {
    const isOn = device.currentState?.isOn ?? false;
    const brightness = device.currentState?.brightness || 100;

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              {device.name}
            </CardTitle>
            <Switch
              checked={isOn}
              onCheckedChange={(checked) => 
                sendCommand(device.id, checked ? 'turn_on' : 'turn_off')
              }
              disabled={controlling === device.id}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Brightness</span>
              <span>{brightness}%</span>
            </div>
            <Slider
              value={[brightness]}
              onValueChange={([value]) => 
                sendCommand(device.id, 'set_brightness', { brightness: value })
              }
              max={100}
              step={10}
              disabled={!isOn || controlling === device.id}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => sendCommand(device.id, 'set_mode', { mode: 'day' })}
            >
              <Sun className="h-4 w-4 mr-2" />
              Day
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => sendCommand(device.id, 'set_mode', { mode: 'night' })}
            >
              <Moon className="h-4 w-4 mr-2" />
              Night
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const LockControl = ({ device }: { device: Device }) => {
    const isLocked = device.currentState?.locked ?? true;

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lock className="h-4 w-4" />
              {device.name}
            </CardTitle>
            <Badge variant={isLocked ? 'default' : 'destructive'}>
              {isLocked ? 'Locked' : 'Unlocked'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            variant={isLocked ? 'destructive' : 'default'}
            className="w-full"
            onClick={() => sendCommand(device.id, isLocked ? 'unlock' : 'lock')}
            disabled={controlling === device.id}
          >
            {isLocked ? 'Unlock Door' : 'Lock Door'}
          </Button>
        </CardContent>
      </Card>
    );
  };

  const TVControl = ({ device }: { device: Device }) => {
    const isOn = device.currentState?.isOn ?? false;
    const volume = device.currentState?.volume || 50;
    const muted = device.currentState?.muted ?? false;

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tv className="h-4 w-4" />
              {device.name}
            </CardTitle>
            <Switch
              checked={isOn}
              onCheckedChange={(checked) => 
                sendCommand(device.id, checked ? 'turn_on' : 'turn_off')
              }
              disabled={controlling === device.id}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Volume</span>
              <span>{volume}%</span>
            </div>
            <Slider
              value={[volume]}
              onValueChange={([value]) => 
                sendCommand(device.id, 'set_volume', { volume: value })
              }
              max={100}
              step={5}
              disabled={!isOn || controlling === device.id}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => sendCommand(device.id, 'mute', {})}
              disabled={!isOn || controlling === device.id}
            >
              {muted ? <VolumeX className="h-4 w-4 mr-2" /> : <Volume2 className="h-4 w-4 mr-2" />}
              {muted ? 'Unmute' : 'Mute'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const BlindControl = ({ device }: { device: Device }) => {
    const isOpen = device.currentState?.isOpen ?? true;
    const position = device.currentState?.position || 100;

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Blinds className="h-4 w-4" />
              {device.name}
            </CardTitle>
            <Badge variant="outline">
              {position}% Open
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Slider
              value={[position]}
              onValueChange={([value]) => 
                sendCommand(device.id, 'set_position', { position: value })
              }
              max={100}
              step={10}
              disabled={controlling === device.id}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => sendCommand(device.id, 'open', {})}
            >
              Open
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => sendCommand(device.id, 'close', {})}
            >
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const ACControl = ({ device }: { device: Device }) => {
    const isOn = device.currentState?.isOn ?? false;
    const temp = device.currentState?.temperature || 24;
    const fanSpeed = device.currentState?.fanSpeed || 'auto';

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <AirVent className="h-4 w-4" />
              {device.name}
            </CardTitle>
            <Switch
              checked={isOn}
              onCheckedChange={(checked) => 
                sendCommand(device.id, checked ? 'turn_on' : 'turn_off')
              }
              disabled={controlling === device.id}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <span className="text-4xl font-bold">{temp}°C</span>
          </div>
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => sendCommand(device.id, 'set_temperature', { temperature: temp - 1 })}
              disabled={!isOn || controlling === device.id}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => sendCommand(device.id, 'set_temperature', { temperature: temp + 1 })}
              disabled={!isOn || controlling === device.id}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Fan Speed</Label>
            <div className="flex gap-2">
              {['low', 'medium', 'high', 'auto'].map((speed) => (
                <Button
                  key={speed}
                  variant={fanSpeed === speed ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 capitalize"
                  onClick={() => sendCommand(device.id, 'set_fan_speed', { fanSpeed: speed })}
                  disabled={!isOn || controlling === device.id}
                >
                  {speed}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const confirmUnlock = () => {
    if (unlockConfirmDeviceId) {
      executeCommand(unlockConfirmDeviceId, 'unlock');
      setUnlockConfirmDeviceId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Room Controls</h1>
        <p className="text-muted-foreground">
          Control smart devices in guest rooms
        </p>
      </div>

      {/* Room Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Label>Select Room:</Label>
            <Select 
              value={selectedRoom?.number || ''} 
              onValueChange={handleRoomSelect}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select a room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.number}>
                    Room {room.number} 
                    {room.iotDevices.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {room.iotDevices.length} devices
                      </Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRoom && (
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="outline">Floor {selectedRoom.floor}</Badge>
                <Badge variant="outline">{selectedRoom.roomType?.name || 'Standard'}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Device Controls */}
      {selectedRoom && (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Devices ({devices.length})</TabsTrigger>
            <TabsTrigger value="climate">Climate</TabsTrigger>
            <TabsTrigger value="lighting">Lighting</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="entertainment">Entertainment</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {devices.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No IoT devices configured for this room
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {devices.map(device => (
                  <div key={device.id}>
                    {device.type === 'thermostat' && <ThermostatControl device={device} />}
                    {device.type === 'light' && <LightControl device={device} />}
                    {device.type === 'lock' && <LockControl device={device} />}
                    {device.type === 'tv' && <TVControl device={device} />}
                    {device.type === 'blind' && <BlindControl device={device} />}
                    {device.type === 'ac' && <ACControl device={device} />}
                    {device.type === 'sensor' && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">{device.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Badge variant="outline">Sensor - No Controls</Badge>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="climate" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {thermostats.map(device => (
                <ThermostatControl key={device.id} device={device} />
              ))}
              {acs.map(device => (
                <ACControl key={device.id} device={device} />
              ))}
              {thermostats.length === 0 && acs.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No climate control devices
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="lighting" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {lights.map(device => (
                <LightControl key={device.id} device={device} />
              ))}
              {blinds.map(device => (
                <BlindControl key={device.id} device={device} />
              ))}
              {lights.length === 0 && blinds.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No lighting devices
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {locks.map(device => (
                <LockControl key={device.id} device={device} />
              ))}
              {locks.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No security devices
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="entertainment" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tvs.map(device => (
                <TVControl key={device.id} device={device} />
              ))}
              {tvs.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No entertainment devices
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Unlock Confirmation Dialog */}
      <AlertDialog open={!!unlockConfirmDeviceId} onOpenChange={(open) => !open && setUnlockConfirmDeviceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Door Unlock</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unlock this door? This action will send an unlock command to the smart lock. Make sure this is an authorized action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnlock} className="bg-orange-600 hover:bg-orange-700">
              Unlock Door
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Actions */}
      {selectedRoom && devices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  lights.forEach(d => sendCommand(d.id, 'turn_on'));
                  thermostats.forEach(d => sendCommand(d.id, 'set_temperature', { temperature: 22 }));
                }}
              >
                <Sun className="h-4 w-4 mr-2" />
                Morning Mode
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  lights.forEach(d => {
                    sendCommand(d.id, 'turn_on');
                    sendCommand(d.id, 'set_brightness', { brightness: 30 });
                  });
                  blinds.forEach(d => sendCommand(d.id, 'close', {}));
                }}
              >
                <Moon className="h-4 w-4 mr-2" />
                Night Mode
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  devices.forEach(d => sendCommand(d.id, 'turn_off'));
                }}
              >
                <PowerOff className="h-4 w-4 mr-2" />
                All Off
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
