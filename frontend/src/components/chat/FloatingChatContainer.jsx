import React from 'react';
import { useChat } from '../../app/providers/ChatProvider.jsx';
import { FloatingChatWindow } from './FloatingChatWindow.jsx';
import { NewMessageModal } from './NewMessageModal.jsx';

export function FloatingChatContainer() {
  const { activeChats } = useChat();

  return (
    <>
      {/* Floating Chat Windows Docked at Bottom-Right (Like Facebook) */}
      <div
        className="fixed bottom-0 right-4 sm:right-24 z-[9980] flex items-end gap-3 pointer-events-none"
        style={{ maxWidth: 'calc(100vw - 2rem)' }}
      >
        {activeChats.map((chat) => (
          <div key={chat.key} className="pointer-events-auto">
            <FloatingChatWindow chat={chat} />
          </div>
        ))}
      </div>

      {/* Modal for composing a new message */}
      <NewMessageModal />
    </>
  );
}

export default FloatingChatContainer;

