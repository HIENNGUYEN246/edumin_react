import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '../../api/chatApi.js';
import { useAuth } from './AuthProvider.jsx';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Active floating chat windows docked at bottom-right (max 2 open at a time)
  const [activeChats, setActiveChats] = useState([]);
  // Contact picker modal state for composing a new message
  const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);

  // Poll channels for recent conversations and total unread count
  const { data: channelsData, refetch: refetchChannels } = useQuery({
    queryKey: ['chat-channels'],
    queryFn: () => chatApi.getChannels(),
    enabled: Boolean(user),
    refetchInterval: 4000,
  });

  const classGroups = useMemo(() => channelsData?.classGroups || [], [channelsData]);
  const directConversations = useMemo(() => channelsData?.directConversations || [], [channelsData]);
  const contacts = useMemo(() => channelsData?.contacts || [], [channelsData]);
  const totalUnread = channelsData?.totalUnread || 0;

  // Compute a unique key for each conversation
  const getChatKey = useCallback((item) => {
    if (!item) return '';
    if (item.type === 'class_group') {
      return `class_${item.classId}`;
    }
    const partnerId = item.recipientId || item.partnerId || item._id;
    return `direct_${partnerId}`;
  }, []);

  /**
   * Opens a chat window for a specific target (Class Group or 1-on-1 User).
   * Brings it to focus and expands it if minimized.
   */
  const openChat = useCallback((target) => {
    if (!target) return;
    const key = getChatKey(target);
    if (!key) return;

    setActiveChats((prev) => {
      const existingIndex = prev.findIndex((c) => c.key === key);
      if (existingIndex >= 0) {
        // Bring to front and expand
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          isMinimized: false,
        };
        return updated;
      }

      const newChat = {
        key,
        type: target.type || 'direct',
        classId: target.classId,
        recipientId: target.recipientId || target.partnerId || target._id,
        title: target.title || target.courseName || target.name || target.classId || 'Hội thoại',
        subtitle: target.courseCode || target.role || target.email || '',
        avatar: target.avatar || '',
        role: target.role || '',
        code: target.code || '',
        inMyClass: target.inMyClass,
        studentCount: target.studentCount,
        teacher: target.teacher,
        isMinimized: false,
      };

      // Limit to 2 concurrent open chat windows at bottom-right (like Facebook desktop)
      if (prev.length >= 2) {
        return [prev[prev.length - 1], newChat];
      }
      return [...prev, newChat];
    });
  }, [getChatKey]);

  /**
   * Closes a chat window.
   */
  const closeChat = useCallback((chatKey) => {
    setActiveChats((prev) => prev.filter((c) => c.key !== chatKey));
  }, []);

  /**
   * Toggles minimized state of a chat window.
   */
  const toggleMinimizeChat = useCallback((chatKey) => {
    setActiveChats((prev) =>
      prev.map((c) => (c.key === chatKey ? { ...c, isMinimized: !c.isMinimized } : c))
    );
  }, []);

  /**
   * Closes all chat windows.
   */
  const closeAllChats = useCallback(() => {
    setActiveChats([]);
  }, []);

  // Listen to global open chat events
  useEffect(() => {
    const handleOpenChatEvent = (e) => {
      if (e?.detail) {
        openChat(e.detail);
      }
    };
    window.addEventListener('edumin:open-chat', handleOpenChatEvent);
    return () => {
      window.removeEventListener('edumin:open-chat', handleOpenChatEvent);
    };
  }, [openChat]);

  const value = useMemo(
    () => ({
      activeChats,
      openChat,
      closeChat,
      toggleMinimizeChat,
      closeAllChats,
      classGroups,
      directConversations,
      contacts,
      totalUnread,
      refetchChannels,
      isNewMessageModalOpen,
      setIsNewMessageModalOpen,
    }),
    [
      activeChats,
      openChat,
      closeChat,
      toggleMinimizeChat,
      closeAllChats,
      classGroups,
      directConversations,
      contacts,
      totalUnread,
      refetchChannels,
      isNewMessageModalOpen,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    return {
      activeChats: [],
      openChat: () => {},
      closeChat: () => {},
      toggleMinimizeChat: () => {},
      closeAllChats: () => {},
      classGroups: [],
      directConversations: [],
      totalUnread: 0,
      refetchChannels: () => {},
      isNewMessageModalOpen: false,
      setIsNewMessageModalOpen: () => {},
    };
  }
  return context;
}

export default ChatProvider;

