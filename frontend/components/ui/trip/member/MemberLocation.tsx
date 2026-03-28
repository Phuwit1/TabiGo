import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity 
} from 'react-native';
import * as Location from 'expo-location';
import io from 'socket.io-client';
import MapView, { Marker, PROVIDER_GOOGLE, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { WEBSOCKET_URL } from '@/api.js';

// Singleton Socket
let globalSocket: any = null;
const getSocket = () => {
    if (!globalSocket) {
        globalSocket = io(WEBSOCKET_URL, {
            transports: ['websocket'],
            autoConnect: false,
            reconnection: true,
        } as any);
        globalSocket.io.opts.extraHeaders = { 'ngrok-skip-browser-warning': 'true' };
    }
    return globalSocket;
};

type Props = {
    groupCode: string;
    userId: number;
    userName: string;
    onClose: () => void;
};

export default function MemberLocationMap({ groupCode, userId, userName, onClose }: Props) {
    const [myLocation, setMyLocation] = useState<any>(null);
    const [othersLocations, setOthersLocations] = useState<any>({});
    const [status, setStatus] = useState('Connecting...');
    const mapRef = useRef<MapView>(null);
    const locationSubscription = useRef<any>(null);

    useEffect(() => {
        if (!groupCode) return;
        startTracking();
        return () => stopTracking();
    }, [groupCode]);

    // Auto-fit map whenever othersLocations changes (new friend location received)
    useEffect(() => {
        if (!myLocation || !mapRef.current) return;
        const others = Object.values(othersLocations) as any[];
        if (others.length === 0) return;
        const coords = [
            myLocation,
            ...others.map((l: any) => ({ latitude: l.latitude, longitude: l.longitude })),
        ];
        mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 120, right: 60, bottom: 80, left: 60 },
            animated: true,
        });
    }, [othersLocations]);

    const startTracking = async () => {
        // 1. ขอ Permission
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'กรุณาเปิด Location เพื่อใช้งาน');
            return;
        }

        // 2. เชื่อมต่อ Socket
        const socket = getSocket();

        // ลงทะเบียน listeners ก่อนเสมอ และ off ก่อนเพื่อป้องกัน duplicate
        socket.off('location_update');
        socket.off('user_left');

        socket.on('location_update', (data: any) => {
            console.log('[Socket] location_update received:', data);
            setOthersLocations((prev: any) => ({
                ...prev,
                [data.username]: {
                    latitude: data.lat,
                    longitude: data.lng,
                    username: data.username,
                    timestamp: data.updated_at ?? data.timestamp,
                    isOnline: data.is_online ?? true,
                }
            }));
        });

        socket.on('user_left', (data: any) => {
            setOthersLocations((prev: any) => {
                if (!prev[data.username]) return prev;
                return { ...prev, [data.username]: { ...prev[data.username], isOnline: false } };
            });
        });

        // emit join_group หลังจาก listeners พร้อมแล้ว
        // ถ้า socket ยังไม่ได้ connect → รอ connect แล้วค่อย emit
        const emitJoin = () => {
            console.log('[Socket] joining group:', groupCode, 'as:', userName);
            socket.emit('join_group', { group_id: groupCode, username: userName });
            setStatus(`Online: ${groupCode}`);
        };

        if (socket.connected) {
            emitJoin();
        } else {
            socket.once('connect', emitJoin);
            socket.connect();
        }

        // 3. ดึง location ทันทีก่อน เพื่อให้ map render ได้เลย
        try {
            const current = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const { latitude, longitude } = current.coords;
            console.log('[Location] got initial position:', latitude, longitude);
            setMyLocation({ latitude, longitude });
            socket.emit('update_location', { lat: latitude, lng: longitude, timestamp: new Date().toISOString() });
        } catch (e) {
            console.warn('[Location] getCurrentPosition failed:', e);
        }

        // 4. Watch สำหรับ update ต่อเนื่อง
        locationSubscription.current = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 5000,
                distanceInterval: 10,
            },
            (loc) => {
                const { latitude, longitude } = loc.coords;
                setMyLocation({ latitude, longitude });
                socket.emit('update_location', {
                    lat: latitude,
                    lng: longitude,
                    timestamp: new Date().toISOString(),
                });
            }
        );
    };

    const stopTracking = () => {
        if (locationSubscription.current) locationSubscription.current.remove();
        const socket = getSocket();

        socket.off('location_update');
        socket.off('user_left');
        socket.off('connect'); // กัน emitJoin ค้างอยู่กรณี unmount ก่อน connect

        socket.emit('leave_group', { group_id: groupCode });
    };

    const focusAllMarkers = () => {
        if (!mapRef.current || !myLocation) return;
        
        const markers = [
            myLocation,
            ...Object.values(othersLocations).map((l: any) => ({ latitude: l.latitude, longitude: l.longitude }))
        ];

        if (markers.length > 1) {
            mapRef.current.fitToCoordinates(markers, {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true,
            });
        } else {
             // ถ้ามีแค่เราคนเดียว ให้ซูมไปที่ตัวเรา
             mapRef.current.animateToRegion({
                ...myLocation,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01
             });
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerOverlay}>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>ติดตามเพื่อน ({Object.keys(othersLocations).length})</Text>
                    <Text style={styles.headerSub}>Group: {groupCode}</Text>
                </View>
                <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
            </View>

            {/* Map */}
            {myLocation ? (
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={{
                        latitude: myLocation.latitude,
                        longitude: myLocation.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    }}
                    showsUserLocation={true}
                    showsMyLocationButton={false}
                >
                    {/* Marker ของตัวเอง */}
                    <Marker
                        coordinate={myLocation}
                        title={userName}
                        description="ตำแหน่งของคุณ"
                        tracksViewChanges={false}
                    >
                        <View style={[styles.customMarker, styles.myMarker]}>
                            <Ionicons name="person" size={16} color="white" />
                        </View>
                    </Marker>

                    {/* Marker ของเพื่อน */}
                    {Object.entries(othersLocations).map(([sid, loc]: any) => (
                        <Marker
                            key={sid}
                            coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
                            title={loc.username || 'Friend'}
                            description={loc.timestamp ? `อัปเดต: ${new Date(loc.timestamp).toLocaleTimeString()}` : ''}
                            tracksViewChanges={false}
                        >
                            <View style={[styles.customMarker, !loc.isOnline && styles.customMarkerOffline]}>
                                <Ionicons name={loc.isOnline ? 'person' : 'person-outline'} size={16} color="white" />
                            </View>

                            <Callout>
                                <View style={styles.calloutView}>
                                    <Text style={styles.calloutTitle}>{loc.username}</Text>
                                    <Text style={styles.calloutSub}>
                                        {loc.isOnline ? 'ออนไลน์' : `ออฟไลน์ · ${loc.timestamp ? new Date(loc.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}`}
                                    </Text>
                                </View>
                            </Callout>
                        </Marker>
                    ))}
                </MapView>
            ) : (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FF6B6B" />
                    <Text style={styles.loadingText}>กำลังระบุตำแหน่ง...</Text>
                </View>
            )}

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={focusAllMarkers}>
                <Ionicons name="locate" size={24} color="#fff" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    map: { width: '100%', height: '100%' },
    headerOverlay: {
        position: 'absolute', top: 50, left: 20, right: 20,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 12, padding: 12,
        flexDirection: 'row', alignItems: 'center',
        zIndex: 10, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 5
    },
    closeBtn: { padding: 8, marginRight: 8 },
    headerInfo: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    headerSub: { fontSize: 12, color: '#666' },
    statusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 10 },
    customMarker: {
        backgroundColor: '#FF6B6B', padding: 8, borderRadius: 20,
        borderWidth: 2, borderColor: 'white', elevation: 5
    },
    customMarkerOffline: {
        backgroundColor: '#9E9E9E',
    },
    myMarker: {
        backgroundColor: '#007AFF',
    },
    calloutView: { padding: 4, alignItems: 'center', minWidth: 100 },
    calloutTitle: { fontWeight: 'bold', fontSize: 14 },
    calloutSub: { fontSize: 11, color: '#666', marginTop: 2 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, color: '#666' },
    fab: {
        position: 'absolute', bottom: 40, right: 20,
        backgroundColor: '#007AFF', width: 56, height: 56, borderRadius: 28,
        justifyContent: 'center', alignItems: 'center', elevation: 6
    }
});
