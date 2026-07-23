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
      setMessages(prev => [...prev, { sender: 'bot', text: res.botResponse }]);

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
    <div className="rapidbot-container" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000 }}>
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
          <form onSubmit={handleSend} className="chatbot-input-area flex items-center border-t border-white/10 p-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask RapidBot..."
              className="chatbot-input flex-1 px-3 py-2 text-sm bg-transparent border-0 outline-none text-white placeholder-white/40"
            />
            <button type="submit" className="chatbot-send-btn p-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition cursor-pointer">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      <style>{`
        .chatbot-bubble-btn {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          border: none;
          box-shadow: 0 10px 25px -5px rgba(124, 58, 237, 0.5);
          position: relative;
        }
        .chatbot-badge {
          position: absolute;
          top: -6px;
          right: -10px;
          background: #ef4444;
          color: white;
          font-size: 9px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 99px;
          border: 1.5px solid #0f172a;
        }
        .chatbot-drawer {
          width: 340px;
          height: 480px;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
        }
        .chatbot-header {
          padding: 16px;
          background: linear-gradient(to right, rgba(79, 70, 229, 0.2), rgba(124, 58, 237, 0.2));
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .chatbot-avatar {
          font-size: 20px;
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
        .suggestion-chip {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8;
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .suggestion-chip:hover {
          background: rgba(255,255,255,0.1);
          color: white;
        }
      `}</style>
    </div>
  );
};

export default RapidBot;
