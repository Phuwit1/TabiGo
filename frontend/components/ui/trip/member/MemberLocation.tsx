import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity
} from 'react-native';
import * as Location from 'expo-location';
import io from 'socket.io-client';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { WEBSOCKET_URL, GOOGLE_API_KEY } from '@/api.js';

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

// Build the HTML page for Google Maps JS API
const buildMapHTML = (apiKey: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; }
    #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    let map;
    let myMarker = null;
    let friendMarkers = {};
    let infoWindows = {};

    function initMap() {
      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 35.6762, lng: 139.6503 },
        zoom: 15,
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_CENTER,
        },
      });
    }

    function updateMyLocation(lat, lng, name) {
      const pos = { lat: lat, lng: lng };
      if (!myMarker) {
        myMarker = new google.maps.Marker({
          position: pos,
          map: map,
          title: name,
          zIndex: 10,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#007AFF',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2.5,
          },
        });
        const iw = new google.maps.InfoWindow({ content: '<b>' + name + '</b><br><small>You</small>' });
        myMarker.addListener('click', function() { iw.open(map, myMarker); });
        map.panTo(pos);
      } else {
        myMarker.setPosition(pos);
      }
    }

    function updateFriend(username, lat, lng, isOnline) {
      const pos = { lat: lat, lng: lng };
      const color = isOnline ? '#FF6B6B' : '#9E9E9E';
      const icon = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 11,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      };

      if (friendMarkers[username]) {
        friendMarkers[username].setPosition(pos);
        friendMarkers[username].setIcon(icon);
        // Update infowindow content
        if (infoWindows[username]) {
          infoWindows[username].setContent(
            '<b>' + username + '</b><br><small>' + (isOnline ? 'Online' : 'Offline') + '</small>'
          );
        }
      } else {
        const marker = new google.maps.Marker({
          position: pos,
          map: map,
          title: username,
          icon: icon,
        });
        const iw = new google.maps.InfoWindow({
          content: '<b>' + username + '</b><br><small>' + (isOnline ? 'Online' : 'Offline') + '</small>',
        });
        marker.addListener('click', function() { iw.open(map, marker); });
        friendMarkers[username] = marker;
        infoWindows[username] = iw;
      }
    }

    function removeFriend(username) {
      if (friendMarkers[username]) {
        friendMarkers[username].setMap(null);
        delete friendMarkers[username];
        delete infoWindows[username];
      }
    }

    function fitAll(myLat, myLng, friends) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: myLat, lng: myLng });
      for (var i = 0; i < friends.length; i++) {
        bounds.extend({ lat: friends[i].lat, lng: friends[i].lng });
      }
      map.fitBounds(bounds, { top: 60, right: 40, bottom: 60, left: 40 });
    }

    function panToMe(lat, lng) {
      map.panTo({ lat: lat, lng: lng });
      map.setZoom(16);
    }
  </script>
  <script
    src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap"
    async defer>
  </script>
</body>
</html>
`;

export default function MemberLocationMap({ groupCode, userName, onClose }: Props) {
    const [myLocation, setMyLocation] = useState<any>(null);
    const [othersLocations, setOthersLocations] = useState<any>({});
    const [mapReady, setMapReady] = useState(false);
    const webViewRef = useRef<WebView>(null);
    const locationSubscription = useRef<any>(null);
    const myLocationRef = useRef<any>(null);
    const othersRef = useRef<any>({});

    // Keep refs in sync for use inside callbacks
    useEffect(() => {
        myLocationRef.current = myLocation;
    }, [myLocation]);

    useEffect(() => {
        othersRef.current = othersLocations;
    }, [othersLocations]);

    useEffect(() => {
        if (!groupCode) return;
        startTracking();
        return () => stopTracking();
    }, [groupCode]);

    // Inject JS to update my marker whenever myLocation changes
    useEffect(() => {
        if (!mapReady || !myLocation) return;
        injectJS(
            `updateMyLocation(${myLocation.latitude}, ${myLocation.longitude}, ${JSON.stringify(userName)}); true;`
        );
    }, [myLocation, mapReady]);

    // Inject JS to update friend marker whenever othersLocations changes
    useEffect(() => {
        if (!mapReady) return;
        Object.values(othersLocations).forEach((loc: any) => {
            if (loc.latitude == null || loc.longitude == null) return;
            injectJS(
                `updateFriend(${JSON.stringify(loc.username)}, ${loc.latitude}, ${loc.longitude}, ${!!loc.isOnline}); true;`
            );
        });
    }, [othersLocations, mapReady]);

    const injectJS = (code: string) => {
        webViewRef.current?.injectJavaScript(code);
    };

    const startTracking = async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Please enable Location to use this feature.');
            return;
        }

        const socket = getSocket();

        socket.off('location_update');
        socket.off('user_left');

        socket.on('location_update', (data: any) => {
            console.log('[Socket] location_update:', data);
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

        const emitJoin = () => {
            console.log('[Socket] joining group:', groupCode, 'as:', userName);
            socket.emit('join_group', { group_id: groupCode, username: userName });
        };

        if (socket.connected) {
            emitJoin();
        } else {
            socket.once('connect', emitJoin);
            socket.connect();
        }

        // Get initial position
        try {
            const current = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            const { latitude, longitude } = current.coords;
            setMyLocation({ latitude, longitude });
            socket.emit('update_location', { lat: latitude, lng: longitude, timestamp: new Date().toISOString() });
        } catch (e) {
            console.warn('[Location] getCurrentPosition failed:', e);
        }

        // Watch for continuous updates
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
        socket.off('connect');

        socket.emit('leave_group', { group_id: groupCode });

        socket.disconnect();
        globalSocket = null;
    };

    const focusAll = () => {
        if (!myLocation) return;
        const others = Object.values(othersRef.current) as any[];
        const friendCoords = others
            .filter((l: any) => l.username !== userName && l.latitude != null && l.longitude != null)
            .map((l: any) => ({ lat: l.latitude, lng: l.longitude }));

        if (friendCoords.length === 0) {
            injectJS(`panToMe(${myLocation.latitude}, ${myLocation.longitude}); true;`);
        } else {
            injectJS(
                `fitAll(${myLocation.latitude}, ${myLocation.longitude}, ${JSON.stringify(friendCoords)}); true;`
            );
        }
    };

    const friendCount = Object.values(othersLocations).filter(
        (l: any) => l.username !== userName
    ).length;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerOverlay}>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>Track Friends ({friendCount})</Text>
                    <Text style={styles.headerSub}>Group: {groupCode}</Text>
                </View>
                <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
            </View>

            {/* WebView Map */}
            <WebView
                ref={webViewRef}
                style={styles.map}
                originWhitelist={['*']}
                source={{ html: buildMapHTML(GOOGLE_API_KEY) }}
                javaScriptEnabled
                domStorageEnabled
                onLoadEnd={() => setMapReady(true)}
                mixedContentMode="always"
            />

            {/* Loading overlay — shown until we have our location */}
            {!myLocation && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#FF6B6B" />
                    <Text style={styles.loadingText}>Getting location...</Text>
                </View>
            )}

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={focusAll}>
                <Ionicons name="locate" size={24} color="#fff" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    map: { flex: 1 },
    headerOverlay: {
        position: 'absolute', top: 50, left: 20, right: 20,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 12, padding: 12,
        flexDirection: 'row', alignItems: 'center',
        zIndex: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 5,
    },
    closeBtn: { padding: 8, marginRight: 8 },
    headerInfo: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    headerSub: { fontSize: 12, color: '#666' },
    statusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 10 },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    loadingText: { marginTop: 10, color: '#666' },
    fab: {
        position: 'absolute', bottom: 40, right: 20,
        backgroundColor: '#007AFF', width: 56, height: 56, borderRadius: 28,
        justifyContent: 'center', alignItems: 'center', elevation: 6,
    },
});
