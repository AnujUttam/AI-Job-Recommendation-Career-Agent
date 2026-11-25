import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { getRankedJobs } from '../services/jobService';
import { saveCandidateProfile } from '../services/profileService';
import {
  fetchConversationById,
  fetchConversations,
  sendAssistantMessage,
} from '../services/assistantService';
import { getLatestResume } from '../services/resumeService';
import {
  fetchSavedJobs,
  removeSavedJobById,
  saveJobById,
} from '../services/savedJobService';

const CareerContext = createContext(null);

const createEmptyProfile = (user = null) => ({
  fullName: user?.name || '',
  email: user?.email || '',
  headline: user?.headline || 'Software & AI Candidate',
  currentLocation: user?.currentLocation || '',
  experienceLevel: user?.preferences?.experienceLevel || 'Entry Level (0-2 yrs)',
  yearsOfExperience: user?.preferences?.yearsOfExperience ?? 0,
  bio: user?.bio || '',
  githubUrl: user?.githubUrl || '',
  linkedinUrl: user?.linkedinUrl || '',
  skills: Array.isArray(user?.skills) ? user.skills : [],
  preferredLocations: Array.isArray(user?.preferences?.preferredLocations)
    ? user.preferences.preferredLocations
    : [],
  remotePreference: user?.preferences?.remotePreference || 'Hybrid or Remote',
  desiredRoles: Array.isArray(user?.preferences?.desiredRoles)
    ? user.preferences.desiredRoles
    : [],
});

const createEmptyResume = () => ({
  fileName: 'No resume uploaded yet',
  uploadedAt: null,
  fileSizeKb: 0,
  atsScore: 0,
  completionPercentage: 0,
  sectionsCompleted: [
    { key: 'summary', label: 'Professional Summary', completed: false },
    { key: 'skills', label: 'Technical Skills', completed: false },
    { key: 'experience', label: 'Work Experience', completed: false },
    { key: 'projects', label: 'Key Projects', completed: false },
    { key: 'education', label: 'Education', completed: false },
  ],
  summary:
    'Upload your PDF resume in Resume Analyzer to extract your skills, experience, and personalized match insights.',
  strengths: [],
  improvements: [],
  extractedSkills: {},
  education: [],
  experience: [],
  projects: [],
});

const mapConversationMessages = (conversation) =>
  (conversation?.messages || []).map((m, idx) => ({
    id: `${conversation._id}-${idx}-${m.createdAt || ''}`,
    role: m.role,
    content: m.content,
    toolsUsed: m.toolsUsed || [],
    timestamp: m.createdAt || conversation.updatedAt || new Date().toISOString(),
  }));

export function CareerProvider({ children }) {
  const { user, isAuthenticated } = useAuth();

  const [profile, setProfile] = useState(() => createEmptyProfile(user));
  const [resume, setResume] = useState(() => createEmptyResume());
  const [resumeLoading, setResumeLoading] = useState(false);

  const [rankedJobs, setRankedJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState('');
  const [rankingMode, setRankingMode] = useState('deterministic_fallback');

  const [savedJobIds, setSavedJobIds] = useState([]);
  const [recentJobIds, setRecentJobIds] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [lastFailedMessage, setLastFailedMessage] = useState('');
  const [assistantMeta, setAssistantMeta] = useState(null);

  const loadJobs = useCallback(
    async (activeProfile) => {
      if (!isAuthenticated) return;
      setJobsLoading(true);
      setJobsError('');
      try {
        const result = await getRankedJobs(activeProfile);
        setRankedJobs(result.jobs || []);
        setRankingMode(result.rankingMode || 'deterministic_fallback');
      } catch (err) {
        setJobsError(err.message || 'Failed to load job recommendations.');
      } finally {
        setJobsLoading(false);
      }
    },
    [isAuthenticated]
  );

  // Hydrate or reset all user-specific state whenever authentication changes.
  useEffect(() => {
    let active = true;

    if (!isAuthenticated || !user) {
      setProfile(createEmptyProfile(null));
      setResume(createEmptyResume());
      setResumeLoading(false);
      setRankedJobs([]);
      setJobsLoading(false);
      setJobsError('');
      setSavedJobIds([]);
      setRecentJobIds([]);
      setSelectedJobId(null);
      setConversations([]);
      setConversationsLoading(false);
      setActiveConversationId(null);
      setChatMessages([]);
      setChatLoading(false);
      setChatError('');
      setLastFailedMessage('');
      setAssistantMeta(null);
      return undefined;
    }

    const hydratedProfile = createEmptyProfile(user);
    setProfile(hydratedProfile);
    setResumeLoading(true);
    setConversationsLoading(true);

    Promise.allSettled([getLatestResume(), fetchSavedJobs(), fetchConversations()]).then(
      ([resumeRes, savedRes, convRes]) => {
        if (!active) return;

        if (resumeRes.status === 'fulfilled' && resumeRes.value) {
          setResume(resumeRes.value);
        } else {
          setResume(createEmptyResume());
        }
        setResumeLoading(false);

        if (savedRes.status === 'fulfilled' && Array.isArray(savedRes.value)) {
          setSavedJobIds(
            savedRes.value
              .map((entry) => entry.job?._id || entry.job?.id)
              .filter(Boolean)
          );
        }

        if (convRes.status === 'fulfilled' && Array.isArray(convRes.value)) {
          setConversations(convRes.value);
          if (convRes.value.length > 0) {
            const latestConv = convRes.value[0];
            setActiveConversationId(latestConv._id);
            setChatMessages(mapConversationMessages(latestConv));
          } else {
            setActiveConversationId(null);
            setChatMessages([]);
          }
        }
        setConversationsLoading(false);
      }
    );

    return () => {
      active = false;
    };
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadJobs(profile);
  }, [isAuthenticated, profile, loadJobs]);

  const toggleSaveJob = async (jobId) => {
    const currentlySaved = savedJobIds.includes(jobId);
    setSavedJobIds((prev) =>
      currentlySaved ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );

    if (!isAuthenticated) return;

    try {
      if (currentlySaved) {
        await removeSavedJobById(jobId);
      } else {
        await saveJobById(jobId);
      }
    } catch {
      setSavedJobIds((prev) =>
        currentlySaved ? [...prev, jobId] : prev.filter((id) => id !== jobId)
      );
    }
  };

  const openJobDetail = (jobId) => {
    setSelectedJobId(jobId);
    setRecentJobIds((prev) => [jobId, ...prev.filter((id) => id !== jobId)].slice(0, 5));
  };

  const closeJobDetail = () => setSelectedJobId(null);

  const updateProfile = async (nextProfile) => {
    const saved = await saveCandidateProfile(nextProfile);
    setProfile(saved);
    return saved;
  };

  const applyParsedResume = (parsedResume) => {
    setResume(parsedResume);
    const flattenedSkills = Object.values(parsedResume.extractedSkills || {}).flat();
    if (flattenedSkills.length > 0) {
      setProfile((prev) => ({
        ...prev,
        skills: Array.from(new Set([...prev.skills, ...flattenedSkills])),
      }));
    }
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
    setChatMessages([]);
    setChatError('');
    setLastFailedMessage('');
  };

  const selectConversation = async (conversationId) => {
    if (!conversationId) return;
    setChatError('');
    setChatLoading(true);
    try {
      const conv = await fetchConversationById(conversationId);
      if (conv) {
        setActiveConversationId(conv._id);
        setChatMessages(mapConversationMessages(conv));
      }
    } catch (err) {
      setChatError(err.message || 'Failed to load selected conversation.');
    } finally {
      setChatLoading(false);
    }
  };

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || chatLoading) return;

    setChatError('');
    setLastFailedMessage('');

    const optimisticUserMsg = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const previousMessages = chatMessages;
    setChatMessages((prev) => [...prev, optimisticUserMsg]);
    setChatLoading(true);

    try {
      const result = await sendAssistantMessage({
        conversationId: activeConversationId,
        message: trimmed,
      });

      const updatedConv = result.conversation;
      setActiveConversationId(updatedConv._id);
      setChatMessages(mapConversationMessages(updatedConv));
      setAssistantMeta(result.assistantMeta);

      setConversations((prev) => {
        const filtered = prev.filter((c) => c._id !== updatedConv._id);
        return [updatedConv, ...filtered];
      });
    } catch (err) {
      setChatMessages(previousMessages);
      setChatError(err.message || 'Failed to get response from Career Assistant.');
      setLastFailedMessage(trimmed);
    } finally {
      setChatLoading(false);
    }
  };

  const retryLastMessage = () => {
    if (lastFailedMessage) {
      sendMessage(lastFailedMessage);
    }
  };

  const selectedJob = useMemo(
    () => rankedJobs.find((job) => job.id === selectedJobId) || null,
    [rankedJobs, selectedJobId]
  );

  const recentlyViewedJobs = useMemo(
    () =>
      recentJobIds
        .map((id) => rankedJobs.find((job) => job.id === id))
        .filter(Boolean),
    [recentJobIds, rankedJobs]
  );

  const value = {
    profile,
    resume,
    resumeLoading,
    rankedJobs,
    jobsLoading,
    jobsError,
    rankingMode,
    refreshJobs: () => loadJobs(profile),
    savedJobIds,
    recentlyViewedJobs,
    selectedJob,
    conversations,
    conversationsLoading,
    activeConversationId,
    chatMessages,
    chatLoading,
    chatError,
    lastFailedMessage,
    assistantMeta,
    toggleSaveJob,
    openJobDetail,
    closeJobDetail,
    updateProfile,
    applyParsedResume,
    startNewConversation,
    selectConversation,
    sendMessage,
    retryLastMessage,
    clearChat: startNewConversation,
  };

  return <CareerContext.Provider value={value}>{children}</CareerContext.Provider>;
}

export function useCareer() {
  const ctx = useContext(CareerContext);
  if (!ctx) {
    throw new Error('useCareer must be used within a CareerProvider');
  }
  return ctx;
}
