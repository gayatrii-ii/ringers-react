import { Request, Response, NextFunction } from 'express';

const POLICIES: Record<string, Record<string, { title: string; content: string }>> = {
  'privacy-policy': {
    EN: {
      title: 'Privacy Policy',
      content:
        'Ringers collects account details, GPS location data during deliveries, and payment references to operate the hyperlocal delivery service. Your personal data is never sold to third parties.',
    },
    HI: {
      title: 'गोपनीयता नीति (Privacy Policy)',
      content:
        'रिंगर्स स्थानीय डिलीवरी सेवा संचालित करने के लिए खाता विवरण, डिलीवरी के दौरान जीपीएस स्थान और भुगतान संदर्भ एकत्र करता है। आपका व्यक्तिगत डेटा कभी तीसरे पक्ष को नहीं बेचा जाता है।',
    },
    MR: {
      title: 'गोपनीयता धोरण (Privacy Policy)',
      content:
        'रिंगर्स हायपरलोकल वितरण सेवा चालवण्यासाठी खाते तपशील, डिलिव्हरी दरम्यान जीपीएस स्थान आणि पेमेंट संदर्भ संकलित करते. आपला वैयक्तिक डेटा कधीही तृतीय पक्षांना विकला जात नाही.',
    },
  },
  'terms-conditions': {
    EN: {
      title: 'Terms & Conditions',
      content:
        'By using Ringers, customers, vendors, and delivery partners agree to adhere to fair commerce practices, valid order placements, and timely fulfillment.',
    },
    HI: {
      title: 'नियम और शर्तें (Terms & Conditions)',
      content:
        'रिंगर्स का उपयोग करके ग्राहक, विक्रेता और डिलीवरी पार्टनर निष्पक्ष व्यापार, वैध ऑर्डर और समय पर पूर्ति के नियमों का पालन करने के लिए सहमत होते हैं।',
    },
    MR: {
      title: 'अटी आणि शर्ती (Terms & Conditions)',
      content:
        'रिंगर्स वापरून ग्राहक, विक्रेते आणि वितरण भागीदार वाजवी व्यापार पद्धती, वैध ऑर्डर आणि वेळेवर पूर्ततेचे पालन करण्यास सहमती दर्शवतात.',
    },
  },
  'cancellation-policy': {
    EN: {
      title: 'Cancellation Policy',
      content:
        'Orders can be cancelled while in PENDING status. Once an order is prepared, out for delivery, or completed, cancellation is strictly prohibited.',
    },
    HI: {
      title: 'रद्दीकरण नीति (Cancellation Policy)',
      content:
        'ऑर्डर केवल PENDING स्थिति में रद्द किए जा सकते हैं। एक बार जब ऑर्डर तैयार हो जाता है या डिलीवरी के लिए निकल जाता है, तो रद्दीकरण प्रतिबंधित है।',
    },
    MR: {
      title: 'रद्दीकरण धोरण (Cancellation Policy)',
      content:
        'ऑर्डर केवळ PENDING स्थितीत रद्द केल्या जाऊ शकतात. एकदा ऑर्डर तयार झाल्यावर किंवा डिलिव्हरीसाठी निघाल्यावर रद्दीकरण पूर्णपणे प्रतिबंधित आहे.',
    },
  },
  'refund-policy': {
    EN: {
      title: 'Refund Policy',
      content:
        'Refunds for eligible cancelled or failed prepaid orders are credited back to the customer wallet or original payment source within 3-5 business days upon admin review.',
    },
    HI: {
      title: 'वापसी नीति (Refund Policy)',
      content:
        'पात्र रद्द या विफल प्रीपेड ऑर्डर के लिए रिफंड एडमिन समीक्षा के 3-5 व्यावसायिक दिनों के भीतर ग्राहक वॉलेट या मूल भुगतान स्रोत में जमा किया जाता है।',
    },
    MR: {
      title: 'परतावा धोरण (Refund Policy)',
      content:
        'पात्र रद्द किंवा अयशस्वी प्रीपेड ऑर्डरसाठी परतावा ॲडमिन पुनरावलोकनानंतर 3-5 व्यावसायिक दिवसांत ग्राहक वॉलेट किंवा मूळ पेमेंट स्त्रोतामध्ये जमा केला जातो.',
    },
  },
};

export class PolicyController {
  public static getPolicy(req: Request, res: Response, _next: NextFunction): void {
    const { policyType } = req.params;
    const lang = (req.query.lang ? String(req.query.lang).toUpperCase() : 'EN') as 'EN' | 'HI' | 'MR';

    const policy = POLICIES[String(policyType).toLowerCase()];
    if (!policy) {
      res.status(404).json({
        success: false,
        message: `Policy '${policyType}' not found. Available policies: privacy-policy, terms-conditions, cancellation-policy, refund-policy.`,
      });
      return;
    }

    const content = policy[lang] || policy['EN'];
    res.status(200).json({
      success: true,
      data: {
        policyType,
        language: lang,
        ...content,
      },
    });
  }
}
