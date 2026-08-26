import React, { useState, useEffect, useRef } from 'react';
import { chatbotAPI } from '../models/api';
import { MessageSquare, X, Send, AlertTriangle, Headset } from 'lucide-react';

const RapidBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Hello! I am RapidBot, your emergency platform assistant. How can I help you today? (Try asking about SOS triggers, Emergency Contacts, or say "talk to human support").' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEscalated, setIsEscalated] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Check for severe distress words
  const checkDistressWords = (text) => {
    const distressWords = ['die', 'kill', 'suicide', 'bleeding', 'attack', 'weapon', 'unconscious', 'heart attack', 'choking'];
    const query = text.toLowerCase();
    return distressWords.some(word => query.includes(word));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userText = inputText.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setInputText('');
    setIsLoading(true);

    try {
      // 1. Send normal query
      const res = await chatbotAPI.sendMessage(userText);
      
      // 2. Output bot response
      const botReply = res.botResponse || res.response;
      setMessages(prev => [...prev, { sender: 'bot', text: botReply }]);

      // 3. Escalation check
      // Either by bot logic triggers ("shouldEscalate") or citizen warning distress word matching
      if (res.shouldEscalate || checkDistressWords(userText)) {
        setIsEscalated(true);
        setMessages(prev => [...prev, {
          sender: 'system',
          text: '⚠️ SEVERE DISTRESS DETECTED. Automatically logging emergency support ticket for System Admin review...'
        }]);

        // Call escalation API
        await chatbotAPI.escalateTicket(userText);
        
        setMessages(prev => [...prev, {
          sender: 'bot',
          text: 'A human dispatcher support ticket has been created. A system administrator has been alerted in their support console.'
        }]);
      }

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { sender: 'system', text: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rapidbot-container" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}>
      {/* Floating Toggle Bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="chatbot-bubble-btn shadow-2xl flex items-center justify-center cursor-pointer"
          aria-label="Open Chatbot"
        >
          <MessageSquare size={24} className="text-white animate-pulse" />
          <span className="chatbot-badge">RapidBot</span>
        </button>
      )}

      {/* Floating Chat Drawer */}
      {isOpen && (
        <div className="chatbot-drawer shadow-3xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="chatbot-header flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <div className="chatbot-avatar">🤖</div>
              <div>
                <div className="font-bold text-sm leading-none">RapidBot</div>
                <div className="text-[10px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span> Live Help Assistant
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white transition cursor-pointer">
              <X size={18} />
            </button>
          </div>

          {/* Messages list */}
          <div className="chatbot-body flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'system' ? (
                  <div className="w-full text-center py-2 px-3 bg-amber-950/40 border border-amber-500/20 text-amber-300 rounded-lg text-xs flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{msg.text}</span>
                  </div>
                ) : (
                  <div className={`message-bubble ${msg.sender === 'user' ? 'user' : 'bot'}`}>
                    {msg.text}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="message-bubble bot typing flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions deck */}
          <div className="chatbot-suggestions px-4 py-2 border-t border-white/5 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
            <button onClick={() => setInputText('How do I trigger SOS?')} className="suggestion-chip">How to trigger SOS?</button>
            <button onClick={() => setInputText('How to add emergency contacts?')} className="suggestion-chip">Add contacts</button>
            <button onClick={() => setInputText('talk to human support')} className="suggestion-chip flex items-center gap-1"><Headset size={12}/> Human Agent</button>
          </div>

          {/* Chat input */}
          <form onSubmit={handleSend} className="chatbot-input-area">
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask RapidBot..."
                className="chatbot-input"
              />
              <button type="submit" className="chatbot-send-btn">
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        .chatbot-drawer * {
          box-sizing: border-box;
        }
        .chatbot-bubble-btn {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          border: none;
          box-shadow: 0 8px 24px rgba(124, 58, 237, 0.4), 0 0 15px rgba(124, 58, 237, 0.2);
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .chatbot-bubble-btn:hover {
          transform: scale(1.08) translateY(-2px);
          box-shadow: 0 12px 28px rgba(124, 58, 237, 0.5), 0 0 20px rgba(124, 58, 237, 0.3);
        }
        .chatbot-badge {
          position: absolute;
          bottom: calc(100% + 10px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(99, 102, 241, 0.95);
          color: white;
          font-size: 10px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 8px;
          border: 1.5px solid rgba(255, 255, 255, 0.1);
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3), 0 0 10px rgba(99, 102, 241, 0.1);
          backdrop-filter: blur(8px);
        }
        .chatbot-badge::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-width: 5px;
          border-style: solid;
          border-color: rgba(99, 102, 241, 0.95) transparent transparent transparent;
        }
        .chatbot-drawer {
          display: flex;
          flex-direction: column;
          width: 360px;
          height: min(600px, calc(100dvh - 48px));
          max-height: calc(100dvh - 48px);
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
          box-sizing: border-box;
        }
        .chatbot-header {
          flex-shrink: 0;
          padding: 16px;
          background: linear-gradient(to right, rgba(79, 70, 229, 0.2), rgba(124, 58, 237, 0.2));
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .chatbot-avatar {
          font-size: 20px;
        }
        .chatbot-body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .message-bubble {
          max-width: 80%;
          padding: 10px 14px;
          border-radius: 16px;
          font-size: 13px;
          line-height: 1.4;
        }
        .message-bubble.user {
          background: #4f46e5;
          color: white;
          border-bottom-right-radius: 4px;
        }
        .message-bubble.bot {
          background: rgba(255, 255, 255, 0.08);
          color: #f1f5f9;
          border-bottom-left-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .chatbot-suggestions {
          flex-shrink: 0;
          padding: 10px 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          gap: 8px;
          overflow-x: auto;
          white-space: nowrap;
          scrollbar-width: none; /* Firefox */
        }
        .chatbot-suggestions::-webkit-scrollbar {
          display: none; /* Safari and Chrome */
        }
        .suggestion-chip {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8;
          font-size: 11px;
          padding: 6px 12px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .suggestion-chip:hover {
          background: rgba(255,255,255,0.1);
          color: white;
        }
        .chatbot-input-area {
          flex-shrink: 0;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding: 12px 16px;
          background: rgba(15, 23, 42, 0.6);
          width: 100%;
        }
        .chatbot-input {
          width: 100%;
          padding: 10px 48px 10px 14px;
          font-size: 13px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          outline: none;
          color: white;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .chatbot-input:focus {
          border-color: rgba(99, 102, 241, 0.5);
        }
        .chatbot-input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }
        .chatbot-send-btn {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          background: #4f46e5;
          border: none;
          border-radius: 8px;
          padding: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          transition: all 0.2s;
        }
        .chatbot-send-btn:hover {
          background: #4338ca;
        }
 
        @media (max-width: 640px) {
          .rapidbot-container {
            bottom: 12px !important;
            right: 12px !important;
          }
          .chatbot-drawer {
            position: fixed;
            bottom: 12px !important;
            right: 12px !important;
            left: 12px !important;
            width: auto !important;
            height: calc(100dvh - 24px) !important;
            max-height: calc(100dvh - 24px) !important;
            border-radius: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default RapidBot;
