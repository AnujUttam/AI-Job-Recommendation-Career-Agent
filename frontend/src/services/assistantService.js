import { apiClient } from '../api/client';

export async function fetchConversations() {
  const { data } = await apiClient.get('/conversations');
  return Array.isArray(data?.conversations) ? data.conversations : [];
}

export async function fetchConversationById(conversationId) {
  const { data } = await apiClient.get(`/conversations/${conversationId}`);
  return data?.conversation || null;
}

export async function sendAssistantMessage({ conversationId, title, message }) {
  const payload = { message };
  if (conversationId) payload.conversationId = conversationId;
  if (title) payload.title = title;

  const { data } = await apiClient.post('/conversations', payload, {
    timeout: 30000,
  });

  if (!data?.latestReply?.content) {
    throw new Error('Assistant returned an empty response.');
  }

  return {
    conversation: data.conversation,
    latestReply: data.latestReply,
    assistantMeta: data.assistantMeta || null,
  };
}
