import { useEffect, useState } from 'react';

interface IframeMessage {
  type: string;
  token?: string;
  userId?: string;
  data?: any;
}

interface IframeIntegrationState {
  isEmbedded: boolean;
  parentOrigin: string | null;
  autoLogin: boolean;
}

export function useIframeIntegration() {
  const [state, setState] = useState<IframeIntegrationState>({
    isEmbedded: false,
    parentOrigin: null,
    autoLogin: false
  });

  useEffect(() => {
    // Detect if running in iframe
    const isEmbedded = window.self !== window.top;
    
    setState(prev => ({
      ...prev,
      isEmbedded,
      parentOrigin: isEmbedded ? document.referrer : null
    }));

    // Listen for messages from parent window (ISO Hub)
    const handleMessage = (event: MessageEvent<IframeMessage>) => {
      // Validate origin for security
      const allowedOrigins = [
        'https://iso-hub-domain.com',
        'https://your-main-saas.com'
      ];
      
      if (!allowedOrigins.includes(event.origin)) {
        console.warn('Ignored message from unauthorized origin:', event.origin);
        return;
      }

      const { type, token, userId, data } = event.data;

      switch (type) {
        case 'AUTH_TOKEN':
          if (token && userId) {
            // Auto-login user with provided token
            handleAutoLogin(token, userId);
          }
          break;
          
        case 'THEME_UPDATE':
          if (data?.theme) {
            // Apply parent theme to maintain consistency
            applyParentTheme(data.theme);
          }
          break;
          
        case 'RESIZE_REQUEST':
          if (data?.height) {
            // Notify parent of content height changes
            notifyParentOfResize(data.height);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Notify parent that JACC is ready
    if (isEmbedded) {
      sendMessageToParent({
        type: 'JACC_READY',
        data: { timestamp: Date.now() }
      });
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleAutoLogin = async (token: string, userId: string) => {
    try {
      // Implement token-based login
      const response = await fetch('/api/auth/sso-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, userId }),
      });

      if (response.ok) {
        setState(prev => ({ ...prev, autoLogin: true }));
        // Refresh the page to load authenticated state
        window.location.reload();
      }
    } catch (error) {
      console.error('Auto-login failed:', error);
    }
  };

  const applyParentTheme = (theme: any) => {
    // Apply theme variables to maintain visual consistency
    const root = document.documentElement;
    
    if (theme.primaryColor) {
      root.style.setProperty('--primary', theme.primaryColor);
    }
    if (theme.backgroundColor) {
      root.style.setProperty('--background', theme.backgroundColor);
    }
    if (theme.textColor) {
      root.style.setProperty('--foreground', theme.textColor);
    }
  };

  const sendMessageToParent = (message: any) => {
    if (state.isEmbedded && state.parentOrigin) {
      window.parent.postMessage(message, state.parentOrigin);
    }
  };

  const notifyParentOfResize = (height: number) => {
    sendMessageToParent({
      type: 'CONTENT_RESIZE',
      data: { height }
    });
  };

  const notifyParentOfNavigation = (path: string) => {
    sendMessageToParent({
      type: 'NAVIGATION_CHANGE',
      data: { path }
    });
  };

  return {
    ...state,
    sendMessageToParent,
    notifyParentOfResize,
    notifyParentOfNavigation
  };
}