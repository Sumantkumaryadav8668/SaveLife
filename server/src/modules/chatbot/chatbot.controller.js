import SupportTicket from './support-ticket.model.js';

const faqResponses = [
  {
    keywords: ['sos', 'trigger', 'help', 'emergency'],
    response: 'To trigger an SOS, press the large floating red "SOS" button available at the bottom-right corner of any page. You can trigger a standard alert (sends to nearest police, hospital, and rescue) or a Silent SOS (dispatched quietly with auto-escalation rules).'
  },
  {
    keywords: ['contact', 'family', 'friend', 'contacts'],
    response: 'You can add up to 5 emergency contacts in your profile settings or dashboard. Whenever you trigger an SOS, these contacts automatically receive an SMS notification with your exact live location details.'
  },
  {
    keywords: ['track', 'gps', 'privacy', 'map'],
    response: 'To protect your privacy, RapidAid only tracks your live location while an active SOS case is open. Once the case is accepted or resolved, live location sharing stops completely.'
  },
  {
    keywords: ['profile', 'verify', 'id', 'identity', 'aadhaar'],
    response: 'Go to your dashboard profile section to upload your Government ID (e.g. Aadhaar Card). Once a system admin reviews and verifies your ID, it speeds up responder verification and ensures abuse protection checks.'
  },
  {
    keywords: ['hi', 'hello', 'hey', 'start'],
    response: 'Hello! I am RapidBot, your emergency platform assistant. How can I help you today? (Try asking: "How do I send an SOS?", "How to add contacts?", or say "talk to human support").'
  }
];

export const queryBot = async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ success: false, message: 'Message is required' });
  }

  const query = message.toLowerCase().trim();

  if (query.includes('human') || query.includes('support') || query.includes('escalate') || query.includes('agent') || query.includes('talk to')) {
    return res.json({
      success: true,
      botResponse: 'Escalating this request to a human operator... Generating support ticket now.',
      shouldEscalate: true
    });
  }

  let matchedResponse = 'I am not sure I understand that. Try asking about "SOS", "Emergency Contacts", "GPS Privacy", "ID Verification", or say "talk to human support" to escalate.';

  for (const item of faqResponses) {
    if (item.keywords.some(keyword => query.includes(keyword))) {
      matchedResponse = item.response;
      break;
    }
  }

  res.json({
    success: true,
    botResponse: matchedResponse,
    shouldEscalate: false
  });
};

export const escalateTicket = async (req, res) => {
  const { initialMessage } = req.body;

  try {
    const newTicket = new SupportTicket({
      user: req.user._id,
      messages: [
        { sender: 'user', text: initialMessage || 'Requesting human support escalations' },
        { sender: 'system', text: 'Chatbot escalated this issue. System Administrator has been notified.' }
      ]
    });

    await newTicket.save();
    res.status(201).json({ success: true, ticket: newTicket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find().populate('user', 'name email role phone').sort({ createdAt: -1 }).exec();
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resolveTicket = async (req, res) => {
  const { id } = req.params;
  try {
    const ticket = await SupportTicket.findById(id).exec();
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    ticket.status = 'resolved';
    ticket.messages.push({ sender: 'system', text: 'This support ticket has been resolved.' });
    await ticket.save();
    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
