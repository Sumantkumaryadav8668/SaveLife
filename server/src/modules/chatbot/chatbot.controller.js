import { queryChatbot } from '../../services/ai.service.js';
import SupportTicket from './support-ticket.model.js';

// Static FAQ fallback chatbot responder
const getFAQResponse = (message = '') => {
  const msg = message.toLowerCase().trim();

  if (
    msg.includes('how to trigger') || 
    msg.includes('how do i trigger') || 
    msg.includes('trigger sos') ||
    msg.includes('silent sos')
  ) {
    return "To trigger an SOS: Click the red floating 'SOS' button at the bottom-right of your citizen dashboard or press 'TRIGGER SOS' on the console. Standard SOS alerts nearest stations and repeats every 5 minutes. Silent SOS dispatches quietly and auto-escalates in 2 minutes if not accepted.";
  }

  if (
    msg.includes('privacy') || 
    msg.includes('gps') || 
    msg.includes('track') || 
    msg.includes('location')
  ) {
    return "Your GPS location is only tracked during an active SOS distress case. Tracking terminates immediately once the case is resolved to protect citizen privacy.";
  }

  if (
    msg.includes('contact') || 
    msg.includes('number') || 
    msg.includes('family') || 
    msg.includes('friend')
  ) {
    return "You can add up to 5 emergency contacts in the Citizen Dashboard. When you trigger an SOS, they will receive automated SMS alerts containing your live location.";
  }

  if (
    msg.includes('verify') || 
    msg.includes('aadhaar') || 
    msg.includes('identity') || 
    msg.includes('id card')
  ) {
    return "To prevent false alarms, citizens must upload a government ID scan (e.g. Aadhaar). System admins review and verify profiles to ensure platform security.";
  }

  return "I am RapidBot, your emergency guide. If you are facing an active emergency, please trigger the red SOS button immediately or dial 100/108. For safety or platform questions, feel free to ask.";
};

const checkDistressWords = (text) => {
  const distressWords = ['die', 'kill', 'suicide', 'bleeding', 'attack', 'weapon', 'unconscious', 'heart attack', 'choking'];
  const query = (text || '').toLowerCase();
  return distressWords.some(word => query.includes(word));
};

/**
 * Handle chatbot query message
 */
export const getMessageResponse = async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, message: 'Message is required' });
  }

  const shouldEscalate = checkDistressWords(message);

  try {
    // 1. Try querying Gemini LLM
    const response = await queryChatbot(message, history || []);

    if (response) {
      return res.json({ 
        success: true, 
        response, 
        botResponse: response,
        shouldEscalate
      });
    }

    // 2. Fall back to static FAQ rule matcher
    const fallbackResponse = getFAQResponse(message);
    res.json({ 
      success: true, 
      response: fallbackResponse, 
      botResponse: fallbackResponse,
      shouldEscalate
    });
  } catch (error) {
    console.error('[Chatbot Controller] Error:', error.message);
    const fallbackResponse = getFAQResponse(message);
    res.json({ 
      success: true, 
      response: fallbackResponse, 
      botResponse: fallbackResponse,
      shouldEscalate
    });
  }
};

// Map queryBot to getMessageResponse for backward compatibility in routing
export const queryBot = getMessageResponse;

/**
 * Escalate conversation to human support ticket
 */
export const escalateTicket = async (req, res) => {
  const { subject, messages, initialMessage } = req.body;

  try {
    let ticketMessages = messages || [];
    if (initialMessage && ticketMessages.length === 0) {
      ticketMessages = [{ sender: 'user', text: initialMessage }];
    }

    const ticket = new SupportTicket({
      user: req.user._id,
      subject: subject || 'Chatbot Human Escalation',
      messages: ticketMessages
    });

    await ticket.save();
    res.status(201).json({ success: true, message: 'Support ticket opened successfully.', ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Retrieve all support tickets (Admin Only)
 */
export const getTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({})
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .exec();

    const mappedTickets = tickets.map(t => {
      const obj = t.toObject();
      obj.initialMessage = obj.initialMessage || obj.messages?.[0]?.text || '';
      return obj;
    });

    res.json({ success: true, tickets: mappedTickets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Mark support ticket as resolved (Admin Only)
 */
export const resolveTicket = async (req, res) => {
  const { id } = req.params;

  try {
    const ticket = await SupportTicket.findById(id).exec();
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Support ticket not found.' });
    }

    ticket.status = 'resolved';
    await ticket.save();

    res.json({ success: true, message: 'Support ticket resolved successfully.', ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
