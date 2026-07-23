import mongoose from 'mongoose';

const SupportTicketSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    default: 'Chatbot Human Escalation'
  },
  messages: [
    {
      sender: { type: String, enum: ['user', 'system', 'support'], required: true },
      text: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  status: {
    type: String,
    enum: ['open', 'resolved'],
    default: 'open'
  }
}, {
  timestamps: true
});

export default mongoose.model('SupportTicket', SupportTicketSchema);
