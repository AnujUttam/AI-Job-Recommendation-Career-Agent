import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  User,
  Wrench,
} from 'lucide-react';
import { useCareer } from '../context/CareerContext';
import { SUGGESTED_QUESTIONS } from '../data/mockData';

function formatInlineMarkdown(line) {
  const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-xs text-slate-900"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function formatMessageText(text) {
  return (text || '').split('\n').map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={idx} className="h-2" />;
    }
    if (trimmed.startsWith('### ')) {
      return (
        <h4 key={idx} className="mt-2 font-semibold">
          {formatInlineMarkdown(trimmed.slice(4))}
        </h4>
      );
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      return (
        <p key={idx} className="mt-1 pl-3">
          • {formatInlineMarkdown(trimmed.slice(2))}
        </p>
      );
    }
    return (
      <p key={idx} className={idx > 0 ? 'mt-1.5' : ''}>
        {formatInlineMarkdown(line)}
      </p>
    );
  });
}

export default function AssistantPage() {
  const {
    profile,
    resume,
    conversations,
    conversationsLoading,
    activeConversationId,
    chatMessages,
    chatLoading,
    chatError,
    lastFailedMessage,
    assistantMeta,
    startNewConversation,
    selectConversation,
    sendMessage,
    retryLastMessage,
  } = useCareer();

  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || chatLoading) return;
    const text = input;
    setInput('');
    sendMessage(text);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left Conversation History Sidebar */}
      <aside className="flex flex-col rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm lg:col-span-3 lg:h-[calc(100vh-9.5rem)]">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Conversations</h2>
          <button
            type="button"
            onClick={startNewConversation}
            className="inline-flex items-center gap-1 rounded-lg bg-navy-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-navy-800"
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </button>
        </div>

        <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto max-h-48 lg:max-h-none">
          {conversationsLoading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
              <span>Loading history...</span>
            </div>
          ) : conversations.length === 0 ? (
            <p className="py-4 text-xs text-slate-500">
              No saved conversations yet. Send a message to start one.
            </p>
          ) : (
            conversations.map((conv) => {
              const isActive = conv._id === activeConversationId;
              return (
                <button
                  key={conv._id}
                  type="button"
                  onClick={() => selectConversation(conv._id)}
                  className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {conv.title || 'Career Guidance Session'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {conv.messages?.length || 0} messages
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Chat Container */}
      <section className="flex h-[calc(100vh-9.5rem)] min-h-[540px] flex-col rounded-xl border border-slate-200/80 bg-white shadow-sm lg:col-span-6">
        {/* Chat Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">CareerAI LangGraph Agent</h2>
              <p className="text-xs text-slate-500">
                {resume.fileName} • {profile.skills.length} active skills
              </p>
            </div>
          </div>

          {assistantMeta ? (
            assistantMeta.isMockResponse ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
                Mock Provider ({assistantMeta.provider}) — Live LLM not configured
              </span>
            ) : (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                Live Gemini ({assistantMeta.model})
              </span>
            )
          ) : (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              Persisted to MongoDB
            </span>
          )}
        </div>

        {/* Message History */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
          {chatMessages.length === 0 && !chatLoading ? (
            <div className="flex h-full flex-col items-center justify-center text-center px-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">
                Start a Career Coaching Conversation
              </h3>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                Ask about recommended jobs, resume ATS feedback, missing skills, or a 4-week
                learning roadmap. Your conversation will be saved automatically.
              </p>
            </div>
          ) : (
            chatMessages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      isUser
                        ? 'bg-navy-900 text-white'
                        : 'border border-indigo-200 bg-indigo-50 text-indigo-600'
                    }`}
                  >
                    {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-navy-900 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div>{formatMessageText(msg.content)}</div>

                    {!isUser && msg.toolsUsed?.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-200/80 pt-2">
                        <Wrench className="h-3 w-3 text-slate-400" />
                        {msg.toolsUsed.map((tool) => (
                          <span
                            key={tool}
                            className="rounded bg-white px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-100"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {chatLoading && (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600">
                <Bot className="h-4 w-4" />
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                <span>Running CareerAI tools and generating reply...</span>
              </div>
            </div>
          )}

          {chatError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"
            >
              <span className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {chatError}
              </span>
              {lastFailedMessage && (
                <button
                  type="button"
                  onClick={retryLastMessage}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-white px-2.5 py-1 font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </button>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSubmit} className="border-t border-slate-200 p-4">
          <div className="flex items-end gap-3">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Ask about skill gaps, resume feedback, or best-fit jobs..."
              className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="submit"
              disabled={!input.trim() || chatLoading}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Press Enter to send, Shift+Enter for a new line.
          </p>
        </form>
      </section>

      {/* Right Suggested Questions & Context Sidebar */}
      <aside className="space-y-5 lg:col-span-3">
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-violet-600" />
            Suggested Prompts
          </h3>
          <div className="mt-4 space-y-2">
            {SUGGESTED_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                disabled={chatLoading}
                onClick={() => sendMessage(question)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-left text-xs font-medium leading-relaxed text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-900 disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Active Context</h3>
          <dl className="mt-3 space-y-2.5 text-xs">
            <div>
              <dt className="text-slate-500">Candidate</dt>
              <dd className="font-medium text-slate-900">{profile.fullName || 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Experience Level</dt>
              <dd className="font-medium text-slate-900">{profile.experienceLevel}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Target Role</dt>
              <dd className="font-medium text-slate-900">
                {profile.desiredRoles?.[0] || 'Not specified'}
              </dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
