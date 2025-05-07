import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

type UserProfile = {
  name: string;
  pensionID: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  bankAccount: string;
  emergencyContact: string;
  profileImageUrl: string;
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile>({
    name: "John Brown",
    pensionID: "PEN-12345678",
    email: "johnbrown@example.com",
    phone: "+44 7123 456789",
    address: "123 London Street, London, UK",
    dateOfBirth: "15/04/1958",
    bankAccount: "XXXX-XXXX-XXXX-5678",
    emergencyContact: "Sarah Brown (+44 7123 456790)",
    profileImageUrl: Image.resolveAssetSource(
      require("../assets/images/profilepic.png")
    ).uri,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editField, setEditField] = useState<keyof UserProfile | "">("");
  const [tempValue, setTempValue] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();

  // Load profile from future backend
  useEffect(() => {
    const fetchProfile = async () => {
      // Simulate fetch
      // Future: Replace this with real API call
      // const response = await fetch('https://api.example.com/profile');
      // const data = await response.json();
      // setProfile(data);

      console.log("Profile fetched (simulated)");
    };

    fetchProfile();
  }, []);

  const handleEditField = (field: keyof UserProfile, value: string) => {
    setEditField(field);
    setTempValue(value);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editField) return;

    setLoading(true);

    try {
      const updatedProfile = { ...profile, [editField]: tempValue };

      // Future: Replace this with your real API call
      // const response = await fetch('/profile/update', { ... })
      // const data = await response.json();

      setTimeout(() => {
        setProfile(updatedProfile);
        setIsEditing(false);
        setEditField("");
        setLoading(false);
        Alert.alert("Success", "Your profile has been updated.");
      }, 1000);
    } catch (error) {
      Alert.alert("Error", "Update failed. Please try again.");
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditField("");
  };

  const uploadImageToServer = async (uri: string) => {
    // Placeholder for future file upload logic
    // Simulate returning an uploaded image URL
    return new Promise<string>((resolve) => {
      setTimeout(() => {
        resolve(uri);
      }, 1500);
    });
  };

  const handleChoosePhoto = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "You need access to your photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.8,
      aspect: [1, 1],
    });

    if (!result.canceled) {
      setLoading(true);
      setModalVisible(false);

      const uploadedUrl = await uploadImageToServer(result.assets[0].uri);

      setProfile((prev) => ({
        ...prev,
        profileImageUrl: uploadedUrl,
      }));

      setLoading(false);
      Alert.alert("Success", "Profile picture updated.");
    }
  };

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "You need camera access.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      aspect: [1, 1],
    });

    if (!result.canceled) {
      setLoading(true);
      setModalVisible(false);

      const uploadedUrl = await uploadImageToServer(result.assets[0].uri);

      setProfile((prev) => ({
        ...prev,
        profileImageUrl: uploadedUrl,
      }));

      setLoading(false);
      Alert.alert("Success", "Profile picture updated.");
    }
  };

  const ProfileInfoItem = ({
    icon,
    label,
    value,
    editable = true,
  }: {
    icon: React.ReactNode;
    label: keyof UserProfile;
    value: string;
    editable?: boolean;
  }) => (
    <View style={styles.infoItem}>
      <View style={styles.infoIconContainer}>{icon}</View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
      {editable && (
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEditField(label, value)}
        >
          <MaterialIcons name="edit" size={20} color="#1F245E" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>My Profile</Text>
            <TouchableOpacity
              onPress={() => router.replace("/(tabs)")}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color="#1F245E" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileImageSection}>
            <View style={styles.profileImageContainer}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#1F245E" />
                </View>
              ) : (
                <Image
                  source={{ uri: profile.profileImageUrl }}
                  style={styles.profileImage}
                />
              )}
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={() => setModalVisible(true)}
              >
                <Ionicons name="camera" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.userName}>{profile.name}</Text>
            <View style={styles.pensionIdContainer}>
              <FontAwesome5 name="id-card" size={12} color="#1F245E" />
              <Text style={styles.pensionId}>{profile.pensionID}</Text>
            </View>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <ProfileInfoItem
              icon={<MaterialIcons name="email" size={20} color="#1F245E" />}
              label="email"
              value={profile.email}
            />
            <ProfileInfoItem
              icon={<MaterialIcons name="phone" size={20} color="#1F245E" />}
              label="phone"
              value={profile.phone}
            />
            <ProfileInfoItem
              icon={
                <Ionicons name="location-outline" size={20} color="#1F245E" />
              }
              label="address"
              value={profile.address}
            />
            <ProfileInfoItem
              icon={<MaterialIcons name="cake" size={20} color="#1F245E" />}
              label="dateOfBirth"
              value={profile.dateOfBirth}
              editable={false}
            />
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Emergency Contact</Text>
            <ProfileInfoItem
              icon={
                <MaterialIcons name="contact-phone" size={20} color="#1F245E" />
              }
              label="emergencyContact"
              value={profile.emergencyContact}
            />
          </View>

          {/* Edit Modal */}
          {isEditing && (
            <View style={styles.editModal}>
              <View style={styles.editModalContent}>
                <Text style={styles.editModalTitle}>Edit {editField}</Text>
                <TextInput
                  style={styles.editInput}
                  value={tempValue}
                  onChangeText={setTempValue}
                  autoFocus
                />
                <View style={styles.editModalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={handleCancel}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={handleSave}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveButtonText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Photo Picker Modal */}
          <Modal
            visible={modalVisible}
            animationType="slide"
            transparent
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.photoModalContent}>
                <Text style={styles.photoModalTitle}>
                  Update Profile Picture
                </Text>
                <TouchableOpacity
                  style={styles.photoOption}
                  onPress={handleTakePhoto}
                >
                  <Ionicons name="camera" size={24} color="#1F245E" />
                  <Text style={styles.photoOptionText}>Take a Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoOption}
                  onPress={handleChoosePhoto}
                >
                  <Ionicons name="images" size={24} color="#1F245E" />
                  <Text style={styles.photoOptionText}>
                    Choose from Gallery
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoOption, styles.cancelPhotoOption]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelPhotoText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// reuse the same styles from your previous screen here (not repeated for brevity)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F245E",
  },
  profileImageSection: {
    alignItems: "center",
    paddingVertical: 25,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  profileImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#1F245E",
    overflow: "hidden",
    position: "relative",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
  },
  cameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#1F245E",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F245E",
    marginTop: 15,
  },
  pensionIdContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8eaf6",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginTop: 8,
  },
  pensionId: {
    fontSize: 12,
    color: "#1F245E",
    marginLeft: 5,
    fontWeight: "500",
  },
  infoSection: {
    backgroundColor: "#fff",
    marginTop: 15,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginHorizontal: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F245E",
    marginBottom: 15,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoIconContainer: {
    width: 40,
    alignItems: "center",
  },
  infoContent: {
    flex: 1,
    marginLeft: 10,
  },
  infoLabel: {
    fontSize: 12,
    color: "#666",
  },
  infoValue: {
    fontSize: 16,
    color: "#333",
    marginTop: 2,
  },
  editButton: {
    padding: 8,
  },
  editModal: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  editModalContent: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    width: "85%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F245E",
    marginBottom: 15,
  },
  editInput: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 5,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  editModalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: "#f2f2f2",
  },
  cancelButtonText: {
    color: "#666",
    fontWeight: "500",
  },
  saveButton: {
    backgroundColor: "#1F245E",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  photoModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  photoModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F245E",
    marginBottom: 20,
    textAlign: "center",
  },
  photoOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  photoOptionText: {
    fontSize: 16,
    marginLeft: 15,
    color: "#333",
  },
  cancelPhotoOption: {
    justifyContent: "center",
    marginTop: 10,
    borderBottomWidth: 0,
  },
  cancelPhotoText: {
    fontSize: 16,
    color: "#ff3b30",
    fontWeight: "500",
    textAlign: "center",
  },
  closeButton: {
    position: "absolute",
    right: 20,
    top: 20,
    zIndex: 10,
  },
});
