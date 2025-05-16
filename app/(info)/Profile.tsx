import { Images, ProfileInitials } from "@/assets/images";
import { Routes } from "@/constants/routes";
import { API_BASE_URL } from "@/utils/config";
import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type UserProfile = {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  pensionID: string;
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editField, setEditField] = useState<keyof UserProfile | "">("");
  const [tempValue, setTempValue] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const token = await SecureStore.getItemAsync("jwt");
        const res = await fetch(`${API_BASE_URL}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setProfile({
          firstname: data.details.firstname,
          lastname: data.details.lastname,
          email: data.email,
          phone: data.details.contact_num,
          address: data.details.address,
          dateOfBirth: new Date(data.details.dob).toLocaleDateString(),
          pensionID: data.pensioner_number,
        });
      } catch {
        Alert.alert("Error", "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleEditField = (field: keyof UserProfile, value: string) => {
    if (field === "email" || field === "phone") {
      setEditField(field);
      setTempValue(value);
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!editField || !profile) return;
    setLoading(true);
    try {
      const updated = { ...profile, [editField]: tempValue };
      setTimeout(() => {
        setProfile(updated);
        setIsEditing(false);
        setEditField("");
        setLoading(false);
        Alert.alert("Success", "Profile updated");
      }, 1000);
    } catch {
      Alert.alert("Error", "Failed to update");
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditField("");
  };

  const ProfileInfoItem = ({
    icon,
    label,
    value,
  }: {
    icon: React.ReactNode;
    label: keyof UserProfile;
    value: string;
  }) => (
    <View style={styles.infoItem}>
      <View style={styles.infoIconContainer}>{icon}</View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
      {(label === "email" || label === "phone") && (
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEditField(label, value)}
        >
          <MaterialIcons name="edit" size={20} color="#1F245E" />
        </TouchableOpacity>
      )}
    </View>
  );

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#1F245E" style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const profileLetter = profile.firstname.charAt(0).toUpperCase();
  const profileImage = ProfileInitials[profileLetter] ?? Images.ProfilePicAlt;

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
              onPress={() => router.replace(Routes.Home)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color="#1F245E" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileImageSection}>
            <View style={styles.profileImageContainer}>
              <Image source={profileImage} style={styles.profileImage} />
            </View>
            <Text style={styles.userName}>
              {profile.firstname} {profile.lastname}
            </Text>
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
              icon={<Ionicons name="location-outline" size={20} color="#1F245E" />}
              label="address"
              value={profile.address}
            />
            <ProfileInfoItem
              icon={<MaterialIcons name="cake" size={20} color="#1F245E" />}
              label="dateOfBirth"
              value={profile.dateOfBirth}
            />
          </View>

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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#1F245E" },
  closeButton: {
    position: "absolute",
    right: 20,
    top: 20,
    zIndex: 10,
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
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
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
  infoIconContainer: { width: 40, alignItems: "center" },
  infoContent: { flex: 1, marginLeft: 10 },
  infoLabel: { fontSize: 12, color: "#666" },
  infoValue: { fontSize: 16, color: "#333", marginTop: 2 },
  editButton: { padding: 8 },
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
  cancelButton: { backgroundColor: "#f2f2f2" },
  cancelButtonText: { color: "#666", fontWeight: "500" },
  saveButton: { backgroundColor: "#1F245E" },
  saveButtonText: { color: "#fff", fontWeight: "500" },
});
