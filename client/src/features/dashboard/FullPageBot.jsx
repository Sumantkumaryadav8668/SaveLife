import React, { useState, useEffect, useRef } from 'react';
import { chatbotAPI } from '../../models/api.js';
import { Send, AlertTriangle, Headset, Sparkles, MessageSquare, Bot } from 'lucide-react';

const FullPageBot = () => {
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Hello! I am RapidBot, your emergency platform assistant. How can I help you today? (Try asking about SOS triggers, Emergency Contacts, or say "talk to human support").' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEscalated, setIsEscalated] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      const res = await chatbotAPI.sendMessage(userText);
      setMessages(prev => [...prev, { sender: 'bot', text: res.botResponse || res.response }]);

      if (res.shouldEscalate || checkDistressWords(userText)) {
        setIsEscalated(true);
        setMessages(prev => [...prev, {
          sender: 'system',
          text: '⚠️ SEVERE DISTRESS DETECTED. Automatically logging emergency support ticket for System Admin review...'
        }]);

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
    <div className="glass-panel chat-container" style={{ height: 'calc(100vh - 160px)', display: 'grid', gridTemplateRows: 'auto 1fr auto auto', overflow: 'hidden' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(to right, rgba(99, 70, 229, 0.05), rgba(124, 58, 237, 0.05))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={20} style={{ color: '#818CF8' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'white', lineHeight: '1.2' }}>RapidBot AI Assistant</h3>
            <span style={{ fontSize: '10.5px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'ping 1s infinite' }}></span>
              Connected & Ready
            </span>
          </div>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', color: '#818CF8', fontWeight: 600 }}>
          <Sparkles size={12} /> AI Powered
        </span>
      </div>

      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', justifyContent: 'flex-start' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.sender === 'system' ? (
              <div style={{ width: '100%', maxWidth: '600px', margin: '0 auto', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', color: '#F87171', borderRadius: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} style={{ color: '#EF4444' }} />
                <span>{msg.text}</span>
              </div>
            ) : (
              <div className={`message-bubble ${msg.sender === 'user' ? 'user' : 'bot'}`} style={{
                borderBottomRightRadius: msg.sender === 'user' ? '4px' : '16px',
                borderBottomLeftRadius: msg.sender === 'user' ? '16px' : '4px',
              }}>
                {msg.text}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '12px 18px', borderRadius: '16px', borderBottomLeftRadius: '4px', display: 'flex', gap: '4px' }}>
              <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested chips */}
      <div style={{ padding: '10px 24px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: '8px', overflowX: 'auto', whiteSpace: 'nowrap', scrollbarWidth: 'none' }} className="scrollbar-none">
        <button onClick={() => setInputText('How do I trigger SOS?')} className="suggestion-chip">How to trigger SOS?</button>
        <button onClick={() => setInputText('How to add emergency contacts?')} className="suggestion-chip">Add contacts</button>
        <button onClick={() => setInputText('talk to human support')} className="suggestion-chip">
          <Headset size={12}/> Human Agent
        </button>
      </div>

      {/* Input row */}
      <form onSubmit={handleSend} style={{ display: 'flex', gap: '12px', padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type your question or request support here..."
          style={{ flex: 1, height: '48px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0 16px', color: 'white', fontSize: '13px', outline: 'none' }}
        />
        <button type="submit" style={{ height: '48px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none', color: 'white', fontWeight: 600, padding: '0 20px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Send size={14} /> Send
        </button>
      </form>

      <style>{`
        .chat-container * {
          box-sizing: border-box;
        }
        .message-bubble {
          max-width: 70%;
          padding: 12px 18px;
          border-radius: 16px;
          font-size: 13.5px;
          line-height: 1.5;
          transition: all 0.2s;
        }
        .message-bubble.user {
          max-width: 50%;
          margin-left: auto;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          border-bottom-right-radius: 4px;
          box-shadow: 0 4px 15px -3px rgba(79, 70, 229, 0.3);
        }
        .message-bubble.bot {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          color: #E2E8F0;
          border-bottom-left-radius: 4px;
        }
        .suggestion-chip {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          font-size: 12px;
          height: 36px;
          padding: 0 14px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .suggestion-chip:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          color: white;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        @media (max-width: 768px) {
          .message-bubble {
            max-width: 80% !important;
          }
          .message-bubble.user {
            max-width: 80% !important;
          }
        }
        @media (max-width: 480px) {
          .message-bubble {
            max-width: 85% !important;
          }
          .message-bubble.user {
            max-width: 85% !important;
          }
        }
      `}</style>

    </div>
  );
};

export default FullPageBot;
