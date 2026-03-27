import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet, TouchableOpacity, Image} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { showMessage } from 'react-native-flash-message';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '@/api.js'

// Sync locally-saved onboarding preferences to backend after login
const syncPreferencesIfPending = async (token: string) => {
  try {
    const raw = await AsyncStorage.getItem('onboarding_answers');
    if (!raw) return;
    const answers = JSON.parse(raw);
    if (!answers.travel_style || !answers.trip_length) return;
    await axios.post(
      `${API_URL}/user/preferences`,
      {
        travel_style: answers.travel_style,
        interests: (answers.interests as string[]) ?? [],
        trip_length: answers.trip_length,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (_) {}
};

import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
  isErrorWithCode
} from '@react-native-google-signin/google-signin';



export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigation = useNavigation();
  const router = useRouter();

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: "1061030412176-tmtkq6rgmr4biqpr8ir1sk902od0mu1e.apps.googleusercontent.com",
    });
  }, []);

  const validate = () => {
    const e: { email?: string; password?: string } = {};
    if (!email.trim()) e.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Invalid email format';
    if (!password) e.password = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    try {
      setIsSubmitting(true);
      const response = await axios.post(`${API_URL}/login`, { email, password });
      const { token, refresh_token } = response.data;
      await AsyncStorage.setItem('access_token', token);
      await AsyncStorage.setItem('refresh_token', refresh_token);
      await syncPreferencesIfPending(token);
      router.push('/(tabs)/profile');
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 401) {
        setErrors({ email: ' ', password: 'Invalid email or password' });
      } else if (status === 403) {
        Alert.alert('Already Signed In', 'This account is logged in on another device.', [{ text: 'OK' }]);
      } else if (!err?.response) {
        Alert.alert('Connection Error', 'Cannot connect to server. Check your internet connection.');
      } else {
        Alert.alert('Login Failed', detail || 'Something went wrong.', [{ text: 'Try Again' }]);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Alert.alert('เข้าสู่ระบบด้วย Google');
  try {
    console.log('Starting Google Sign-In...');
    setIsSubmitting(true);
    
    // Check Play Services availability
    await GoogleSignin.hasPlayServices();
    
    const response = await GoogleSignin.signIn();
    console.log('Sign-in response:', response);
    
    if (isSuccessResponse(response)) {
      const { idToken, user } = response.data;
      const name = user.name || "";  // fallback in case null
      const email = user.email;
      const photo = user.photo || "";
      
      console.log('Google Sign-In successful:', { name, email });

      const backendRes = await axios.post(`${API_URL}/google-login`, { token: idToken });
      const { token, refresh_token } = backendRes.data;
    

      await AsyncStorage.setItem('access_token', token);
      await AsyncStorage.setItem('refresh_token', refresh_token);
      await syncPreferencesIfPending(token);

      router.push({
        pathname: '/(tabs)/profile',
        params: { name, email, photo }
      });
    } else {
      Alert.alert('Sign in cancelled or failed');
    }
  } catch (error : any) {
    console.error('Google Sign-In error:', error);
    
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          console.log('User cancelled');
          break;
        case statusCodes.IN_PROGRESS:
          Alert.alert('Sign in is in progress');
          break;
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          Alert.alert('Play services not available');
          break;
        default:
          Alert.alert('Error', error.message);
      }
    } else {
     if (error.response) {
             Alert.alert("Login Failed", `Server Error: ${error.response.status}`);
        } else {
             Alert.alert("Error", error.message || "Unknown error");
      }
    }
  } finally {
    setIsSubmitting(false);
  }
};
   const handleRegister = () => {
     router.push('/Register');
  };


  return (
    <View style={styles.container}>
      <View style={styles.formContainer}>
        <Image 
        source={require('../../assets/images/adaptive-icon.png')}
        style={styles.tabigologo}>
        </Image>
        <Text style={styles.title}>Sign In</Text>

        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          placeholder="Email"
          value={email}
          onChangeText={(t) => { setEmail(t); setErrors(e => ({ ...e, email: undefined })); }}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {errors.email?.trim() ? <Text style={styles.errorText}>{errors.email}</Text> : null}

        <TextInput
          style={[styles.input, errors.password && styles.inputError]}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={(t) => { setPassword(t); setErrors(e => ({ ...e, password: undefined })); }}
        />
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

        <TouchableOpacity onPress={handleLogin} style={styles.buttonContainer} disabled={isSubmitting}>
          <LinearGradient
            colors={['#fc8c54ff', '#FF5E62']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.gradientButton, isSubmitting && { opacity: 0.7 }]}
          >
            <Text style={styles.buttonText}>{isSubmitting ? 'Signing in...' : 'Sign In'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
          <View style={styles.googleButtonContent}>
            <Image
               source={require('../../assets/images/googlelogo.png')}
              style={styles.googleLogo}
            />
            <Text style={styles.googleButtonText}>Sign in with Google</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={handleRegister}>
            <Text style={styles.registerLink}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  formContainer: {
    width: '100%',
    maxWidth: 350,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 10,
    marginBottom: 20,
  },
  gradientButton: {
    padding: 15,
    alignItems: 'center',
    borderRadius: 16,
    width: '100%',
  },
  buttonText: {
    backgroundColor: 'transparent',
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 15,
    color: '#666',
    fontSize: 14,
  },
  googleButton: {
    width: '100%',
    backgroundColor: 'black',
    padding: 15,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
   googleLogo: {
    width: 18,
    height: 18,
    marginRight: 10,
  },
  tabigologo:{
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  googleButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
   googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
   registerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  registerText: {
    color: '#666',
    fontSize: 16,
  },
  registerLink: {
    color: '#fc9a4fff',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  inputError: {
    borderColor: '#FF5E62',
    backgroundColor: '#fff5f5',
  },
  errorText: {
    color: '#FF5E62',
    fontSize: 12,
    alignSelf: 'flex-start',
    marginTop: -10,
    marginBottom: 8,
  },
});
