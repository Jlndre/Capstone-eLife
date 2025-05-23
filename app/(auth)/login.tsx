import { Images } from "@/assets/images";
import { Routes } from "@/constants/routes";
import { API_BASE_URL } from "@/utils/config";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

const { width, height } = Dimensions.get("window");

interface LoginCredentials {
  userId: string;
  password: string;
}

const LoginScreen: React.FC = () => {
  const router = useRouter();

  const [credentials, setCredentials] = useState<LoginCredentials>({ userId: "", password: "" });
  const [errors, setErrors] = useState<Partial<LoginCredentials>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isButtonActive, setIsButtonActive] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const { userId, password } = credentials;
    setIsButtonActive(userId.trim() !== "" && password.trim() !== "");
  }, [credentials]);

  const formatPensionerId = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handleChange = (field: keyof LoginCredentials, value: string) => {
    const updatedValue = field === "userId" ? formatPensionerId(value) : value;
    setCredentials((prev) => ({ ...prev, [field]: updatedValue }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<LoginCredentials> = {};
    if (!/^\d{3}-\d{3}-\d{4}$/.test(credentials.userId)) newErrors.userId = "Please enter a valid ID in format 000-000-0000";
    if (credentials.password.length < 8) newErrors.password = "Password must be at least 8 characters";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pensioner_number: credentials.userId.replace(/-/g, ""),
          password: credentials.password,
        }),
      });

      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (data.token) {
          await SecureStore.setItemAsync("jwt", data.token);
          router.replace(Routes.Home);
        } else {
          Alert.alert("Login failed", data.message || "Unknown error occurred");
        }
      } catch (err) {
        console.error("JSON parse error:", err);
        Alert.alert("Error", "Unexpected server response. Please check backend logs.");
      }
    } catch (err) {
      console.error("Login error:", err);
      Alert.alert("Error", "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      "Reset Password",
      "Instructions to reset your password will be sent to your registered email.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: () => console.log("Reset password") },
      ]
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={[styles.imageContainer, keyboardVisible && styles.imageContainerSmall]}>
            <ImageBackground source={Images.LoginHeader} style={styles.image} resizeMode="cover">
              <View style={styles.curve}>
                <Svg height="100%" width="100%" viewBox="0 0 1440 200">
                  <Path
                    fill="#fff"
                    d="M0,128L48,138.7C96,149,192,171,288,160C384,149,480,107,576,112C672,117,768,171,864,186.7C960,203,1056,181,1152,154.7C1248,128,1344,96,1392,80L1440,64L1440,200L0,200Z"
                  />
                </Svg>
              </View>
            </ImageBackground>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.loginText}>Login</Text>

            <Text style={styles.label}>User ID:</Text>
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="000-000-0000"
                style={[styles.input, errors.userId && styles.inputError]}
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                value={credentials.userId}
                onChangeText={(text) => handleChange("userId", text)}
                maxLength={12}
              />
              {credentials.userId && (
                <TouchableOpacity style={styles.clearButton} onPress={() => handleChange("userId", "")}> 
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            {errors.userId ? (
              <Text style={styles.errorText}>{errors.userId}</Text>
            ) : (
              <Text style={styles.helperText}>Enter your ID in format: 000-000-0000</Text>
            )}

            <Text style={styles.label}>Password:</Text>
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="Enter your password"
                style={[styles.input, errors.password && styles.inputError]}
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                value={credentials.password}
                onChangeText={(text) => handleChange("password", text)}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={22} color="#0B1741" />
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

            <TouchableOpacity
              style={[styles.signInButton, isButtonActive ? styles.activeButton : styles.inactiveButton]}
              onPress={handleLogin}
              disabled={!isButtonActive || isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signInText}>Sign In</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.forgotContainer} onPress={handleForgotPassword}>
              <Text style={styles.forgotText}>
                Forgot Password? <Text style={styles.resetText}>Reset here</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  imageContainer: {
    height: height * 0.35,
  },
  imageContainerSmall: {
    height: height * 0.2,
  },
  image: {
    flex: 1,
    justifyContent: "flex-end",
  },
  curve: {
    position: "absolute",
    bottom: -32,
    width: "100%",
    height: 120,
    zIndex: 5,
  },
  formContainer: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  loginText: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0B1741",
    marginBottom: 24,
  },
  label: {
    fontWeight: "600",
    fontSize: 15,
    color: "#0B1741",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  input: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 15,
    color: "#0B1741",
  },
  inputError: {
    borderColor: "#e74c3c",
    borderWidth: 1,
  },
  clearButton: {
    position: "absolute",
    right: 15,
    padding: 5,
  },
  eyeButton: {
    position: "absolute",
    right: 15,
    padding: 5,
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 12,
    marginBottom: 16,
    marginTop: 4,
  },
  helperText: {
    color: "#777",
    fontSize: 12,
    marginBottom: 16,
    marginTop: 4,
  },
  signInButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activeButton: {
    backgroundColor: "#0B1741",
  },
  inactiveButton: {
    backgroundColor: "#ccc",
  },
  signInText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  forgotContainer: {
    padding: 10,
    alignItems: "center",
  },
  forgotText: {
    textAlign: "center",
    color: "#555",
    fontSize: 14,
  },
  resetText: {
    fontWeight: "bold",
    color: "#CF393B",
  },
  footer: {
    marginTop: "auto",
    marginBottom: 20,
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: "#555",
  },
});
