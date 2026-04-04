import { getSupabaseClient } from "@/lib/supabaseClient";

export type AppRole = "restaurant" | "shelter";

export type ShelterRequestStatus = "open" | "responded" | "matched" | "completed" | "fulfilled" | "cancelled";

export type ProfileRow = {
  id: string;
  role: AppRole;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  organization_notes?: string | null;
};

export function getDashboardPathForRole(role: AppRole): string {
  return role === "restaurant" ? "/restaurant/home" : "/shelter/home";
}

export function getLoginPathForRole(role: AppRole): string {
  return role === "restaurant" ? "/restaurant/login" : "/shelter/login";
}

export function getRegisterPathForRole(role: AppRole): string {
  return role === "restaurant" ? "/restaurant/register-donor" : "/shelter/register";
}

export function getProfileDetailsPathForRole(role: AppRole): string {
  return role === "restaurant" ? "/restaurant/register-donor/details" : "/shelter/register/details";
}

export function isBaseProfileComplete(profile: ProfileRow | null): boolean {
  if (!profile) return false;
  return Boolean(
    profile.name &&
      profile.email &&
      profile.phone &&
      profile.address &&
      profile.city &&
      profile.state &&
      profile.zip_code
  );
}

export async function isRestaurantProfileComplete(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const [{ data: profile }, { data: donation }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, name, email, phone, address, city, state, zip_code")
      .eq("id", userId)
      .single(),
    supabase
      .from("donations")
      .select("id, food_type")
      .eq("restaurant_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
  ]);

  const typedProfile = (profile as ProfileRow) || null;
  const baseComplete = isBaseProfileComplete(typedProfile);
  if (!typedProfile || typedProfile.role !== "restaurant") return false;

  return Boolean(baseComplete && donation?.food_type);
}

export async function isShelterProfileComplete(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, name, email, phone, address, city, state, zip_code")
    .eq("id", userId)
    .single();

  const typedProfile = (profile as ProfileRow) || null;
  return Boolean(typedProfile?.role === "shelter" && isBaseProfileComplete(typedProfile));
}

export async function isRoleProfileComplete(role: AppRole, userId: string): Promise<boolean> {
  if (role === "restaurant") {
    return isRestaurantProfileComplete(userId);
  }

  return isShelterProfileComplete(userId);
}

export async function getRoleGuardRedirect(expectedRole: AppRole, userId: string): Promise<string | null> {
  const role = await getCurrentUserRole(userId);

  if (!role) {
    return getProfileDetailsPathForRole(expectedRole);
  }

  if (role !== expectedRole) {
    const otherRoleComplete = await isRoleProfileComplete(role, userId);
    return otherRoleComplete ? getDashboardPathForRole(role) : getProfileDetailsPathForRole(role);
  }

  const isComplete = await isRoleProfileComplete(expectedRole, userId);
  return isComplete ? null : getProfileDetailsPathForRole(expectedRole);
}

export async function getAuthenticatedUserDefaultRoute(
  userId: string,
  preferredRole: AppRole
): Promise<string> {
  const role = (await getCurrentUserRole(userId)) || preferredRole;
  const isComplete = await isRoleProfileComplete(role, userId);
  return isComplete ? getDashboardPathForRole(role) : getProfileDetailsPathForRole(role);
}

export async function getCurrentUserRole(userId: string): Promise<AppRole | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return (data?.role as AppRole) || null;
}

export function mapShelterStatusForUi(status: ShelterRequestStatus): "Pending" | "Responded" | "Matched" | "Completed" | "Cancelled" {
  if (status === "open") return "Pending";
  if (status === "responded") return "Responded";
  if (status === "matched") return "Matched";
  if (status === "completed" || status === "fulfilled") return "Completed";
  return "Cancelled";
}

export function canEditCoreRequestFields(status: ShelterRequestStatus): boolean {
  return status === "open";
}

export function canEditPickupWindow(status: ShelterRequestStatus): boolean {
  return status === "open" || status === "responded" || status === "matched";
}
