import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import { API_BASE_URL } from "@/utils/config";
/**
 * Custom hook to handle Life Certificate generation and verification
 */
export const useLifeCertificate = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [certificateData, setCertificateData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Generate a JSON certificate and update user's verification status
   * This handles both certificate generation and all required API calls
   */
  const generateAndUpdateCertificate = async () => {
    if (isGenerating) return;
    
    try {
      setIsGenerating(true);
      setError(null);
      
      // Get the JWT token
      const token = await SecureStore.getItemAsync("jwt");
      
      if (!token) {
        throw new Error("Authentication token not found");
      }
      
      // 1. Request certificate generation from the backend
      // This will create a DigitalCertificate record based on the most recent approved ProofSubmission
      const response = await fetch(
        `${API_BASE_URL}/generate-certificate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            // Add any additional data needed for certificate generation
            quarter: getCurrentQuarter(),
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to generate certificate");
      }
      
      const result = await response.json();
      
      // 2. Save certificate data to state
      setCertificateData(result.certificate);
      
      // 3. Update quarter verification status if needed (this might be handled server-side)
      await updateQuarterVerification(token, result.certificate.proof_submission_id);
      
      // 4. Update user permissions with certificate ID
      await updateUserPermissions(token, result.certificate.id);
      
      return result.certificate;
    } catch (err) {
      console.error("Failed to generate and update certificate:", err);
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setIsGenerating(false);
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
   * Update the quarter verification status
   */
  const updateQuarterVerification = async (token: string, proofSubmissionId: number) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/update-quarter-verification",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            quarter: getCurrentQuarter(),
            status: "completed",
            proof_submission_id: proofSubmissionId
          }),
        }
      );
      
      if (!response.ok) {
        console.warn("Failed to update quarter verification, but continuing...");
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error updating quarter verification:", error);
      // We don't throw here to allow the process to continue
    }
  };
  
  /**
   * Update the user's permissions in the app
   * @param token - JWT authentication token
   * @param certificateId - The ID of the generated certificate
   */
  const updateUserPermissions = async (token: string, certificateId: number) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/update-permissions",
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
        console.warn("Failed to update user permissions, but continuing...");
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error updating user permissions:", error);
      // We don't throw here to allow the process to continue
    }
  };

  return {
    generateAndUpdateCertificate,
    certificateData,
    isGenerating,
    error,
  };
};