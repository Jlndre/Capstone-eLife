import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ImageBackground,
  Pressable,
  ScrollView,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialIcons, Ionicons, AntDesign } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import SideMenuDrawer from "../../components/SideMenu";

const screenWidth = Dimensions.get("window").width;

// ✅ Define type for quarters
interface QuarterPreview {
  ref: string;
  title: string;
  date: string;
}

export default function DashboardScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterPreview | null>(
    null
  );
  const [isCurrentQuarterCompleted, setIsCurrentQuarterCompleted] =
    useState(false);
  const [isDrawerVisible, setDrawerVisible] = useState(false);

  const handleVerifyClick = () => {
    if (!isCurrentQuarterCompleted) {
      router.push("/StartProcess");
    }
  };

  const handleQuarterCompletion = () => {
    setIsCurrentQuarterCompleted(true);
    Alert.alert(
      "Verification Complete",
      "Your First Quarter life certificate has been successfully verified!"
    );
  };

  const handleUpcomingQuarterClick = (item: QuarterPreview) => {
    setSelectedQuarter(item);
    setModalVisible(true);
  };

  return (
    <>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <ImageBackground
        source={require("../../assets/images/Dashboard.png")}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.headerIcons}>
            <Pressable onPress={() => setDrawerVisible(true)}>
              <Text style={styles.hamburger}>☰</Text>
            </Pressable>
            <Image
              source={require("../../assets/images/profilepic.png")}
              style={styles.profilePic}
            />
          </View>

          {/* Header Text */}
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <Text style={styles.trnText}>TRN XXX-XXX-000</Text>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Current Certificate */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  Current Quarter Certificate
                </Text>
                <TouchableOpacity>
                  <MaterialIcons name="more-vert" size={20} color="#999" />
                </TouchableOpacity>
              </View>
              <View style={styles.underline} />
              {isCurrentQuarterCompleted ? (
                <View style={styles.completedCertificate}>
                  <View style={styles.certificateInfo}>
                    <Text style={styles.certificateInfoText}>
                      REF#123456 AGP/B1234{"\n"}First Quarter
                    </Text>
                    <View style={styles.doneTagContainer}>
                      <AntDesign name="checkcircle" size={18} color="#4CAF50" />
                      <Text style={styles.doneTagText}>Completed</Text>
                    </View>
                  </View>
                  <Text style={styles.completedDateText}>
                    Verified on: 01/15/2025
                  </Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.certificateBtn}
                    onPress={handleVerifyClick}
                  >
                    <Text style={styles.certificateBtnText}>
                      REF#123456 AGP/B1234{"\n"}First Quarter - Click to Verify
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.actionRow}>
                    <Text style={styles.dueText}>Due on: 01/31/2025</Text>
                    <TouchableOpacity
                      style={styles.demoButton}
                      onPress={handleQuarterCompletion}
                    >
                      <Text style={styles.demoButtonText}>
                        Demo: Mark as Complete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>

            {/* Upcoming Certificates */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  Upcoming Life Certificate Uploads
                </Text>
                <TouchableOpacity>
                  <MaterialIcons name="more-vert" size={20} color="#999" />
                </TouchableOpacity>
              </View>
              <View style={styles.underline} />
              {[
                {
                  ref: "123457",
                  title: "Second Quarter",
                  date: "opens on: 04/01/2024",
                },
                {
                  ref: "123458",
                  title: "Third Quarter",
                  date: "opens on: 07/01/2024",
                },
                {
                  ref: "123459",
                  title: "Final Quarter",
                  date: "opens on: 10/01/2024",
                },
              ].map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.upcomingCertificate}
                  onPress={() => handleUpcomingQuarterClick(item)}
                >
                  <Text style={styles.upcomingCertificateText}>
                    REF#{item.ref} AGP/B1234{"\n"}
                    {item.title}
                  </Text>
                  <Text style={styles.upcomingDateText}>{item.date}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Past Certificates (if completed) */}
            {isCurrentQuarterCompleted && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Past Life Certificates</Text>
                  <TouchableOpacity>
                    <MaterialIcons name="more-vert" size={20} color="#999" />
                  </TouchableOpacity>
                </View>
                <View style={styles.underline} />
                <Text style={styles.noItemsText}>
                  No previous certificates to display yet.
                </Text>
              </View>
            )}

            <View style={{ paddingBottom: tabBarHeight + 20 }} />
          </ScrollView>

          {/* Modal */}
          <Modal
            animationType="fade"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Quarter Not Available</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#555" />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalContent}>
                  <Ionicons
                    name="time-outline"
                    size={50}
                    color="#1F245E"
                    style={styles.modalIcon}
                  />
                  <Text style={styles.modalText}>
                    {selectedQuarter ? selectedQuarter.title : ""} is not open
                    for verification yet.
                  </Text>
                  <Text style={styles.modalDate}>
                    It will be available on{" "}
                    {selectedQuarter
                      ? selectedQuarter.date.replace("opens on: ", "")
                      : ""}
                    .
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Side Menu Drawer */}
          <SideMenuDrawer
            visible={isDrawerVisible}
            onClose={() => setDrawerVisible(false)}
          />
        </SafeAreaView>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: screenWidth,
    backgroundColor: "#F6F6F6",
  },
  safeArea: {
    paddingHorizontal: 16,
    flex: 1,
  },
  headerIcons: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  hamburger: {
    fontSize: 30,
    color: "#fff",
  },
  profilePic: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#fff",
  },
  headerTextContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0B1741",
  },
  trnText: {
    color: "#808080",
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  upcomingCertificate: {
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  upcomingCertificateText: {
    fontSize: 16,
    color: "#666",
  },
  upcomingDateText: {
    fontSize: 14,
    color: "#888",
    fontStyle: "italic",
    marginTop: 4,
    textAlign: "right",
  },
  completedCertificate: {
    backgroundColor: "#f0f7f0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#c8e6c9",
  },
  certificateInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  certificateInfoText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  doneTagContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  doneTagText: {
    color: "#4CAF50",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 4,
  },
  completedDateText: {
    fontSize: 14,
    color: "#4CAF50",
    textAlign: "right",
    marginTop: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#0B1741",
  },
  underline: {
    height: 1,
    backgroundColor: "#E0E0E0",
    marginTop: 4,
    marginBottom: 12,
  },
  certificateBtn: {
    backgroundColor: "#1F245E",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  certificateBtnText: {
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
  },
  dueText: {
    fontSize: 14,
    color: "#888",
    fontStyle: "italic",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  demoButton: {
    backgroundColor: "#E0E0E0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  demoButtonText: {
    fontSize: 12,
    color: "#555",
  },
  noItemsText: {
    fontSize: 16,
    color: "#888",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 20,
  },
  // Modal Styles
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalView: {
    width: "85%",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F245E",
  },
  modalContent: {
    alignItems: "center",
    paddingVertical: 15,
  },
  modalIcon: {
    marginBottom: 15,
  },
  modalText: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 8,
    color: "#333",
  },
  modalDate: {
    fontSize: 16,
    textAlign: "center",
    color: "#666",
    fontStyle: "italic",
  },
  modalButton: {
    backgroundColor: "#1F245E",
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 20,
    alignItems: "center",
  },
  modalButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
