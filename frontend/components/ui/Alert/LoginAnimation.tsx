import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

interface LoginAlertModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function LoginAlertModal({ visible, onClose }: LoginAlertModalProps) {
  const router = useRouter();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.alertOverlay}>
        <View style={styles.alertCard}>
          
          <View style={styles.alertIconBg}>
            <LottieView
              source={require('@/assets/images/Unlock.json')} // เช็ค path ให้ตรงกับโปรเจกต์ของคุณ
              autoPlay
              loop={true}
              style={{ width: 100, height: 100 }}
            />
          </View>

          <Text style={styles.alertTitle}>Authentication Required</Text>
          <Text style={styles.alertMessage}>Please log in to use this feature.</Text>

          <View style={styles.alertBtnRow}>
            <TouchableOpacity 
              style={styles.alertCancelBtn} 
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.alertCancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.alertConfirmBtn} 
              onPress={() => {
                onClose();
                router.push('/Login'); // เช็ค path หน้า Login ให้ตรง
              }}
              activeOpacity={0.8}
            >
              <LinearGradient 
                colors={['#FF6B6B', '#FF4757']} 
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} 
                style={styles.alertConfirmGradient}
              >
                <Text style={styles.alertConfirmText}>Login</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 99999, // ดันให้สูงทะลุทุกอย่าง
    elevation: 99999,
  },
  alertCard: {
    width: '90%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  alertIconBg: {
    width: 100, 
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  alertBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  alertCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCancelText: {
    color: '#666',
    fontSize: 15,
    fontWeight: 'bold',
  },
  alertConfirmBtn: {
    flex: 1,
    borderRadius: 16,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  alertConfirmGradient: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});