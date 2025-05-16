import { API_BASE_URL } from "@/utils/config";
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
   * @param certificateId - The ID of the certificate being viewed (optional)
   */
  const handleLifeCertificateViewed = async (certificateId?: number) => {
    if (isProcessing) return;
    
    console.log("Calling handleLifeCertificateViewed", certificateId ? `with ID: ${certificateId}` : "without ID");
    
    try {
      setIsProcessing(true);
      setError(null);
      
      // Get the JWT token
      const token = await SecureStore.getItemAsync("jwt");
      
      if (!token) {
        throw new Error("Authentication token not found");
      }

      // Start with the provided ID or undefined
      let resolvedCertificateId: number | undefined = certificateId;
      
      // If no certificate ID was provided, try to get the latest one
      if (resolvedCertificateId === undefined) {
        console.log("No certificate ID provided, attempting to fetch latest");
        try {
          const latestId = await getLatestCertificateId(token);
          
          // Only assign if we got a valid ID (not null)
          if (latestId !== null) {
            resolvedCertificateId = latestId;
            console.log(`Using resolved certificate ID: ${resolvedCertificateId}`);
          } else {
            console.log("No existing certificate found, generating a new one");
            // If we can't find a certificate, let's generate one
            const newCertificate = await generateCertificate(token);
            if (newCertificate && newCertificate.id) {
              resolvedCertificateId = newCertificate.id;
              console.log(`Using newly generated certificate ID: ${resolvedCertificateId}`);
            } else {
              throw new Error("Failed to generate a new certificate");
            }
          }
        } catch (err) {
          console.error("Error resolving certificate ID:", err);
          throw new Error("Certificate ID is required and could not be determined automatically");
        }
      }
      
      // Make sure we have a valid certificate ID at this point
      if (resolvedCertificateId === undefined) {
        throw new Error("Failed to resolve certificate ID");
      }
      
      // Proceed with the API calls using the resolved ID
      console.log(`Proceeding with certificate ID: ${resolvedCertificateId}`);
      
      // Perform all necessary API calls and state changes
      // Using Promise.all for parallel execution
      const results = await Promise.all([
        updateAccountStatus(token, resolvedCertificateId),
        updateUserPermissions(token, resolvedCertificateId),
      ]);
      
      console.log("Certificate view processing complete", results);
      setIsComplete(true);
      return results;
    } catch (err) {
      console.error("Failed to process Life verification:", err);
      setError(err instanceof Error ? err.message : String(err));
      throw err; // Re-throw for the component to handle
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Generate a new certificate
   */
  const generateCertificate = async (token: string) => {
    try {
      console.log("Attempting to generate a new certificate");
      const response = await fetch(
        `${API_BASE_URL}/generate-certificate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            quarter: getCurrentQuarter(),
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to generate certificate");
      }
      
      const result = await response.json();
      console.log("Certificate generated successfully", result.certificate?.id);
      
      // Store the certificate ID for future use
      if (result.certificate && result.certificate.id) {
        await SecureStore.setItemAsync("latest_certificate_id", result.certificate.id.toString());
      }
      
      return result.certificate;
    } catch (error) {
      console.error("Error generating certificate:", error);
      throw error;
    }
  };

  /**
   * Get the current quarter string (e.g., "Q1-2025")
   */
  const getCurrentQuarter = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    let quarter;
    
    if (month < 3) quarter = "Q1";
    else if (month < 6) quarter = "Q2";
    else if (month < 9) quarter = "Q3";
    else quarter = "Q4";
    
    return `${quarter}-${year}`;
  };

  /**
   * Attempt to get the latest certificate ID from the verification history
   */
  const getLatestCertificateId = async (token: string): Promise<number | null> => {
    try {
      console.log("Fetching verification history to find latest certificate");
      const response = await fetch(
        `${API_BASE_URL}/verification-history`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        console.error("Failed to fetch verification history", response.status);
        return null;
      }

      const data = await response.json();
      console.log(`Found ${data?.length || 0} certificates in history`);
      
      // Get the most recent certificate
      if (data && data.length > 0) {
        // Sort by date descending and get the first one (most recent)
        const sortedCertificates = data.sort((a: { date: string | number | Date; }, b: { date: string | number | Date; }) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return dateB - dateA;
        });
        
        console.log("Most recent certificate:", sortedCertificates[0]);
        return sortedCertificates[0].id;
      }
      
      console.log("No certificates found in history");
      return null;
    } catch (err) {
      console.error("Error getting latest certificate ID:", err);
      return null;
    }
  };
  
  /**
   * Update the user's account status in the backend
   * @param token - JWT authentication token
   * @param certificateId - The ID of the certificate being viewed
   */
  const updateAccountStatus = async (token: string, certificateId: number) => {
    try {
      console.log(`Updating account status with certificate ID: ${certificateId}`);
      const response = await fetch(
        `${API_BASE_URL}/update-account-status`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            certificate_id: certificateId,
            status: "verified",
            lifeVerified: true,
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message || "Failed to update account status";
        console.error("Error updating account status:", new Error(errorMsg));
        throw new Error(errorMsg);
      }
      
      console.log("Account status updated successfully");
      return await response.json();
    } catch (error) {
      console.error("Error updating account status:", error);
      throw error;
    }
  };
  
  /**
   * Update the user's permissions in the app
   * @param token - JWT authentication token
   * @param certificateId - The ID of the certificate being viewed
   */
  const updateUserPermissions = async (token: string, certificateId: number) => {
    try {
      console.log(`Updating user permissions with certificate ID: ${certificateId}`);
      const response = await fetch(
        `${API_BASE_URL}/update-permissions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            certificate_id: certificateId,
            permissions: ["access_funds", "view_certificate", "trade_assets"],
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message || "Failed to update user permissions";
        console.error("Error updating user permissions:", new Error(errorMsg));
        throw new Error(errorMsg);
      }
      
      console.log("User permissions updated successfully");
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