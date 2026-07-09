/**
 * Mock API for local testing (when backend is not available)
 * Returns realistic responses to allow UI testing
 */

// Mock delay to simulate network latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const mockApi = {
  // Request OTP (phone login)
  requestLoginOtp: async (phoneNumber: string) => {
    await delay(800);
    console.log(`[MOCK] Sending OTP to ${phoneNumber}`);
    return {
      success: true,
      data: {
        message: 'OTP sent to your phone number',
      },
    };
  },

  // Verify OTP and login
  verifyLoginOtp: async (phoneNumber: string, otp: string) => {
    await delay(1200);
    console.log(`[MOCK] Verifying OTP: ${otp}`);
    
    if (otp === '123456') {
      return {
        success: true,
        data: {
          user: {
            user_id: 'user-' + Date.now(),
            phone_number: phoneNumber,
            role: 'parent',
            name: 'Demo Parent',
            language: 'am',
          },
          token: {
            session_token: 'mock-token-' + Date.now(),
          },
        },
      };
    }
    
    return {
      success: false,
      error: {
        code: 'INVALID_OTP',
        message: 'Invalid OTP. Try 123456 for demo.',
      },
    };
  },

  // Get user profile
  getProfile: async () => {
    await delay(300);
    return {
      success: true,
      data: {
        user: {
          user_id: 'user-123',
          phone_number: '+251911223344',
          role: 'parent',
          name: 'Demo Parent',
          language: 'am',
        },
      },
    };
  },

  // Get children list
  getChildren: async () => {
    await delay(400);
    return {
      success: true,
      data: [
        {
          child_id: 'child-1',
          name: 'Sofia',
          date_of_birth: '2020-03-15',
          language: 'am',
          grade_level: 'Grade 1',
        },
        {
          child_id: 'child-2',
          name: 'Abebe',
          date_of_birth: '2021-06-22',
          language: 'am',
          grade_level: 'Kindergarten',
        },
      ],
    };
  },

  // Start session
  startSession: async (childId: string) => {
    await delay(600);
    return {
      success: true,
      data: {
        session_id: 'session-' + Date.now(),
        child_id: childId,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      },
    };
  },

  // Submit features (after game)
  submitFeatureVector: async (sessionId: string, features: any) => {
    await delay(500);
    return {
      success: true,
      data: {
        message: 'Features recorded',
      },
    };
  },

  // Complete session
  completeSession: async (sessionId: string) => {
    await delay(1000);
    return {
      success: true,
      data: {
        session_id: sessionId,
        status: 'completed',
      },
    };
  },

  // Get report
  getReport: async (sessionId: string) => {
    await delay(800);
    return {
      success: true,
      data: {
        status: 'completed',
        report_id: 'report-' + sessionId,
        report_text_amharic: `ይህ ሪፖርት ለ6 ዓመት ልጅዎ የተደረገ የ20 ደቂቃ ጨዋታ-ላይ-ተመርኩዞ ምርመራ ውጤት ነው።

ምርመራው ልጅዎ ጥሩ ተሳትፎ ማሳየቱን ያሳያል።

ይህ ምርመራ ነው፣ ሕክምናዊ ምርመራ አይደለም።`,
        recommendations: [
          'ለልጅዎ ትናንሽ ተግባሮች ይስጡ',
          'ተጨማሪ ጊዜ ይስጡ',
          'ደጋግም ልምምድ ያድርጉ',
        ],
        referral_suggested: false,
        generated_at: new Date().toISOString(),
        disclaimer: 'ይህ ምርመራ ነው፣ ሕክምናዊ ምርመራ አይደለም።',
      },
    };
  },
};

// Intercept fetch calls to use mock API
const originalFetch = window.fetch;

export function enableMockApi() {
  (window as any).fetch = async (url: string, options?: any) => {
    // Only mock API calls to /api/
    if (url.includes('/api/')) {
      console.log(`[MOCK API] ${options?.method || 'GET'} ${url}`);

      try {
        if (url.includes('/auth/login/otp/request')) {
          const body = JSON.parse(options.body);
          const result = await mockApi.requestLoginOtp(body.phone_number);
          return new Response(JSON.stringify(result));
        }

        if (url.includes('/auth/login/otp/verify')) {
          const body = JSON.parse(options.body);
          const result = await mockApi.verifyLoginOtp(body.phone_number, body.otp);
          return new Response(JSON.stringify(result));
        }

        if (url.includes('/users/me')) {
          const result = await mockApi.getProfile();
          return new Response(JSON.stringify(result));
        }

        if (url.includes('/children') && !url.includes('/:id')) {
          const result = await mockApi.getChildren();
          return new Response(JSON.stringify(result));
        }

        if (url.includes('/sessions') && options?.method === 'POST') {
          const body = JSON.parse(options.body);
          const result = await mockApi.startSession(body.child_id);
          return new Response(JSON.stringify(result));
        }

        if (url.includes('/sessions/') && url.includes('/features')) {
          const result = await mockApi.submitFeatureVector('session-id', {});
          return new Response(JSON.stringify(result));
        }

        if (url.includes('/sessions/') && url.includes('/report')) {
          const sessionId = url.split('/')[4];
          const result = await mockApi.getReport(sessionId);
          return new Response(JSON.stringify(result));
        }

        // Default: return 404
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
      } catch (error) {
        console.error('[MOCK API ERROR]', error);
        return new Response(JSON.stringify({ error: 'Mock API error' }), { status: 500 });
      }
    }

    // Use real fetch for non-API calls
    return originalFetch(url, options);
  };
}
