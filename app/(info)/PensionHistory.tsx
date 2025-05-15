import { Routes } from "@/constants/routes";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Certificate = {
  id: string;
  date: string;
  status: string;
};

export default function PensionHistory() {
  const router = useRouter();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCertificates = async () => {
      try {
        // Get JWT token from secure storage
        const token = await SecureStore.getItemAsync("jwt");

        if (!token) {
          setError("Authentication token not found");
          setLoading(false);
          return;
        }
        const response = await fetch(
          "https://09c6-208-131-174-130.ngrok-free.app/verification-history",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        setCertificates(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch verification history"
        );
        console.error("Error fetching certificates:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCertificates();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace(Routes.Home)}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={26} color="#2C3E50" />
        </TouchableOpacity>
        <Text style={styles.title}>Pension History</Text>
      </View>

      {/* Loading State */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1F245E" />
          <Text style={styles.loadingText}>
            Loading verification history...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : certificates.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="document-text-outline" size={64} color="#BBC0C4" />
          <Text style={styles.emptyText}>No verification history found</Text>
        </View>
      ) : (
        /* List of Certificates */
        <FlatList
          data={certificates}
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
      )}
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
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#2C3E50",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    color: "#6B7280",
    textAlign: "center",
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: "#E53E3E",
    textAlign: "center",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
