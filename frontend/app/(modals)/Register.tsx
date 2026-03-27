import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet, ScrollView, TouchableOpacity, Platform, Image  } from 'react-native';
import axios from 'axios';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_URL } from '@/api.js'
import { LinearGradient } from 'expo-linear-gradient';

export default function RegisterScreen({ navigation } : { navigation: any }) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone_number: '',
    birth_date: new Date(),
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = 'Required';
    if (!form.last_name.trim())  e.last_name  = 'Required';
    if (!form.email.trim())      e.email      = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format';
    if (!form.phone_number.trim()) e.phone_number = 'Required';
    else if (form.phone_number.length !== 10) e.phone_number = 'Must be 10 digits';
    if (!form.password)          e.password   = 'Required';
    else if (form.password.length < 6) e.password = 'At least 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    try {
      setLoading(true);
      const payload = {
        ...form,
        birth_date: form.birth_date.toISOString().split('T')[0],
      };

      await axios.post(`${API_URL}/register`, payload);

      Alert.alert(
        'Registration Successful!',
        `Welcome, ${form.first_name}!`,
        [{ text: 'Go to Sign In', onPress: () => router.push('/Login') }]
      );
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;

      if (status === 400) {
        setErrors(prev => ({ ...prev, email: 'Email already registered' }));
      } else if (status === 422) {
        Alert.alert('Invalid Input', detail || 'Please check your information');
      } else if (status === 500) {
        Alert.alert('Server Error', 'Something went wrong. Please try again later.');
      } else if (!err?.response) {
        Alert.alert('Connection Error', 'Cannot connect to server. Check your internet connection.');
      } else {
        Alert.alert('Registration Failed', detail || 'Unable to create account');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setForm({ ...form, birth_date: selectedDate });
    }
  };


  const handleBackToLogin = () => {
     router.push('/Login');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          <Image 
          source={require('../../assets/images/adaptive-icon.png')}
          style={styles.tabigologo}
          ></Image>
          <Text style={styles.title}>Create Account</Text>
          <TextInput
            style={[styles.input, errors.first_name && styles.inputError]}
            placeholder="First Name"
            value={form.first_name}
            onChangeText={(text) => { setForm({ ...form, first_name: text }); setErrors(e => ({ ...e, first_name: '' })); }}
          />
          {errors.first_name ? <Text style={styles.errorText}>{errors.first_name}</Text> : null}

          <TextInput
            style={[styles.input, errors.last_name && styles.inputError]}
            placeholder="Last Name"
            value={form.last_name}
            onChangeText={(text) => { setForm({ ...form, last_name: text }); setErrors(e => ({ ...e, last_name: '' })); }}
          />
          {errors.last_name ? <Text style={styles.errorText}>{errors.last_name}</Text> : null}

          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.email}
            onChangeText={(text) => { setForm({ ...form, email: text }); setErrors(e => ({ ...e, email: '' })); }}
          />
          {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

          <TextInput
            style={[styles.input, errors.phone_number && styles.inputError]}
            placeholder="Phone Number"
            keyboardType="phone-pad"
            value={form.phone_number}
            onChangeText={(text) => { setForm({ ...form, phone_number: text }); setErrors(e => ({ ...e, phone_number: '' })); }}
          />
          {errors.phone_number ? <Text style={styles.errorText}>{errors.phone_number}</Text> : null}

          {/* Date of Birth */}
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateInput}>
            <Text style={styles.dateText}>
              Date of Birth: {form.birth_date.toLocaleDateString('en-GB')}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={form.birth_date}
              mode="date"
              display={Platform.OS === 'android' ? 'calendar' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}

          <TextInput
            style={[styles.input, errors.password && styles.inputError]}
            placeholder="Password"
            secureTextEntry
            value={form.password}
            onChangeText={(text) => { setForm({ ...form, password: text }); setErrors(e => ({ ...e, password: '' })); }}
          />
          {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

          <TouchableOpacity onPress={handleRegister} disabled={loading} style={styles.buttonContainer}>
            <LinearGradient
              colors={['#fc8c54ff', '#FF5E62']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.gradientButton, loading && { opacity: 0.7 }]}
            >
              <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create Account'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={handleBackToLogin}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>

    
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  formContainer: {
    width: '100%',
    maxWidth: 350,
    alignSelf: 'center',
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
  dateInput: {
    width: '100%',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    borderColor: '#ddd',
    borderWidth: 1,
  },
  dateText: { fontSize: 16, color: '#333' },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
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
  tabigologo :{
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  loginContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginText: {
    color: '#666',
    fontSize: 16,
  },
  loginLink: {
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
