import { apiClient } from '../api/client';

/**
 * Persist candidate profile and preferences via backend API.
 */
export async function saveCandidateProfile(updatedProfile) {
  const payload = {
    name: updatedProfile.fullName,
    headline: updatedProfile.headline,
    currentLocation: updatedProfile.currentLocation,
    bio: updatedProfile.bio,
    githubUrl: updatedProfile.githubUrl,
    linkedinUrl: updatedProfile.linkedinUrl,
    skills: updatedProfile.skills,
    preferences: {
      experienceLevel: updatedProfile.experienceLevel,
      yearsOfExperience: updatedProfile.yearsOfExperience,
      preferredLocations: updatedProfile.preferredLocations,
      remotePreference: updatedProfile.remotePreference,
      desiredRoles: updatedProfile.desiredRoles,
    },
  };

  const { data } = await apiClient.put('/users/profile', payload);
  if (!data?.user) {
    throw new Error('Server returned an invalid profile update response.');
  }

  return {
    ...updatedProfile,
    fullName: data.user.name || updatedProfile.fullName,
    skills: Array.isArray(data.user.skills) ? data.user.skills : updatedProfile.skills,
    updatedAt: data.user.updatedAt || new Date().toISOString(),
  };
}
