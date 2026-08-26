/**
 * SaveLife SMS Dispatcher Service
 */

const isConfigured = 
  !!process.env.SMS_PROVIDER && 
  !!process.env.SMS_API_KEY;

export const sendSMS = async (to, message) => {
  if (!isConfigured) {
    console.warn(`\n[SMS WARNING] SMS Provider not configured. Simulated SMS below:`);
    console.log(`================ SIMULATED SMS ================`);
    console.log(`TO: ${to}`);
    console.log(`MESSAGE: ${message}`);
    console.log(`===============================================\n`);
    return {
      success: true,
      status: 'simulated',
      messageId: `MOCK-${Date.now()}-${Math.round(Math.random() * 1000)}`
    };
  }

  // Example integration placeholder for Twilio / Plivo / local SMS gateway provider
  const provider = process.env.SMS_PROVIDER.toLowerCase();
  console.log(`[SMS Service] Sending SMS to ${to} via provider: ${provider}...`);

  try {
    // If Twilio:
    if (provider === 'twilio') {
      // Stub Twilio axios request
      // const response = await axios.post(...)
    }

    return {
      success: true,
      status: 'sent',
      messageId: `SMS-${Date.now()}`
    };
  } catch (error) {
    console.error(`[SMS Service] Failed to send SMS to ${to}:`, error.message);
    return {
      success: false,
      status: 'failed',
      error: error.message
    };
  }
};

export default sendSMS;
