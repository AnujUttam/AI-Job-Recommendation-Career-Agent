import axios from 'axios';
import { env } from '../config/env.js';
import { Conversation } from '../models/Conversation.js';
import { getRecommendationsForUser } from '../services/recommendationService.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const generateGroundedFallbackReply = async (message, user) => {
  const { recommendations } = await getRecommendationsForUser(user, { limit: 3 });
  const top = recommendations[0];
  const q = message.toLowerCase();

  if (q.includes('skill') || q.includes('gap') || q.includes('missing')) {
    const missing = top?.missingSkills?.length
      ? top.missingSkills.join(', ')
      : 'Kubernetes, TypeScript, and Automated Evaluation';
    return {
      content: `Based on your current skills (${(user.skills || []).slice(0, 6).join(', ') || 'not yet specified'}) and top match **${top?.title || 'AI / Software Engineer'}**, focus next on: **${missing}**.`,
      toolsUsed: ['analyze_skill_gap'],
    };
  }

  if (recommendations.length > 0) {
    const summary = recommendations
      .map((j, i) => `${i + 1}. **${j.title}** at ${j.company} (${j.matchPercentage}% match)`)
      .join('\n');
    return {
      content: `Here are your top recommended roles based on your profile:\n\n${summary}`,
      toolsUsed: ['recommendation_service'],
    };
  }

  return {
    content: `I have your profile loaded (${user.name}). Add skills or upload a resume to get tailored job recommendations and skill-gap guidance.`,
    toolsUsed: ['user_profile_context'],
  };
};

export const getConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({ userId: req.user._id })
    .sort({ updatedAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    conversations,
  });
});

export const createOrAppendConversation = asyncHandler(async (req, res) => {
  const { conversationId, title, message } = req.body;

  let conversation;
  if (conversationId) {
    conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new ApiError(404, 'Conversation not found');
    }
    if (conversation.userId.toString() !== req.user._id.toString()) {
      throw new ApiError(403, 'You do not have permission to access this conversation');
    }
  } else {
    conversation = new Conversation({
      userId: req.user._id,
      title: title || message.slice(0, 60),
      messages: [],
    });
  }

  conversation.messages.push({
    role: 'user',
    content: message,
  });

  let assistantReply = null;
  let assistantMeta = null;

  if (env.aiServiceUrl) {
    try {
      const priorHistory = conversation.messages
        .slice(0, -1)
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const headers = {};
      if (env.internalApiKey) {
        headers['X-Internal-API-Key'] = env.internalApiKey;
      }
      if (req.headers.authorization) {
        headers.Authorization = req.headers.authorization;
      }

      const response = await axios.post(
        `${env.aiServiceUrl}/ai/assistant/chat`,
        {
          conversationId: conversation._id.toString(),
          message,
          userProfile: req.user,
          history: priorHistory,
        },
        {
          timeout: env.aiServiceTimeoutMs,
          headers,
        }
      );

      if (response.data?.content) {
        assistantReply = {
          content: response.data.content,
          toolsUsed: response.data.toolsUsed || [],
        };
        assistantMeta = {
          intent: response.data.intent || null,
          provider: response.data.provider || null,
          isMockResponse: Boolean(response.data.isMockResponse),
          model: response.data.model || null,
        };
      }
    } catch {
      // Fall back cleanly when AI assistant service is offline or unconfigured.
    }
  }

  if (!assistantReply) {
    assistantReply = await generateGroundedFallbackReply(message, req.user);
    assistantMeta = {
      intent: 'fallback',
      provider: 'backend_fallback',
      isMockResponse: true,
      model: 'deterministic-fallback',
    };
  }

  conversation.messages.push({
    role: 'assistant',
    content: assistantReply.content,
    toolsUsed: assistantReply.toolsUsed,
  });

  await conversation.save();

  res.status(conversationId ? 200 : 201).json({
    success: true,
    conversation,
    latestReply: conversation.messages[conversation.messages.length - 1],
    assistantMeta,
  });
});

export const getConversationById = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id).lean();
  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }
  if (conversation.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You do not have permission to access this conversation');
  }

  res.status(200).json({
    success: true,
    conversation,
  });
});
