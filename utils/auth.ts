import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";

const TOKEN_KEY = "jwt";

interface TokenPayload {
  user_id: number;
  exp: number;
}

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function deleteToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function isTokenValid(): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;

  try {
    const decoded = jwtDecode<TokenPayload>(token);
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp > now;
  } catch (error) {
    console.error("Invalid token format:", error);
    return false;
  }
}
