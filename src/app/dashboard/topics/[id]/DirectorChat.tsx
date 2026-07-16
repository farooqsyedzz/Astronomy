'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Clapperboard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { runDirectorAction } from '@/features/director/actions';
import type { ChatMessage } from '@/services/director';
import styles from './DirectorChat.module.css';

interface DirectorChatProps {
  topicId: string;
  sceneId: string;
}

export function DirectorChat({ topicId, sceneId }: DirectorChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMsg = input.trim();
    setInput('');
    const newHistory = [...messages, { role: 'user' as const, content: userMsg }];
    setMessages(newHistory);
    setIsProcessing(true);

    try {
      const response = await runDirectorAction(topicId, userMsg, messages, sceneId);
      
      setMessages([
        ...newHistory, 
        { 
          role: 'assistant', 
          content: response.assistantResponse + 
                   (response.assetsDeleted.length > 0 
                    ? `\n\n(Deleted assets: ${response.assetsDeleted.join(', ')}. Please click 'Generate Assets' above to rebuild.)` 
                    : '')
        }
      ]);
    } catch (error: any) {
      setMessages([
        ...newHistory, 
        { role: 'assistant', content: `❌ Error: ${error.message || 'Failed to process request.'}` }
      ]);
    } finally {
      setIsProcessing(false);
    }
  }

  if (!isOpen) {
    return (
      <Button 
        variant="ghost" 
        className={styles.openButton}
        onClick={() => setIsOpen(true)}
      >
        <Clapperboard className={styles.iconSm} />
        AI Director
      </Button>
    );
  }

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <div className={styles.headerTitle}>
          <Clapperboard className={styles.iconSm} />
          <span>AI Director Chat</span>
        </div>
        <button className={styles.closeButton} onClick={() => setIsOpen(false)}>×</button>
      </div>

      <div className={styles.chatHistory}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            How would you like to direct this scene? Try:<br/>
            "Make it more dramatic"<br/>
            "Rewrite for beginners"<br/>
            "Change the camera to pan left"
          </div>
        )}
        
        {messages.map((msg, i) => (
          <div key={i} className={`${styles.message} ${msg.role === 'user' ? styles.msgUser : styles.msgAssistant}`}>
            {msg.content}
          </div>
        ))}
        {isProcessing && (
          <div className={`${styles.message} ${styles.msgAssistant}`}>
            <Loader2 className={styles.spinningIcon} /> Directing...
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <form className={styles.inputForm} onSubmit={handleSubmit}>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Instruct the director..."
          className={styles.inputField}
          disabled={isProcessing}
        />
        <button type="submit" disabled={!input.trim() || isProcessing} className={styles.sendButton}>
          <Send className={styles.iconSm} />
        </button>
      </form>
    </div>
  );
}
