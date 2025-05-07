import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Dimensions,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "expo-camera";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

interface FileData {
  uri: string;
  name: string;
  type: string;
}

const UploadPhotoIDScreen = () => {
  const router = useRouter();
  const [file, setFile] = useState<FileData | null>(null);

  useEffect(() => {
    (async () => {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        alert("We need permissions to access your photo library.");
      }
    })();
  }, []);

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setFile({
        uri: asset.uri,
        name: asset.fileName || "photo.jpg",
        type: asset.type || "image/jpeg",
      });
    }
  };

  const pickFromCamera = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== "granted") {
      alert("Camera permission is required!");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setFile({
        uri: asset.uri,
        name: asset.fileName || "photo.jpg",
        type: asset.type || "image/jpeg",
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerSection}>
        <Text style={styles.stepTitle}>Step 1: Upload Photo ID</Text>
        <Text style={styles.instruction}>
          Please upload a valid government issued photo ID eg. NIDS Card,
          National ID, Driver's License, Passport.
        </Text>
        <View style={styles.curve}>
          <Svg height="100%" width="100%" viewBox="0 0 1440 320">
            <Path
              fill="#FFFFFF"
              d="M0,160L48,170.7C96,181,192,203,288,192C384,181,480,139,576,117.3C672,96,768,96,864,112C960,128,1056,160,1152,160C1248,160,1344,128,1392,112L1440,96L1440,320L0,320Z"
            />
          </Svg>
        </View>
      </View>

      <Image
        source={require("../assets/images/id-graphic.png")}
        style={styles.idImage}
        resizeMode="contain"
      />

      <View style={styles.uploadCard}>
        <TouchableOpacity style={styles.uploadButton} onPress={pickFromCamera}>
          <Ionicons
            name="camera"
            size={20}
            color="white"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.uploadText}>Use Camera</Text>
        </TouchableOpacity>

        <View style={styles.separatorRow}>
          <View style={styles.separator} />
          <Text style={styles.orText}>or</Text>
          <View style={styles.separator} />
        </View>

        <TouchableOpacity style={styles.uploadButton} onPress={pickFromGallery}>
          <MaterialIcons
            name="photo-library"
            size={20}
            color="white"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.uploadText}>Select Photo from Gallery</Text>
        </TouchableOpacity>

        <Text style={styles.fileTypesText}>
          Accepted Photo types: .png, .jpg
        </Text>

        {file && (
          <View style={styles.filePreview}>
            <MaterialIcons name="insert-drive-file" size={32} color="#282C64" />
            <Text style={styles.fileName}>{file.name}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.push("/StartProcess")}
      >
        <Text style={styles.backButtonText}>Go back</Text>
      </TouchableOpacity>

      {file && (
        <TouchableOpacity
          style={styles.nextButton}
          onPress={() => router.push("/checking-upload")}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

export default UploadPhotoIDScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  headerSection: {
    width: "100%",
    backgroundColor: "#282C64",
    paddingTop: height * 0.06,
    paddingHorizontal: 20,
    paddingBottom: height * 0.18,
    position: "relative",
  },
  curve: {
    position: "absolute",
    bottom: -55,
    left: 0,
    right: 0,
    height: height * 0.14,
  },
  stepTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 12,
  },
  instruction: {
    color: "#f0f0f0",
    fontSize: 15,
  },
  idImage: {
    width: 100,
    height: 100,
    marginTop: -40,
  },
  uploadCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    margin: 20,
    padding: 20,
    width: width * 0.9,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  uploadButton: {
    backgroundColor: "#D63B3B",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  uploadText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  separatorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  separator: {
    flex: 1,
    height: 1,
    backgroundColor: "#ccc",
  },
  orText: {
    marginHorizontal: 8,
    color: "#999",
    fontSize: 14,
  },
  fileTypesText: {
    color: "#666",
    fontSize: 12,
    marginTop: 10,
  },
  filePreview: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    backgroundColor: "#F9F9F9",
    padding: 12,
    borderRadius: 8,
    width: "100%",
    justifyContent: "flex-start",
    gap: 10,
  },
  fileName: {
    color: "#666",
    fontSize: 14,
  },
  backButton: {
    position: "absolute",
    bottom: 40,
    left: 20,
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backButtonText: {
    color: "#1F245E",
    fontWeight: "600",
  },
  nextButton: {
    position: "absolute",
    bottom: 40,
    right: 20,
    backgroundColor: "#D63B3B",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    elevation: 4,
  },
  nextButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
