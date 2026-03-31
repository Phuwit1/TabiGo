import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, FlatList, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '@/api.js'

// ─── Japanese Palette ──────────────────────────────────────────────────────────
const BENI         = '#C0392B';
const KINCHA       = '#B8963E';
const KINCHA_LIGHT = '#D4AF55';
const SUMI         = '#1C1410';
const WASHI        = '#FAF5EC';
const WASHI_DARK   = '#EDE5D8';
const INK_60       = 'rgba(28,20,16,0.6)';
const INK_20       = 'rgba(28,20,16,0.12)';

// 1. Interfaces match the JSON structure 
interface FlightTime {
  utc?: string;
  local?: string;
}

interface DepartureInfo {
  origin_code: string;
  origin_name: string;
  gate_dep?: string;
  terminal_dep?: string;
  schedule_dep_time: FlightTime;
  revised_dep_time?: FlightTime;
}

interface ArrivalInfo {
  dest_code: string;
  dest_name: string;
  gate_arr?: string;
  terminal_arr?: string;
  baggageBelt?: string;
  schedule_arr_time: FlightTime;
  revised_arr_time?: FlightTime;
}

// Main Interface
interface FlightData {
  flight_number: string;
  airline: string;
  status: string;
  aircraft: string;
  departure: DepartureInfo;
  arrival: ArrivalInfo;
}

interface FlightSearchProps {
  visible: boolean;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

export default function FlightSearch({ visible, onClose }: FlightSearchProps) {
  const [FlightNumber, setFlightNumber] = useState('');
  const [flightResults, setFlightResults] = useState<FlightData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchToken = async () => {
    const token = await AsyncStorage.getItem('access_token');
    return token;
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) {
      return isoString;
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch (e) {
      return '';
    }
  }

  const handleSearch = async () => {
    setLoading(true);
    setFlightResults([]);
    
    const token = await fetchToken();
    if (!token) {
      Alert.alert('Error', 'No access. Please log in before searching for flights.');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/flight/${FlightNumber}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      });

      // console.log('Flight search results:', response.data);
      // check log
      
      if (Array.isArray(response.data)) {
        setFlightResults(response.data);
      } else {
        setFlightResults([response.data]);
      }

    } catch (error) {
      console.log(error);
      Alert.alert('Not Found', 'Flight not found or an error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const TimeDisplay = ({ scheduled, revised }: { scheduled?: string, revised?: string }) => {
    const scheduledTime = formatTime(scheduled);
    const revisedTime = formatTime(revised);

    const hasChange = revised && revisedTime !== scheduledTime && revisedTime !== '-';

    if (hasChange) {
      return (
        <View style={styles.timeContainer}>
          {/* เวลาใหม่ (Revised) สีเขียว ตัวใหญ่ */}
          <Text style={[styles.timeText, styles.revisedTimeText]}>
            {revisedTime}
          </Text>
          {/* เวลาเดิม (Scheduled) สีเทา ขีดฆ่า ตัวเล็ก */}
          <Text style={styles.scheduledTimeText}>{scheduledTime}</Text>
        </View>
      );
    }

    // ถ้าเวลาไม่เปลี่ยน แสดงเวลาเดิมปกติ
    return <Text style={styles.timeText}>{scheduledTime}</Text>;
  };

  // 2. Render Card 
  const renderFlightItem = ({ item }: { item: FlightData }) => (
    <View style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.airlineText}>{item.airline}</Text>
          <Text style={styles.flightNumText}>{item.flight_number}</Text>
        </View>
        <View style={[styles.statusBadge,
        { backgroundColor: item.status === 'Arrived' ? 'rgba(184,150,62,0.15)' : 'rgba(192,57,43,0.1)' }
        ]}>
          <Text style={[styles.statusText,
          { color: item.status === 'Arrived' ? KINCHA : BENI }
          ]}>
            {item.status}
          </Text>
        </View>
      </View>

      {/* Route & Time */}
      <View style={styles.routeContainer}>
        <View style={styles.locationBlock}>
          <Text style={styles.codeText}>{item.departure.origin_code}</Text>
          <TimeDisplay
            scheduled={item.departure.schedule_dep_time?.local}
            revised={item.departure.revised_dep_time?.local}
          />
          <Text style={styles.dateText}>{formatDate(item.departure.schedule_dep_time?.local)}</Text>
        </View>

        {/* Arrow */}
        <View style={styles.planeIconBlock}>
          <Ionicons name="airplane" size={20} color={KINCHA_LIGHT} />
          <Text style={styles.durationText}>→</Text>
        </View>

        <View style={styles.locationBlock}>
          <Text style={styles.codeText}>{item.arrival.dest_code}</Text>
          <TimeDisplay
            scheduled={item.arrival.schedule_arr_time?.local}
            revised={item.arrival.revised_arr_time?.local}
          />
          <Text style={styles.dateText}>{formatDate(item.arrival.schedule_arr_time?.local)}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Footer Info */}
      <View style={styles.footerContainer}>

        <View style={styles.footerColumnLeft}>
          <Text style={styles.footerHeader}>DEPARTURE</Text>
          
          <View style={styles.rowInfo}>
            <Text style={styles.infoLabel}>Terminal:</Text>
            <Text style={styles.infoValue}>{item.departure.terminal_dep || '-'}</Text> 
          </View>

          <View style={styles.rowInfo}>
            <Text style={styles.infoLabel}>Gate:</Text>
            <Text style={styles.infoValue}>{item.departure.gate_dep || '-'}</Text>
          </View>
        </View>

        <View style={styles.verticalDivider} />

        {/* ฝั่งขวา: ขาเข้า (Arrival) */}
        <View style={styles.footerColumnRight}>
          <Text style={styles.footerHeader}>ARRIVAL</Text>
          
          <View style={styles.rowInfo}>
            <Text style={styles.infoLabel}>Terminal:</Text>
            <Text style={styles.infoValue}>{item.arrival.terminal_arr || '-'}</Text>
          </View>

          <View style={styles.rowInfo}>
            <Text style={styles.infoLabel}>Gate:</Text>
            <Text style={styles.infoValue}>{item.arrival.gate_arr || '-'}</Text>
          </View>

          <View style={styles.rowInfo}>
            <Text style={styles.infoLabel}>Belt:</Text>
            <Text style={styles.infoValue}>{item.arrival.baggageBelt || '-'}</Text>
          </View>
        </View>

      </View>
    </View>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalView}>

          {/* Header Modal */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Flight Search</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={SUMI} />
            </TouchableOpacity>
          </View>

          {/* Search Form */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Flight Number (e.g. SQ719)</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="airplane-outline" size={20} color={KINCHA} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                placeholder="Search..."
                value={FlightNumber}
                onChangeText={setFlightNumber}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
            <Text style={styles.searchBtnText}>{loading ? 'Searching...' : 'Search'}</Text>
          </TouchableOpacity>

          {/* 3. Result Section (Swipeable) */}
          {flightResults.length > 0 && (
            <View style={styles.resultSection}>
              <Text style={styles.resultTitle}>
                Found {flightResults.length} flights
                {flightResults.length > 1 && <Text style={{ fontSize: 12, fontWeight: 'normal', color: '#666' }}> (Swipe for more)</Text>}
              </Text>

              <FlatList
                data={flightResults}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => index.toString()}
                renderItem={renderFlightItem}
                contentContainerStyle={{ paddingVertical: 10 }}
              />

              {/* Dots Indicator */}
              {flightResults.length > 1 && (
                <View style={styles.pagination}>
                  {flightResults.map((_, i) => (
                    <View key={i} style={styles.dot} />
                  ))}
                </View>
              )}
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(28,20,16,0.55)',
  },
  modalView: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: WASHI,
    borderRadius: 16,
    padding: 20,
    borderTopWidth: 3,
    borderTopColor: BENI,
    shadowColor: SUMI,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: SUMI,
    letterSpacing: 0.5,
  },
  formGroup: {
    marginBottom: 10,
  },
  label: {
    marginBottom: 5,
    color: INK_60,
    fontWeight: '500',
    fontSize: 13,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: WASHI_DARK,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: WASHI_DARK,
    height: 45,
  },
  input: {
    flex: 1,
    height: '100%',
    color: SUMI,
  },
  searchBtn: {
    backgroundColor: BENI,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: BENI,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  searchBtnText: {
    color: WASHI,
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  resultSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: WASHI_DARK,
    paddingTop: 10,
    alignItems: 'center',
  },
  resultTitle: {
    alignSelf: 'flex-start',
    fontWeight: 'bold',
    color: SUMI,
    marginBottom: 5,
    fontSize: 13,
  },
  cardContainer: {
    width: width * 0.8,
    backgroundColor: WASHI,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: WASHI_DARK,
    padding: 15,
    marginHorizontal: 5,
    shadowColor: SUMI,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  airlineText: {
    fontSize: 12,
    color: INK_60,
  },
  flightNumText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: SUMI,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  routeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  locationBlock: {
    alignItems: 'center',
    flex: 1,
    minHeight: 65,
    justifyContent: 'flex-start',
  },
  codeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: BENI,
    marginBottom: 4,
  },
  timeContainer: {
    alignItems: 'center',
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    color: SUMI,
  },
  revisedTimeText: {
    color: KINCHA,
    fontSize: 18,
    fontWeight: 'bold',
  },
  scheduledTimeText: {
    fontSize: 12,
    color: INK_60,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  dateText: {
    fontSize: 12,
    color: INK_60,
    marginTop: 4,
  },
  planeIconBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginTop: 10,
  },
  durationText: {
    fontSize: 12,
    color: WASHI_DARK,
    marginTop: -5,
  },
  divider: {
    height: 1,
    backgroundColor: WASHI_DARK,
    marginBottom: 10,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 5,
  },
  footerColumnLeft: {
    flex: 1,
    alignItems: 'flex-start',
    paddingRight: 10,
  },
  footerColumnRight: {
    flex: 1,
    alignItems: 'flex-end',
    paddingLeft: 10,
  },
  verticalDivider: {
    width: 1,
    backgroundColor: WASHI_DARK,
    marginHorizontal: 5,
  },
  footerHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    color: KINCHA,
    marginBottom: 4,
    letterSpacing: 0.8,
  },
  rowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  infoLabel: {
    fontSize: 12,
    color: INK_60,
    marginRight: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: SUMI,
  },
  pagination: {
    flexDirection: 'row',
    marginTop: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: WASHI_DARK,
    marginHorizontal: 3,
  }
});
