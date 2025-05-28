import { Images, ProfileInitials } from "@/assets/images";
import { Routes } from "@/constants/routes";
import { API_BASE_URL } from "@/utils/config";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useState } from "react";
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
  opening_date?: string;
  is_open?: boolean;
}

interface QuarterEligibility {
  quarter: string;
  year: number;
  eligible: boolean;
  reason: string;
  opening_date: string;
  due_date: string;
  is_open: boolean;
  current_date: string;
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
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterPreview | null>(null);
  const [isDrawerVisible, setDrawerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [name, setName] = useState<string>("");
  const [firstname, setFirstname] = useState<string>("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [accountStatus, setAccountStatus] = useState<"Active" | "Inactive">("Active");

  const [isCurrentQuarterCompleted, setIsCurrentQuarterCompleted] = useState(false);
  const [currentQuarter, setCurrentQuarter] = useState<QuarterData | null>(null);
  const [upcomingQuarters, setUpcomingQuarters] = useState<QuarterData[]>([]);
  const [completedQuarters, setCompletedQuarters] = useState<QuarterData[]>([]);
  const [missedQuarters, setMissedQuarters] = useState<QuarterData[]>([]);
  
  const [quarterEligibility, setQuarterEligibility] = useState<QuarterEligibility | null>(null);

  const pastQuarters = [...completedQuarters, ...missedQuarters].sort(
    (a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
  );

  useFocusEffect(
    useCallback(() => {
      console.log("📲 Dashboard focused. Fetching latest data...");
      fetchDashboardData();
    }, [])
  );
  // Check quarter eligibility
  const checkQuarterEligibility = async () => {
    try {
      const token = await SecureStore.getItemAsync("jwt");
      if (!token) return;

      console.log("Checking quarter eligibility...");
      const response = await fetch(`${API_BASE_URL}/api/quarter-eligibility`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });

      if (response.ok) {
        const eligibility = await response.json();
        setQuarterEligibility(eligibility);
        console.log("Quarter eligibility:", eligibility);
      } else {
        console.error("Failed to check quarter eligibility:", response.status);
      }
    } catch (error) {
      console.error("Error checking quarter eligibility:", error);
    }
  };

  const fetchDashboardData = async () => {
    const token = await SecureStore.getItemAsync("jwt");
    console.log("📦 Stored token:", token);

    setIsLoading(true);
    try {
      const token = await SecureStore.getItemAsync("jwt");
      
      // Add cache buster to prevent stale data
      const cacheBuster = new Date().getTime();
      const res = await fetch(
        `${API_BASE_URL}/api/dashboard-summary?t=${cacheBuster}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache, no-store, must-revalidate",
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
        setUpcomingQuarters(data.upcoming || []);
        setCompletedQuarters(data.completed || []);
        setMissedQuarters(data.missed || []);
        setIsCurrentQuarterCompleted(data.current?.status === "completed");
        
        console.log("Dashboard data updated:", {
          current: data.current,
          upcoming: data.upcoming?.length || 0,
          completed: data.completed?.length || 0,
          missed: data.missed?.length || 0
        });
        
        // Check quarter eligibility after fetching dashboard data
        await checkQuarterEligibility();
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

  const handleVerifyClick = async () => {
    console.log("Verify button clicked");
    
    // First check eligibility
    if (!quarterEligibility) {
      console.log("No eligibility data, checking...");
      await checkQuarterEligibility();
    }

    if (quarterEligibility && !quarterEligibility.eligible) {
      let title = "Verification Not Available";
      let message = quarterEligibility.reason;

      if (quarterEligibility.reason.includes("not yet open")) {
        title = "Quarter Not Yet Open";
        message = `The ${quarterEligibility.quarter} quarter verification will open on ${new Date(quarterEligibility.opening_date).toLocaleDateString()}. Please check back after this date.`;
      } else if (quarterEligibility.reason.includes("already completed")) {
        title = "Quarter Already Verified";
        message = `You've already completed verification for ${quarterEligibility.quarter} Quarter ${quarterEligibility.year}.`;
      } else if (quarterEligibility.reason.includes("ended")) {
        title = "Verification Period Ended";
        message = `The verification period for ${quarterEligibility.quarter} Quarter ${quarterEligibility.year} has ended.`;
      }

      Alert.alert(title, message, [{ text: "OK", style: "cancel" }]);
      return;
    }

    // Proceed with verification if eligible
    if (!isCurrentQuarterCompleted && currentQuarter) {
      console.log("Navigating to verification process");
      router.push(Routes.StartProcess);
    }
  };

  const handleQuarterCompletion = async () => {
    try {
      const token = await SecureStore.getItemAsync("jwt");
      const res = await fetch(
        `${API_BASE_URL}/api/test-complete/${currentQuarter?.quarter}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (res.ok) {
        await fetchDashboardData();
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
    // Check if this is actually a not-yet-open quarter
    const isNotYetOpen = item.date.includes("opens on:") || item.date.includes("Opens on:");
    
    if (isNotYetOpen) {
      setSelectedQuarter(item);
      setModalVisible(true);
    } else {
      // This is a truly upcoming quarter (open but not current)
      Alert.alert(
        "Quarter Available Later",
        `${item.title} will become available for verification after you complete the current quarter.`,
        [{ text: "OK", style: "cancel" }]
      );
    }
  };

  const profileLetter = firstname?.charAt(0).toUpperCase() || "A";
  const profileImage = ProfileInitials[profileLetter] || Images.ProfilePicAlt;

  // Helper function to determine button state
  const getVerificationButtonState = () => {
    if (!currentQuarter) {
      return { disabled: true, text: "No Quarter Available", reason: "no_quarter" };
    }

    // Check if current quarter is completed
    if (isCurrentQuarterCompleted || currentQuarter.status === 'completed') {
      return { disabled: true, text: "Already Verified", reason: "completed" };
    }
    
    // Check quarter eligibility
    if (quarterEligibility && !quarterEligibility.eligible) {
      if (!quarterEligibility.is_open) {
        return { disabled: true, text: "Not Yet Open", reason: "not_open" };
      } else {
        return { disabled: true, text: "Already Completed", reason: "completed" };
      }
    }
    
    return { disabled: false, text: "Click to Verify", reason: "available" };
  };

  const buttonState = getVerificationButtonState();

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
              </View>
              <View style={styles.underline} />
              
              {currentQuarter ? (
                // Always show current quarter, but with different states
                <>
                  <View style={styles.currentQuarterHeader}>
                    <Text style={styles.currentQuarterTitle}>
                      {currentQuarter?.quarter} Quarter {year}
                    </Text>
                    <View style={[
                      styles.currentQuarterBadge,
                      (isCurrentQuarterCompleted || currentQuarter.status === 'completed') 
                        ? styles.verifiedBadge 
                        : styles.pendingBadge
                    ]}>
                      <Text style={styles.currentQuarterBadgeText}>
                        {(isCurrentQuarterCompleted || currentQuarter.status === 'completed') 
                          ? "VERIFIED" 
                          : "PENDING"
                        }
                      </Text>
                    </View>
                  </View>
                  
                  {(isCurrentQuarterCompleted || currentQuarter.status === 'completed') ? (
                    <View style={styles.verifiedSection}>
                      <Text style={styles.verifiedText}>
                         Your verification for this quarter is complete.
                      </Text>
                      <Text style={styles.verifiedDateText}>
                        Verified on: {currentQuarter?.verified_at}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.certificateBtn,
                          buttonState.disabled && styles.disabledCertificateBtn
                        ]}
                        onPress={handleVerifyClick}
                        disabled={buttonState.disabled}
                      >
                        <Text style={[
                          styles.certificateBtnText,
                          buttonState.disabled && styles.disabledBtnText
                        ]}>
                          {currentQuarter?.quarter} Quarter {year} - {buttonState.text}
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.actionRow}>
                        <Text style={styles.dueText}>
                          {buttonState.reason === "not_open" && quarterEligibility
                            ? `Opens on: ${new Date(quarterEligibility.opening_date).toLocaleDateString()}`
                            : `Due by: ${currentQuarter?.due_date}`
                          }
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
                  )}
                </>
              ) : (
                <EmptyStateCard
                  message="No current quarter available."
                  icon="calendar-outline"
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
                upcomingQuarters.map((item, index) => {
                  const isNotYetOpen = item.is_open === false || item.opening_date;
                  const dateText = isNotYetOpen 
                    ? `Opens on: ${item.opening_date ? new Date(item.opening_date).toLocaleDateString() : item.due_date}`
                    : `Due by: ${item.due_date}`;
                    
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.upcomingCertificate,
                        isNotYetOpen && styles.notYetOpenCertificate
                      ]}
                      onPress={() =>
                        handleUpcomingQuarterClick({
                          title: `${item.quarter} Quarter`,
                          date: dateText,
                        })
                      }
                    >
                      <View style={styles.upcomingCertificateHeader}>
                        <Text style={styles.upcomingCertificateText}>
                          {item.quarter} Quarter {item.year || year}
                        </Text>
                        {isNotYetOpen && (
                          <View style={styles.notOpenBadge}>
                            <Text style={styles.notOpenBadgeText}>NOT OPEN</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[
                        styles.upcomingDateText,
                        isNotYetOpen && styles.notYetOpenDateText
                      ]}>
                        {dateText}
                      </Text>
                    </TouchableOpacity>
                  );
                })
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
                </View>
                <View style={styles.modalContent}>
                  <Ionicons
                    name="time-outline"
                    size={50}
                    color="#1F245E"
                    style={styles.modalIcon}
                  />
                  <Text style={styles.modalText}>
                    {selectedQuarter?.title || ""} is not open for verification yet.
                  </Text>
                  <Text style={styles.modalDate}>
                    It will be available on{" "}
                    {selectedQuarter?.date.replace(/Opens on: |opens on: /, "") || ""}
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
  notYetOpenCertificate: {
    backgroundColor: "#f5f5f5",
    borderColor: "#bdbdbd",
    opacity: 0.8,
  },
  upcomingCertificateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  upcomingCertificateText: {
    fontSize: 16,
    color: "#666",
    flex: 1,
  },
  notOpenBadge: {
    backgroundColor: "#757575",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  notOpenBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  upcomingDateText: {
    fontSize: 14,
    color: "#888",
    fontStyle: "italic",
    textAlign: "right",
  },
  notYetOpenDateText: {
    color: "#999",
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
  disabledCertificateBtn: {
    backgroundColor: "#CCCCCC",
    opacity: 0.6,
  },
  certificateBtnText: {
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
  },
  disabledBtnText: {
    color: "#666666",
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
  color: "#fff",
  fontSize: 16,
  fontWeight: "600",
  },
  // New styles for current quarter display
  currentQuarterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  currentQuarterTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F245E",
    flex: 1,
  },
  currentQuarterBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  verifiedBadge: {
    backgroundColor: "#4CAF50",
  },
  pendingBadge: {
    backgroundColor: "#FFA000",
  },
  currentQuarterBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  verifiedSection: {
    backgroundColor: "#f0f7f0",
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
  },
  verifiedText: {
    fontSize: 16,
    color: "#2E7D32",
    fontWeight: "500",
    marginBottom: 8,
  },
  verifiedDateText: {
    fontSize: 14,
    color: "#4CAF50",
    fontStyle: "italic",
  },
});