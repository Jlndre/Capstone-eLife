import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// Example mock data for the past 2 years
const mockCertificates = [
  { id: "1", date: "March 12, 2025", status: "Verified" },
  { id: "2", date: "December 10, 2024", status: "Verified" },
  { id: "3", date: "September 8, 2024", status: "Verified" },
  { id: "4", date: "June 6, 2024", status: "Verified" },
  { id: "5", date: "March 4, 2024", status: "Verified" },
  { id: "6", date: "December 1, 2023", status: "Verified" },
  { id: "7", date: "September 2, 2023", status: "Verified" },
  { id: "8", date: "June 1, 2023", status: "Verified" },
];

export default function PensionHistory() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace("/(tabs)")}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={26} color="#2C3E50" />
        </TouchableOpacity>
        <Text style={styles.title}>Pension History</Text>
      </View>

      {/* List of Certificates */}
      <FlatList
        data={mockCertificates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Ionicons
              name="checkmark-circle-outline"
              size={24}
              color="#1FAD66"
            />
            <View style={styles.cardInfo}>
              <Text style={styles.cardDate}>{item.date}</Text>
              <Text style={styles.cardStatus}>{item.status}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F245E",
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
  },
  cardInfo: {
    marginLeft: 12,
  },
  cardDate: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2C3E50",
  },
  cardStatus: {
    fontSize: 14,
    color: "#1FAD66",
    marginTop: 4,
  },
});
