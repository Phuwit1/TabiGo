import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/api.js';

// Import สำหรับ UI
import { LinearGradient } from 'expo-linear-gradient';
import ApproveAnimation from '@/components/ui/Alert/ApproveAnimation'; 
import WrongAnimation from '@/components/ui/Alert/WrongAnimation';
import LottieView from 'lottie-react-native';

export default function JoinTripModal({ isVisible, onClose }: { isVisible?: boolean, onClose?: () => void }) {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [tripDetails, setTripDetails] = useState<any>(null);

  // --- State สำหรับ Custom Alert ---
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    isSuccess: false,
    onConfirm: () => {}, 
  });

  const showCustomAlert = (title: string, message: string, isSuccess = false, onConfirm = () => {}) => {
    setAlertConfig({ visible: true, title, message, isSuccess, onConfirm });
  };

  const closeAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
    if (alertConfig.onConfirm) alertConfig.onConfirm();
  };

  useEffect(() => {
    if (params.code) {
      setCode(params.code as string);
      fetchTripDetails(params.code as string);
    }
  }, [params.code]);

  const fetchTripDetails = async (searchCode: string) => {
    if (!searchCode) return;
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(
        `${API_URL}/trip_group/code/${searchCode}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setTripDetails(response.data);
      setStep('preview'); 
    } catch (error) {
      showCustomAlert("Error", "ไม่พบกลุ่ม หรือ รหัสไม่ถูกต้อง", false, () => setCode(''));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmJoin = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/trip_group/join`,
        { unique_code: code },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showCustomAlert("Success!", "เข้าร่วมกลุ่มสำเร็จ", true, () => {
        handleClose(); 
        router.replace('/(tabs)/mytrip'); 
      });
    } catch (error) {
      showCustomAlert("Error", "ไม่สามารถเข้าร่วมกลุ่มได้", false);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose(); 
    } else {
      router.back(); 
    }
  };

  return (
    <Modal
      visible={isVisible !== undefined ? isVisible : true}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          
          {/* Header */}
          <View style={styles.header}>
             <Text style={styles.title}>{step === 'input' ? 'Join a Trip' : 'Trip Details'}</Text>
             <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
               <Ionicons name="close" size={20} color="#666" />
             </TouchableOpacity>
          </View>

          {step === 'input' ? (
            /* --- หน้า 1: กรอก Code --- */
            <View style={styles.contentContainer}>
              <Text style={styles.label}>INVITE CODE</Text>
              <TextInput 
                style={styles.input}
                placeholder="e.g. A1B2C3D4"
                placeholderTextColor="#A0AEC0"
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                maxLength={8}
              />
              
              <TouchableOpacity 
                style={[styles.mainButton, (!code || loading) && styles.disabledButton]} 
                onPress={() => fetchTripDetails(code)}
                disabled={!code || loading}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={(!code || loading) ? ['#CBD5E0', '#A0AEC0'] : ['#FFA500', '#FF7B00']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  <Text style={styles.buttonText}>{loading ? 'Searching...' : 'Search Trip'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            /* --- หน้า 2: Preview --- */
            <View style={styles.contentContainer}>
              <View style={styles.previewBox}>
                <View style={styles.iconWrapper}>
                   <Ionicons name="airplane" size={36} color="#FF7B00" />
                </View>
                <Text style={styles.tripName}>{tripDetails?.name_group}</Text>
                <Text style={styles.ownerText}>Created by <Text style={{fontWeight: 'bold', color: '#4A5568'}}>{tripDetails?.owner_name}</Text></Text>
                
                <View style={styles.divider} />
                
                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="people" size={16} color="#FF7B00" />
                    </View>
                    <View>
                      <Text style={styles.infoLabel}>Members</Text>
                      <Text style={styles.infoValue}>{tripDetails?.member_count} People</Text>
                    </View>
                  </View>
                  
                  <View style={styles.infoItem}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="calendar" size={16} color="#FF7B00" />
                    </View>
                    <View>
                      <Text style={styles.infoLabel}>Dates</Text>
                      <Text style={styles.infoValue}>
                        {new Date(tripDetails?.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - {new Date(tripDetails?.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  </View>
                </View>

                {tripDetails?.is_member && (
                   <View style={styles.alreadyMemberBadge}>
                     <Ionicons name="checkmark-circle" size={16} color="#38A169" />
                     <Text style={styles.alreadyMemberText}>You are already in this trip</Text>
                   </View>
                )}
              </View>

              <TouchableOpacity 
                style={[styles.mainButton, tripDetails?.is_member && styles.disabledButton]} 
                onPress={handleConfirmJoin}
                disabled={loading || tripDetails?.is_member}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={(loading || tripDetails?.is_member) ? ['#CBD5E0', '#A0AEC0'] : ['#FFA500', '#FF7B00']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>{tripDetails?.is_member ? "Joined" : "Confirm Join"}</Text>}
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => setStep('input')} style={styles.backButton}>
                  <Text style={styles.backButtonText}>Search Another Code</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingBox}>
              <LottieView
                source={require('@/assets/images/CreateTrip/Airplane.json')}
                autoPlay
                loop
                style={{ width: 150, height: 150 }}
              />
              <Text style={[styles.loadingText, { marginTop: -20 }]}>Please wait...</Text>
            </View>
          </View>
        )}

        {/* 🌸 Custom Alert Overlay 🌸 */}
        {alertConfig.visible && (
          <View style={styles.alertOverlay}>
            <View style={styles.alertCard}>
              {alertConfig.isSuccess ? (
                <ApproveAnimation size={120} loop={false} />
              ) : (
                <WrongAnimation size={120} loop={false} />
              )}
              <Text style={styles.alertTitle}>{alertConfig.title}</Text>
              <Text style={styles.alertMessage}>{alertConfig.message}</Text>
              <TouchableOpacity style={styles.alertBtn} onPress={closeAlert} activeOpacity={0.8}>
                <LinearGradient 
                  colors={alertConfig.isSuccess ? ['#48BB78', '#38A169'] : ['#FC8181', '#E53E3E']} 
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} 
                  style={styles.alertBtnGradient}
                >
                  <Text style={styles.buttonText}>OK</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // --- Main Layout ---
  overlay: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.5)' 
  },
  card: { 
    width: '88%', 
    maxWidth: 400,
    backgroundColor: '#FFFFFF', 
    borderRadius: 28, 
    padding: 24, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 24 
  },
  title: { 
    fontSize: 22, 
    fontWeight: '800', 
    color: '#2D3748' 
  },
  closeButton: {
    backgroundColor: '#F7FAFC',
    borderRadius: 20,
    padding: 8,
  },
  contentContainer: {
    width: '100%',
  },

  // --- Input Step ---
  label: { 
    fontSize: 12, 
    fontWeight: '700',
    color: '#A0AEC0', 
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: { 
    backgroundColor: '#F7FAFC',
    borderWidth: 1.5, 
    borderColor: '#EDF2F7', 
    borderRadius: 16, 
    padding: 16, 
    fontSize: 20, 
    fontWeight: '600',
    textAlign: 'center', 
    color: '#2D3748',
    marginBottom: 24, 
  },

  // --- Buttons ---
  mainButton: { 
    borderRadius: 16,
    shadowColor: '#FF7B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  gradientButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: { 
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: { 
    color: '#FFFFFF', 
    fontWeight: 'bold', 
    fontSize: 16,
    letterSpacing: 0.5,
  },
  backButton: { 
    marginTop: 16, 
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonText: { 
    color: '#718096', 
    fontSize: 14,
    fontWeight: '600'
  },

  // --- Preview Step ---
  previewBox: { 
    backgroundColor: '#F7FAFC',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center', 
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  iconWrapper: { 
    width: 72, 
    height: 72, 
    borderRadius: 36, 
    backgroundColor: '#FFEDD5', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  tripName: { 
    fontSize: 22, 
    fontWeight: '800', 
    color: '#2D3748',
    textAlign: 'center',
    marginBottom: 6,
  },
  ownerText: { 
    color: '#718096', 
    fontSize: 14,
    marginBottom: 16,
  },
  divider: { 
    height: 1, 
    backgroundColor: '#E2E8F0', 
    width: '100%', 
    marginBottom: 16 
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#A0AEC0',
    fontWeight: '600',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    color: '#4A5568',
    fontWeight: '700',
  },
  alreadyMemberBadge: { 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FFF4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 20,
  },
  alreadyMemberText: { 
    color: '#2F855A', 
    fontWeight: '700', 
    fontSize: 13,
    marginLeft: 6,
  },

  // --- Custom Alert Styles ---
  alertOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 9999, 
    elevation: 9999,
  },
  alertCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  alertTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2D3748',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 15,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  alertBtn: {
    width: '100%',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  alertBtnGradient: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9998, // ให้อยู่ใต้ Alert 1 ระดับเผื่อเกิด Error
    elevation: 9998,
  },
  loadingBox: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A5568',
  },
});