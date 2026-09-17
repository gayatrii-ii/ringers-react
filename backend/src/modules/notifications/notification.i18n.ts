/**
 * Ringers Platform - Multi-Language Localization Engine (i18n)
 * Supported Languages:
 *   - EN: English (Default)
 *   - HI: Hindi (हिंदी)
 *   - MR: Marathi (मराठी)
 */

export type SupportedLanguage = 'EN' | 'HI' | 'MR';

export interface LocalizedTemplate {
  title: string;
  message: string;
}

export type NotificationEvent =
  | 'ORDER_PLACED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_PREPARING'
  | 'ORDER_READY'
  | 'ORDER_OUT_FOR_DELIVERY'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'WALLET_CREDIT'
  | 'WALLET_DEBIT'
  | 'NEW_ORDER_VENDOR'
  | 'RIDER_ASSIGNED';

export interface TemplateParams {
  orderNumber?: string;
  vendorName?: string;
  amount?: string | number;
  balance?: string | number;
  reason?: string;
  riderName?: string;
  riderPhone?: string;
}

const TEMPLATES: Record<NotificationEvent, Record<SupportedLanguage, LocalizedTemplate>> = {
  ORDER_PLACED: {
    EN: {
      title: 'Order Placed Successfully',
      message: 'Your order #{orderNumber} has been received by {vendorName}.',
    },
    HI: {
      title: 'ऑर्डर सफलतापूर्वक दर्ज हुआ',
      message: 'आपका ऑर्डर #{orderNumber} {vendorName} द्वारा प्राप्त कर लिया गया है।',
    },
    MR: {
      title: 'ऑर्डर यशस्वीरीत्या नोंदवली गेली',
      message: 'तुमची ऑर्डर #{orderNumber} {vendorName} कडून स्वीकारली गेली आहे.',
    },
  },
  ORDER_CONFIRMED: {
    EN: {
      title: 'Order Confirmed',
      message: '{vendorName} has confirmed your order #{orderNumber} and will begin preparation.',
    },
    HI: {
      title: 'ऑर्डर कन्फर्म हुआ',
      message: '{vendorName} ने आपका ऑर्डर #{orderNumber} स्वीकार कर लिया है और तैयारी शुरू कर रहे हैं।',
    },
    MR: {
      title: 'ऑर्डर निश्चित झाली',
      message: '{vendorName} ने तुमची ऑर्डर #{orderNumber} निश्चित केली आहे आणि तयार करणे सुरू करत आहेत.',
    },
  },
  ORDER_PREPARING: {
    EN: {
      title: 'Order Being Prepared',
      message: '{vendorName} is now preparing your delicious food for order #{orderNumber}.',
    },
    HI: {
      title: 'खाना तैयार किया जा रहा है',
      message: '{vendorName} आपके ऑर्डर #{orderNumber} का स्वादिष्ट भोजन तैयार कर रहा है।',
    },
    MR: {
      title: 'ऑर्डर तयार होत आहे',
      message: '{vendorName} तुमच्या ऑर्डर #{orderNumber} चे स्वादिष्ट जेवण तयार करत आहे.',
    },
  },
  ORDER_READY: {
    EN: {
      title: 'Order Ready for Pickup',
      message: 'Your order #{orderNumber} is packed and ready for delivery partner pickup.',
    },
    HI: {
      title: 'ऑर्डर पिकअप के लिए तैयार है',
      message: 'आपका ऑर्डर #{orderNumber} पैक हो चुका है और डिलीवरी पार्टनर के लिए तैयार है।',
    },
    MR: {
      title: 'ऑर्डर पिकअपसाठी तयार आहे',
      message: 'तुमची ऑर्डर #{orderNumber} पॅक झाली असून डिलिव्हरी पार्टनरसाठी सज्ज आहे.',
    },
  },
  ORDER_OUT_FOR_DELIVERY: {
    EN: {
      title: 'Out for Delivery',
      message: 'Your order #{orderNumber} is on the way with your delivery partner.',
    },
    HI: {
      title: 'डिलीवरी के लिए निकल चुका है',
      message: 'डिलीवरी पार्टनर आपका ऑर्डर #{orderNumber} लेकर आपके पते की ओर निकल चुका है।',
    },
    MR: {
      title: 'डिलिव्हरीसाठी निघाले आहे',
      message: 'डिलिव्हरी पार्टनर तुमची ऑर्डर #{orderNumber} घेऊन तुमच्या पत्त्यावर येत आहे.',
    },
  },
  ORDER_DELIVERED: {
    EN: {
      title: 'Order Delivered',
      message: 'Your order #{orderNumber} has been delivered. Enjoy your meal and please leave a review!',
    },
    HI: {
      title: 'ऑर्डर डिलीवर हो गया',
      message: 'आपका ऑर्डर #{orderNumber} सफलतापूर्वक पहुंच गया है। भोजन का आनंद लें और रेटिंग दें!',
    },
    MR: {
      title: 'ऑर्डर वितरित झाली',
      message: 'तुमची ऑर्डर #{orderNumber} वितरित करण्यात आली आहे. जेवणाचा आनंद घ्या आणि रेटिंग द्या!',
    },
  },
  ORDER_CANCELLED: {
    EN: {
      title: 'Order Cancelled',
      message: 'Order #{orderNumber} has been cancelled. Reason: {reason}',
    },
    HI: {
      title: 'ऑर्डर रद्द किया गया',
      message: 'ऑर्डर #{orderNumber} रद्द कर दिया गया है। कारण: {reason}',
    },
    MR: {
      title: 'ऑर्डर रद्द करण्यात आली',
      message: 'ऑर्डर #{orderNumber} रद्द करण्यात आली आहे. कारण: {reason}',
    },
  },
  WALLET_CREDIT: {
    EN: {
      title: 'Wallet Balance Credited',
      message: '₹{amount} has been added to your wallet. Current balance: ₹{balance}.',
    },
    HI: {
      title: 'वॉलेट में पैसे जमा हुए',
      message: 'आपके वॉलेट में ₹{amount} जोड़े गए हैं। वर्तमान शेष: ₹{balance}।',
    },
    MR: {
      title: 'वॉलेटमध्ये रक्कम जमा झाली',
      message: 'तुमच्या वॉलेटमध्ये ₹{amount} जमा झाले आहेत. चालू शिल्लक: ₹{balance}.',
    },
  },
  WALLET_DEBIT: {
    EN: {
      title: 'Wallet Balance Debited',
      message: '₹{amount} was deducted from your wallet for order #{orderNumber}.',
    },
    HI: {
      title: 'वॉलेट से पैसे कटे',
      message: 'ऑर्डर #{orderNumber} के लिए आपके वॉलेट से ₹{amount} काटे गए हैं।',
    },
    MR: {
      title: 'वॉलेटमधून रक्कम वजा झाली',
      message: 'ऑर्डर #{orderNumber} साठी तुमच्या वॉलेटमधून ₹{amount} वजा झाले आहेत.',
    },
  },
  NEW_ORDER_VENDOR: {
    EN: {
      title: 'New Order Received!',
      message: 'You received new order #{orderNumber} worth ₹{amount}. Please review and confirm.',
    },
    HI: {
      title: 'नया ऑर्डर प्राप्त हुआ!',
      message: 'आपको ₹{amount} का नया ऑर्डर #{orderNumber} मिला है। कृपया जांचें और स्वीकार करें।',
    },
    MR: {
      title: 'नवीन ऑर्डर प्राप्त झाली!',
      message: 'तुम्हाला ₹{amount} ची नवीन ऑर्डर #{orderNumber} मिळाली आहे. कृपया तपासा आणि पुष्टी करा.',
    },
  },
  RIDER_ASSIGNED: {
    EN: {
      title: 'Delivery Partner Assigned',
      message: '{riderName} ({riderPhone}) has been assigned to deliver order #{orderNumber}.',
    },
    HI: {
      title: 'डिलीवरी पार्टनर नियुक्त',
      message: 'ऑर्डर #{orderNumber} के लिए {riderName} ({riderPhone}) को नियुक्त किया गया है।',
    },
    MR: {
      title: 'डिलिव्हरी पार्टनर नियुक्त',
      message: 'ऑर्डर #{orderNumber} साठी {riderName} ({riderPhone}) यांची नियुक्ती झाली आहे.',
    },
  },
};

/**
 * Format notification title and message by replacing {placeholder} variables
 */
export function formatNotification(
  event: NotificationEvent,
  lang: SupportedLanguage = 'EN',
  params: TemplateParams = {}
): LocalizedTemplate {
  const language = (['EN', 'HI', 'MR'].includes(lang) ? lang : 'EN') as SupportedLanguage;
  const template = TEMPLATES[event]?.[language] || TEMPLATES[event]['EN'];

  let title = template.title;
  let message = template.message;

  const replaceMap: Record<string, string> = {
    '{orderNumber}': params.orderNumber || '',
    '{vendorName}': params.vendorName || 'the store',
    '{amount}': params.amount !== undefined ? String(params.amount) : '',
    '{balance}': params.balance !== undefined ? String(params.balance) : '',
    '{reason}': params.reason || 'Not specified',
    '{riderName}': params.riderName || 'Rider',
    '{riderPhone}': params.riderPhone || '',
  };

  for (const [placeholder, val] of Object.entries(replaceMap)) {
    title = title.split(placeholder).join(val);
    message = message.split(placeholder).join(val);
  }

  return { title, message };
}
