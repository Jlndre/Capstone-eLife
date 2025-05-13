import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';

/**
 * Custom hook to handle all app state changes and API calls
 * when a user's Life verification has succeeded and they view their certificate
 */
export const useVerificationSuccess = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle all the state changes and API calls when a user views their Life certificate
   * This is the main function that orchestrates all the necessary API calls and state changes
   */
  const handleLifeCertificateViewed = async () => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      setError(null);
      
      // Get the JWT token
      const token = await SecureStore.getItemAsync("jwt");
      
      if (!token) {
        throw new Error("Authentication token not found");
      }
      
      // Perform all necessary API calls and state changes
      // We'll use Promise.all to run them in parallel for better performance
      await Promise.all([
        updateAccountStatus(token),
        updateUserPermissions(token),
        // Add any other API calls needed
      ]);
      
      setIsComplete(true);
    } catch (err) {
      console.error("Failed to process Life verification:", err);
      throw err; // Re-throw for the component to handle
    } finally {
      setIsProcessing(false);
    }
  };
  
  /**
   * Update the user's account status in the backend
   */
  const updateAccountStatus = async (token: string) => {
    try {
      const response = await fetch(
        "https://b018-63-143-118-227.ngrok-free.app/update-account-status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "verified",
            lifeVerified: true,
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update account status");
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error updating account status:", error);
      throw error;
    }
  };
  
  /**
   * Update the user's permissions in the app
   */
  const updateUserPermissions = async (token: string) => {
    try {
      const response = await fetch(
        "https://b018-63-143-118-227.ngrok-free.app/update-permissions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            permissions: ["access_funds", "view_certificate", "trade_assets"],
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update user permissions");
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error updating user permissions:", error);
      throw error;
    }
  };

  return {
    handleLifeCertificateViewed,
    isProcessing,
    isComplete,
    error,
  };
};