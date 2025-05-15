import { Images, ProfileInitials } from "@/assets/images";
import { Routes } from "@/constants/routes";
import { AntDesign, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SideMenuDrawer from "../../components/SideMenu";

interface QuarterPreview {
  title: string;
  date: string;
}

interface QuarterData {
  quarter: string;
  due_date: string;
  verified_at?: string;
  status?: string;
  year?: number;
}

type EmptyStateCardProps = {
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

const EmptyStateCard = ({
  message,
  icon = "calendar-outline",
}: EmptyStateCardProps) => (
  <View style={styles.emptyStateContainer}>
    <Ionicons
      name={icon}
      size={40}
      color="#ccc"
      style={styles.emptyStateIcon}
    />
    <Text style={styles.noItemsText}>{message}</Text>
  </View>
);

export default function DashboardScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterPreview | null>(
    null
  );
  const [isDrawerVisible, setDrawerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [name, setName] = useState<string>("");
  const [firstname, setFirstname] = useState<string>("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [accountStatus, setAccountStatus] = useState<"Active" | "Inactive">(
    "Active"
  );

  const [isCurrentQuarterCompleted, setIsCurrentQuarterCompleted] =
    useState(false);
  const [currentQuarter, setCurrentQuarter] = useState<QuarterData | null>(
    null
  );
  const [upcomingQuarters, setUpcomingQuarters] = useState<QuarterData[]>([]);
  const [completedQuarters, setCompletedQuarters] = useState<QuarterData[]>([]);
  const [missedQuarters, setMissedQuarters] = useState<QuarterData[]>([]);

  const pastQuarters = [...completedQuarters, ...missedQuarters].sort(
    (a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
  );

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const token = await SecureStore.getItemAsync("jwt");
    console.log("📦 Stored token:", token);

    setIsLoading(true);
    try {
      const token = await SecureStore.getItemAsync("jwt");
      const res = await fetch(
        "https://09c6-208-131-174-130.ngrok-free.app/api/dashboard-summary",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();
      if (res.ok) {
        setName(data.name);
        setFirstname(data.name.split(" ")[0]);
        setYear(data.year);
        setAccountStatus(data.active ? "Active" : "Inactive");
        setCurrentQuarter(data.current);
        setUpcomingQuarters(data.upcoming);
        setCompletedQuarters(data.completed);
        setMissedQuarters(data.missed);
        setIsCurrentQuarterCompleted(data.current?.status === "completed");
      } else {
        console.warn("Dashboard error:", data.message);
        Alert.alert("Error", data.message || "Failed to load dashboard data");
      }
    } catch (err) {
      console.error("Dashboard fetch error", err);
      Alert.alert(
        "Connection Error",
        "Failed to connect to server. Please check your internet connection."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyClick = () => {
    if (!isCurrentQuarterCompleted && currentQuarter) {
      router.push(Routes.StartProcess);
    }
  };

  const handleQuarterCompletion = async () => {
    try {
      const token = await SecureStore.getItemAsync("jwt");
      const res = await fetch(
        `https://09c6-208-131-174-130.ngrok-free.app/api/test-complete/${currentQuarter?.quarter}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (res.ok) {
        fetchDashboardData();
        Alert.alert(
          "Verification Complete",
          `Your ${currentQuarter?.quarter} Quarter life certificate has been successfully verified!`
        );
      } else {
        const error = await res.json();
        Alert.alert(
          "Error",
          error.message || "Failed to complete verification"
        );
      }
    } catch (err) {
      console.error("Verification error", err);
      Alert.alert("Error", "Failed to complete verification process");
    }
  };

  const handleUpcomingQuarterClick = (item: QuarterPreview) => {
    setSelectedQuarter(item);
    setModalVisible(true);
  };

  const profileLetter = firstname?.charAt(0).toUpperCase() || "A";
  const profileImage = ProfileInitials[profileLetter] || Images.ProfilePicAlt;

  return (
    <>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <ImageBackground
        source={Images.DashboardBackground}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.headerIcons}>
            <Pressable onPress={() => setDrawerVisible(true)}>
              <Text style={styles.hamburger}>☰</Text>
            </Pressable>
            <Image source={profileImage} style={styles.profilePic} />
          </View>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{year}</Text>
            <Text style={styles.yearText}>Nice to have you, {firstname}!</Text>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
          >
            {accountStatus === "Inactive" && (
              <Text style={styles.inactiveAlert}>
                ⚠ Your account is inactive due to missed verifications.
              </Text>
            )}

            {/* Current Certificate */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  Current Quarter Verification
                </Text>
                <TouchableOpacity onPress={fetchDashboardData}>
                  <MaterialIcons name="refresh" size={20} color="#999" />
                </TouchableOpacity>
              </View>
              <View style={styles.underline} />
              {currentQuarter ? (
                isCurrentQuarterCompleted ? (
                  <View style={styles.completedCertificate}>
                    <View style={styles.certificateInfo}>
                      <Text style={styles.certificateInfoText}>
                        {currentQuarter?.quarter} Quarter {year}
                      </Text>
                      <View style={styles.doneTagContainer}>
                        <AntDesign
                          name="checkcircle"
                          size={18}
                          color="#4CAF50"
                        />
                        <Text style={styles.doneTagText}>Completed</Text>
                      </View>
                    </View>
                    <Text style={styles.completedDateText}>
                      Verified on: {currentQuarter?.verified_at}
                    </Text>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.certificateBtn}
                      onPress={handleVerifyClick}
                      disabled={!currentQuarter}
                    >
                      <Text style={styles.certificateBtnText}>
                        {currentQuarter?.quarter} Quarter {year} - Click to
                        Verify
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.actionRow}>
                      <Text style={styles.dueText}>
                        Due by: {currentQuarter?.due_date}
                      </Text>
                      <TouchableOpacity
                        style={styles.demoButton}
                        onPress={handleQuarterCompletion}
                      >
                        <Text style={styles.demoButtonText}>
                          Test Verification
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )
              ) : (
                <EmptyStateCard
                  message="No verification required for this quarter."
                  icon="checkmark-circle-outline"
                />
              )}
            </View>

            {/* Upcoming */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Upcoming Verifications</Text>
                <TouchableOpacity>
                  <MaterialIcons name="calendar-today" size={20} color="#999" />
                </TouchableOpacity>
              </View>
              <View style={styles.underline} />
              {upcomingQuarters.length > 0 ? (
                upcomingQuarters.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.upcomingCertificate}
                    onPress={() =>
                      handleUpcomingQuarterClick({
                        title: `${item.quarter} Quarter`,
                        date: `opens on: ${item.due_date}`,
                      })
                    }
                  >
                    <Text style={styles.upcomingCertificateText}>
                      {item.quarter} Quarter {item.year || year}
                    </Text>
                    <Text style={styles.upcomingDateText}>
                      Opens on: {item.due_date}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <EmptyStateCard
                  message="No upcoming verifications left for this year."
                  icon="time-outline"
                />
              )}
            </View>

            {/* Past Certificates - Combined */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Past Verifications</Text>
                <TouchableOpacity>
                  <MaterialIcons name="history" size={20} color="#999" />
                </TouchableOpacity>
              </View>
              <View style={styles.underline} />
              {pastQuarters.length > 0 ? (
                pastQuarters.map((q, index) => (
                  <View
                    key={index}
                    style={[
                      styles.pastCertificate,
                      q.status === "completed"
                        ? styles.completedCertificate
                        : styles.missedCertificate,
                    ]}
                  >
                    <View style={styles.certificateInfo}>
                      <Text style={styles.certificateInfoText}>
                        {q.quarter} Quarter {q.year || year}
                      </Text>
                      <View
                        style={[
                          styles.statusTagContainer,
                          q.status === "completed"
                            ? styles.completedTagContainer
                            : styles.missedTagContainer,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusTag,
                            q.status === "completed"
                              ? styles.completedTag
                              : styles.missedTag,
                          ]}
                        >
                          {q.status === "completed" ? "Completed" : "Missed"}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.statusDateText,
                        q.status === "completed"
                          ? styles.completedDateText
                          : styles.missedDateText,
                      ]}
                    >
                      {q.status === "completed"
                        ? `Verified on: ${q.verified_at}`
                        : `Missed deadline: ${q.due_date}`}
                    </Text>
                  </View>
                ))
              ) : (
                <EmptyStateCard
                  message="No past verifications to display"
                  icon="folder-outline"
                />
              )}
            </View>

            <View style={{ paddingBottom: tabBarHeight + 20 }} />
          </ScrollView>

          {/* Modal for Upcoming Quarter */}
          <Modal
            animationType="fade"
            transparent
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
                    {selectedQuarter?.title || ""} is not open for verification
                    yet.
                  </Text>
                  <Text style={styles.modalDate}>
                    It will be available on{" "}
                    {selectedQuarter?.date.replace("opens on: ", "") || ""}
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
    width: "100%",
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
  yearText: {
    color: "#808080",
    fontSize: 14,
  },
  inactiveAlert: {
    color: "#d32f2f",
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    backgroundColor: "rgba(255,220,220,0.7)",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f44336",
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
  pastCertificate: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  completedCertificate: {
    backgroundColor: "#f0f7f0",
    borderColor: "#c8e6c9",
  },
  missedCertificate: {
    backgroundColor: "#fff0f0",
    borderColor: "#ffcdd2",
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
  statusTagContainer: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedTagContainer: {
    backgroundColor: "#e8f5e9",
  },
  missedTagContainer: {
    backgroundColor: "#ffebee",
  },
  statusTag: {
    fontWeight: "600",
    fontSize: 14,
  },
  completedTag: {
    color: "#4CAF50",
  },
  missedTag: {
    color: "#F44336",
  },
  statusDateText: {
    fontSize: 14,
    textAlign: "right",
    marginTop: 4,
    fontStyle: "italic",
  },
  completedDateText: {
    color: "#4CAF50",
  },
  missedDateText: {
    color: "#d32f2f",
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
    paddingVertical: 10,
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  emptyStateIcon: {
    marginBottom: 10,
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
