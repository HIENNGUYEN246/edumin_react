import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '../../api/chatApi.js';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { useChat } from '../../app/providers/ChatProvider.jsx';
import { Avatar } from '../ui/Avatar.jsx';

// Format bytes into readable file size
function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Format duration in seconds to mm:ss
function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Get document icon based on file extension
function getDocumentIcon(name = '') {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) {
    return <i className="fas fa-file-pdf text-rose-500 text-base" />;
  }
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) {
    return <i className="fas fa-file-word text-blue-500 text-base" />;
  }
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) {
    return <i className="fas fa-file-excel text-emerald-500 text-base" />;
  }
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) {
    return <i className="fas fa-file-powerpoint text-amber-500 text-base" />;
  }
  if (lower.endsWith('.zip') || lower.endsWith('.rar')) {
    return <i className="fas fa-file-zipper text-purple-500 text-base" />;
  }
  return <i className="fas fa-file-lines text-indigo-500 text-base" />;
}

function removeVietnameseTones(str = '') {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function escapeRegExp(string = '') {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderMessageContent(content = '', isOwn = false, isMentioned = false, members = []) {
  if (!content) return null;

  const names = [
    'all',
    'admin',
    'đào tạo',
    'dao tao',
    'Tất cả cả lớp',
    'Ban Quản trị & Đào tạo',
    ...(members || []).map((m) => m?.name),
  ].filter(Boolean);

  names.sort((a, b) => b.length - a.length);

  const patternStr =
    names.length > 0
      ? `(@(?:${names.map(escapeRegExp).join('|')}|[A-Za-z0-9_\\u00C0-\\u1EF9]+))`
      : '(@[A-Za-z0-9_\\u00C0-\\u1EF9]+)';

  const mentionRegex = new RegExp(patternStr, 'gi');
  const parts = content.split(mentionRegex);

  return (
    <span>
      {parts.map((part, i) => {
        if (part && part.startsWith('@')) {
          return (
            <span
              key={i}
              className={`font-bold px-1.5 py-0.5 rounded-md mx-0.5 inline-block text-[11px] ${
                isOwn
                  ? 'bg-white/25 text-white'
                  : isMentioned
                    ? 'bg-amber-200 text-amber-900 border border-amber-300'
                    : 'bg-indigo-100 text-indigo-800 border border-indigo-200/60'
              }`}
            >
              {part}
            </span>
          );
        }
        return part;
      })}
    </span>
  );
}

// Interactive Voice Note Player Component
function VoiceMessagePlayer({ src, duration = 0, isOwn = false }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const totalTime = duration > 0 ? duration : (audioRef.current?.duration || 0);
  const progressPercent = totalTime > 0 ? Math.min(100, (currentTime / totalTime) * 100) : 0;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-2xl min-w-[190px] shadow-xs select-none ${
        isOwn
          ? 'bg-indigo-700/80 text-white border border-indigo-400/30'
          : 'bg-white text-slate-800 border border-slate-200'
      }`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onTimeUpdate={handleTimeUpdate}
      />

      <button
        type="button"
        onClick={togglePlay}
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition cursor-pointer ${
          isOwn
            ? 'bg-white text-indigo-600 hover:bg-indigo-50'
            : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }`}
        title={isPlaying ? 'Tạm dừng' : 'Nghe tin nhắn thoại'}
      >
        <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play text-xs'} ${isPlaying ? 'text-[10px]' : 'ml-0.5'}`} />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[10px] font-mono leading-none mb-1">
          <span className={isOwn ? 'text-indigo-100' : 'text-slate-500'}>
            {formatDuration(currentTime > 0 ? currentTime : totalTime)}
          </span>
          <span className={`flex items-center gap-1 ${isOwn ? 'text-indigo-200' : 'text-slate-400'}`}>
            <i className="fas fa-microphone text-[9px]" />
            <span>Thoại</span>
          </span>
        </div>

        {/* Progress bar */}
        <div className={`w-full h-1.5 rounded-full overflow-hidden ${isOwn ? 'bg-indigo-900/40' : 'bg-slate-200'}`}>
          <div
            className={`h-full transition-all duration-100 ${isOwn ? 'bg-white' : 'bg-indigo-600'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

const EMOJI_CATEGORIES = [
  {
    title: 'Cảm xúc phổ biến',
    emojis: ['😀', '😂', '🤣', '😊', '😍', '🥰', '😎', '🤔', '🤫', '😭', '🥳', '😴', '😇', '🤩', '👍', '👎', '👏', '❤️', '🔥', '⭐', '💡', '🎉'],
  },
  {
    title: 'Học tập & Nhà trường',
    emojis: ['📚', '🎓', '✍️', '📝', '📖', '🏫', '🎒', '📌', '⏰', '💬', '🔔', '💻', '📄', '📜', '📐', '🔬', '✨', '💯'],
  },
];

export function FloatingChatWindow({ chat }) {
  const { user } = useAuth();
  const { closeChat, toggleMinimizeChat, refetchChannels } = useChat();
  const queryClient = useQueryClient();

  const [inputText, setInputText] = useState('');
  const [stagedAttachments, setStagedAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [lightboxImg, setLightboxImg] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const docInputRef = useRef(null);
  const imgInputRef = useRef(null);
  const emojiPickerRef = useRef(null);

  // Audio recording refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const role = user?.role || '';
  const isAdmin = role === 'dao-tao' || role === 'admin';
  const isTeacher = role === 'giao-vien' || role === 'teacher';

  // 1. Fetch messages for this target
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['chat-messages', chat.type, chat.type === 'class_group' ? chat.classId : chat.recipientId],
    queryFn: () =>
      chatApi.getMessages({
        type: chat.type,
        classId: chat.classId,
        recipientId: chat.recipientId,
      }),
    refetchInterval: 2500,
    enabled: Boolean(chat),
  });

  const messages = messagesData?.data?.messages || [];
  const classInfo = messagesData?.data?.classInfo || {};
  const currentStudentCount = classInfo.studentCount ?? chat.studentCount;

  // Auto-scroll to bottom
  useEffect(() => {
    if (!chat.isMinimized && messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, stagedAttachments.length, chat.isMinimized]);

  // Focus input when opened
  useEffect(() => {
    if (!chat.isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [chat.isMinimized]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // Mention states for class group chat
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const [selectedMentionIdx, setSelectedMentionIdx] = useState(0);
  const [stagedMentions, setStagedMentions] = useState([]);

  const isClass = chat.type === 'class_group';
  const classMembers = classInfo.members || [];

  const filteredMentionMembers = useMemo(() => {
    if (mentionQuery === null) return [];
    const qNorm = removeVietnameseTones(mentionQuery);
    return classMembers.filter((m) => {
      if (!qNorm) return true;
      const nameNorm = removeVietnameseTones(m.name);
      const codeNorm = removeVietnameseTones(m.code || '');
      const roleNorm = removeVietnameseTones(m.role || '');
      const mentionKeyNorm = removeVietnameseTones(m.mentionKey || '');
      return (
        nameNorm.includes(qNorm) ||
        codeNorm.includes(qNorm) ||
        roleNorm.includes(qNorm) ||
        mentionKeyNorm.includes(qNorm)
      );
    });
  }, [classMembers, mentionQuery]);

  useEffect(() => {
    setSelectedMentionIdx(0);
  }, [mentionQuery]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setInputText(val);

    if (!isClass) {
      setMentionQuery(null);
      return;
    }

    const leftText = val.slice(0, pos);
    const lastAtIndex = leftText.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const charBeforeAt = lastAtIndex > 0 ? leftText[lastAtIndex - 1] : ' ';
      const textAfterAt = leftText.slice(lastAtIndex + 1);
      if (/\s/.test(charBeforeAt) && !/\n/.test(textAfterAt) && textAfterAt.length <= 30) {
        setMentionQuery(textAfterAt);
        setMentionCursorPos(lastAtIndex);
        return;
      }
    }
    setMentionQuery(null);
  };

  const insertMention = (member) => {
    if (!member) return;
    const beforeAt = inputText.slice(0, mentionCursorPos);
    const afterAt = inputText.slice(mentionCursorPos + 1 + (mentionQuery || '').length);
    const mentionTag = `@${member.name} `;
    const newText = `${beforeAt}${mentionTag}${afterAt}`;
    setInputText(newText);
    setMentionQuery(null);

    setStagedMentions((prev) => {
      if (prev.some((m) => m.userId === member.userId && m.name === member.name)) {
        return prev;
      }
      return [...prev, { userId: member.userId, name: member.name, role: member.role }];
    });

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const nextPos = beforeAt.length + mentionTag.length;
        inputRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 50);
  };

  const handleInputKeyDown = (e) => {
    if (mentionQuery !== null && filteredMentionMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIdx((prev) => (prev + 1) % filteredMentionMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIdx((prev) => (prev - 1 + filteredMentionMembers.length) % filteredMentionMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const member = filteredMentionMembers[selectedMentionIdx] || filteredMentionMembers[0];
        if (member) {
          insertMention(member);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
  };

  const handleTriggerMention = () => {
    if (isRecording) return;
    const currentVal = inputText;
    const appendSpace = currentVal.length > 0 && !currentVal.endsWith(' ') ? ' ' : '';
    const newText = `${currentVal}${appendSpace}@`;
    setInputText(newText);
    setMentionQuery('');
    setMentionCursorPos(newText.length - 1);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newText.length, newText.length);
      }
    }, 50);
  };

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (payload) => chatApi.sendMessage(payload),
    onSuccess: () => {
      setInputText('');
      setStagedAttachments([]);
      setStagedMentions([]);
      setMentionQuery(null);
      queryClient.invalidateQueries({
        queryKey: ['chat-messages', chat.type, chat.type === 'class_group' ? chat.classId : chat.recipientId],
      });
      refetchChannels();
    },
  });

  const handleSendMessage = (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    if ((!text && stagedAttachments.length === 0) || sendMutation.isPending || isUploading) return;

    const payload = {
      type: chat.type,
      classId: chat.classId,
      recipientId: chat.recipientId,
      content: text,
      ...(stagedAttachments.length > 0 ? { attachments: stagedAttachments } : {}),
      ...(stagedMentions.length > 0 ? { mentions: stagedMentions } : {}),
    };

    sendMutation.mutate(payload);
  };

  // Upload attachment (Document / Image)
  const handleUploadFile = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await chatApi.uploadAttachment(formData);
      if (res?.file) {
        setStagedAttachments((prev) => [...prev, res.file]);
      }
    } catch (err) {
      console.error('Lỗi khi tải tệp:', err);
      alert(err?.message || 'Không thể tải tệp lên');
    } finally {
      setIsUploading(false);
    }
  };

  // Voice Chat: Start Recording
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Trình duyệt của bạn không hỗ trợ ghi âm trực tiếp.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const duration = recordingSeconds;
        clearInterval(recordingTimerRef.current);
        setIsRecording(false);
        setRecordingSeconds(0);

        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size < 100) return;

        const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });

        setIsUploading(true);
        try {
          const formData = new FormData();
          formData.append('file', audioFile);
          formData.append('duration', String(duration));
          const res = await chatApi.uploadAttachment(formData);
          if (res?.file) {
            setStagedAttachments((prev) => [...prev, res.file]);
          }
        } catch (err) {
          console.error('Lỗi khi tải voice chat:', err);
        } finally {
          setIsUploading(false);
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Không thể truy cập micro:', err);
      alert('Không thể truy cập microphone. Vui lòng cấp quyền truy cập micro cho trang web.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // Remove a staged attachment before sending
  const handleRemoveStagedAttachment = (idx) => {
    setStagedAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // Add emoji to input
  const handleSelectEmoji = (emoji) => {
    setInputText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleInsertAnnouncementTemplate = () => {
    setInputText((prev) => (prev ? prev : '[Thông báo lớp học]: '));
    inputRef.current?.focus();
  };

  const roleBadge = (r) => {
    if (r === 'dao-tao' || r === 'admin') {
      return (
        <span className="px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-700 text-[10px] font-bold">
          Đào tạo
        </span>
      );
    }
    if (r === 'giao-vien' || r === 'teacher') {
      return (
        <span className="px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-bold">
          Giáo viên
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold">
        Sinh viên
      </span>
    );
  };

  return (
    <>
      <div
        data-testid={`floating-chat-${chat.key}`}
        className={`bg-white rounded-t-2xl shadow-2xl border border-slate-200/90 flex flex-col transition-all duration-200 overflow-hidden ${
          chat.isMinimized
            ? 'w-64 h-11'
            : 'w-80 sm:w-96 h-[480px] max-h-[85vh]'
        }`}
      >
        {/* Facebook-style Chat Header */}
        <div
          onClick={() => chat.isMinimized && toggleMinimizeChat(chat.key)}
          className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white px-3.5 py-2.5 flex items-center justify-between shadow-xs select-none cursor-pointer shrink-0"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Avatar or Class Icon */}
            {isClass ? (
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 shadow-xs border border-white/20">
                <i className="fas fa-graduation-cap text-xs" />
              </div>
            ) : (
              <div className="relative shrink-0">
                <Avatar src={chat.avatar} name={chat.title} size={32} />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-indigo-700" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate">
                <h4 className="text-xs font-bold text-white truncate max-w-[150px] sm:max-w-[190px]" title={chat.title}>
                  {chat.title}
                </h4>
                {!isClass && chat.code && (
                  <span className="font-mono text-[9px] font-bold text-indigo-100 bg-white/20 px-1 py-0.2 rounded shrink-0">
                    {chat.code}
                  </span>
                )}
                {!isClass && chat.role && roleBadge(chat.role)}
                {!isClass && chat.inMyClass === false && (
                  <span className="px-1.5 py-0.2 rounded bg-white/20 text-indigo-100 text-[9px] font-semibold shrink-0">
                    Lớp ngoài
                  </span>
                )}
              </div>
              <p className="text-[10px] text-indigo-100/90 truncate">
                {isClass
                  ? `Lớp ${chat.classId}${
                      currentStudentCount !== undefined && currentStudentCount !== null
                        ? currentStudentCount > 0
                          ? ` • ${currentStudentCount} SV`
                          : ' • Chưa có SV'
                        : ''
                    }${chat.teacher ? ` • GV: ${chat.teacher}` : ''}`
                  : 'Đang hoạt động'}
              </p>
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {isClass && (isAdmin || isTeacher) && !chat.isMinimized && (
              <button
                type="button"
                onClick={handleInsertAnnouncementTemplate}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition text-xs cursor-pointer"
                title="Chèn mẫu thông báo nhanh"
              >
                <i className="fas fa-bullhorn text-[11px]" />
              </button>
            )}

            <button
              type="button"
              onClick={() => toggleMinimizeChat(chat.key)}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition text-xs cursor-pointer"
              title={chat.isMinimized ? 'Mở rộng ô chat' : 'Thu nhỏ ô chat'}
              aria-label={chat.isMinimized ? 'Mở rộng' : 'Thu nhỏ'}
            >
              <i className={`fas ${chat.isMinimized ? 'fa-chevron-up' : 'fa-minus'} text-[11px]`} />
            </button>

            <button
              type="button"
              onClick={() => closeChat(chat.key)}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition text-xs cursor-pointer"
              title="Đóng ô chat"
              aria-label="Đóng"
            >
              <i className="fas fa-xmark text-xs" />
            </button>
          </div>
        </div>

        {/* Messages Stream & Input */}
        {!chat.isMinimized && (
          <>
            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5 bg-slate-50/70 text-xs">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                  <i className="fas fa-spinner fa-spin text-indigo-500" />
                  <span>Đang tải tin nhắn...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-10 px-4 text-slate-400">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-2">
                    <i className="fas fa-comments text-base" />
                  </div>
                  <p className="font-semibold text-slate-600">Chưa có tin nhắn nào</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {isClass
                      ? 'Gửi tin nhắn hoặc thông báo đầu tiên cho các thành viên trong lớp học phần.'
                      : 'Hãy gửi lời chào đầu tiên để bắt đầu trò chuyện.'}
                  </p>
                </div>
              ) : (
                messages.map((m, mIdx) => {
                  const isOwn = m.isOwn || m.sender === user?._id || m.sender === user?.id;
                  const isMentioned = Boolean(
                    !isOwn &&
                    m.mentions &&
                    m.mentions.some(
                      (men) =>
                        String(men.userId) === String(user?._id) ||
                        String(men.userId) === String(user?.id) ||
                        men.name === 'all' ||
                        (isAdmin && (men.role === 'admin' || men.role === 'dao-tao' || men.name === 'admin'))
                    )
                  );
                  const timeStr = m.createdAt
                    ? new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                    : '';

                  const attachments = m.attachments || [];

                  return (
                    <div
                      key={m._id || m.id || mIdx}
                      className={`flex items-start gap-1.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {!isOwn && (
                        <Avatar src={m.senderAvatar} name={m.senderName} size={28} className="mt-0.5 shrink-0" />
                      )}

                      <div className={`max-w-[78%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                        {!isOwn && isClass && (
                          <div className="flex items-center gap-1 mb-0.5 px-1">
                            <span className="text-[10px] font-bold text-slate-700 truncate max-w-[130px]">
                              {m.senderName}
                            </span>
                            {roleBadge(m.senderRole)}
                          </div>
                        )}

                        {/* Mention banner if current user was tagged */}
                        {isMentioned && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/95 border border-amber-300 px-2 py-0.5 rounded-md mb-1 shadow-2xs">
                            <i className="fas fa-bell text-amber-600 animate-bounce" />
                            <span>Bạn được nhắc nhở trong tin nhắn này</span>
                          </div>
                        )}

                        {/* Attachments rendering */}
                        {attachments.length > 0 && (
                          <div className="space-y-1.5 mb-1 w-full">
                            {attachments.map((att, aIdx) => {
                              // 1. Image
                              if (att.type === 'image') {
                                return (
                                  <div
                                    key={aIdx}
                                    onClick={() => setLightboxImg(att)}
                                    className="relative group rounded-xl overflow-hidden cursor-zoom-in border border-slate-200/90 shadow-2xs max-w-[220px]"
                                  >
                                    <img
                                      src={att.url}
                                      alt={att.name || 'Ảnh đính kèm'}
                                      className="w-full h-auto max-h-[160px] object-cover rounded-xl transition duration-200 group-hover:scale-102"
                                      loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1">
                                      <i className="fas fa-magnifying-glass-plus text-xs" />
                                      <span>Xem ảnh</span>
                                    </div>
                                  </div>
                                );
                              }

                              // 2. Audio / Voice Chat
                              if (att.type === 'audio') {
                                return (
                                  <VoiceMessagePlayer
                                    key={aIdx}
                                    src={att.url}
                                    duration={att.duration}
                                    isOwn={isOwn}
                                  />
                                );
                              }

                              // 3. Document
                              return (
                                <a
                                  key={aIdx}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-2 p-2 rounded-xl transition shadow-2xs max-w-[240px] border ${
                                    isOwn
                                      ? 'bg-indigo-700/80 text-white border-indigo-500/40 hover:bg-indigo-700'
                                      : 'bg-white text-slate-800 border-slate-200/90 hover:bg-slate-50'
                                  }`}
                                  title={`Tải xuống: ${att.name}`}
                                >
                                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0 shadow-2xs">
                                    {getDocumentIcon(att.name)}
                                  </div>
                                  <div className="flex-1 min-w-0 text-left">
                                    <p className="text-xs font-bold truncate">{att.name || 'Tài liệu'}</p>
                                    <p className={`text-[10px] ${isOwn ? 'text-indigo-200' : 'text-slate-400'}`}>
                                      {formatFileSize(att.size) || 'Tài liệu đính kèm'}
                                    </p>
                                  </div>
                                  <i className="fas fa-arrow-down-to-bracket text-xs opacity-75 shrink-0" />
                                </a>
                              );
                            })}
                          </div>
                        )}

                        {/* Text Content */}
                        {m.content && (
                          <div
                            className={`px-3 py-2 text-xs rounded-2xl leading-relaxed whitespace-pre-wrap break-words shadow-2xs ${
                              isOwn
                                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-xs shadow-indigo-500/10'
                                : isMentioned
                                  ? 'bg-amber-50 border-2 border-amber-400 text-amber-950 font-medium rounded-tl-xs shadow-amber-200/50'
                                  : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs'
                            }`}
                          >
                            {renderMessageContent(m.content, isOwn, isMentioned, classMembers)}
                          </div>
                        )}

                        {timeStr && (
                          <span className="text-[9px] text-slate-400 mt-0.5 px-1 font-mono">
                            {timeStr}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Staged Attachments Preview Bar */}
            {stagedAttachments.length > 0 && (
              <div className="p-2 bg-slate-100/90 border-t border-slate-200/80 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
                {stagedAttachments.map((file, idx) => (
                  <div
                    key={idx}
                    className="relative flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs shrink-0 shadow-2xs group"
                  >
                    {file.type === 'image' ? (
                      <img src={file.url} alt={file.name} className="w-6 h-6 object-cover rounded" />
                    ) : file.type === 'audio' ? (
                      <i className="fas fa-microphone text-rose-500 text-xs" />
                    ) : (
                      getDocumentIcon(file.name)
                    )}
                    <span className="max-w-[110px] truncate text-slate-700 font-medium">
                      {file.name || 'Tệp'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveStagedAttachment(idx)}
                      className="ml-1 text-slate-400 hover:text-rose-500 p-0.5 rounded cursor-pointer"
                      title="Xóa tệp đính kèm"
                    >
                      <i className="fas fa-xmark text-xs" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Emoji Picker Popover */}
            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                className="absolute bottom-14 left-2 right-2 bg-white rounded-2xl shadow-xl border border-slate-200 p-2.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
              >
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100">
                  <span className="text-[11px] font-bold text-slate-700">Biểu tượng cảm xúc & Icon</span>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(false)}
                    className="text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <i className="fas fa-xmark text-xs" />
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-2">
                  {EMOJI_CATEGORIES.map((cat, cIdx) => (
                    <div key={cIdx}>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        {cat.title}
                      </p>
                      <div className="grid grid-cols-8 gap-1">
                        {cat.emojis.map((emoji, eIdx) => (
                          <button
                            key={eIdx}
                            type="button"
                            onClick={() => handleSelectEmoji(emoji)}
                            className="w-7 h-7 flex items-center justify-center text-base hover:bg-indigo-50 rounded-lg transition hover:scale-120 cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Input Bar & Action Toolbar */}
            <form
              onSubmit={handleSendMessage}
              className="p-2 bg-white border-t border-slate-200/80 flex flex-col gap-1.5 shrink-0 relative"
            >
              {/* Hidden file inputs */}
              <input
                ref={docInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                onChange={(e) => handleUploadFile(e, 'document')}
                className="hidden"
              />
              <input
                ref={imgInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleUploadFile(e, 'image')}
                className="hidden"
              />

              {/* Mention Suggestion Dropdown */}
              {isClass && mentionQuery !== null && filteredMentionMembers.length > 0 && (
                <div
                  data-testid="mention-autocomplete-dropdown"
                  className="absolute bottom-full left-2 right-2 mb-1 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 max-h-52 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-2 duration-150"
                >
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 mb-1">
                    <span className="flex items-center gap-1 text-indigo-600">
                      <i className="fas fa-at text-[10px]" />
                      <span>Nhắc nhở thành viên lớp ({filteredMentionMembers.length})</span>
                    </span>
                    <span className="text-[9px] text-slate-400 font-normal">Dùng ↑ ↓ Enter để chọn</span>
                  </div>
                  <div className="space-y-0.5">
                    {filteredMentionMembers.map((member, idx) => (
                      <div
                        key={member.userId || idx}
                        onClick={() => insertMention(member)}
                        className={`px-2.5 py-1.5 rounded-xl cursor-pointer flex items-center justify-between transition ${
                          idx === selectedMentionIdx
                            ? 'bg-indigo-50 text-indigo-900 border border-indigo-200/80 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate min-w-0">
                          <Avatar src={member.avatar} name={member.name} size={24} />
                          <div className="truncate">
                            <span className="text-xs font-bold truncate">{member.name}</span>
                            {member.code && (
                              <span className="ml-1.5 font-mono text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-100">
                                {member.code}
                              </span>
                            )}
                          </div>
                        </div>
                        {roleBadge(member.role)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Main input row: Voice recording mode or standard text input */}
              {isRecording ? (
                <div className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5 animate-pulse">
                  <div className="flex items-center gap-2 text-rose-600 font-semibold text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                    <span>Đang ghi âm...</span>
                    <span className="font-mono text-xs">{formatDuration(recordingSeconds)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-100 text-xs font-semibold transition cursor-pointer"
                      title="Hủy ghi âm"
                    >
                      <i className="fas fa-trash-can mr-1" /> Hủy
                    </button>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-xs"
                      title="Xong và đính kèm"
                    >
                      <i className="fas fa-check" /> Xong
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={handleInputKeyDown}
                    placeholder={
                      isClass
                        ? 'Gửi thông báo hoặc trao đổi trong lớp (gõ @ để nhắc nhở)...'
                        : 'Nhập tin nhắn...'
                    }
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 transition"
                  />

                  <button
                    type="submit"
                    disabled={(!inputText.trim() && stagedAttachments.length === 0) || sendMutation.isPending || isUploading}
                    className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition flex items-center justify-center shrink-0 shadow-xs cursor-pointer disabled:cursor-not-allowed"
                    title="Gửi tin nhắn"
                    aria-label="Gửi tin nhắn"
                  >
                    {sendMutation.isPending || isUploading ? (
                      <i className="fas fa-spinner fa-spin text-xs" />
                    ) : (
                      <i className="fas fa-paper-plane text-xs" />
                    )}
                  </button>
                </div>
              )}

              {/* Action Toolbar: Document, Image, Emoji, Voice Note, @ Mention button */}
              <div className="flex items-center justify-between px-1 text-slate-500 text-xs">
                <div className="flex items-center gap-1">
                  {/* Attach Document */}
                  <button
                    type="button"
                    onClick={() => docInputRef.current?.click()}
                    disabled={isUploading || isRecording}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer disabled:opacity-40"
                    title="Đính kèm Tài liệu (PDF, Word, Excel, PPT, Zip...)"
                    aria-label="Đính kèm tài liệu"
                  >
                    <i className="fas fa-paperclip text-xs" />
                  </button>

                  {/* Attach Image */}
                  <button
                    type="button"
                    onClick={() => imgInputRef.current?.click()}
                    disabled={isUploading || isRecording}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer disabled:opacity-40"
                    title="Đính kèm Hình ảnh"
                    aria-label="Đính kèm hình ảnh"
                  >
                    <i className="far fa-image text-xs" />
                  </button>

                  {/* Emoji Picker */}
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                    disabled={isRecording}
                    className={`p-1.5 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition cursor-pointer disabled:opacity-40 ${
                      showEmojiPicker ? 'text-amber-500 bg-amber-50' : 'text-slate-500'
                    }`}
                    title="Biểu tượng cảm xúc (Icon / Emoji)"
                    aria-label="Chọn icon"
                  >
                    <i className="far fa-face-smile text-xs" />
                  </button>

                  {/* Voice Chat */}
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={isRecording || isUploading}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer disabled:opacity-40"
                    title="Ghi âm tin nhắn thoại (Voice chat)"
                    aria-label="Ghi âm giọng nói"
                  >
                    <i className="fas fa-microphone text-xs" />
                  </button>

                  {/* Quick @ Mention reminder button for class groups */}
                  {isClass && (
                    <button
                      type="button"
                      onClick={handleTriggerMention}
                      disabled={isRecording}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shrink-0 ${
                        mentionQuery !== null
                          ? 'bg-amber-100 text-amber-700 border border-amber-300'
                          : 'text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                      }`}
                      title="Nhắc nhở học sinh/giáo viên bằng @"
                      aria-label="Nhắc nhở qua @"
                    >
                      <i className="fas fa-at text-[11px]" />
                      <span className="text-[11px]">Nhắc nhở</span>
                    </button>
                  )}
                </div>

                {isUploading && (
                  <span className="text-[10px] text-indigo-600 font-medium flex items-center gap-1 animate-pulse">
                    <i className="fas fa-spinner fa-spin text-[10px]" /> Đang tải tệp...
                  </span>
                )}
              </div>
            </form>
          </>
        )}
      </div>

      {/* Lightbox Image Preview Modal */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-150"
        >
          <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxImg.url}
              alt={lightboxImg.name || 'Hình ảnh'}
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <a
                href={lightboxImg.url}
                download={lightboxImg.name || 'image.jpg'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center backdrop-blur-xs transition"
                title="Tải ảnh về máy"
              >
                <i className="fas fa-download text-xs" />
              </a>
              <button
                type="button"
                onClick={() => setLightboxImg(null)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center backdrop-blur-xs transition cursor-pointer"
                title="Đóng xem ảnh"
              >
                <i className="fas fa-xmark text-sm" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default FloatingChatWindow;
