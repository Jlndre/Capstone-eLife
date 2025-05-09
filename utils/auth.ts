import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";


interface TokenPayload {
  user_id: number;
  exp: number; // Expiry timestamp
}

export async function isTokenValid(): Promise<boolean> {
  const token = await SecureStore.getItemAsync("jwt");
  if (!token) return false;

  try {
    const decoded = jwtDecode<TokenPayload>(token);
    const now = Math.floor(Date.now() / 1000); // current time in seconds
    return decoded.exp > now;
  } catch (error) {
    console.error("Invalid token format:", error);
    return false;
  }
}
